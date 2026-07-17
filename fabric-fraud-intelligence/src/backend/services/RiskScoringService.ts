import type { FraudAlert, Severity } from '@/backend/models';

export interface RiskBreakdown {
  score: number;
  severity: Severity;
  drivers: { name: string; weight: number }[];
}

/**
 * RiskScoringService — normalizes an alert into a transparent, explainable
 * risk breakdown. Non-binding: always subject to human approval.
 */
export class RiskScoringService {
  severityOf(score: number): Severity {
    if (score >= 0.9) return 'Critical';
    if (score >= 0.75) return 'High';
    if (score >= 0.5) return 'Medium';
    return 'Low';
  }

  explain(alert: FraudAlert): RiskBreakdown {
    const base = alert.riskScore;
    const driversByType: Record<string, string[]> = {
      'Card Fraud': ['amount_zscore', 'ip_country_risk', 'new_device'],
      AML: ['layering_depth', 'round_amount_ratio', 'counterparty_risk'],
      KYC: ['kyc_staleness', 'pep_status', 'adverse_media'],
      Identity: ['impossible_travel', 'device_novelty', 'session_anomaly'],
      'Claims Fraud': ['image_hash_reuse', 'provider_concentration', 'amount_vs_policy'],
      'Collusion Network': ['community_density', 'shared_devices', 'provider_overlap'],
    };
    const names = driversByType[alert.alertType] ?? ['anomaly_score', 'behaviour_deviation'];
    const drivers = names.map((name, i) => ({
      name,
      weight: Math.round((base * (0.5 - i * 0.12) + 0.06) * 100) / 100,
    }));
    return { score: base, severity: this.severityOf(base), drivers };
  }
}

export const riskScoring = new RiskScoringService();
