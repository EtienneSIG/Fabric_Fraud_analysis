import { DATASET } from '@/data/seed';
import type { AlertStatus, AlertType, FraudAlert, Severity } from '@/backend/models';

export interface AlertRow extends FraudAlert {
  customerName: string;
  caseId: string;
}

export interface AlertFilter {
  type?: AlertType | 'All';
  severity?: Severity | 'All';
  status?: AlertStatus | 'All';
  search?: string;
}

function enrich(a: FraudAlert): AlertRow {
  const customerName = DATASET.customers.find((c) => c.id === a.customerId)?.name ?? '—';
  const caseId = DATASET.cases.find((c) => c.alertId === a.id)?.id ?? '';
  return { ...a, customerName, caseId };
}

/** GET /api/alerts */
export function getAlerts(filter: AlertFilter = {}): AlertRow[] {
  return DATASET.alerts
    .filter((a) => (filter.type && filter.type !== 'All' ? a.alertType === filter.type : true))
    .filter((a) => (filter.severity && filter.severity !== 'All' ? a.severity === filter.severity : true))
    .filter((a) => (filter.status && filter.status !== 'All' ? a.status === filter.status : true))
    .filter((a) =>
      filter.search
        ? `${a.id} ${a.explanationShort} ${a.customerId}`.toLowerCase().includes(filter.search.toLowerCase())
        : true
    )
    .map(enrich)
    .sort((a, b) => b.riskScore - a.riskScore);
}

/** GET /api/alerts/:id */
export function getAlert(id: string): AlertRow | undefined {
  const a = DATASET.alerts.find((x) => x.id === id);
  return a ? enrich(a) : undefined;
}
