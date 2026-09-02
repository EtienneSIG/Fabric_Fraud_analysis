import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';

const TENANT_ID = import.meta.env.VITE_FOUNDRY_TENANT_ID || 'b7b9a0c6-fe36-41b6-a38d-582c6573e2ff';
const CLIENT_ID = import.meta.env.VITE_FOUNDRY_CLIENT_ID || 'f3468125-d8c3-4863-bb7c-968a70683f06';
const AGENT_ENDPOINT =
  import.meta.env.VITE_FOUNDRY_AGENT_ENDPOINT ||
  'https://esigfoundry.services.ai.azure.com/api/projects/FraudIQ/agents/fraud-iq-orchestrator/endpoint/protocols/openai/responses';
const AGENT_API_VERSION = '2025-11-15-preview';
const SCOPES = ['https://ai.azure.com/.default'];
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const AUTH_REDIRECT_URI = `${window.location.origin}/msal-redirect.html`;
const POPUP_RELAY_URI = `${window.location.origin}/popup-relay.html`;

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

export function shouldRetryFoundryRequest(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

async function foundryError(response: Response): Promise<Error> {
  const details = await response.json().catch(() => undefined) as {
    error?: { message?: string; request_id?: string };
    request_id?: string;
  } | undefined;
  const requestId = response.headers.get('x-request-id') ||
    response.headers.get('apim-request-id') ||
    details?.error?.request_id ||
    details?.request_id;
  const message = details?.error?.message || `Foundry IQ request failed (${response.status}).`;
  return new Error(`${message} [HTTP ${response.status}${requestId ? ` · request ${requestId}` : ''}]`);
}

export async function askFoundryAgent(question: string): Promise<FoundryAgentResult> {
  const client = getApplication();
  const accessToken = await getAccessToken(client);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(getVersionedAgentEndpoint(AGENT_ENDPOINT), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: question }),
    });

    if (response.ok) return parseFoundryResponse(await response.json() as FoundryResponse);
    if (attempt === 0 && shouldRetryFoundryRequest(response.status)) {
      await new Promise((resolve) => window.setTimeout(resolve, 750));
      continue;
    }
    throw await foundryError(response);
  }
  throw new Error('Foundry IQ request failed.');
}