import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';

import i18n from '@/i18n/i18n';
import { diag, startTimer } from '@/backend/diag';
import type { ProbeResult } from '@/backend/services/probe';
import { getAgentTimeoutMs } from '@/backend/services/generalSettings';
import {
  getForceDemo,
  getFoundryAgent,
  getFoundryClientId,
  getFoundryProjectEndpoint,
  getFoundryTenantId,
} from '@/backend/services/foundrySettings';

// Build-time defaults (VITE_FOUNDRY_*). At call time they are overridden by the analyst's own
// values entered in Settings (localStorage), so the direct Foundry IQ path can be pointed at any
// tenant / project / agent without a rebuild. When tenant + client + endpoint are all missing the
// path stays off and the deterministic mock runs — no MSAL popup, no cross-tenant sign-in.
const ENV_TENANT_ID = import.meta.env.VITE_FOUNDRY_TENANT_ID || '';
const ENV_CLIENT_ID = import.meta.env.VITE_FOUNDRY_CLIENT_ID || '';
const ENV_FOUNDRY_ACCOUNT = import.meta.env.VITE_FOUNDRY_ACCOUNT || '';
const ENV_FOUNDRY_PROJECT = import.meta.env.VITE_FOUNDRY_PROJECT || '';
const ENV_AGENT_NAME = import.meta.env.VITE_FOUNDRY_AGENT_NAME || 'fraud-iq-orchestrator';
const ENV_AGENT_ENDPOINT = import.meta.env.VITE_FOUNDRY_AGENT_ENDPOINT || '';
const AGENT_API_VERSION = '2025-11-15-preview';
// Specific delegated scope (not .default) so the analyst can consent interactively at sign-in when no
// admin consent is pre-granted for the SPA. Yields aud=https://ai.azure.com; RBAC gates the call.
const SCOPES = ['https://ai.azure.com/user_impersonation'];
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
// Web IQ runs the model's web_search tool and the account's model deployment is throttled (429s
// dominate under load), so the agent call retries transient statuses with jittered exponential
// backoff and honors a Retry-After header. Total wait stays bounded by the withTimeout cap.
const MAX_AGENT_ATTEMPTS = 3;
const RETRY_BASE_MS = 750;
const RETRY_MAX_MS = 8_000;
// Web IQ is an approval-gated MCP tool (default require_approval=always): the first response is an
// mcp_approval_request with no message, so we auto-approve and continue the turn up to this many rounds.
const MAX_MCP_ROUNDS = 3;
// gpt-5.6-terra is a reasoning model: reasoning + web_search tokens count against this budget, so it
// must be large enough to leave room for the final message (1200 left the response `incomplete`).
const OUTPUT_TOKEN_LIMIT = 6000;
const AUTH_REDIRECT_URI = `${window.location.origin}/msal-redirect.html`;
const POPUP_RELAY_URI = `${window.location.origin}/popup-relay.html`;

// Effective values: browser override (Settings) first, then build-time env.
const effectiveTenantId = (): string => getFoundryTenantId() || ENV_TENANT_ID;
const effectiveClientId = (): string => getFoundryClientId() || ENV_CLIENT_ID;
const effectiveAgentName = (): string => getFoundryAgent() || ENV_AGENT_NAME;

/** Composed agent responses endpoint (runtime project endpoint + agent, else the env fallbacks). */
export function effectiveAgentEndpoint(): string {
  const base =
    getFoundryProjectEndpoint() ||
    (ENV_FOUNDRY_ACCOUNT && ENV_FOUNDRY_PROJECT
      ? `https://${ENV_FOUNDRY_ACCOUNT}.services.ai.azure.com/api/projects/${ENV_FOUNDRY_PROJECT}`
      : '');
  if (base) {
    return `${base.replace(/\/+$/, '')}/agents/${effectiveAgentName()}/endpoint/protocols/openai/responses`;
  }
  return ENV_AGENT_ENDPOINT;
}

/** True only when the direct Foundry agent is fully wired (tenant + SPA client + endpoint). */
export const foundryDirectConfigured = (): boolean =>
  !getForceDemo() && Boolean(effectiveClientId() && effectiveTenantId() && effectiveAgentEndpoint());

/** Deterministic, localized grounding used when no direct Foundry agent is configured.
 *  Mirrors the deployed fraud-iq-orchestrator service prompt: facts (unverified) / obligations /
 *  human-validation actions, with one official citation — concise enough to fit the Foundry column. */
function mockFoundryAnswer(): FoundryAgentResult {
  const t = i18n.getFixedT(null, 'fraudIq');
  return {
    answer: t('mockAgentAnswer'),
    citations: [
      {
        title: 'ACPR — surveillance LCB-FT',
        url: 'https://acpr.banque-france.fr/fr/publications-et-statistiques/publications/dispositifs-automatises-de-surveillance-des-operations-en-matiere-de-lcb-ft',
      },
    ],
  };
}

interface FoundryAnnotation {
  type?: string;
  url?: string;
  title?: string;
}

interface FoundryContent {
  type?: string;
  text?: string;
  annotations?: FoundryAnnotation[];
}

interface FoundryOutput {
  type?: string;
  id?: string;
  server_label?: string;
  name?: string;
  content?: FoundryContent[];
}

interface FoundryResponse {
  id?: string;
  output?: FoundryOutput[];
  output_text?: string;
}

export interface FoundryCitation {
  title: string;
  url: string;
}

export interface FoundryAgentResult {
  answer: string;
  citations: FoundryCitation[];
  // True when a configured live agent failed/timed out and we fell back to the demo answer.
  degraded?: boolean;
}

export function getVersionedAgentEndpoint(endpoint: string): string {
  const url = new URL(endpoint);
  url.searchParams.set('api-version', AGENT_API_VERSION);
  return url.toString();
}

export type FoundryLocale = 'en' | 'fr' | 'es';

export function shouldRetryFoundryRequest(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

// Delay before the next attempt: honor Retry-After (seconds or HTTP-date) when the service sends it,
// else jittered exponential backoff. Capped so a burst of 429s can't blow past the request timeout.
export function foundryRetryDelayMs(retryAfter: string | null, attempt: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(Math.max(0, seconds) * 1000, RETRY_MAX_MS);
    const at = Date.parse(retryAfter);
    if (!Number.isNaN(at)) return Math.min(Math.max(0, at - Date.now()), RETRY_MAX_MS);
  }
  const backoff = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
  return backoff / 2 + Math.random() * (backoff / 2); // full-ish jitter
}

export function normalizeFoundryLocale(language?: string): FoundryLocale {
  if (language?.toLowerCase().startsWith('fr')) return 'fr';
  if (language?.toLowerCase().startsWith('es')) return 'es';
  return 'en';
}

// Pin the agent output locale and bound the response length (matches the deployed prompt contract).
export function buildFoundryRequest(question: string, language?: string) {
  const locale = normalizeFoundryLocale(language);
  return { input: `[OUTPUT_LOCALE=${locale}]\n${question}`, max_output_tokens: OUTPUT_TOKEN_LIMIT };
}

let application: PublicClientApplication | undefined;
let initialization: Promise<void> | undefined;
let appSignature = '';

function getApplication(): PublicClientApplication {
  const clientId = effectiveClientId();
  const tenantId = effectiveTenantId();
  if (!clientId) {
    throw new Error('Foundry IQ is not configured. Set the SPA client id in Settings.');
  }
  const signature = `${clientId}|${tenantId}`;
  if (!application || appSignature !== signature) {
    // The popup relay bridge is only needed when embedded in a cross-origin iframe (Fabric portal),
    // where COOP severs window.opener. In a standalone tab a plain synchronous popup is correct — the
    // relay there closes early and loses the response. Detect the context and configure accordingly.
    const embedded = window.self !== window.top;
    application = new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: AUTH_REDIRECT_URI,
        ...(embedded ? { popupRelayUri: POPUP_RELAY_URI } : {}),
      },
      cache: { cacheLocation: 'localStorage' },
      system: {
        // Synchronous popup: opens straight to the IdP in one window (also dodges popup blockers).
        navigatePopups: true,
        // Forward MSAL's own logs to the diag sink (console + App Insights) for span/telemetry deep-dive.
        loggerOptions: {
          piiLoggingEnabled: false,
          logLevel: 3,
          loggerCallback: (level: number, message: string) =>
            diag('msal', message, undefined, level === 0 ? 'error' : level === 1 ? 'warn' : 'info'),
        },
        ...(embedded ? { popupBridgeTimeout: 180_000, iframeBridgeTimeout: 30_000 } : {}),
      },
    });
    initialization = application.initialize();
    appSignature = signature;
  }
  return application;
}

async function getAccount(client: PublicClientApplication): Promise<AccountInfo> {
  await initialization;
  const existing = client.getActiveAccount() ?? client.getAllAccounts()[0];
  if (existing) {
    client.setActiveAccount(existing);
    return existing;
  }
  const login = await client.loginPopup({
    scopes: SCOPES,
    redirectUri: AUTH_REDIRECT_URI,
  });
  if (!login.account) throw new Error('Microsoft Entra sign-in returned no account.');
  client.setActiveAccount(login.account);
  return login.account;
}

export function requiresInteractiveAuth(error: unknown): boolean {
  return error instanceof InteractionRequiredAuthError ||
    (typeof error === 'object' && error !== null && 'errorCode' in error && error.errorCode === 'timed_out');
}

// Eagerly initializes MSAL at app start so the first sign-in popup opens inside the click gesture (a
// popup opened after an await is blocked and surfaces as `user_cancelled`). Also clears any stale
// redirect interaction state. Safe no-op when the direct agent is not configured.
export async function handleFoundryRedirect(): Promise<void> {
  if (!effectiveClientId()) return;
  try {
    const app = getApplication();
    await initialization;
    const result = await app.handleRedirectPromise();
    if (result?.account) app.setActiveAccount(result.account);
  } catch (error) {
    diag('foundryiq', 'redirect sign-in handling failed', error, 'error');
  }
}

async function getAccessToken(client: PublicClientApplication): Promise<string> {
  const account = await getAccount(client);
  const elapsed = startTimer();
  try {
    const token = await client.acquireTokenSilent({ account, scopes: SCOPES });
    diag('foundryiq', `token acquired silently in ${elapsed()}ms`, undefined, 'info');
    return token.accessToken;
  } catch (error) {
    if (!requiresInteractiveAuth(error)) {
      diag('foundryiq', 'silent token acquisition failed', error, 'error');
      throw error;
    }
    diag('foundryiq', 'silent token expired \u2192 interactive popup', undefined, 'info');
    const token = await client.acquireTokenPopup({
      account,
      scopes: SCOPES,
      redirectUri: AUTH_REDIRECT_URI,
    });
    diag('foundryiq', `token acquired via popup in ${elapsed()}ms`, undefined, 'info');
    return token.accessToken;
  }
}

export function extractFoundryAnswer(response: FoundryResponse): FoundryAgentResult {
  const contents = (response.output ?? []).flatMap((item) => item.content ?? []);
  const answer = response.output_text?.trim() || contents
    .filter((content) => content.type === 'output_text' && content.text)
    .map((content) => content.text?.trim())
    .filter(Boolean)
    .join('\n\n');
  const citations = contents
    .flatMap((content) => content.annotations ?? [])
    .filter((annotation): annotation is FoundryAnnotation & { url: string } =>
      annotation.type === 'url_citation' && Boolean(annotation.url)
    )
    .map((annotation) => ({
      title: annotation.title || new URL(annotation.url).hostname,
      url: annotation.url,
    }))
    .filter((citation, index, all) => all.findIndex((item) => item.url === citation.url) === index);

  return { answer, citations };
}

export function parseFoundryResponse(response: FoundryResponse): FoundryAgentResult {
  const result = extractFoundryAnswer(response);
  if (!result.answer) throw new Error('Foundry IQ returned an empty response.');
  return result;
}

class AgentTimeoutError extends Error {}

// A manual "Test connection" waits for the full reasoning round-trip (web_search + generation can
// take ~30-60s), so it is capped well above the demo-UX agent timeout.
const PROBE_TIMEOUT_MS = 90_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = window.setTimeout(() => reject(new AgentTimeoutError('Foundry IQ timed out.')), ms);
    promise.then(
      (value) => { window.clearTimeout(id); resolve(value); },
      (error) => { window.clearTimeout(id); reject(error); }
    );
  });
}

// Interactive MSAL sign-in is user-paced, so it is acquired separately and never under a timeout.
async function acquireAgentToken(): Promise<string> {
  return getAccessToken(getApplication());
}

// One POST to the responses endpoint, retrying transient statuses (incl. 429) with jittered backoff
// + Retry-After. Bounded by the withTimeout cap around callAgent.
async function sendResponses(endpoint: string, accessToken: string, payload: unknown): Promise<FoundryResponse> {
  const body = JSON.stringify(payload);
  for (let attempt = 0; attempt < MAX_AGENT_ATTEMPTS; attempt++) {
    const fetchElapsed = startTimer();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body,
    });
    diag('foundryiq', `agent HTTP ${response.status} in ${fetchElapsed()}ms`, undefined, response.ok ? 'info' : 'error');
    if (response.ok) return await response.json() as FoundryResponse;
    if (attempt < MAX_AGENT_ATTEMPTS - 1 && shouldRetryFoundryRequest(response.status)) {
      const wait = foundryRetryDelayMs(response.headers.get('retry-after'), attempt);
      diag('foundryiq', `HTTP ${response.status} → retry ${attempt + 1}/${MAX_AGENT_ATTEMPTS - 1} in ${Math.round(wait)}ms`, undefined, 'warn');
      await new Promise((resolve) => window.setTimeout(resolve, wait));
      continue;
    }
    const details = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
    throw new Error(details?.error?.message || `Foundry IQ request failed (${response.status}).`);
  }
  throw new Error('Foundry IQ request failed.');
}

// The agent round-trip — safe to cap with a timeout. Auto-approves the approval-gated Web IQ MCP
// tool: an mcp_approval_request (no message) is answered with an mcp_approval_response so the agent
// runs the tool and returns the final answer, all within the same withTimeout cap.
async function callAgent(question: string, accessToken: string, language?: string): Promise<FoundryAgentResult> {
  const endpoint = getVersionedAgentEndpoint(effectiveAgentEndpoint());
  const host = new URL(endpoint).host;
  diag('foundryiq', `direct agent call → ${host} (agent ${effectiveAgentName()})`, undefined, 'info');

  let payload: Record<string, unknown> = buildFoundryRequest(question, language);
  for (let round = 0; round < MAX_MCP_ROUNDS; round++) {
    const raw = await sendResponses(endpoint, accessToken, payload);
    const result = extractFoundryAnswer(raw);
    if (result.answer) {
      diag('foundryiq', `parsed answer (${result.answer.length} chars, ${result.citations.length} citations)`, undefined, 'info');
      return result;
    }
    const approvals = (raw.output ?? []).filter((o) => o.type === 'mcp_approval_request' && o.id);
    if (approvals.length && raw.id) {
      diag('foundryiq', `auto-approving ${approvals.length} MCP call(s): ${approvals.map((a) => `${a.server_label ?? '?'}/${a.name ?? '?'}`).join(', ')}`, undefined, 'info');
      payload = {
        previous_response_id: raw.id,
        input: approvals.map((a) => ({ type: 'mcp_approval_response', approval_request_id: a.id, approve: true })),
        max_output_tokens: OUTPUT_TOKEN_LIMIT,
      };
      continue;
    }
    break; // completed with no message and nothing to approve
  }
  throw new Error('Foundry IQ returned an empty response.');
}

export async function askFoundryAgent(question: string, language?: string): Promise<FoundryAgentResult> {
  if (!foundryDirectConfigured()) {
    diag('foundryiq', 'direct agent not configured → deterministic demo answer', undefined, 'info');
    return mockFoundryAnswer();
  }
  const elapsed = startTimer();
  // Only the agent round-trip is capped (runtime-tunable); the sign-in popup is not, so a first-time
  // interactive login can't trip the timeout.
  const timeoutMs = getAgentTimeoutMs();
  try {
    const token = await acquireAgentToken();
    const result = await withTimeout(callAgent(question, token, language), timeoutMs);
    diag('foundryiq', `direct agent completed in ${elapsed()}ms`, undefined, 'info');
    return result;
  } catch (error) {
    // Any failure (timeout, cancelled sign-in, 403, network) degrades to the deterministic demo
    // answer so the pillar never stalls. The real reason is logged and still surfaced by the
    // Settings "Test connection" probe (which calls the agent directly and does throw).
    const reason = error instanceof AgentTimeoutError
      ? `timed out after ${timeoutMs}ms`
      : error instanceof Error ? error.message : String(error);
    diag('foundryiq', `direct agent failed (${reason}) after ${elapsed()}ms → demo answer`, error, 'error');
    return { ...mockFoundryAnswer(), degraded: true };
  }
}

/** On-demand connectivity probe for the direct SPA path: signs in and pings the agent so the
 *  Settings "Test connection" button reflects the tenant / client / endpoint just entered, instead
 *  of the backend-proxy path. Sign-in is not timed (user-paced); only the agent round-trip is, so a
 *  first interactive login reports the real result rather than a spurious timeout. */
export async function probeFoundryDirect(): Promise<ProbeResult> {
  if (getForceDemo()) return { state: 'off', detail: 'Force demo enabled' };
  if (!foundryDirectConfigured()) return { state: 'off', detail: 'Direct agent not configured' };
  const elapsed = startTimer();
  try {
    const token = await acquireAgentToken();
    await withTimeout(callAgent('ping', token), PROBE_TIMEOUT_MS);
    const detail = `direct · ${elapsed()} ms`;
    diag('foundryiq', `probe -> live (${detail})`, undefined, 'info');
    return { state: 'live', detail };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    diag('foundryiq', `probe -> unreachable (${detail})`, error, 'error');
    return { state: 'unreachable', detail };
  }
}