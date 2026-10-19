// User-selected Foundry orchestrator agent for the current project. Stored only in this browser
// and sent to the backend proxy via the x-foundry-agent header, which overrides the
// FOUNDRY_ORCHESTRATOR_AGENT app setting. Lets an analyst point the app at a specific agent of the
// wired Foundry project without a redeploy.
const STORAGE_KEY = 'ffi.foundry.agent';

export const DEFAULT_FOUNDRY_AGENT = 'fraud-triage-agent';

// The connected-agent topology deployed by foundry/agents/deploy_agents.ps1 (orchestrator first).
export const KNOWN_FOUNDRY_AGENTS = [
  'fraud-triage-agent',
  'fraud-investigation-agent',
  'fraud-aml-agent',
  'fraud-claims-agent',
  'fraud-regulatory-agent',
] as const;

export function getFoundryAgent(): string {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setFoundryAgent(value: string): void {
  try {
    const v = value.trim();
    if (v) globalThis.localStorage?.setItem(STORAGE_KEY, v);
    else globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode / SSR) */
  }
}

export function effectiveFoundryAgent(): string {
  return getFoundryAgent() || DEFAULT_FOUNDRY_AGENT;
}

// --- Direct browser Foundry IQ connection (runtime "bring your own Foundry") -------------------
// tenant + SPA client + project endpoint, stored only in this browser (localStorage). They let an
// analyst point the direct Foundry IQ path at their own project/agent at runtime, overriding the
// build-time VITE_FOUNDRY_* — no rebuild, no cross-tenant default. Never bundled or logged.
const KEY_TENANT = 'ffi.foundry.tenantId';
const KEY_CLIENT = 'ffi.foundry.clientId';
const KEY_ENDPOINT = 'ffi.foundry.projectEndpoint';

function readKey(key: string): string {
  try {
    return globalThis.localStorage?.getItem(key)?.trim() ?? '';
  } catch {
    return '';
  }
}

function writeKey(key: string, value: string): void {
  try {
    const v = value.trim();
    if (v) globalThis.localStorage?.setItem(key, v);
    else globalThis.localStorage?.removeItem(key);
  } catch {
    /* storage unavailable (private mode / SSR) */
  }
}

export const getFoundryTenantId = (): string => readKey(KEY_TENANT);
export const setFoundryTenantId = (value: string): void => writeKey(KEY_TENANT, value);
export const getFoundryClientId = (): string => readKey(KEY_CLIENT);
export const setFoundryClientId = (value: string): void => writeKey(KEY_CLIENT, value);
export const getFoundryProjectEndpoint = (): string => readKey(KEY_ENDPOINT);
export const setFoundryProjectEndpoint = (value: string): void => writeKey(KEY_ENDPOINT, value);

// Manual preference to always run the deterministic demo path, even when a real connection is
// wired. Stored only in this browser. Off by default (use the real agent when configured).
const KEY_FORCE_DEMO = 'ffi.foundry.forceDemo';
export const getForceDemo = (): boolean => readKey(KEY_FORCE_DEMO) === '1';
export const setForceDemo = (value: boolean): void => writeKey(KEY_FORCE_DEMO, value ? '1' : '');
