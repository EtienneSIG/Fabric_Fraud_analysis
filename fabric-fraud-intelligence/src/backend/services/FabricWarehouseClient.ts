import { DATASET } from '@/data/seed';
import type {
  Account,
  Claim,
  Customer,
  Evidence,
  FraudAlert,
  FraudCase,
  Policy,
  Transaction,
} from '@/backend/models';

/**
 * FabricWarehouseClient — abstraction over structured data. In mock mode it
 * serves the seeded dataset; the same surface can later target the Fabric
 * Lakehouse / Warehouse SQL analytics endpoint.
 */
export class FabricWarehouseClient {
  getCustomer(id: string): Customer | undefined {
    return DATASET.customers.find((c) => c.id === id);
  }
  getAccountsForCustomer(customerId: string): Account[] {
    return DATASET.accounts.filter((a) => a.customerId === customerId);
  }
  getAccount(id: string): Account | undefined {
    return DATASET.accounts.find((a) => a.id === id);
  }
  getTransaction(id: string): Transaction | undefined {
    return DATASET.transactions.find((t) => t.id === id);
  }
  getTransactionsForAccount(accountId: string): Transaction[] {
    return DATASET.transactions.filter((t) => t.accountId === accountId);
  }
  getClaim(id: string): Claim | undefined {
    return DATASET.claims.find((c) => c.id === id);
  }
  getPolicy(id: string): Policy | undefined {
    return DATASET.policies.find((p) => p.id === id);
  }
  getAlert(id: string): FraudAlert | undefined {
    return DATASET.alerts.find((a) => a.id === id);
  }
  getCase(id: string): FraudCase | undefined {
    return DATASET.cases.find((c) => c.id === id);
  }
  getEvidenceForCase(caseId: string): Evidence[] {
    return DATASET.evidence.filter((e) => e.caseId === caseId);
  }
}

export const warehouse = new FabricWarehouseClient();
