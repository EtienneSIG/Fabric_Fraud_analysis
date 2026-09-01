import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';

import i18n from '@/i18n/i18n';
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
const SCOPES = ['https://ai.azure.com/.default'];
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

/** Deterministic, localized grounding used when no direct Foundry agent is configured. */
function mockFoundryAnswer(): FoundryAgentResult {
  const t = i18n.getFixedT(null, 'fraudIq');
  return { answer: t('synthesis.generic.rationale'), citations: [] };
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
  content?: FoundryContent[];
}

interface FoundryResponse {
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
}

export function getVersionedAgentEndpoint(endpoint: string): string {
  const url = new URL(endpoint);
  url.searchParams.set('api-version', AGENT_API_VERSION);
  return url.toString();
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
    application = new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: AUTH_REDIRECT_URI,
        popupRelayUri: POPUP_RELAY_URI,
      },
      cache: { cacheLocation: 'localStorage' },
      system: {
        popupBridgeTimeout: 180_000,
        iframeBridgeTimeout: 30_000,
        navigatePopups: true,
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

async function getAccessToken(client: PublicClientApplication): Promise<string> {
  const account = await getAccount(client);
  try {
    const token = await client.acquireTokenSilent({ account, scopes: SCOPES });
    return token.accessToken;
  } catch (error) {
    if (!requiresInteractiveAuth(error)) throw error;
    const token = await client.acquireTokenPopup({
      account,
      scopes: SCOPES,
      redirectUri: AUTH_REDIRECT_URI,
    });
    return token.accessToken;
  }
}

export function parseFoundryResponse(response: FoundryResponse): FoundryAgentResult {
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

  if (!answer) throw new Error('Foundry IQ returned an empty response.');
  return { answer, citations };
}

export async function askFoundryAgent(question: string): Promise<FoundryAgentResult> {
  if (!foundryDirectConfigured()) return mockFoundryAnswer();
  const client = getApplication();
  const accessToken = await getAccessToken(client);
  const response = await fetch(getVersionedAgentEndpoint(effectiveAgentEndpoint()), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: question }),
  });

  if (!response.ok) {
    const details = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
    throw new Error(details?.error?.message || `Foundry IQ request failed (${response.status}).`);
  }
  return parseFoundryResponse(await response.json() as FoundryResponse);
}