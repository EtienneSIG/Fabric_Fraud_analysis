import type { CaseBundle } from './context';

/** Produces an AML suspicious-activity narrative for internal review. */
export class AMLCaseAgent {
  readonly name = 'AMLCaseAgent';

  narrative(b: CaseBundle): string {
    const { alert, customer, transaction } = b;
    const who = customer ? `${customer.name} (${customer.segment}, ${customer.country})` : 'the subject';
    const amount = transaction ? `${transaction.currency} ${transaction.amount}` : 'multiple wires';
    const risk = customer?.pepFlag ? 'PEP status active; ' : '';
    return [
      `SUSPICIOUS ACTIVITY NARRATIVE — ${alert.id}`,
      `Subject: ${who}. ${risk}KYC rating ${customer?.kycRiskRating ?? 'n/a'}.`,
      `Pattern: ${alert.explanationShort}`,
      `Typology: layering — inbound funds (${amount}) moved across linked accounts and rapidly externalised, inconsistent with declared activity.`,
      `Assessment: risk score ${b.risk.score} (${b.risk.severity}). Structuring and velocity anomalies corroborate intent to obscure origin.`,
      `Recommendation (advisory): escalate to MLRO and prepare a SAR if counterparties cannot be substantiated. Human approval required.`,
    ].join('\n');
  }
}

export const amlCaseAgent = new AMLCaseAgent();
