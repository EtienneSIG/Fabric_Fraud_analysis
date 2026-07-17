import { warehouse } from '@/backend/services/FabricWarehouseClient';
import { riskScoring, type RiskBreakdown } from '@/backend/services/RiskScoringService';
import type {
  Account,
  Claim,
  Customer,
  Evidence,
  FraudAlert,
  FraudCase,
  Transaction,
} from '@/backend/models';

/** All grounded context an agent needs to reason about a case. */
export interface CaseBundle {
  case: FraudCase;
  alert: FraudAlert;
  customer?: Customer;
  account?: Account;
  transaction?: Transaction;
  claim?: Claim;
  evidence: Evidence[];
  risk: RiskBreakdown;
}

export function buildBundle(caseId: string): CaseBundle | undefined {
  const kase = warehouse.getCase(caseId);
  if (!kase) return undefined;
  const alert = warehouse.getAlert(kase.alertId);
  if (!alert) return undefined;
  const customer = alert.customerId ? warehouse.getCustomer(alert.customerId) : undefined;
  const transaction = alert.transactionId ? warehouse.getTransaction(alert.transactionId) : undefined;
  const account = transaction ? warehouse.getAccount(transaction.accountId) : undefined;
  const claim = alert.claimId ? warehouse.getClaim(alert.claimId) : undefined;
  return {
    case: kase,
    alert,
    customer,
    account,
    transaction,
    claim,
    evidence: warehouse.getEvidenceForCase(caseId),
    risk: riskScoring.explain(alert),
  };
}
