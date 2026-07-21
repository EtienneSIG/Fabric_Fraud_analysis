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
  synthesis: Synthesis;
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

  const synth: Record<string, Synthesis> = {
    aml: {
      verdict: 'Blanchiment probable — schéma de layering coordonné',
      confidence: 0.88,
      rationale:
        'En croisant les trois IQ, le faisceau est convergent. Fabric IQ établit, sur les données réelles, une chaîne de layering sur 48 h à travers 4 comptes liés, avec ~92 % des entrées ré-externalisées et des montants ronds incohérents avec l’activité déclarée. Work IQ montre que l’équipe a déjà signalé ces contreparties et qu’un modèle de SAR est prêt. Foundry IQ rattache le motif à la typologie « layering », au seuil de déclaration UE et à une résolution antérieure par SAR. Ensemble, structuration + vélocité + ré-externalisation rapide corroborent une intention d’obscurcir l’origine des fonds.',
      findings: [
        'Fabric IQ · chaîne A→B→C→cash-out en <48 h sur 4 comptes liés',
        'Fabric IQ · 92 % des entrées externalisées, montants ronds atypiques',
        'Work IQ · contreparties déjà signalées par l’équipe AML-EMEA',
        'Foundry IQ · typologie « layering » + seuil de déclaration UE atteint',
      ],
      actions: [
        'Geler les paiements sortants du compte',
        'Ouvrir une investigation sur les comptes liés',
        'Préparer et déposer un SAR auprès du MLRO (approbation humaine)',
      ],
      businessImpact: [
        'Dépôt de SAR accéléré : de ~90 min d’investigation à quelques secondes.',
        'Risque réglementaire et amendes réduits par une détection précoce du layering.',
        'Moins de faux positifs → temps analyste réalloué aux vrais cas.',
      ],
    },
    card: {
      verdict: 'Fraude carte très probable — prise de contrôle / voyage impossible',
      confidence: 0.94,
      rationale:
        'Fabric IQ relie, en direct, la transaction e-commerce à un écart d’emplacement carte/IP et à un pic de vélocité 4× la baseline, sur un appareil vu pour la première fois quelques minutes avant. Work IQ indique que le marchand a été récemment signalé et qu’un chargeback est déjà journalisé. Foundry IQ re-score l’événement à 0,94 et rappelle un taux de fraude confirmée de 96 % sur blocage + réémission pour des cas comparables. La convergence géo + vélocité + nouvel appareil rend le scénario de fraude dominant.',
      findings: [
        'Fabric IQ · géo-mismatch carte/IP + vélocité 4× baseline',
        'Fabric IQ · nouvel appareil vu 12 min avant la transaction',
        'Work IQ · marchand signalé récemment, chargeback journalisé',
        'Foundry IQ · 96 % de fraude confirmée sur blocage + réémission (cas similaires)',
      ],
      actions: [
        'Bloquer la carte et inverser l’autorisation contestée',
        'Renforcer l’authentification (step-up) sur le compte',
        'Contacter le client pour confirmation',
      ],
      businessImpact: [
        'Pertes évitées : blocage en temps réel avant l’enchaînement des transactions.',
        'Expérience client préservée grâce à un step-up ciblé plutôt qu’un blocage massif.',
        'Chargebacks et coûts de traitement réduits.',
      ],
    },
    claim: {
      verdict: 'Réseau de fraude documentaire aux sinistres',
      confidence: 0.9,
      rationale:
        'Fabric IQ expose un sous-graphe dense prestataire–assurés (modularité 0,71) avec réutilisation de hash de photos de dommages sur plusieurs sinistres. Work IQ remonte un rapport antérieur sur le prestataire et un expert SIU recommandé. Foundry IQ confirme le motif de fraude organisée et rappelle que le gel des paiements au prestataire partagé a démantelé un réseau similaire. La concentration prestataire + preuves réutilisées pointe vers une collusion plutôt que des cas isolés.',
      findings: [
        'Fabric IQ · sous-graphe dense (modularité 0,71) prestataire–assurés',
        'Fabric IQ · hash de photo de dommage réutilisé sur 3 sinistres',
        'Work IQ · rapport antérieur sur le prestataire disponible',
        'Foundry IQ · précédent résolu par gel des paiements au prestataire',
      ],
      actions: [
        'Geler les paiements vers le prestataire partagé',
        'Escalader le réseau vers la cellule SIU',
        'Rouvrir les sinistres liés pour contrôle',
      ],
      businessImpact: [
        'Économies directes : indemnisations frauduleuses stoppées avant paiement.',
        'Réseau démantelé en une passe — ROI de la cellule SIU.',
        'Dossiers étayés et défendables en cas de contentieux.',
      ],
    },
    takeover: {
      verdict: 'Prise de contrôle de compte (ATO) en cours',
      confidence: 0.9,
      rationale:
        'Fabric IQ trace la séquence réinitialisation→nouvel appareil→nouveau bénéficiaire→virement sortant, avec un voyage impossible (deux connexions à 900 km en 20 min). Work IQ dispose d’une alerte régionale et d’aucune notification de voyage au dossier. Foundry IQ récupère le playbook ATO et des résolutions antérieures par gel + réinitialisation vérifiée. Le chaînage rapide des changements sensibles depuis une IP étrangère signe une prise de contrôle.',
      findings: [
        'Fabric IQ · reset → nouvel appareil → nouveau bénéficiaire → virement',
        'Fabric IQ · voyage impossible (900 km en 20 min)',
        'Work IQ · avis régional ATO, aucune notif de voyage au dossier',
        'Foundry IQ · playbook ATO + résolutions gel + reset vérifié',
      ],
      actions: [
        'Geler les paiements et révoquer appareil/bénéficiaire',
        'Forcer une réinitialisation d’identifiants vérifiée',
        'Contacter le client via un canal de confiance',
      ],
      businessImpact: [
        'Fonds clients protégés par un gel avant externalisation.',
        'Confiance et rétention client renforcées.',
        'Moins d’incidents ATO récurrents grâce au playbook réutilisé.',
      ],
    },
    generic: {
      verdict: 'Signal à investiguer — contexte multi-IQ consolidé',
      confidence: 0.75,
      rationale:
        'Fabric IQ fournit les faits gouvernés et les relations depuis l’ontologie et le lakehouse ; Work IQ ajoute le contexte humain et organisationnel (échanges, documents, propriétaire du cas) ; Foundry IQ apporte les typologies, la mémoire des cas et les outils. Ensemble, ils produisent une évaluation explicable et prête à la décision, avec une recommandation d’action.',
      findings: [
        'Fabric IQ · entité résolue : client, comptes, transactions, alertes',
        'Fabric IQ · liens de partage d’entités récupérés pour le contexte',
        'Work IQ · discussions et documents pertinents localisés',
        'Foundry IQ · typologies et cas similaires rappelés',
      ],
      actions: [
        'Prioriser selon la centralité dans le graphe',
        'Rassembler les preuves et documenter le cas',
        'Décider (surveillance / escalade) avec approbation humaine',
      ],
      businessImpact: [
        'Investigation de ~90 min ramenée à quelques secondes.',
        'Décisions expliquées et auditables → conformité facilitée.',
        'Productivité analyste et time-to-decision fortement améliorés.',
      ],
    },
  };

  return { fabric: fabricIqLive(question), work: work[f], foundry: foundry[f], synthesis: synth[f] };
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

