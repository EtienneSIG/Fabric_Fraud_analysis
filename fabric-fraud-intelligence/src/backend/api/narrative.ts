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
export function entityNarrative(node: EntityNode, sharedCount: number): string {
  const type = (node.fraudType ?? 'Fraud').replace('Fraud: ', '');

  if (node.kind === 'fraud') {
    return (
      `AI assessment — ${type} cluster. This red hub groups ${node.degree} customers whose ` +
      `Customer 360 journey terminated in a confirmed ${type} outcome. The customers wired to this ` +
      `hub reached it through similar behavioural paths, and those sharing an end-location are cross-linked ` +
      `as a potential coordinated ring. Prioritise the highest-centrality members for investigation, as they ` +
      `bridge the most journeys and are the likeliest orchestration points.`
    );
  }

  const j = journeyFor(node.id);
  const steps = j.map((e) => e.event).filter((e) => !e.startsWith('Fraud'));
  const foreignEvt = j.find((e) => FOREIGN.test(e.location));
  const paid = j.filter((e) => e.amount != null);
  const total = paid.reduce((s, e) => s + (e.amount ?? 0), 0);
  const first = steps[0] ?? 'routine account activity';
  const path = steps.slice(0, 5).join(' → ') || 'account activity';
  const signal = TYPE_SIGNAL[type] ?? 'an anomalous sequence versus the customer’s behavioural baseline';
  const action = TYPE_ACTION[type] ?? 'Escalate for manual review and hold high-risk transactions.';

  const parts: string[] = [];
  parts.push(
    `AI assessment — customer ${node.id} is flagged for ${type} (risk ${node.risk.toFixed(2)}).`
  );
  parts.push(
    `The journey opened with ${first.toLowerCase()} and progressed as: ${path}, ending in the ${type} event.`
  );
  parts.push(`The decisive pattern is ${signal}.`);
  if (foreignEvt) {
    parts.push(
      `Activity shifted to ${foreignEvt.location} via ${foreignEvt.channel}, inconsistent with the customer’s usual location.`
    );
  }
  if (paid.length) {
    parts.push(
      `Across the journey, ${paid.length} monetary events total ${eur(total)}${
        paid.length > 1 ? ', with value escalating toward the end' : ''
      }.`
    );
  }
  if (sharedCount > 0) {
    parts.push(
      `Network signal: this customer shares its fraud end-location with ${sharedCount} other flagged ` +
        `customer${sharedCount > 1 ? 's' : ''}, suggesting a possible collusion ring rather than an isolated case.`
    );
  } else {
    parts.push('Network signal: no shared-location peers detected, so this currently reads as an isolated case.');
  }
  parts.push(
    `Graph centrality — degree ${node.degree}, closeness ${node.closeness}, betweenness ${node.betweenness}: ` +
      `${node.betweenness > 0 ? 'this node bridges multiple journeys and warrants priority.' : 'a peripheral node in the ring.'}`
  );
  parts.push(`Recommended action: ${action}`);

  return parts.join(' ');
}
