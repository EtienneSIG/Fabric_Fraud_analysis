// App-adjacent backend logic. Host-agnostic: runs on the Rayfin `functions` service (preferred,
// shares Fabric SSO/OBO) or on the Azure Function that hosts the Teams bot endpoint. Every real
// integration is guarded by config + the analyst's OBO token and falls back to a simulated result
// so the mock-first contract holds when nothing is wired.

import { DataLakeServiceClient } from '@azure/storage-file-datalake';
import { DefaultAzureCredential } from '@azure/identity';

import { env, graphOBO, foundryToken, cognitiveToken, webIqToken, getSecret, logError, scrubPII } from './shared.js';

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

// Foundry Agents run over the Responses API (POST {project}/openai/v1/responses with an
// agent_reference). Overridable so ops can point at the exact project endpoint / agent name.
const FOUNDRY_ORCHESTRATOR = env('FOUNDRY_ORCHESTRATOR_AGENT') || 'fraud-triage-agent';

// Response `output` items: assistant messages carry output_text content (+ url_citation annotations);
// tool-call items surface the tools the agent invoked. See learn.microsoft.com Responses API.
interface ResponseAnnotation {
  type?: string;
  url?: string;
  title?: string;
}
interface ResponseContent {
  type?: string;
  text?: string;
  annotations?: ResponseAnnotation[];
}
interface ResponseItem {
  type?: string;
  role?: string;
  name?: string;
  content?: ResponseContent[];
}

/** Runs the Foundry triage orchestrator (delegates to connected agents, grounds on Fabric via
 *  conn-fabric-fraud-dataagent with OBO) through the Responses API. */
export async function runAgent(req: AgentRunRequest, userToken: string | null): Promise<AgentReply> {
  const endpoint = env('FOUNDRY_PROJECT_ENDPOINT') || env('AI_FOUNDRY_ENDPOINT');
  if (!endpoint) return { runId: `RUN-${Date.now()}`, text: '', generatedQuery: '', grounding: [], mode: 'mock' };
  try {
    const token = await foundryToken(userToken);
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/openai/v1/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_reference: { type: 'agent_reference', name: FOUNDRY_ORCHESTRATOR },
        input: req.prompt,
        metadata: { ...req.context, locale: req.locale },
      }),
    });
    if (!res.ok) throw new Error(`Foundry response failed: ${res.status}`);
    const data = (await res.json()) as { id?: string; output_text?: string; output?: ResponseItem[] };
    const output = data.output ?? [];
    const messages = output.filter((i) => i.type === 'message').flatMap((i) => i.content ?? []);
    const text =
      data.output_text ??
      messages
        .filter((c) => c.type === 'output_text')
        .map((c) => c.text ?? '')
        .join('\n');

    const grounding: AgentReply['grounding'] = [];
    for (const item of output) {
      for (const c of item.content ?? []) {
        for (const a of c.annotations ?? []) {
          if (a.type === 'url_citation' && a.url) grounding.push({ title: a.title ?? a.url, source: 'web', confidence: 0.9 });
        }
      }
      // Tool-call items (e.g. fabric_dataagent_call, mcp_call) expose which tools grounded the answer.
      if (item.type && item.type.endsWith('_call')) {
        grounding.push({ title: item.name ?? item.type, source: item.type, confidence: 0.8 });
      }
    }

    return { runId: data.id ?? `RUN-${Date.now()}`, text, generatedQuery: '', grounding, mode: 'foundry' };
  } catch (e) {
    logError('foundry', e, { caseId: req.context.caseId });
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
  } catch (e) {
    logError('workiq', e, { entityId: req.entityId });
    return { signals: [] };
  }
}

export interface RegulatoryWebSearchRequest {
  query: string;
  caseId?: string;
  locale: string;
}
export interface RegulatoryCitation {
  title: string;
  url: string;
  snippet: string;
}
export interface RegulatoryWebSearchReply {
  citations: RegulatoryCitation[];
  mode: 'mock' | 'webiq';
}

const WEBIQ_SEARCH_URL = 'https://api.microsoft.ai/v3/search/web';

function officialDomains(): string[] {
  return env('WEBIQ_OFFICIAL_DOMAINS')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function hostAllowed(url: string, domains: string[]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/** Web IQ regulatory grounding: builds a domain-scoped, PII-free web query, restricts results to the
 *  official-domain allow-list server-side, and returns citations. Entra ID app-only token, API-key
 *  fallback, deterministic mock when neither credential is configured. Advisory only (HITL). */
export async function regulatoryWebSearch(
  req: RegulatoryWebSearchRequest,
  _userToken: string | null
): Promise<RegulatoryWebSearchReply> {
  const domains = officialDomains();
  const safeQuery = scrubPII(req.query).slice(0, 400);
  const siteScope = domains.length ? ` (${domains.map((d) => `site:${d}`).join(' OR ')})` : '';
  const query = `${safeQuery}${siteScope}`.slice(0, 1000);

  const token = await webIqToken().catch(() => '');
  const apiKey = token ? '' : await getSecret(env('WEBIQ_API_KEY_SECRET_NAME') || 'webiq-api-key').catch(() => '');
  if (!token && !apiKey) return { citations: mockCitations(domains, req.locale), mode: 'mock' };

  try {
    const res = await fetch(WEBIQ_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : { 'x-apikey': apiKey }),
      },
      body: JSON.stringify({
        query,
        maxResults: 10,
        language: req.locale,
        contentFormat: 'passage',
        maxLength: 1200,
      }),
    });
    if (!res.ok) throw new Error(`Web IQ search failed: ${res.status}`);
    const data = (await res.json()) as {
      webResults?: { title?: string; url?: string; content?: string }[];
    };
    const citations = (data.webResults ?? [])
      .filter((r) => r.url && (domains.length === 0 || hostAllowed(r.url, domains)))
      .map((r) => ({ title: r.title ?? r.url ?? '', url: r.url ?? '', snippet: r.content ?? '' }));
    return { citations, mode: 'webiq' };
  } catch (e) {
    logError('webiq', e, { caseId: req.caseId });
    return { citations: mockCitations(domains, req.locale), mode: 'mock' };
  }
}

// Deterministic offline stand-in so the Web IQ pillar renders without a configured credential.
function mockCitations(domains: string[], locale: string): RegulatoryCitation[] {
  const src = domains.length ? domains : ['eur-lex.europa.eu', 'acpr.banque-france.fr'];
  const fr = locale.startsWith('fr');
  return src.slice(0, 3).map((d) => ({
    title: fr ? `Obligation réglementaire — ${d}` : `Regulatory obligation — ${d}`,
    url: `https://${d}/`,
    snippet: fr
      ? 'Source officielle : détection et déclaration des opérations suspectes (référence simulée).'
      : 'Official source: detection and reporting of suspicious activity (simulated reference).',
  }));
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
  } catch (e) {
    logError('teams', e, { caseId: card.caseId });
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
  } catch (e) {
    logError('onelake', e, { caseId: d.caseId });
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
  } catch (e) {
    logError('email', e, { caseId: req.caseId });
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
  } catch (e) {
    logError('evidence', e, { caseId: req.caseId });
    return { ok: false, simulated: true };
  }
}

export interface AgentRunExportRequest {
  domain: string;
  limit: number;
}
export interface RaftSeedQuestion {
  id: string;
  question: string;
  domain: string;
}
export interface AgentRunExportResult {
  ok: boolean;
  simulated: boolean;
  domain: string;
  count: number;
  questions: RaftSeedQuestion[];
}

// Deterministic AML seed used when no OneLake trace store is wired — keeps the export
// re-runnable offline and gives 1_gen.ipynb a defensible synthetic fallback.
const SYNTHETIC_AML_QUESTIONS: readonly string[] = [
  'Is this pattern of sub-threshold cash deposits structuring or smurfing, and which rule was breached?',
  'Three customers credited one beneficiary with cash under the reporting limit in a week — what typology is this?',
  'Assess these rapid pass-through transfers for layering and state whether the case is SAR-ready.',
  'The invoice unit price is 40% above the reference band — is this trade-based money laundering?',
  'Given the customer risk rating, is this velocity alert consistent with expected activity?',
  'Draft the subject, typology, pattern, assessment and recommendation for this AML alert.',
  'A cash-intensive business shows deposits inconsistent with footfall — which stage of laundering is this?',
  'The account belongs to a PEP with unexplained inflows — how does that change the assessment?',
  'These correspondent-banking hops obscure the originator — is layering the right typology to cite?',
  'Dormant account reactivated with high-value wires — is this SAR-ready and what rule fired?',
  'Distinguish structuring from smurfing for this set of deposits and cite the exact threshold.',
  'Should this alert be escalated to the nominated officer, and what is the exculpatory analysis?',
];

function toSeed(domain: string, id: string, question: string): RaftSeedQuestion {
  return { id, question: scrubPII(question), domain };
}

function isDomainMatch(domain: string, agentName: string, prompt: string): boolean {
  if (domain !== 'aml') return true;
  return /aml|sar|launder|structur|smurf|layering/i.test(`${agentName} ${prompt}`);
}

/** Exports AgentRun traces into the RAFT seed-question format (WS-5). Reads newline-delimited
 *  AgentRun records from OneLake when configured, filters to the domain, scrubs PII, and is
 *  deterministic. Falls back to a synthetic AML seed offline so 1_gen.ipynb always has input. */
export async function exportAgentRuns(req: AgentRunExportRequest): Promise<AgentRunExportResult> {
  const domain = req.domain || 'aml';
  const synthetic = (): AgentRunExportResult => {
    const questions = SYNTHETIC_AML_QUESTIONS.slice(0, req.limit).map((q, i) =>
      toSeed(domain, `SEED-AML-${String(i + 1).padStart(3, '0')}`, q)
    );
    return { ok: true, simulated: true, domain, count: questions.length, questions };
  };

  const workspace = env('ONELAKE_WORKSPACE');
  const lakehouse = env('ONELAKE_LAKEHOUSE');
  if (!workspace || !lakehouse) return synthetic();

  try {
    const service = new DataLakeServiceClient('https://onelake.dfs.fabric.microsoft.com', new DefaultAzureCredential());
    const fs = service.getFileSystemClient(workspace);
    const file = fs.getFileClient(`${lakehouse}.Lakehouse/Files/agent_run/agent_run.jsonl`);
    const download = await file.read();
    const body = await streamToString(download.readableStreamBody);
    const runs = body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { id?: string; agentName?: string; prompt?: string })
      .filter((r) => r.prompt && isDomainMatch(domain, r.agentName ?? '', r.prompt))
      .sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''))
      .slice(0, req.limit)
      .map((r, i) => toSeed(domain, r.id ?? `RUN-${i}`, r.prompt as string));
    return { ok: true, simulated: false, domain, count: runs.length, questions: runs };
  } catch (e) {
    logError('agentrun-export', e, { domain });
    return synthetic();
  }
}

async function streamToString(stream: NodeJS.ReadableStream | null | undefined): Promise<string> {
  if (!stream) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

// ---- RAFT A/B compare (WS-6/WS-9) -----------------------------------------------------------
// System message MUST be identical to the one used in training (foundry/raft, raft.instructions.md).
const RAFT_SYSTEM =
  'You are an AML analyst assistant. Answer only from the provided documents. ' +
  'Cite the exact typology and rule. If the documents do not support an answer, say so. ' +
  'Output is advisory; a human must approve any filing.';

export interface RaftCompareRequest {
  prompt: string;
  subject: string;
  context: { caseId?: string; alertId?: string; role?: string };
  locale: string;
}
export interface RaftAnswer {
  label: 'baseline' | 'raft';
  model: string;
  text: string;
  grounding: { title: string; source: string; confidence: number }[];
  tokens: number;
  latencyMs: number;
}
export interface RaftComparison {
  baseline: RaftAnswer;
  raft: RaftAnswer;
  mode: 'mock' | 'foundry';
}

// Deterministic contrast used offline / when no student deployment is wired. Mirrors the app's
// RaftModelClient.mockCompare so the demo peak is identical whether or not a backend is present.
function mockCompare(req: RaftCompareRequest): RaftComparison {
  const subject = req.subject || 'the subject account';
  return {
    mode: 'mock',
    baseline: {
      label: 'baseline',
      model: 'gpt-4.1 (baseline)',
      text:
        'This account shows unusual movements that may indicate money laundering. Several transfers ' +
        'occur between linked accounts over a short period. It could be layering or possibly ' +
        'structuring. Recommend an analyst review the activity and decide whether to escalate.',
      grounding: [{ title: 'Transactions', source: 'fabric_dataagent', confidence: 0.61 }],
      tokens: 1850,
      latencyMs: 2200,
    },
    raft: {
      label: 'raft',
      model: 'gpt-4.1-mini · RAFT (AML)',
      text:
        `Subject: ${subject}\n` +
        'Typology: Layering — proceeds separated from origin through rapid pass-through transfers, ' +
        'not structuring (which is threshold avoidance by a single actor).\n' +
        'Pattern: Three pass-through hops within 48h, inbound and outbound amounts matched within 2%.\n' +
        'Assessment: Meets the layering monitoring rule (≥3 hops, in/out within 2%, held <48h) and is ' +
        "inconsistent with the customer's expected profile.\n" +
        'Recommendation: SAR-ready — escalate to the nominated officer. Advisory; human approval required.',
      grounding: [
        { title: 'aml/layering.md', source: 'foundry_iq', confidence: 0.92 },
        { title: 'transaction_monitoring_thresholds', source: 'fabric_dataagent', confidence: 0.88 },
      ],
      tokens: 1200,
      latencyMs: 1400,
    },
  };
}

// Azure OpenAI api-version (env-overridable). The default supports gpt-5 / o-series reasoning
// models (max_completion_tokens, reasoning_effort) as well as classic gpt-4.1 / gpt-4o.
const AOAI_API_VERSION = env('AOAI_API_VERSION') || '2025-04-01-preview';

// Reasoning models (o-series, gpt-5 family) reject `temperature` and use `max_completion_tokens`;
// classic chat models (gpt-4.1, gpt-4o) take `temperature`. Detection is by model family name.
function isReasoningModel(name: string): boolean {
  const m = name.toLowerCase();
  return /^o[1-9]/.test(m) || /gpt-5/.test(m);
}

// One Azure OpenAI chat completion against a named deployment; adapts the request body to the model
// family. `modelHint` carries the underlying model id when the deployment name is an opaque alias.
// Returns text + token usage + latency.
async function chatOnce(
  endpoint: string,
  deployment: string,
  prompt: string,
  token: string,
  modelHint?: string
): Promise<{ text: string; tokens: number; latencyMs: number }> {
  const reasoning = isReasoningModel(modelHint ?? deployment);
  const body: Record<string, unknown> = {
    messages: [
      { role: 'system', content: RAFT_SYSTEM },
      { role: 'user', content: prompt },
    ],
    max_completion_tokens: 2000,
  };
  if (reasoning) {
    const effort = env('AOAI_REASONING_EFFORT');
    if (effort) body.reasoning_effort = effort;
  } else {
    body.temperature = 0.2;
  }
  const started = Date.now();
  const res = await fetch(
    `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${AOAI_API_VERSION}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`AOAI ${deployment} failed: ${res.status}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    tokens: data.usage?.total_tokens ?? 0,
    latencyMs: Date.now() - started,
  };
}

/** RAFT A/B: runs the AML question against the baseline and the fine-tuned student deployment.
 *  Real path when AI_FOUNDRY_ENDPOINT + RAFT_STUDENT_DEPLOYMENT are set; otherwise a deterministic
 *  mock so the demo peak works offline (mock-first contract). */
export async function raftCompare(req: RaftCompareRequest, userToken: string | null): Promise<RaftComparison> {
  const endpoint = env('AI_FOUNDRY_ENDPOINT');
  const student = env('RAFT_STUDENT_DEPLOYMENT');
  const baselineDep = env('RAFT_BASELINE_DEPLOYMENT') || 'gpt-4.1';
  if (!endpoint || !student) return mockCompare(req);
  try {
    const token = await cognitiveToken(userToken);
    // Underlying model ids (env-overridable) so chatOnce can adapt classic vs reasoning params
    // even when the deployment name is an opaque alias.
    const baselineModel = env('RAFT_BASELINE_MODEL') || baselineDep;
    const studentModel = env('RAFT_STUDENT_MODEL') || student;
    const [b, r] = await Promise.all([
      chatOnce(endpoint, baselineDep, req.prompt, token, baselineModel),
      chatOnce(endpoint, student, req.prompt, token, studentModel),
    ]);
    return {
      mode: 'foundry',
      baseline: {
        label: 'baseline',
        model: `${baselineDep} (baseline)`,
        text: b.text,
        grounding: [{ title: baselineDep, source: 'foundry', confidence: 0.75 }],
        tokens: b.tokens,
        latencyMs: b.latencyMs,
      },
      raft: {
        label: 'raft',
        model: `${student} · RAFT (AML)`,
        text: r.text,
        grounding: [{ title: student, source: 'foundry', confidence: 0.9 }],
        tokens: r.tokens,
        latencyMs: r.latencyMs,
      },
    };
  } catch (e) {
    logError('raft-compare', e, { caseId: req.context.caseId });
    return mockCompare(req);
  }
}

// ---- RAFT evaluation (WS-7) -----------------------------------------------------------------
export interface RaftEvalMetrics {
  groundedness: number;
  retrieval_quality: number;
  relevance: number;
  tokens_per_investigation: number;
  latency_ms: number;
  cost_per_1000: number;
}
export interface RaftEvaluation {
  generated_at: string;
  live: boolean;
  baseline_model: string;
  student_deployment: string;
  n_questions: number;
  summary: { baseline: RaftEvalMetrics; raft: RaftEvalMetrics };
}

// Committed sample mirrors foundry/raft/eval/results/sample.json and the app's SAMPLE_EVALUATION,
// so the Model Quality tab renders identically offline.
const SAMPLE_EVALUATION: RaftEvaluation = {
  generated_at: '2026-08-31T07:55:51Z',
  live: false,
  baseline_model: 'gpt-4.1',
  student_deployment: 'raft-student',
  n_questions: 8,
  summary: {
    baseline: { groundedness: 0.675, retrieval_quality: 0.668, relevance: 0.668, tokens_per_investigation: 1850, latency_ms: 2200, cost_per_1000: 18.5 },
    raft: { groundedness: 0.881, retrieval_quality: 0.879, relevance: 0.874, tokens_per_investigation: 1200, latency_ms: 1400, cost_per_1000: 4.8 },
  },
};

/** Returns the baseline-vs-RAFT evaluation for the Model Quality tab. Reads the latest results
 *  written by foundry/raft/eval to OneLake when configured; otherwise the committed sample. */
export async function raftEval(): Promise<RaftEvaluation> {
  const workspace = env('ONELAKE_WORKSPACE');
  const lakehouse = env('ONELAKE_LAKEHOUSE');
  if (!workspace || !lakehouse) return SAMPLE_EVALUATION;
  try {
    const service = new DataLakeServiceClient('https://onelake.dfs.fabric.microsoft.com', new DefaultAzureCredential());
    const fs = service.getFileSystemClient(workspace);
    const file = fs.getFileClient(`${lakehouse}.Lakehouse/Files/raft/eval/results/latest.json`);
    const download = await file.read();
    const body = await streamToString(download.readableStreamBody);
    const parsed = JSON.parse(body) as RaftEvaluation;
    return { ...parsed, live: true };
  } catch (e) {
    logError('raft-eval', e, {});
    return SAMPLE_EVALUATION;
  }
}
