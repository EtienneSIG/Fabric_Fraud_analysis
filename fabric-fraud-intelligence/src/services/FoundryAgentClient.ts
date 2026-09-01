import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';

import i18n from '@/i18n/i18n';

// Deploy-specific: everything is read from env so the app is tenant / resource-group / project
// agnostic and never authenticates against a foreign tenant. When the tenant, client or agent
// endpoint is missing, the direct Foundry path stays off and the deterministic mock runs — no MSAL
// popup, no cross-tenant sign-in.
const TENANT_ID = import.meta.env.VITE_FOUNDRY_TENANT_ID || '';
const CLIENT_ID = import.meta.env.VITE_FOUNDRY_CLIENT_ID || '';

// The agent endpoint is either given whole (VITE_FOUNDRY_AGENT_ENDPOINT) or composed from the
// account + project + agent name, so a new tenant/RG only needs those parts, not a full URL.
const FOUNDRY_ACCOUNT = import.meta.env.VITE_FOUNDRY_ACCOUNT || '';
const FOUNDRY_PROJECT = import.meta.env.VITE_FOUNDRY_PROJECT || '';
const FOUNDRY_AGENT_NAME = import.meta.env.VITE_FOUNDRY_AGENT_NAME || 'fraud-iq-orchestrator';
const AGENT_ENDPOINT =
  import.meta.env.VITE_FOUNDRY_AGENT_ENDPOINT ||
  (FOUNDRY_ACCOUNT && FOUNDRY_PROJECT
    ? `https://${FOUNDRY_ACCOUNT}.services.ai.azure.com/api/projects/${FOUNDRY_PROJECT}` +
      `/agents/${FOUNDRY_AGENT_NAME}/endpoint/protocols/openai/responses`
    : '');

const SCOPES = ['https://ai.azure.com/.default'];
const AUTH_REDIRECT_URI = `${window.location.origin}/msal-redirect.html`;

/** True only when this deployment wired its OWN Foundry agent (tenant + client + endpoint). */
export const foundryDirectConfigured = (): boolean =>
  Boolean(CLIENT_ID && TENANT_ID && AGENT_ENDPOINT);

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

let application: PublicClientApplication | undefined;
let initialization: Promise<void> | undefined;

function getApplication(): PublicClientApplication {
  if (!CLIENT_ID) {
    throw new Error('Foundry IQ is not configured. Set VITE_FOUNDRY_CLIENT_ID.');
  }
  if (!application) {
    application = new PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: AUTH_REDIRECT_URI,
      },
      cache: { cacheLocation: 'sessionStorage' },
    });
    initialization = application.initialize();
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
    prompt: 'select_account',
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
  const response = await fetch(AGENT_ENDPOINT, {
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