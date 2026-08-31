import { DefaultAzureCredential, OnBehalfOfCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { Client } from '@microsoft/microsoft-graph-client';

const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';

export function env(key: string): string {
  return process.env[key] ?? '';
}

// Structured, greppable server log; captured by Azure Monitor OpenTelemetry as a trace/exception.
export function logError(scope: string, err: unknown, meta?: Record<string, unknown>): void {
  console.error(`[fraudintel:${scope}]`, err instanceof Error ? err.message : err, meta ?? {});
}

/** Strips the "Bearer " prefix from an incoming Authorization header. */
export function bearer(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader);
  return m ? m[1] : null;
}

/** Redacts PII before an AgentRun trace leaves the trust boundary (mirrors the app's maskPII
 *  intent for exported free text). Deterministic so exports stay reproducible. */
export function scrubPII(text: string): string {
  return text
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[card]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\b\d{6,}\b/g, '[num]');
}

let secretClient: SecretClient | null = null;
function kv(): SecretClient {
  if (!secretClient) {
    const uri = env('KEY_VAULT_URI');
    if (!uri) throw new Error('KEY_VAULT_URI not configured');
    secretClient = new SecretClient(uri, new DefaultAzureCredential());
  }
  return secretClient;
}

const secretCache = new Map<string, string>();
export async function getSecret(name: string): Promise<string> {
  const cached = secretCache.get(name);
  if (cached) return cached;
  const value = (await kv().getSecret(name)).value ?? '';
  secretCache.set(name, value);
  return value;
}

/** Builds an on-behalf-of credential from the signed-in analyst's assertion (delegated Graph). */
async function oboCredential(userToken: string): Promise<OnBehalfOfCredential> {
  const clientSecret = await getSecret(env('GRAPH_OBO_CLIENT_SECRET_NAME') || 'graph-obo-client-secret');
  return new OnBehalfOfCredential({
    tenantId: env('AZURE_TENANT_ID'),
    clientId: env('GRAPH_OBO_CLIENT_ID'),
    clientSecret,
    userAssertionToken: userToken,
  });
}

/** Microsoft Graph client acting on behalf of the analyst (delegated, OBO). */
export async function graphOBO(userToken: string): Promise<Client> {
  const credential = await oboCredential(userToken);
  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => (await credential.getToken(GRAPH_SCOPE))?.token ?? '',
    },
  });
}

/** Bearer token for the Foundry data plane on behalf of the analyst (falls back to MI). */
export async function foundryToken(userToken: string | null): Promise<string> {
  const scope = 'https://ai.azure.com/.default';
  if (userToken) {
    const cred = await oboCredential(userToken);
    return (await cred.getToken(scope))?.token ?? '';
  }
  return (await new DefaultAzureCredential().getToken(scope))?.token ?? '';
}
