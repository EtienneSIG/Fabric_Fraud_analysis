import { DATASET } from '@/data/seed';
import type { CustomerEvent } from '@/backend/models';

import type { EntityNode } from './entity-graph';

const FOREIGN = /China|Nigeria|Romania|Russia|Pakistan|Ukraine|Dubai/;

function journeyFor(id: string): CustomerEvent[] {
  return DATASET.events
    .filter((e) => e.customerId === id)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

const eur = (n: number) => `€${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const TYPE_SIGNAL: Record<string, string> = {
  'Card Fraud':
    'card-present/online spend accelerating from a newly seen device with a billing-vs-IP geography mismatch (impossible travel)',
  'Account Takeover':
    'a password reset followed by enrollment of an unrecognized device and a new payee, immediately drained by an outbound wire',
  'Money Mule':
    'a large inbound credit rapidly layered out through several transfers and an ATM cash-out — classic mule behaviour',
  'Identity Fraud':
    'onboarding on a fresh device with identity-document and address changes, consistent with a synthetic-identity build-up',
};

const TYPE_ACTION: Record<string, string> = {
  'Card Fraud': 'Block the card, reverse the disputed authorisations, and step-up authentication on the account.',
  'Account Takeover': 'Freeze outbound payments, revoke the new device/beneficiary, and force a verified credential reset.',
  'Money Mule': 'Hold the account, file a suspicious-activity report (SAR), and trace upstream/downstream counterparties.',
  'Identity Fraud': 'Escalate to KYC re-verification and place the profile under enhanced due diligence before further activity.',
};

/**
 * Produces a short, AI-style narrative that explains what is happening for the
 * selected graph entity, grounded in its Customer 360 journey and its position
 * in the fraud network. Deterministic (no external LLM call) so it works fully
 * client-side inside the Fabric app.
 */
export interface EntityNarrative {
  kind: 'fraud' | 'customer';
  typeLabel: string;
  headline: string;
  riskPct: number;
  summary: string;
  signals: string[];
  network: string;
  action: string;
}

export function entityNarrative(node: EntityNode, sharedCount: number): EntityNarrative {
  const type = (node.fraudType ?? 'Fraud').replace('Fraud: ', '');

  if (node.kind === 'fraud') {
    return {
      kind: 'fraud',
      typeLabel: type,
      headline: `${type} cluster`,
      riskPct: Math.round(node.risk * 100),
      summary:
        `This red hub groups ${node.degree} customers whose Customer 360 journey ended in a ` +
        `confirmed ${type} outcome, reached through similar behavioural paths.`,
      signals: [
        `${node.degree} customers attached to this typology`,
        `Customers sharing an end-location are cross-linked (potential ring)`,
        `High-centrality members bridge the most journeys`,
      ],
      network:
        'Members with high centrality are the likeliest orchestration points of the network.',
      action: 'Prioritise the highest-centrality members (betweenness) for investigation.',
    };
  }

  const j = journeyFor(node.id);
  const steps = j.map((e) => e.event).filter((e) => !e.startsWith('Fraud'));
  const foreignEvt = j.find((e) => FOREIGN.test(e.location));
  const paid = j.filter((e) => e.amount != null);
  const total = paid.reduce((s, e) => s + (e.amount ?? 0), 0);
  const first = steps[0] ?? 'routine account activity';
  const path = steps.slice(0, 5).join(' → ') || 'account activity';
  const signal = TYPE_SIGNAL[type] ?? 'an anomalous sequence versus the behavioural baseline';
  const action = TYPE_ACTION[type] ?? 'Escalate for manual review and hold high-risk transactions.';

  const signals: string[] = [];
  signals.push(`Path · ${path} → ${type}`);
  signals.push(`Decisive signal · ${signal}`);
  if (foreignEvt) {
    signals.push(
      `Shifted to ${foreignEvt.location} via ${foreignEvt.channel} — inconsistent with usual location`
    );
  }
  if (paid.length) {
    signals.push(
      `${paid.length} monetary events · ${eur(total)}${paid.length > 1 ? ' (escalating value)' : ''}`
    );
  }
  signals.push(
    `Centrality · degree ${node.degree}, closeness ${node.closeness}, betweenness ${node.betweenness}`
  );

  const network =
    sharedCount > 0
      ? `Shares its fraud end-location with ${sharedCount} other flagged customer${
          sharedCount > 1 ? 's' : ''
        } → likely collusion ring, not an isolated case.`
      : 'No shared-location peers detected → currently reads as an isolated case.';

  return {
    kind: 'customer',
    typeLabel: type,
    headline: `${type} — ${node.id}`,
    riskPct: Math.round(node.risk * 100),
    summary:
      `Customer ${node.id} is flagged for ${type}. The journey opened with ${first.toLowerCase()} ` +
      `and escalated to the ${type} event.`,
    signals,
    network,
    action,
  };
}
