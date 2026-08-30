// Central configuration read from Vite env vars. Fabric Apps inject VITE_*.
export type AppMode = 'mock' | 'fabric';

interface FabricConfig {
  mode: AppMode;
  workspaceId: string;
  dataAgentId: string;
  tenantId: string;
}

interface IntegrationConfig {
  backendApiUrl: string;
  foundryEndpoint: string;
  graphOboClientId: string;
  foundryEnabled: boolean;
  workIqEnabled: boolean;
  teamsEnabled: boolean;
}

function env(key: string): string {
  return (import.meta.env[key as keyof ImportMetaEnv] as string | undefined) ?? '';
}

function flag(key: string): boolean {
  return env(key).toLowerCase() === 'true';
}

export const fabricConfig: FabricConfig = {
  mode: (env('VITE_FABRIC_APP_MODE') as AppMode) || 'mock',
  workspaceId: env('VITE_FABRIC_WORKSPACE_ID'),
  dataAgentId: env('VITE_FABRIC_DATA_AGENT_ID') || env('VITE_RAYFIN_DATA_AGENT_ID'),
  tenantId: env('VITE_FABRIC_TENANT_ID'),
};

export const integrationConfig: IntegrationConfig = {
  backendApiUrl: env('VITE_BACKEND_API_URL'),
  foundryEndpoint: env('VITE_FOUNDRY_ENDPOINT'),
  graphOboClientId: env('VITE_GRAPH_OBO_CLIENT_ID'),
  foundryEnabled: flag('VITE_FOUNDRY_ENABLED'),
  workIqEnabled: flag('VITE_WORKIQ_ENABLED'),
  teamsEnabled: flag('VITE_TEAMS_ENABLED'),
};

export const isMock = (): boolean => fabricConfig.mode !== 'fabric' || !fabricConfig.dataAgentId;

// A real integration also needs a reachable backend endpoint; otherwise fall back to mock.
const backendReady = (): boolean => !isMock() && !!integrationConfig.backendApiUrl;

export const isFoundryEnabled = (): boolean => backendReady() && integrationConfig.foundryEnabled;
export const isWorkIqEnabled = (): boolean => backendReady() && integrationConfig.workIqEnabled;
export const isTeamsEnabled = (): boolean => backendReady() && integrationConfig.teamsEnabled;
