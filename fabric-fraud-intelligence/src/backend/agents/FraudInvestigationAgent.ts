import type { CaseBundle } from './context';

export interface SuggestedAction {
  action: string;
  rationale: string;
  priority: 'High' | 'Medium' | 'Low';
}

/** Produces a grounded investigation brief + non-binding recommended actions. */
export class FraudInvestigationAgent {
  readonly name = 'FraudInvestigationAgent';

  investigate(b: CaseBundle): string {
    const { alert, customer, transaction, claim, risk } = b;
    const subject = customer ? `${customer.name} (${customer.segment}, ${customer.country})` : 'the customer';
    const trigger = transaction
      ? `transaction ${transaction.id} of ${transaction.currency} ${transaction.amount} at ${transaction.merchant} via ${transaction.channel}`
      : claim
        ? `claim ${claim.id} (${claim.claimType}, ${claim.amountClaimed})`
        : 'account-level behaviour';
    const topEv = b.evidence.slice(0, 2).map((e) => `“${e.title}” (${e.sourceSystem}, conf ${e.confidence})`).join('; ');
    const drivers = risk.drivers.map((d) => `${d.name} (${d.weight})`).join(', ');
    return [
      `Alert ${alert.id} (${alert.alertType}, ${risk.severity}, score ${risk.score}) on ${subject}.`,
      `Trigger: ${trigger}.`,
      `Strongest evidence: ${topEv || 'n/a'}.`,
      `Model drivers: ${drivers}.`,
      customer?.pepFlag ? 'Customer is a PEP — enhanced due diligence applies.' : '',
      customer?.sanctionsFlag ? '⚠ Potential sanctions exposure — escalate immediately.' : '',
      'Residual uncertainty: confirm device ownership and counterparty legitimacy before final disposition.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  suggestActions(b: CaseBundle): SuggestedAction[] {
    const out: SuggestedAction[] = [];
    const sev = b.risk.severity;
    if (b.customer?.sanctionsFlag) {
      out.push({ action: 'Escalate to Sanctions team', rationale: 'Potential sanctions match on customer.', priority: 'High' });
    }
    if (sev === 'Critical' || sev === 'High') {
      out.push({ action: 'Block / hold', rationale: `High residual risk (${b.risk.score}).`, priority: 'High' });
      out.push({ action: 'Step-up authentication', rationale: 'Verify genuine customer before release.', priority: 'Medium' });
    } else {
      out.push({ action: 'Monitor', rationale: 'Risk below action threshold; keep under watch.', priority: 'Low' });
    }
    if (b.alert.alertType === 'KYC') {
      out.push({ action: 'Request documents', rationale: 'Refresh CDD / beneficial ownership.', priority: 'Medium' });
    }
    out.push({ action: 'Human approval required', rationale: 'All AI recommendations are advisory only.', priority: 'Low' });
    return out;
  }
}

export const fraudInvestigationAgent = new FraudInvestigationAgent();
