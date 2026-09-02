// Central configuration read from Vite env vars. Fabric Apps inject VITE_*.
import { hasWebIqKey } from '@/backend/services/webIqSettings';
import { getBackendApiUrl } from '@/backend/services/generalSettings';

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
  webIqEnabled: boolean;
  teamsEnabled: boolean;
  raftEnabled: boolean;
  raftStudentDeployment: string;
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
  webIqEnabled: flag('VITE_WEBIQ_ENABLED'),
  teamsEnabled: flag('VITE_TEAMS_ENABLED'),
  raftEnabled: flag('VITE_RAFT_ENABLED'),
  raftStudentDeployment: env('VITE_RAFT_STUDENT_DEPLOYMENT'),
};

export const isMock = (): boolean => fabricConfig.mode !== 'fabric' || !fabricConfig.dataAgentId;

// A real integration also needs a reachable backend endpoint; otherwise fall back to mock.
// The URL can come from the build-time env or the runtime Settings > Général override.
const backendReady = (): boolean => !isMock() && !!getBackendApiUrl();

export const isFoundryEnabled = (): boolean => backendReady() && integrationConfig.foundryEnabled;
export const isWorkIqEnabled = (): boolean => backendReady() && integrationConfig.workIqEnabled;
// Live when enabled at build time OR when the analyst has entered their own key in Settings.
export const isWebIqEnabled = (): boolean =>
  backendReady() && (integrationConfig.webIqEnabled || hasWebIqKey());
export const isTeamsEnabled = (): boolean => backendReady() && integrationConfig.teamsEnabled;

// The RAFT student A/B path is live only when a fine-tuned deployment is wired; otherwise the
// app shows the deterministic mock A/B so the demo peak still works offline.
export const isRaftEnabled = (): boolean =>
  backendReady() && integrationConfig.raftEnabled && !!integrationConfig.raftStudentDeployment;

export type FeatureKey = 'fabric' | 'foundry' | 'raft' | 'workiq' | 'webiq' | 'teams';

export interface IntegrationStatus {
  overall: 'mock' | 'partial' | 'live';
  features: Record<FeatureKey, boolean>;
}

// Snapshot of which integrations are live vs mock, for the discreet header mode badge. A feature is
// "live" only when fully wired; anything not configured degrades gracefully to the mock path.
export function integrationStatus(): IntegrationStatus {
  const features: Record<FeatureKey, boolean> = {
    fabric: !isMock(),
    foundry: isFoundryEnabled(),
    raft: isRaftEnabled(),
    workiq: isWorkIqEnabled(),
    webiq: isWebIqEnabled(),
    teams: isTeamsEnabled(),
  };
  const live = Object.values(features).filter(Boolean).length;
  const overall = live === 0 ? 'mock' : live === Object.keys(features).length ? 'live' : 'partial';
  return { overall, features };
}
