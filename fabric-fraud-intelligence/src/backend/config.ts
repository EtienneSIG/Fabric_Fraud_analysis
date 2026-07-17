// Central configuration read from Vite env vars. Fabric Apps inject VITE_*.
export type AppMode = 'mock' | 'fabric';

interface FabricConfig {
  mode: AppMode;
  workspaceId: string;
  dataAgentId: string;
  tenantId: string;
}

function env(key: string): string {
  return (import.meta.env[key as keyof ImportMetaEnv] as string | undefined) ?? '';
}

export const fabricConfig: FabricConfig = {
  mode: (env('VITE_FABRIC_APP_MODE') as AppMode) || 'mock',
  workspaceId: env('VITE_FABRIC_WORKSPACE_ID'),
  dataAgentId: env('VITE_FABRIC_DATA_AGENT_ID'),
  tenantId: env('VITE_FABRIC_TENANT_ID'),
};

export const isMock = (): boolean => fabricConfig.mode !== 'fabric' || !fabricConfig.dataAgentId;
