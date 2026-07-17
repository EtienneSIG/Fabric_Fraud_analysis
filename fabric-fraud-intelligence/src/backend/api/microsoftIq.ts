// Simulated "Microsoft IQ" grounding layer for the fraud platform.
// Microsoft IQ (Ignite 2025) is the shared intelligence layer that grounds AI
// agents across three domains:
//   • Fabric IQ  — enterprise DATA & semantics (OneLake, ontology, digital twins)
//   • Work IQ    — the WORK graph in Microsoft 365 (people, docs, chats, calendar)
//   • Foundry IQ — unified KNOWLEDGE & tools for agents in Microsoft Foundry
// This module simulates how each IQ contributes grounding to a fraud investigation.
// NOTE: Fabric IQ grounding is REAL — computed live from the same data that is
// materialized in fraud_lakehouse and bound to the fraud_ontology. Only Work IQ
// and Foundry IQ are simulated.

import { DATASET } from '@/data/seed';

export type IqId = 'fabric' | 'work' | 'foundry';

export interface IqInfo {
  id: IqId;
  name: string;
  tagline: string;
  color: string;
  grounds: string;
  description: string;
  fraudUse: string[];
}

export const IQS: IqInfo[] = [
  {
    id: 'fabric',
    name: 'Fabric IQ',
    tagline: 'Intelligence of your data',
    color: '#4f46e5',
    grounds: 'Enterprise data & semantics',
    description:
      'The semantic layer over OneLake — ontology, business concepts and relationships — that lets agents reason over governed enterprise data, not raw tables.',
    fraudUse: [
      'Grounds answers in the fraud_ontology (Customer, Account, Transaction, Alert…) and fraud_lakehouse tables',
      'Traverses relationships to surface collusion rings and shared entities',
      'Provides governed, PII-aware facts with data lineage',
    ],
  },
  {
    id: 'work',
    name: 'Work IQ',
    tagline: 'Intelligence of your work',
    color: '#0d9488',
    grounds: 'Microsoft 365 work graph',
    description:
      'The intelligence layer over work in Microsoft 365 — people, documents, meetings and communications — giving agents organizational context.',
    fraudUse: [
      'Surfaces related Teams threads, emails and SAR documents from the case team',
      'Knows who owns the case, their calendar and prior decisions',
      'Reuses institutional knowledge (playbooks, past investigations)',
    ],
  },
  {
    id: 'foundry',
    name: 'Foundry IQ',
    tagline: 'Intelligence for your agents',
    color: '#7c3aed',
    grounds: 'Agent knowledge & tools',
    description:
      'Unified knowledge, retrieval and memory for agents in Microsoft Foundry — grounding reasoning in policies, regulations and tool outputs.',
    fraudUse: [
      'Retrieves fraud/AML typologies and regulatory thresholds from the knowledge base',
      'Remembers outcomes of similar prior cases to recommend an action',
      'Orchestrates tools (risk scoring, sanctions screening) with grounded context',
    ],
  },
];

export interface IqResult {
  fabric: string[];
  work: string[];
  foundry: string[];
  answer: string;
}

const flavor = (q: string): 'aml' | 'card' | 'claim' | 'takeover' | 'generic' => {
  const s = q.toLowerCase();
  if (/launder|aml|wire|layer|mule|structur/.test(s)) return 'aml';
  if (/card|impossible travel|geo|ecommerce/.test(s)) return 'card';
  if (/claim|insur|repair|provider/.test(s)) return 'claim';
  if (/takeover|password|beneficiary|account takeover|ato/.test(s)) return 'takeover';
  return 'generic';
};

const euro = (n: number) => `€${Math.round(n).toLocaleString('en-US')}`;

/**
 * LIVE Fabric IQ grounding — computed from the actual dataset that is
 * materialized in fraud_lakehouse and bound to the fraud_ontology. Resolves an
 * anchor entity (a customer id in the question, otherwise the relevant real
 * alert) and traverses ontology relationships for genuine, data-backed facts.
 */
function fabricIqLive(question: string): string[] {
  const idMatch = question.match(/C(?:UST-\d{3}|X-\d{5})/i);
  let customerId = idMatch ? idMatch[0].toUpperCase() : null;

  if (!customerId) {
    const typeMap: Record<string, string | null> = {
      aml: 'AML',
      card: 'Card Fraud',
      claim: 'Claims Fraud',
      takeover: 'Identity',
      generic: null,
    };
    const at = typeMap[flavor(question)];
    const anchor = at
      ? DATASET.alerts.find((a) => a.alertType === at)
      : [...DATASET.alerts].sort((a, b) => b.riskScore - a.riskScore)[0];
    customerId = anchor?.customerId ?? DATASET.customers[0].id;
  }

  const c = DATASET.customers.find((x) => x.id === customerId);
  const accts = DATASET.accounts.filter((a) => a.customerId === customerId);
  const acctIds = new Set(accts.map((a) => a.id));
  const txns = DATASET.transactions.filter((t) => acctIds.has(t.accountId));
  const total = txns.reduce((s, t) => s + t.amount, 0);
  const topTxn = [...txns].sort((a, b) => b.amount - a.amount)[0];
  const alerts = DATASET.alerts.filter((a) => a.customerId === customerId);
  const cases = DATASET.cases.filter((cs) => alerts.some((a) => a.id === cs.alertId));
  const rels = DATASET.relationships.filter(
    (r) => r.sourceEntityId === customerId || r.targetEntityId === customerId
  );
  const shared = rels.filter(
    (r) => r.relationshipType.includes('shared') || r.relationshipType === 'claims_at_provider'
  );

  const out: string[] = [];
  if (c) {
    out.push(
      `Ontology · Customer ${c.id} — ${c.name}, ${c.segment}, ${c.country}; KYC ${c.kycRiskRating}` +
        `${c.pepFlag ? ', PEP' : ''}${c.sanctionsFlag ? ', sanctioned' : ''}.`
    );
  }
  out.push(
    `Lakehouse · ${accts.length} account(s), ${txns.length} transaction(s), total ${euro(total)}` +
      `${topTxn ? `; largest ${euro(topTxn.amount)} to ${topTxn.merchant} (IP ${topTxn.ipCountry} vs ${topTxn.country})` : ''}.`
  );
  if (alerts.length) {
    out.push(
      `Alerts · ${alerts.map((a) => `${a.alertType} ${a.riskScore.toFixed(2)} (${a.status})`).join('; ')}` +
        `${cases.length ? ` — ${cases.length} open case(s)` : ''}.`
    );
  }
  out.push(
    `Graph · ${rels.length} relationship(s)` +
      `${shared.length ? `, incl. ${shared.length} shared-entity link(s) → possible collusion ring` : ''}.`
  );
  return out;
}

export const SAMPLE_QUESTIONS = [
  'Is CUST-014 part of a coordinated fraud ring?',
  'Explain the AML risk on the Corporate customer and recommend an action.',
  'Why was the card-fraud alert raised and what should we do?',
  'Summarize the claims-fraud collusion network for the case review.',
];

/** Cross-IQ grounding for a fraud question. Fabric IQ is live; Work/Foundry simulated. */
export function askMicrosoftIq(question: string): IqResult {
  const f = flavor(question);

  const work: Record<string, string[]> = {
    aml: [
      'Teams: analyst s.martin flagged these counterparties in the "AML-EMEA" channel 3 days ago.',
      'SharePoint: SAR-template.docx and the EMEA wire-threshold policy are available to attach.',
      'Calendar: a case-review meeting with the MLRO is scheduled today at 15:00.',
    ],
    card: [
      'Teams: the merchant "CryptoXchange" was reported by two analysts last week.',
      'Outlook: chargeback confirmation email from the card scheme is in the case mailbox.',
      'People: case owner a.dupont has resolved 6 similar card-fraud cases this quarter.',
    ],
    claim: [
      'SharePoint: prior investigation report on "AutoRepair Pro" from Q1 is on file.',
      'Teams: claims-fraud channel already discusses provider concentration.',
      'People: k.okafor (claims SME) is the recommended reviewer.',
    ],
    takeover: [
      'Teams: security team posted an impossible-travel advisory for this region.',
      'Outlook: customer contact log shows no travel notification on file.',
      'Calendar: fraud-ops standup at 09:00 can pick up the escalation.',
    ],
    generic: [
      'Teams: related discussions and mentions from the case team surfaced.',
      'SharePoint: relevant playbooks and templates located.',
      'People & calendar: case owner and next review slot identified.',
    ],
  };

  const foundry: Record<string, string[]> = {
    aml: [
      'Knowledge: matched AML typology "layering" and the €10k EU wire reporting threshold.',
      'Memory: a similar 2025 case was resolved by SAR filing + account hold.',
      'Tool: sanctions/PEP screening returned a medium adverse-media hit.',
    ],
    card: [
      'Knowledge: "impossible travel + new device" maps to the card-takeover pattern.',
      'Memory: comparable cases had a 96% confirmed-fraud rate on block+reissue.',
      'Tool: real-time risk model v3.1 re-scored the event at 0.94.',
    ],
    claim: [
      'Knowledge: image-hash reuse + provider concentration = organised claims fraud.',
      'Memory: prior ring was dismantled by freezing payouts to the shared provider.',
      'Tool: graph community-detection confirmed the ring boundary.',
    ],
    takeover: [
      'Knowledge: retrieved the account-takeover response playbook.',
      'Memory: earlier ATO cases resolved by payment freeze + verified reset.',
      'Tool: device-intelligence check flagged the new fingerprint as high-risk.',
    ],
    generic: [
      'Knowledge: relevant fraud typologies and thresholds retrieved.',
      'Memory: outcomes of similar prior cases recalled.',
      'Tool: risk scoring and screening executed with grounded context.',
    ],
  };

  const answers: Record<string, string> = {
    aml: 'Grounded across Microsoft IQ: Fabric IQ confirms a 48-hour layering chain across 4 linked accounts; Work IQ shows the case team already flagged the counterparties and a SAR template is ready; Foundry IQ matches the "layering" typology, the EU reporting threshold and a prior SAR-based resolution. Recommendation: freeze outbound payments, file a SAR, and open a linked-accounts investigation.',
    card: 'Grounded across Microsoft IQ: Fabric IQ ties the €900 ecommerce transaction to a device/IP geo-mismatch and a 4× velocity spike; Work IQ shows the merchant was recently reported and a chargeback is logged; Foundry IQ re-scores the event at 0.94 and recalls a 96% confirmed-fraud rate on block+reissue. Recommendation: block the card, reverse the authorisation and step-up authentication.',
    claim: 'Grounded across Microsoft IQ: Fabric IQ exposes a dense provider–claimant ring (modularity 0.71) with reused damage-photo hashes; Work IQ surfaces a prior report on the provider and an SME reviewer; Foundry IQ confirms the organised-claims pattern and recalls that freezing payouts dismantled a similar ring. Recommendation: freeze payouts to the shared provider and escalate the network for SIU review.',
    takeover: 'Grounded across Microsoft IQ: Fabric IQ shows a reset→new-device→new-beneficiary→wire sequence with impossible travel; Work IQ has a regional advisory and no travel notice on file; Foundry IQ retrieves the ATO playbook and prior freeze+reset resolutions. Recommendation: freeze payments, revoke the device/beneficiary and force a verified credential reset.',
    generic: 'Grounded across Microsoft IQ: Fabric IQ supplies governed data and relationships, Work IQ adds the human/organizational context, and Foundry IQ brings typologies, memory and tools. Together they produce an explainable, decision-ready assessment with a recommended action.',
  };

  return { fabric: fabricIqLive(question), work: work[f], foundry: foundry[f], answer: answers[f] };
}

// ---------------------------------------------------------------------------
// Flagship scenario: real-time card fraud — "90 minutes → 30 seconds"
// ---------------------------------------------------------------------------

export interface Recommendation {
  confidence: number; // 0..1
  actions: string[];
  caseId: string;
}

export interface CardFraudScenario {
  alertId: string;
  customerId: string;
  customerName: string;
  context: string[];
  beforeSteps: string[];
  beforeMinutes: number;
  prompt: string;
  work: string[];
  fabric: string[]; // LIVE from ontology + lakehouse
  foundry: string[];
  recommendation: Recommendation;
  seconds: number;
}

/** Builds the flagship card-fraud scenario. Fabric IQ facts are live from data. */
export function cardFraudScenario(): CardFraudScenario {
  const alert = DATASET.alerts.find((a) => a.alertType === 'Card Fraud') ?? DATASET.alerts[0];
  const c = DATASET.customers.find((x) => x.id === alert.customerId) ?? DATASET.customers[0];
  const txn = DATASET.transactions.find((t) => t.id === alert.transactionId);
  const linkedCase = DATASET.cases.find((cs) => cs.alertId === alert.id);

  const fabric = [
    `Ontology · Customer ${c.id} — ${c.name}, ${c.segment}, ${c.country}; KYC ${c.kycRiskRating}` +
      `${c.pepFlag ? ', PEP' : ''}.`,
    txn
      ? `Lakehouse · Première transaction hors ${c.country} depuis 12 mois : ${euro(txn.amount)} ` +
        `chez ${txn.merchant} (IP ${txn.ipCountry} vs pays carte ${txn.country}).`
      : `Lakehouse · Première transaction hors ${c.country} depuis 12 mois, marchand à l'étranger.`,
    `Comportement · 41 transactions en 4 h — vélocité ~4× la baseline ; achat à 03:00 (horaire atypique) ; mobile géolocalisé dans un autre pays.`,
    `Alert · ${alert.alertType} · risk ${alert.riskScore.toFixed(2)} (${alert.status}) — bound to transaction ${alert.transactionId || '—'}.`,
  ];

  return {
    alertId: alert.id,
    customerId: c.id,
    customerName: c.name,
    context: [
      'Carte bancaire utilisée à 03:00',
      'Paiement dans un hôtel à l’étranger',
      '41 transactions en 4 heures',
      'Pays inhabituel pour le client',
      'Mobile localisé dans un autre pays',
    ],
    beforeSteps: [
      'Consulter le moteur de règles anti-fraude',
      'Vérifier les scores de risque',
      'Interroger le data warehouse',
      'Chercher dans Teams',
      'Lire les emails',
      'Chercher les incidents similaires',
      'Consulter les procédures',
      'Appeler un collègue',
      'Consolider les informations',
      'Prendre une décision',
    ],
    beforeMinutes: 90,
    prompt: 'Analyse cette alerte fraude et recommande une action.',
    work: [
      'Un collègue (a.dupont) a traité un cas quasi identique il y a 5 jours.',
      'Des échanges Teams dans le canal « Fraud-EMEA » mentionnent le même hôtel.',
      'Une enquête similaire existe déjà et peut être réutilisée comme modèle.',
      'Le client a potentiellement signalé un problème via le support auparavant.',
    ],
    fabric,
    foundry: [
      'Applique la politique fraude : géo-mismatch + vélocité anormale + horaire atypique = blocage.',
      'Croise la typologie « card-present takeover / impossible travel » de la base de connaissances.',
      'Mémoire : les cas comparables ont eu 96 % de fraude confirmée sur blocage + réémission.',
      'Génère un raisonnement explicable et une recommandation d’action.',
    ],
    recommendation: {
      confidence: 0.92,
      actions: [
        'Carte temporairement bloquée',
        'Contact client recommandé',
        'Dossier d’investigation créé automatiquement',
      ],
      caseId: linkedCase?.id ?? 'CASE-001',
    },
    seconds: 30,
  };
}

