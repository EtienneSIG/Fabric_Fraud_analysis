import { isFoundryEnabled } from '@/backend/config';
import { postJson } from '@/backend/services/backendApi';
import { getFoundryAgent } from '@/backend/services/foundrySettings';
import type { ProbeState, ProbeResult } from '@/backend/services/probe';
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
        const agent = getFoundryAgent();
        return await postJson<AgentReply>(
          '/api/agents/run',
          req,
          undefined,
          agent ? { 'x-foundry-agent': agent } : undefined
        );
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

  /** On-demand connectivity probe: runs a minimal agent call and reports the real service mode + detail. */
  async probe(): Promise<ProbeResult> {
    if (!isFoundryEnabled()) return { state: 'off', detail: 'Foundry not enabled (mock mode)' };
    const started = Date.now();
    try {
      const agent = getFoundryAgent();
      const res = await postJson<{ mode?: string }>(
        '/api/agents/run',
        { agentName: agent || 'fraud-triage-agent', prompt: 'ping', context: { caseId: 'health' }, locale: 'en' },
        15000,
        agent ? { 'x-foundry-agent': agent } : undefined
      );
      const state: ProbeState = res.mode === 'foundry' ? 'live' : 'mock';
      const detail = `mode=${res.mode ?? 'unknown'} · ${Date.now() - started} ms`;
      diag('foundry', `probe -> ${state} (${detail})`, undefined, state === 'live' ? 'info' : 'warn');
      return { state, detail };
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      diag('foundry', `probe -> unreachable (${detail})`, e, 'error');
      return { state: 'unreachable', detail };
    }
  }
}

export const foundryAgent = new FoundryAgentClient();
