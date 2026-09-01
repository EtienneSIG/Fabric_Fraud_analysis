import './otel.js';

import { app, type HttpRequest, type HttpResponseInit } from '@azure/functions';
import type { z } from 'zod';

import {
  runAgent,
  workIqSignals,
  regulatoryWebSearch,
  notifyTeams,
  upsertCaseDecision,
  emailReport,
  uploadEvidence,
  exportAgentRuns,
  raftCompare,
  raftEval,
} from './handlers.js';
import { bearer } from './shared.js';
import {
  agentRunSchema,
  teamsCardSchema,
  caseDecisionSchema,
  emailReportSchema,
  evidenceUploadSchema,
  agentRunExportSchema,
  raftCompareSchema,
  regulatoryWebSearchSchema,
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
    return p.ok ? json(200, await runAgent(p.data, userToken(req), req.headers.get('x-foundry-agent'))) : p.res;
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

// Web IQ regulatory grounding: domain-scoped, PII-free web search over official sources.
app.http('webiqSearch', {
  route: 'webiq/search',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const p = await parse(req, regulatoryWebSearchSchema);
    return p.ok
      ? json(200, await regulatoryWebSearch(p.data, userToken(req), req.headers.get('x-webiq-key')))
      : p.res;
  },
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

// Exports AgentRun traces into the RAFT seed-question format (WS-5). Read-only; PII scrubbed.
app.http('agentsRunsExport', {
  route: 'agents/runs/export',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const p = await parse(req, agentRunExportSchema);
    return p.ok ? json(200, await exportAgentRuns(p.data)) : p.res;
  },
});

// RAFT A/B: same AML question against baseline vs the fine-tuned student (real or deterministic mock).
app.http('raftCompare', {
  route: 'raft/compare',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const p = await parse(req, raftCompareSchema);
    return p.ok ? json(200, await raftCompare(p.data, userToken(req))) : p.res;
  },
});

// RAFT evaluation summary for the Model Quality tab (live OneLake results or committed sample).
app.http('raftEval', {
  route: 'raft/eval',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async () => json(200, await raftEval()),
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
