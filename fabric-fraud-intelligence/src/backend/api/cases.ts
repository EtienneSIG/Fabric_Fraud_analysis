import { DATASET } from '@/data/seed';
import { audit } from '@/backend/services/AuditService';
import { buildBundle, type CaseBundle } from '@/backend/agents/context';
import type { Decision } from '@/backend/models';

/** GET /api/cases/:id — the full grounded case view. */
export function getCase(caseId: string): CaseBundle | undefined {
  return buildBundle(caseId);
}

export interface DecisionInput {
  decision: Decision;
  reason: string;
  userId: string;
}

/** POST /api/cases/:id/decision — human decision (audited). */
export function postDecision(caseId: string, input: DecisionInput): boolean {
  const cs = DATASET.cases.find((c) => c.id === caseId);
  if (!cs) return false;
  cs.decision = input.decision;
  cs.decisionReason = input.reason;
  cs.status =
    input.decision === 'Escalate'
      ? 'Escalated'
      : input.decision === 'Close - False Positive'
        ? 'Closed'
        : cs.status;
  cs.updatedAt = new Date().toISOString();
  audit.logDecision(input.userId, caseId, input.decision, input.reason);
  return true;
}
