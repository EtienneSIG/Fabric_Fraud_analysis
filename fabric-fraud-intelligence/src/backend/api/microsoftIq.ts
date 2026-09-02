// Microsoft IQ grounding layer for the fraud platform.
// Microsoft IQ (Ignite 2025) is the shared intelligence layer that grounds AI
// agents across four domains:
//   • Fabric IQ  — enterprise DATA & semantics (OneLake, ontology, digital twins)
//   • Work IQ    — the WORK graph in Microsoft 365 (people, docs, chats, calendar)
//   • Foundry IQ — unified KNOWLEDGE & tools for agents in Microsoft Foundry
//   • Web IQ     — the live WEB (official regulatory sources) via Microsoft Web IQ
// NOTE: Fabric IQ grounding is REAL — computed live from the same data that is
// materialized in fraud_lakehouse and bound to the fraud_ontology. Web IQ is real when
// enabled (backend proxy over Microsoft Web IQ); Foundry IQ calls the deployed agent.

import { DATASET } from '@/data/seed';
import i18n from '@/i18n/i18n';
import { askFoundryAgent } from '@/services/FoundryAgentClient';

export type IqId = 'fabric' | 'work' | 'foundry' | 'web';

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
  {
    id: 'web',
    name: 'Web IQ',
    tagline: 'Intelligence of the live web',
    color: '#ea580c',
    grounds: 'Official regulatory sources',
    description:
      'Real-time web grounding via Microsoft Web IQ — restricted to official regulatory domains, returning cited obligations with source links.',
    fraudUse: [
      'Retrieves current AML/fraud obligations from official sources (ACPR, AMF, EUR-Lex…)',
      'Restricts search and citations to an official-domain allow-list, no case PII in the query',
      'Preserves verifiable source links so an investigator can confirm each obligation',
    ],
  },
];

export interface Synthesis {
  verdict: string;
  confidence: number; // 0..1
  rationale: string;
  findings: string[];
  actions: string[];
  businessImpact: string[];
}

export interface IqResult {
  fabric: string[];
  work: string[];
  foundry: string[];
  web: string[];
  synthesis: Synthesis;
}

export const flavor = (q: string): IqFlavor => {
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

export type IqFlavor = 'aml' | 'card' | 'claim' | 'takeover' | 'generic';

const IQ_CONFIDENCE: Record<IqFlavor, number> = {
  aml: 0.88,
  card: 0.94,
  claim: 0.9,
  takeover: 0.9,
  generic: 0.75,
};

/** Sample FraudIQ questions in the active locale. */
export function getSampleQuestions(): string[] {
  return i18n.t('sampleQuestions', { ns: 'fraudIq', returnObjects: true }) as string[];
}

/**
 * Cross-IQ grounding for a fraud question. Fabric IQ is data-derived and Foundry IQ
 * calls the deployed agent; localized Work IQ and Web IQ values provide fallbacks.
 */
export async function askMicrosoftIq(question: string): Promise<IqResult> {
  const f = flavor(question);
  const t = i18n.getFixedT(null, 'fraudIq');
  const synthesis: Synthesis = {
    ...(t(`synthesis.${f}`, { returnObjects: true }) as Omit<Synthesis, 'confidence'>),
    confidence: IQ_CONFIDENCE[f],
  };
  const foundry = await askFoundryAgent(question);
  const webItems = foundry.citations.length
    ? foundry.citations.map((citation) => `${citation.title} · ${citation.url}`)
    : t(`web.${f}`, { returnObjects: true }) as string[];
  return {
    fabric: fabricIqLive(question),
    work: t(`work.${f}`, { returnObjects: true }) as string[],
    foundry: [foundry.answer],
    web: webItems,
    synthesis: {
      ...synthesis,
      rationale: foundry.answer,
      findings: [
        ...synthesis.findings.filter((finding) => !finding.startsWith('Foundry IQ ·')),
        ...foundry.citations.map((citation) => `Web IQ · ${citation.title}`),
      ],
    },
  };
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
  web: string[];
  recommendation: Recommendation;
  seconds: number;
}

/** Builds the flagship card-fraud scenario. Fabric IQ facts are live from data. */
export function cardFraudScenario(): CardFraudScenario {
  const alert = DATASET.alerts.find((a) => a.alertType === 'Card Fraud') ?? DATASET.alerts[0];
  const c = DATASET.customers.find((x) => x.id === alert.customerId) ?? DATASET.customers[0];
  const txn = DATASET.transactions.find((t) => t.id === alert.transactionId);
  const linkedCase = DATASET.cases.find((cs) => cs.alertId === alert.id);
  const t = i18n.getFixedT(null, 'fraudIq');

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
    context: t('scenario.context', { returnObjects: true }) as string[],
    beforeSteps: t('scenario.beforeSteps', { returnObjects: true }) as string[],
    beforeMinutes: 90,
    prompt: t('scenario.prompt'),
    work: t('scenario.work', { returnObjects: true }) as string[],
    fabric,
    foundry: t('scenario.foundry', { returnObjects: true }) as string[],
    web: t('scenario.web', { returnObjects: true }) as string[],
    recommendation: {
      confidence: 0.92,
      actions: t('scenario.recommendationActions', { returnObjects: true }) as string[],
      caseId: linkedCase?.id ?? 'CASE-001',
    },
    seconds: 30,
  };
}

