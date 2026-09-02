// Container App entrypoint: a dependency-light Node HTTP server that exposes the SAME `/api/*`
// routes as the Azure Functions wrapper (functions.ts), reusing the identical host-agnostic
// handlers + Zod schemas. It exists so the browser SPA can reach the backend proxy over CORS
// (the Rayfin origin), which the hardened Function storage blocks from this workstation.
// The Web IQ live path only needs the analyst-supplied key (x-webiq-key) + network egress —
// no Azure identity — so this proxy unblocks the live regulatory search on its own.
import './otel.js';

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
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

const PORT = Number(process.env.PORT ?? 8080);

// CORS allow-list: explicit origins only (never `*`), because the SPA sends credentials:'include'
// which requires an exact-origin echo + Allow-Credentials. Override with CORS_ALLOWED_ORIGINS.
function allowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  return [
    'https://mild-falls-763438f7b8-swedencentral.webapp.fabricapps.net',
    'http://localhost:5173',
    'http://localhost:5199',
  ];
}

function applyCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  const allow = allowedOrigins();
  if (origin && (allow.includes('*') || allow.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-webiq-key, x-foundry-agent');
  res.setHeader('Access-Control-Max-Age', '600');
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined;
  }
}

function header(req: IncomingMessage, name: string): string | null {
  const v = req.headers[name];
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

type Parsed<S extends z.ZodTypeAny> = { ok: true; data: z.infer<S> } | { ok: false };
function parse<S extends z.ZodTypeAny>(schema: S, raw: unknown): Parsed<S> {
  const r = schema.safeParse(raw);
  return r.success ? { ok: true, data: r.data } : { ok: false };
}

const server = createServer(async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method ?? 'GET';
  const token = bearer(header(req, 'authorization'));

  try {
    if (method === 'GET' && (path === '/' || path === '/health' || path === '/api/health')) {
      return send(res, 200, { ok: true, service: 'fraudintel-backend' });
    }

    if (method === 'POST' && path === '/api/agents/run') {
      const p = parse(agentRunSchema, await readJson(req));
      if (!p.ok) return send(res, 400, { error: 'invalid request' });
      return send(res, 200, await runAgent(p.data, token, header(req, 'x-foundry-agent')));
    }

    if (method === 'GET' && path === '/api/workiq/signals') {
      return send(
        res,
        200,
        await workIqSignals(
          {
            entityId: url.searchParams.get('entityId') ?? '',
            flavor: url.searchParams.get('flavor') ?? 'generic',
            locale: url.searchParams.get('locale') ?? 'en',
          },
          token
        )
      );
    }

    if (method === 'POST' && path === '/api/webiq/search') {
      const p = parse(regulatoryWebSearchSchema, await readJson(req));
      if (!p.ok) return send(res, 400, { error: 'invalid request' });
      return send(res, 200, await regulatoryWebSearch(p.data, token, header(req, 'x-webiq-key')));
    }

    if (method === 'POST' && path === '/api/notify/teams') {
      const p = parse(teamsCardSchema, await readJson(req));
      if (!p.ok) return send(res, 400, { error: 'invalid request' });
      return send(res, 200, await notifyTeams(p.data, token));
    }

    if (method === 'POST' && path === '/api/cases/decision') {
      const p = parse(caseDecisionSchema, await readJson(req));
      if (!p.ok) return send(res, 400, { error: 'invalid request' });
      return send(res, 200, await upsertCaseDecision(p.data));
    }

    if (method === 'POST' && path === '/api/reports/email') {
      const p = parse(emailReportSchema, await readJson(req));
      if (!p.ok) return send(res, 400, { error: 'invalid request' });
      return send(res, 200, await emailReport(p.data, token));
    }

    if (method === 'POST' && path === '/api/evidence/upload') {
      const p = parse(evidenceUploadSchema, await readJson(req));
      if (!p.ok) return send(res, 400, { error: 'invalid request' });
      return send(res, 200, await uploadEvidence(p.data, token));
    }

    if (method === 'POST' && path === '/api/agents/runs/export') {
      const p = parse(agentRunExportSchema, await readJson(req));
      if (!p.ok) return send(res, 400, { error: 'invalid request' });
      return send(res, 200, await exportAgentRuns(p.data));
    }

    if (method === 'POST' && path === '/api/raft/compare') {
      const p = parse(raftCompareSchema, await readJson(req));
      if (!p.ok) return send(res, 400, { error: 'invalid request' });
      return send(res, 200, await raftCompare(p.data, token));
    }

    if (method === 'GET' && path === '/api/raft/eval') {
      return send(res, 200, await raftEval());
    }

    // Bot Framework messaging endpoint: an Action.Execute decision card writes back to OneLake.
    if (method === 'POST' && path === '/api/messages') {
      const activity = ((await readJson(req)) ?? {}) as {
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
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: 'not found', path });
  } catch (e) {
    console.error('[fraudintel:server]', e instanceof Error ? e.message : e);
    return send(res, 500, { error: 'internal error' });
  }
});

server.listen(PORT, () => console.log(`[fraudintel] backend proxy listening on :${PORT}`));
