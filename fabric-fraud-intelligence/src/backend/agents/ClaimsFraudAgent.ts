import type { CaseBundle } from './context';

/** Produces an insurance claims-fraud investigation summary. */
export class ClaimsFraudAgent {
  readonly name = 'ClaimsFraudAgent';

  summary(b: CaseBundle): string {
    const { alert, claim, customer } = b;
    const anomalies = b.evidence
      .filter((e) => ['forensic', 'anomaly', 'graph'].includes(e.evidenceType))
      .map((e) => `• ${e.title}: ${e.content}`)
      .join('\n');
    return [
      `CLAIMS FRAUD SUMMARY — ${alert.id}`,
      claim
        ? `Claim ${claim.id}: ${claim.claimType}, ${claim.amountClaimed} at "${claim.repairProvider}" (${claim.location}).`
        : 'Claim context unavailable.',
      `Claimant: ${customer?.name ?? 'n/a'} (${customer?.segment ?? ''}).`,
      `Indicators:`,
      anomalies || '• Elevated amount vs policy baseline.',
      `Assessment: risk ${b.risk.score} (${b.risk.severity}). Image reuse + provider concentration indicate an organised pattern.`,
      `Recommended disposition (advisory): investigate & request original documentation before payment. Human approval required.`,
    ].join('\n');
  }
}

export const claimsFraudAgent = new ClaimsFraudAgent();
