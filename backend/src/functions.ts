import './otel.js';

import { app, type HttpRequest, type HttpResponseInit } from '@azure/functions';
import type { z } from 'zod';

import {
  runAgent,
  workIqSignals,
  notifyTeams,
  upsertCaseDecision,
  emailReport,
  uploadEvidence,
} from './handlers.js';
import { bearer } from './shared.js';
import {
  agentRunSchema,
  teamsCardSchema,
  caseDecisionSchema,
  emailReportSchema,
  evidenceUploadSchema,
} from './schemas.js';

const json = (status: number, body: unknown): HttpResponseInit => ({
  status,
  jsonBody: body,
  headers: { 'Content-Type': 'application/json' },
});

const userToken = (req: HttpRequest): string | null => bearer(req.headers.get('authorization'));

// Validates the JSON body against a Zod schema; returns 400 on failure.
async function parse<S extends z.ZodTypeAny>(
  req: HttpRequest,
  schema: S
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; res: HttpResponseInit }> {
  const result = schema.safeParse(await req.json().catch(() => undefined));
  if (!result.success) {
    return { ok: false, res: json(400, { error: 'invalid request', issues: result.error.issues }) };
  }
  return { ok: true, data: result.data };
}

app.http('agentsRun', {
  route: 'agents/run',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const p = await parse(req, agentRunSchema);
    return p.ok ? json(200, await runAgent(p.data, userToken(req))) : p.res;
  },
});

app.http('workiqSignals', {
  route: 'workiq/signals',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (req) =>
    json(200, await workIqSignals({
      entityId: req.query.get('entityId') ?? '',
      flavor: req.query.get('flavor') ?? 'generic',
      locale: req.query.get('locale') ?? 'en',
    }, userToken(req))),
});

app.http('notifyTeams', {
  route: 'notify/teams',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const p = await parse(req, teamsCardSchema);
    return p.ok ? json(200, await notifyTeams(p.data, userToken(req))) : p.res;
  },
});

app.http('casesDecision', {
  route: 'cases/decision',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const p = await parse(req, caseDecisionSchema);
    return p.ok ? json(200, await upsertCaseDecision(p.data)) : p.res;
  },
});

app.http('reportsEmail', {
  route: 'reports/email',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const p = await parse(req, emailReportSchema);
    return p.ok ? json(200, await emailReport(p.data, userToken(req))) : p.res;
  },
});

app.http('evidenceUpload', {
  route: 'evidence/upload',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const p = await parse(req, evidenceUploadSchema);
    return p.ok ? json(200, await uploadEvidence(p.data, userToken(req))) : p.res;
  },
});

// Bot Framework messaging endpoint. On an Action.Execute approve/escalate/dismiss card action,
// write the decision back to OneLake (closing the loop). Full auth belongs to the Bot adapter.
app.http('messages', {
  route: 'messages',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const activity = (await req.json().catch(() => ({}))) as {
      value?: { action?: { verb?: string; data?: { caseId?: string; decision?: string } } };
      from?: { id?: string };
    };
    const action = activity.value?.action;
    if (action?.verb?.startsWith('decision:') && action.data?.caseId) {
      await upsertCaseDecision({
        caseId: action.data.caseId,
        decision: (action.data.decision as 'approve' | 'escalate' | 'dismiss') ?? 'approve',
        userId: activity.from?.id ?? 'teams-user',
        source: 'teams',
      });
    }
    return json(200, { ok: true });
  },
});
