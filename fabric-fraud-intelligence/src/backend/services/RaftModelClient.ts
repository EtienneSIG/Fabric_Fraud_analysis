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
  question?: string;
  scenario?: RaftScenario;
}

export type RaftScenario = 'structuring' | 'smurfing' | 'layering' | 'not-aml';

interface RaftCompareRequest {
  prompt: string;
  subject: string;
  context: DataAgentContext;
  locale: string;
  scenario?: RaftScenario;
}

// The concrete questions the A/B demo runs. Same system prompt for both models; the fine-tuned
// student wins by *deciding* correctly (disambiguating look-alike typologies, citing the exact
// rule, and abstaining on non-AML) — not by a better prompt.
export const RAFT_QUESTIONS: Record<RaftScenario, string> = {
  structuring:
    'Five cash deposits of 9,400 over two days, none above the 10,000 threshold — name the typology and the rule.',
  smurfing:
    'Four unrelated people each deposit 8,000 toward the same beneficiary within a week — typology and rule?',
  layering:
    'Funds moved through three accounts in under 48h with inbound and outbound amounts matching within 1% — typology, and is it SAR-ready?',
  'not-aml': 'A cardholder disputes a genuine online purchase — is this money laundering?',
};

// The system prompt is identical for the baseline and the fine-tuned student — the UI shows it
// read-only so the audience sees the improvement comes from the weights, not a better prompt.
export const RAFT_SYSTEM_PROMPT =
  'You are an AML analyst assistant. Answer only from the provided documents. Cite the exact ' +
  'typology and rule. If the documents do not support an answer, say so. Output is advisory; a ' +
  'human must approve any filing.';

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
        const r = await postJson<RaftComparison>('/api/raft/compare', req);
        return { ...r, question: r.question ?? req.prompt, scenario: req.scenario };
      } catch (e) {
        diag('raft', 'A/B compare failed; using deterministic mock', e);
      }
    }
    return this.mockCompare(req);
  }

  // Deterministic per-scenario contrast: a generic, hedging baseline vs a RAFT answer that names
  // the exact typology + rule (or correctly abstains). Same for every run, so the demo is stable.
  private mockCompare(req: RaftCompareRequest): RaftComparison {
    const key: RaftScenario = req.scenario ?? 'layering';
    const s = SCENARIOS[key];
    const subject = req.subject || 'the subject account';
    return {
      mode: 'mock',
      scenario: key,
      question: req.prompt || RAFT_QUESTIONS[key],
      baseline: { label: 'baseline', ...s.baseline },
      raft: { label: 'raft', ...s.raft, text: s.raft.text.replace('{subject}', subject) },
    };
  }
}

type AnswerBody = Omit<RaftAnswer, 'label'>;
const BASELINE_MODEL = 'gpt-4.1 (baseline)';
const RAFT_MODEL = 'gpt-4.1-mini · RAFT (AML)';

const SCENARIOS: Record<RaftScenario, { baseline: AnswerBody; raft: AnswerBody }> = {
  structuring: {
    baseline: {
      model: BASELINE_MODEL,
      text:
        'Several cash deposits sit just under the reporting limit, which looks suspicious. This could ' +
        'be structuring, or smurfing if more than one person is involved. Recommend an analyst review ' +
        'the account and decide whether to escalate.',
      grounding: [{ title: 'Transactions', source: 'fabric_dataagent', confidence: 0.6 }],
      tokens: 1820,
      latencyMs: 2100,
    },
    raft: {
      model: RAFT_MODEL,
      text:
        'Subject: {subject}\n' +
        'Typology: Structuring — one customer splitting a single cash sum into deposits kept below the ' +
        '10,000 reporting threshold (not smurfing, which needs multiple actors).\n' +
        'Rule: aggregated same-customer cash exceeds 90% of the threshold within a rolling 72h with no ' +
        'single breach — met here (5 × 9,400 = 47,000 in 48h).\n' +
        'Recommendation: SAR-ready — escalate to the nominated officer. Advisory; human approval required.',
      grounding: [
        { title: 'aml/structuring.md', source: 'foundry_iq', confidence: 0.93 },
        { title: 'transaction_monitoring_thresholds', source: 'fabric_dataagent', confidence: 0.88 },
      ],
      tokens: 1180,
      latencyMs: 1350,
    },
  },
  smurfing: {
    baseline: {
      model: BASELINE_MODEL,
      text:
        'Multiple deposits into one beneficiary account could be structuring or possibly layering. ' +
        "There isn't enough here to be certain — recommend a manual review before any decision.",
      grounding: [{ title: 'Transactions', source: 'fabric_dataagent', confidence: 0.58 }],
      tokens: 1790,
      latencyMs: 2150,
    },
    raft: {
      model: RAFT_MODEL,
      text:
        'Subject: {subject}\n' +
        'Typology: Smurfing — several distinct actors moving sub-threshold cash to one beneficiary ' +
        '(not structuring, which is a single actor splitting their own funds).\n' +
        'Rule: three or more distinct customers credit a common beneficiary with sub-threshold cash ' +
        'within a rolling 7-day window — met here (4 individuals within a week).\n' +
        'Recommendation: SAR-ready — escalate. Advisory; human approval required.',
      grounding: [
        { title: 'aml/smurfing.md', source: 'foundry_iq', confidence: 0.92 },
        { title: 'aml/structuring.md', source: 'foundry_iq', confidence: 0.71 },
      ],
      tokens: 1210,
      latencyMs: 1380,
    },
  },
  layering: {
    baseline: {
      model: BASELINE_MODEL,
      text:
        'This account shows unusual movements that may indicate money laundering. Several transfers ' +
        'occur between linked accounts over a short period. It could be layering or possibly ' +
        'structuring. Recommend an analyst review the activity and decide whether to escalate.',
      grounding: [{ title: 'Transactions', source: 'fabric_dataagent', confidence: 0.61 }],
      tokens: 1850,
      latencyMs: 2200,
    },
    raft: {
      model: RAFT_MODEL,
      text:
        'Subject: {subject}\n' +
        'Typology: Layering — proceeds separated from origin through rapid pass-through transfers, ' +
        'not structuring (which is threshold avoidance by a single actor).\n' +
        'Pattern: Three pass-through hops within 48h, inbound and outbound amounts matched within 2%.\n' +
        'Assessment: Meets the layering monitoring rule (≥3 hops, in/out within 2%, held <48h) and is ' +
        "inconsistent with the customer's expected profile.\n" +
        'Recommendation: SAR-ready — escalate to the nominated officer. Advisory; human approval required.',
      grounding: [
        { title: 'aml/layering.md', source: 'foundry_iq', confidence: 0.92 },
        { title: 'transaction_monitoring_thresholds', source: 'fabric_dataagent', confidence: 0.88 },
      ],
      tokens: 1200,
      latencyMs: 1400,
    },
  },
  'not-aml': {
    baseline: {
      model: BASELINE_MODEL,
      text:
        'The funds move quickly and the customer is now disputing the payment, which can be a sign of ' +
        'laundering. To be safe, recommend preparing a suspicious activity report and escalating.',
      grounding: [{ title: 'Transactions', source: 'fabric_dataagent', confidence: 0.55 }],
      tokens: 1760,
      latencyMs: 2050,
    },
    raft: {
      model: RAFT_MODEL,
      text:
        "Not AML. A cardholder disputing a genuine purchase is a chargeback / 'friendly fraud' matter — " +
        'the documents show no placement, layering or integration pattern, so no money-laundering ' +
        'typology applies. Route to card disputes; do NOT file a SAR. Advisory; human approval required.',
      grounding: [
        { title: 'card/friendly-fraud.md', source: 'foundry_iq', confidence: 0.9 },
        { title: 'aml/typology-overview.md', source: 'foundry_iq', confidence: 0.82 },
      ],
      tokens: 940,
      latencyMs: 1100,
    },
  },
};

export const raftModel = new RaftModelClient();
