import { isRaftEnabled } from '@/backend/config';
import { diag } from '@/backend/diag';
import { getJson } from '@/backend/services/backendApi';

export interface RaftEvalMetrics {
  groundedness: number;
  retrieval_quality: number;
  relevance: number;
  tokens_per_investigation: number;
  latency_ms: number;
  cost_per_1000: number;
}

export interface RaftEvaluation {
  generated_at: string;
  live: boolean;
  baseline_model: string;
  student_deployment: string;
  n_questions: number;
  summary: { baseline: RaftEvalMetrics; raft: RaftEvalMetrics };
}

// Committed sample from foundry/raft/eval/results/sample.json so the Model Quality tab renders
// offline. A live run (foundry/raft/eval) overwrites the real numbers via the backend.
const SAMPLE_EVALUATION: RaftEvaluation = {
  generated_at: '2026-08-31T07:55:51Z',
  live: false,
  baseline_model: 'gpt-4.1',
  student_deployment: 'raft-student',
  n_questions: 8,
  summary: {
    baseline: {
      groundedness: 0.675,
      retrieval_quality: 0.668,
      relevance: 0.668,
      tokens_per_investigation: 1850,
      latency_ms: 2200,
      cost_per_1000: 18.5,
    },
    raft: {
      groundedness: 0.881,
      retrieval_quality: 0.879,
      relevance: 0.874,
      tokens_per_investigation: 1200,
      latency_ms: 1400,
      cost_per_1000: 4.8,
    },
  },
};

/**
 * RaftEvalClient — surfaces the baseline-vs-RAFT evaluation for the Settings Model Quality tab.
 * Returns live numbers from the backend when the RAFT student is wired, otherwise the committed
 * sample so the tab always renders (degrades gracefully to the sample offline).
 */
export class RaftEvalClient {
  async getEvaluation(): Promise<RaftEvaluation> {
    if (isRaftEnabled()) {
      try {
        return await getJson<RaftEvaluation>('/api/raft/eval');
      } catch (e) {
        diag('raft', 'eval fetch failed; using committed sample', e);
      }
    }
    return SAMPLE_EVALUATION;
  }
}

export const raftEval = new RaftEvalClient();
