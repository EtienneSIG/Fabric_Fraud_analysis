import { isFoundryEnabled } from '@/backend/config';
import { postJson } from '@/backend/services/backendApi';
import { diag } from '@/backend/diag';
import {
  dataAgent,
  type DataAgentContext,
  type GroundingSource,
} from '@/backend/services/FabricDataAgentClient';

export interface AgentReply {
  runId: string;
  text: string;
  generatedQuery: string;
  grounding: GroundingSource[];
  mode: 'mock' | 'foundry';
}

interface AgentRunRequest {
  agentName: string;
  prompt: string;
  context: DataAgentContext;
  locale: string;
}

/**
 * FoundryAgentClient — routes an agent run to the Microsoft Foundry Agent Service
 * (via the backend `/api/agents/run`, which grounds on Fabric through the
 * conn-fabric-fraud-dataagent connection with OBO). Falls back to the deterministic
 * Fabric Data Agent mock so the app stays offline-capable.
 */
export class FoundryAgentClient {
  async run(req: AgentRunRequest): Promise<AgentReply> {
    if (isFoundryEnabled()) {
      try {
        return await postJson<AgentReply>('/api/agents/run', req);
      } catch (e) {
        diag('foundry', 'agent run failed; using deterministic mock', e);
      }
    }
    const da = await dataAgent.askDataAgent(req.prompt, req.context);
    return {
      runId: da.runId,
      text: da.answer,
      generatedQuery: da.generatedQuery,
      grounding: da.groundingSources,
      mode: 'mock',
    };
  }
}

export const foundryAgent = new FoundryAgentClient();
