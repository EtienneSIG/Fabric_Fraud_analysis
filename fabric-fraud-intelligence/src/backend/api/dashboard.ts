import { DATASET } from '@/data/seed';
import type { AlertType, Severity } from '@/backend/models';

export interface DashboardKpis {
  alertsToday: number;
  highRiskAlerts: number;
  avgInvestigationHours: number;
  estimatedFraudExposure: number;
  falsePositiveRate: number;
  byType: { type: AlertType; count: number }[];
  bySeverity: { severity: Severity; count: number }[];
}

/** GET /api/dashboard/kpis */
export function getKpis(): DashboardKpis {
  const now = Date.now();
  const alertsToday = DATASET.alerts.filter(
    (a) => now - new Date(a.createdAt).getTime() < 86400000
  ).length;
  const highRiskAlerts = DATASET.alerts.filter(
    (a) => a.severity === 'High' || a.severity === 'Critical'
  ).length;

  const avgInvestigationHours =
    Math.round(
      (DATASET.cases.reduce(
        (s, c) => s + (DATASET.evidence.filter((e) => e.caseId === c.id).length * 1.4 + 2.5),
        0
      ) /
        Math.max(DATASET.cases.length, 1)) *
        10
    ) / 10;

  const estimatedFraudExposure = Math.round(
    DATASET.alerts
      .filter((a) => a.severity === 'High' || a.severity === 'Critical')
      .reduce((s, a) => {
        const txn = DATASET.transactions.find((t) => t.id === a.transactionId);
        const claim = DATASET.claims.find((c) => c.id === a.claimId);
        return s + (txn?.amount ?? claim?.amountClaimed ?? 2500);
      }, 0)
  );

  const closed = DATASET.alerts.filter(
    (a) => a.status === 'Closed' || a.status === 'False Positive'
  ).length;
  const fp = DATASET.alerts.filter((a) => a.status === 'False Positive').length;
  const falsePositiveRate = closed === 0 ? 0 : Math.round((fp / closed) * 1000) / 10;

  const byType = (['Card Fraud', 'AML', 'KYC', 'Identity', 'Claims Fraud', 'Collusion Network'] as AlertType[]).map(
    (type) => ({ type, count: DATASET.alerts.filter((a) => a.alertType === type).length })
  );
  const bySeverity = (['Critical', 'High', 'Medium', 'Low'] as Severity[]).map((severity) => ({
    severity,
    count: DATASET.alerts.filter((a) => a.severity === severity).length,
  }));

  return {
    alertsToday,
    highRiskAlerts,
    avgInvestigationHours,
    estimatedFraudExposure,
    falsePositiveRate,
    byType,
    bySeverity,
  };
}
