import { isRaftEnabled } from '@/backend/config';
import { diag } from '@/backend/diag';
import { postJson } from '@/backend/services/backendApi';
import type { DataAgentContext, GroundingSource } from '@/backend/services/FabricDataAgentClient';

export interface RaftAnswer {
  label: 'baseline' | 'raft';
  model: string;
  text: string;
  grounding: GroundingSource[];
  tokens: number;
  latencyMs: number;
}

export interface RaftComparison {
  baseline: RaftAnswer;
  raft: RaftAnswer;
  mode: 'mock' | 'foundry';
}

interface RaftCompareRequest {
  prompt: string;
  subject: string;
  context: DataAgentContext;
  locale: string;
}

/**
 * RaftModelClient — runs the same AML question against the baseline model and the fine-tuned
 * RAFT student, side by side. When a student deployment is wired it routes to the backend
 * (`/api/raft/compare`); otherwise it returns a deterministic mock A/B so the demo's baseline-vs-
 * RAFT peak still works fully offline. Every answer stays advisory (human approval required).
 */
export class RaftModelClient {
  async compare(req: RaftCompareRequest): Promise<RaftComparison> {
    if (isRaftEnabled()) {
      try {
        return await postJson<RaftComparison>('/api/raft/compare', req);
      } catch (e) {
        diag('raft', 'A/B compare failed; using deterministic mock', e);
      }
    }
    return this.mockCompare(req);
  }

  // Deterministic contrast: a generic, weakly-grounded baseline answer vs a RAFT answer that
  // cites the exact typology and rule in the structured, SAR-ready format.
  private mockCompare(req: RaftCompareRequest): RaftComparison {
    const subject = req.subject || 'the subject account';
    const baseline: RaftAnswer = {
      label: 'baseline',
      model: 'gpt-4.1 (baseline)',
      text:
        `This account shows unusual movements that may indicate money laundering. ` +
        `Several transfers occur between linked accounts over a short period. It could be ` +
        `layering or possibly structuring. Recommend an analyst review the activity and decide ` +
        `whether to escalate.`,
      grounding: [{ title: 'Transactions', source: 'fabric_dataagent', confidence: 0.61 }],
      tokens: 1850,
      latencyMs: 2200,
    };
    const raft: RaftAnswer = {
      label: 'raft',
      model: 'gpt-4.1-mini · RAFT (AML)',
      text:
        `Subject: ${subject}\n` +
        `Typology: Layering — proceeds separated from origin through rapid pass-through transfers, ` +
        `not structuring (which is threshold avoidance by a single actor).\n` +
        `Pattern: Three pass-through hops within 48h, inbound and outbound amounts matched within 2%.\n` +
        `Assessment: Meets the layering monitoring rule (≥3 hops, in/out within 2%, held <48h) and is ` +
        `inconsistent with the customer's expected profile.\n` +
        `Recommendation: SAR-ready — escalate to the nominated officer. Advisory; human approval required.`,
      grounding: [
        { title: 'aml/layering.md', source: 'foundry_iq', confidence: 0.92 },
        { title: 'transaction_monitoring_thresholds', source: 'fabric_dataagent', confidence: 0.88 },
      ],
      tokens: 1200,
      latencyMs: 1400,
    };
    return { baseline, raft, mode: 'mock' };
  }
}

export const raftModel = new RaftModelClient();
