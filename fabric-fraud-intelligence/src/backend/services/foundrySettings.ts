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
