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
const SCOPES = ['https://ai.azure.com/.default'];
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
        navigatePopups: false,
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