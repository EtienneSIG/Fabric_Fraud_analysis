// App-adjacent backend logic. Host-agnostic: runs on the Rayfin `functions` service (preferred,
// shares Fabric SSO/OBO) or on the Azure Function that hosts the Teams bot endpoint. Every real
// integration is guarded by config + the analyst's OBO token and falls back to a simulated result
// so the mock-first contract holds when nothing is wired.

import { DataLakeServiceClient } from '@azure/storage-file-datalake';
import { DefaultAzureCredential } from '@azure/identity';

import { env, graphOBO, foundryToken } from './shared.js';

export interface AgentRunRequest {
  agentName: string;
  prompt: string;
  context: { caseId?: string; alertId?: string; role?: string };
  locale: string;
}
export interface AgentReply {
  runId: string;
  text: string;
  generatedQuery: string;
  grounding: { title: string; source: string; confidence: number }[];
  mode: 'mock' | 'foundry';
}

const API_VERSION = '2025-11-15-preview';

/** Runs the Foundry triage orchestrator (delegates to connected agents, grounds on Fabric via
 *  conn-fabric-fraud-dataagent with OBO). */
export async function runAgent(req: AgentRunRequest, userToken: string | null): Promise<AgentReply> {
  const endpoint = env('AI_FOUNDRY_ENDPOINT');
  if (!endpoint) return { runId: `RUN-${Date.now()}`, text: '', generatedQuery: '', grounding: [], mode: 'mock' };
  try {
    const token = await foundryToken(userToken);
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/agents/fraud-triage-agent/runs?api-version=${API_VERSION}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: req.prompt, metadata: { ...req.context, locale: req.locale } }),
    });
    if (!res.ok) throw new Error(`Foundry run failed: ${res.status}`);
    const data = (await res.json()) as {
      id?: string;
      output_text?: string;
      tool_results?: { title?: string; source?: string; score?: number }[];
      generated_query?: string;
    };
    return {
      runId: data.id ?? `RUN-${Date.now()}`,
      text: data.output_text ?? '',
      generatedQuery: data.generated_query ?? '',
      grounding: (data.tool_results ?? []).map((g) => ({
        title: g.title ?? 'Fabric',
        source: g.source ?? 'fabric_dataagent',
        confidence: g.score ?? 0.8,
      })),
      mode: 'foundry',
    };
  } catch {
    return { runId: `RUN-${Date.now()}`, text: '', generatedQuery: '', grounding: [], mode: 'mock' };
  }
}

export interface WorkIqRequest {
  entityId: string;
  flavor: string;
  locale: string;
}
/** Surfaces Microsoft 365 work-graph signals via delegated Graph (OBO). */
export async function workIqSignals(req: WorkIqRequest, userToken: string | null): Promise<{ signals: string[] }> {
  if (!userToken) return { signals: [] };
  try {
    const graph = await graphOBO(userToken);
    const q = encodeURIComponent(`"${req.entityId}"`);
    const [mail, events, files] = await Promise.allSettled([
      graph.api(`/me/messages?$search=${q}&$top=2&$select=subject,from`).get(),
      graph.api('/me/events?$top=1&$select=subject,start').get(),
      graph.api(`/me/drive/root/search(q='${req.entityId}')?$top=2&$select=name,webUrl`).get(),
    ]);
    const signals: string[] = [];
    if (mail.status === 'fulfilled') for (const m of mail.value.value ?? []) signals.push(`Outlook: ${m.subject}`);
    if (events.status === 'fulfilled') for (const e of events.value.value ?? []) signals.push(`Calendar: ${e.subject}`);
    if (files.status === 'fulfilled') for (const f of files.value.value ?? []) signals.push(`SharePoint: ${f.name}`);
    return { signals };
  } catch {
    return { signals: [] };
  }
}

export interface TeamsCaseCard {
  caseId: string;
  alertId: string;
  title: string;
  summary: string;
  riskScore: number;
  actions: ('approve' | 'escalate' | 'dismiss')[];
  locale: string;
}
/** Posts an approval Adaptive Card to a Teams channel via Graph (OBO). */
export async function notifyTeams(card: TeamsCaseCard, userToken: string | null): Promise<{ delivered: boolean; simulated: boolean; messageId?: string }> {
  const teamId = env('TEAMS_TEAM_ID');
  const channelId = env('TEAMS_CHANNEL_ID');
  if (!userToken || !teamId || !channelId) return { delivered: false, simulated: true };
  try {
    const graph = await graphOBO(userToken);
    const body = {
      body: { contentType: 'html', content: `<attachment id="${card.caseId}"></attachment>` },
      attachments: [
        {
          id: card.caseId,
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: JSON.stringify(buildAdaptiveCard(card)),
        },
      ],
    };
    const sent = await graph.api(`/teams/${teamId}/channels/${channelId}/messages`).post(body);
    return { delivered: true, simulated: false, messageId: sent.id };
  } catch {
    return { delivered: false, simulated: true };
  }
}

function buildAdaptiveCard(card: TeamsCaseCard) {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      { type: 'TextBlock', size: 'Medium', weight: 'Bolder', text: card.title },
      { type: 'TextBlock', wrap: true, text: card.summary },
      { type: 'FactSet', facts: [{ title: 'Risk', value: card.riskScore.toFixed(2) }, { title: 'Case', value: card.caseId }] },
    ],
    actions: card.actions.map((a) => ({
      type: 'Action.Execute',
      title: a,
      verb: `decision:${a}`,
      data: { caseId: card.caseId, alertId: card.alertId, decision: a },
    })),
  };
}

export interface CaseDecision {
  caseId: string;
  decision: 'approve' | 'escalate' | 'dismiss';
  userId: string;
  rationale?: string;
  source: 'app' | 'teams';
}
/** Writes the analyst decision to OneLake and appends it to the retraining backlog, closing the
 *  alert→case→writeback→retraining loop. */
export async function upsertCaseDecision(d: CaseDecision): Promise<{ ok: boolean; simulated: boolean }> {
  const workspace = env('ONELAKE_WORKSPACE');
  const lakehouse = env('ONELAKE_LAKEHOUSE');
  if (!workspace || !lakehouse) return { ok: true, simulated: true };
  try {
    const service = new DataLakeServiceClient('https://onelake.dfs.fabric.microsoft.com', new DefaultAzureCredential());
    const fs = service.getFileSystemClient(workspace);
    const line = JSON.stringify({ ...d, at: new Date().toISOString() }) + '\n';
    const bytes = Buffer.byteLength(line);
    for (const table of ['decision_table', 'analyst_feedback_table', 'retraining_backlog']) {
      const file = fs.getFileClient(`${lakehouse}.Lakehouse/Files/${table}/${d.caseId}-${Date.now()}.jsonl`);
      await file.create();
      await file.append(line, 0, bytes);
      await file.flush(bytes);
    }
    return { ok: true, simulated: false };
  } catch {
    return { ok: false, simulated: true };
  }
}

export interface EmailReportRequest {
  caseId: string;
  to: string[];
  subject: string;
  body: string;
  locale: string;
}
export async function emailReport(req: EmailReportRequest, userToken: string | null): Promise<{ ok: boolean; simulated: boolean }> {
  if (!userToken) return { ok: false, simulated: true };
  try {
    const graph = await graphOBO(userToken);
    await graph.api('/me/sendMail').post({
      message: {
        subject: req.subject,
        body: { contentType: 'HTML', content: req.body },
        toRecipients: req.to.map((address) => ({ emailAddress: { address } })),
      },
    });
    return { ok: true, simulated: false };
  } catch {
    return { ok: false, simulated: true };
  }
}

export interface EvidenceUploadRequest {
  caseId: string;
  fileName: string;
  contentBase64: string;
  contentType: string;
}
export async function uploadEvidence(req: EvidenceUploadRequest, userToken: string | null): Promise<{ ok: boolean; simulated: boolean; url?: string }> {
  if (!userToken) return { ok: false, simulated: true };
  try {
    const graph = await graphOBO(userToken);
    const path = `/me/drive/root:/FraudCases/${req.caseId}/${req.fileName}:/content`;
    const uploaded = await graph.api(path).putStream(Buffer.from(req.contentBase64, 'base64'));
    return { ok: true, simulated: false, url: uploaded?.webUrl };
  } catch {
    return { ok: false, simulated: true };
  }
}
