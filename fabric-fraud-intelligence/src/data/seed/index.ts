import type {
  Account,
  AlertStatus,
  AlertType,
  Claim,
  Customer,
  CustomerEvent,
  Evidence,
  EntityRelationship,
  FraudAlert,
  FraudCase,
  Policy,
  Severity,
  Transaction,
} from '@/backend/models';

export interface Dataset {
  customers: Customer[];
  accounts: Account[];
  policies: Policy[];
  transactions: Transaction[];
  claims: Claim[];
  alerts: FraudAlert[];
  cases: FraudCase[];
  evidence: Evidence[];
  relationships: EntityRelationship[];
  events: CustomerEvent[];
}

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Sofia', 'Liam', 'Amara', 'Noah', 'Chen', 'Yara', 'Marco', 'Isabelle', 'Tobias', 'Priya', 'Oluwaseun', 'Elena', 'Hugo', 'Fatima', 'Lucas', 'Mei', 'Andrei', 'Camille', 'Diego', 'Nadia'];
const LAST = ['Rossi', 'Dubois', 'Okafor', 'Novak', 'Wang', 'Haddad', 'Bianchi', 'Laurent', 'Meyer', 'Sharma', 'Adeyemi', 'Petrov', 'Moreau', 'Khan', 'Silva', 'Tan', 'Ionescu', 'Bernard', 'Garcia', 'Farouk'];
const SEGMENTS = ['Retail', 'SMB', 'Corporate', 'Wealth', 'Insurance'];
const COUNTRIES = ['FR', 'GB', 'US', 'DE', 'NG', 'AE', 'RO', 'LU', 'SG'];
const KYC = ['Low', 'Medium', 'High'];
const MERCHANTS = ['Amazon EU', 'BrightMart', 'CryptoXchange', 'LuxGoods', 'QuickCash ATM', 'GlobalWire Ltd', 'TechBay', 'FuelStop', 'AutoRepair Pro', 'MediCare Clinic'];
const MCC = ['5411', '5732', '6051', '5944', '6011', '4829', '5045', '5541', '7538', '8011'];
const CHANNELS = ['card-present', 'ecommerce', 'atm', 'wire', 'mobile'];
const ANALYSTS = ['a.dupont', 's.martin', 'l.chen', 'k.okafor', 'm.rossi'];

const iso = (daysAgo: number, r: () => number): string =>
  new Date(Date.now() - daysAgo * 86400000 - Math.floor(r() * 86400000)).toISOString();

const pick = <T>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];

function severityOf(score: number): Severity {
  if (score >= 0.9) return 'Critical';
  if (score >= 0.75) return 'High';
  if (score >= 0.5) return 'Medium';
  return 'Low';
}

export function buildDataset(): Dataset {
  const r = rng(2026);

  // Customers ---------------------------------------------------------------
  const customers: Customer[] = Array.from({ length: 20 }, (_, i) => {
    const pep = r() < 0.15;
    const sanctions = r() < 0.08;
    const kyc = pep || sanctions ? 'High' : pick(r, KYC);
    return {
      id: `CUST-${String(i + 1).padStart(3, '0')}`,
      name: `${FIRST[i]} ${LAST[i]}`,
      segment: pick(r, SEGMENTS),
      country: pick(r, COUNTRIES),
      kycRiskRating: kyc,
      pepFlag: pep,
      sanctionsFlag: sanctions,
    };
  });

  // Accounts ----------------------------------------------------------------
  const accounts: Account[] = [];
  customers.forEach((c, i) => {
    const n = 1 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      accounts.push({
        id: `ACC-${String(accounts.length + 1).padStart(3, '0')}`,
        customerId: c.id,
        ibanHash: `IBANH-${(Math.floor(r() * 1e10)).toString(16).toUpperCase()}`,
        accountOpenDate: iso(300 + Math.floor(r() * 1500), r),
        status: r() < 0.9 ? 'active' : 'frozen',
      });
      void i;
    }
  });

  // Policies + Claims (insurance) ------------------------------------------
  const insuranceCustomers = customers.filter((_, i) => i % 2 === 0).slice(0, 8);
  const policies: Policy[] = insuranceCustomers.map((c, i) => ({
    id: `POL-${String(i + 1).padStart(3, '0')}`,
    customerId: c.id,
    policyType: pick(r, ['Auto', 'Home', 'Health', 'Travel']),
    startDate: iso(200 + Math.floor(r() * 800), r),
    premium: Math.round((300 + r() * 2000) * 100) / 100,
    status: 'active',
  }));

  const REPAIR_PROVIDERS = ['AutoRepair Pro', 'FastFix Garage', 'AutoRepair Pro', 'Prime Body Shop', 'FastFix Garage'];
  const claims: Claim[] = policies.map((p, i) => {
    const suspicious = i < 3;
    return {
      id: `CLM-${String(i + 1).padStart(3, '0')}`,
      policyId: p.id,
      customerId: p.customerId,
      claimType: pick(r, ['Collision', 'Water Damage', 'Theft', 'Medical']),
      claimDate: iso(2 + Math.floor(r() * 40), r),
      amountClaimed: Math.round((1000 + r() * (suspicious ? 40000 : 12000)) * 100) / 100,
      repairProvider: suspicious ? 'AutoRepair Pro' : pick(r, REPAIR_PROVIDERS),
      status: 'under_review',
      location: pick(r, ['Paris', 'Lyon', 'London', 'Berlin', 'Dubai']),
    };
  });

  // Transactions ------------------------------------------------------------
  const transactions: Transaction[] = Array.from({ length: 100 }, (_, i) => {
    const acc = pick(r, accounts);
    const channel = pick(r, CHANNELS);
    const mi = Math.floor(r() * MERCHANTS.length);
    const country = pick(r, COUNTRIES);
    const highRisk = r() < 0.2;
    return {
      id: `TXN-${String(i + 1).padStart(4, '0')}`,
      accountId: acc.id,
      timestamp: iso(Math.floor(r() * 20), r),
      amount: Math.round((5 + r() * (highRisk ? 9000 : 800)) * 100) / 100,
      currency: pick(r, ['EUR', 'USD', 'GBP', 'AED']),
      merchant: MERCHANTS[mi],
      merchantCategory: MCC[mi],
      channel,
      country,
      deviceId: `DEV-${(Math.floor(r() * 9000) + 1000).toString()}`,
      ipCountry: highRisk ? pick(r, ['NG', 'RO', 'AE']) : country,
      counterpartyId: r() < 0.4 ? pick(r, accounts).id : '',
    };
  });

  // Hero alerts (rich demo scenarios) + filler -----------------------------
  const alerts: FraudAlert[] = [];
  const pushAlert = (
    a: Omit<FraudAlert, 'id' | 'severity' | 'createdAt'> & { daysAgo?: number }
  ) => {
    alerts.push({
      id: `ALT-${String(alerts.length + 1).padStart(3, '0')}`,
      severity: severityOf(a.riskScore),
      createdAt: iso(a.daysAgo ?? Math.floor(r() * 5), r),
      alertType: a.alertType,
      source: a.source,
      riskScore: a.riskScore,
      status: a.status,
      customerId: a.customerId,
      transactionId: a.transactionId,
      claimId: a.claimId,
      explanationShort: a.explanationShort,
    });
  };

  const cardTxn = transactions.find((t) => t.channel === 'ecommerce' && t.ipCountry !== t.country) ?? transactions[0];
  pushAlert({
    alertType: 'Card Fraud',
    source: 'Real-time scoring model v3.1',
    riskScore: 0.94,
    status: 'New',
    customerId: accounts.find((a) => a.id === cardTxn.accountId)!.customerId,
    transactionId: cardTxn.id,
    claimId: '',
    explanationShort: `High-value ${cardTxn.currency} ${cardTxn.amount} ecommerce purchase with device/IP geo mismatch (${cardTxn.ipCountry} vs ${cardTxn.country}).`,
    daysAgo: 0,
  });

  const amlCust = customers.find((c) => c.segment === 'Corporate') ?? customers[3];
  pushAlert({
    alertType: 'AML',
    source: 'Transaction monitoring — layering rule',
    riskScore: 0.88,
    status: 'In Review',
    customerId: amlCust.id,
    transactionId: transactions.find((t) => t.channel === 'wire')?.id ?? '',
    claimId: '',
    explanationShort: 'Rapid wire layering across 4 linked accounts within 48h, funds consolidated then withdrawn.',
    daysAgo: 1,
  });

  const pepCust = customers.find((c) => c.pepFlag) ?? customers[0];
  pushAlert({
    alertType: 'KYC',
    source: 'Periodic KYC refresh engine',
    riskScore: 0.7,
    status: 'New',
    customerId: pepCust.id,
    transactionId: '',
    claimId: '',
    explanationShort: `PEP customer with stale KYC (last refresh > 24 months) and new high-risk counterparties.`,
    daysAgo: 2,
  });

  const claimHero = claims[0];
  pushAlert({
    alertType: 'Claims Fraud',
    source: 'Claims anomaly + image forensics',
    riskScore: 0.91,
    status: 'In Review',
    customerId: claimHero.customerId,
    transactionId: '',
    claimId: claimHero.id,
    explanationShort: `Damage photo hash reused across 3 claims; provider "${claimHero.repairProvider}" over-represented.`,
    daysAgo: 1,
  });

  pushAlert({
    alertType: 'Collusion Network',
    source: 'Graph community detection',
    riskScore: 0.86,
    status: 'Escalated',
    customerId: claims[1].customerId,
    transactionId: '',
    claimId: claims[1].id,
    explanationShort: 'Repair provider "AutoRepair Pro" linked to 4 claimants and 2 shared devices — probable collusion ring.',
    daysAgo: 2,
  });

  const fillerTypes: AlertType[] = ['Card Fraud', 'AML', 'Identity', 'Card Fraud', 'AML', 'Identity', 'KYC', 'Card Fraud', 'Claims Fraud', 'Collusion Network'];
  const fillerStatus: AlertStatus[] = ['New', 'In Review', 'Closed', 'False Positive', 'Escalated'];
  fillerTypes.forEach((t) => {
    const cust = pick(r, customers);
    const score = Math.round((0.4 + r() * 0.55) * 100) / 100;
    pushAlert({
      alertType: t,
      source: t === 'AML' ? 'Transaction monitoring' : t === 'Identity' ? 'Device intelligence' : 'Scoring model',
      riskScore: score,
      status: pick(r, fillerStatus),
      customerId: cust.id,
      transactionId: t === 'Claims Fraud' || t === 'Collusion Network' ? '' : pick(r, transactions).id,
      claimId: t === 'Claims Fraud' || t === 'Collusion Network' ? pick(r, claims).id : '',
      explanationShort:
        t === 'Identity'
          ? 'New device + impossible travel; identity takeover suspected.'
          : t === 'AML'
            ? 'Structuring pattern just below reporting threshold.'
            : t === 'KYC'
              ? 'Beneficial ownership mismatch on refresh.'
              : 'Anomalous spend vs behavioural baseline.',
    });
  });

  // Cases (one per alert) ---------------------------------------------------
  const cases: FraudCase[] = alerts.map((a, i) => ({
    id: `CASE-${String(i + 1).padStart(3, '0')}`,
    alertId: a.id,
    assignedTo: ANALYSTS[i % ANALYSTS.length],
    status:
      a.status === 'Escalated'
        ? 'Escalated'
        : a.status === 'Closed' || a.status === 'False Positive'
          ? 'Closed'
          : i % 3 === 0
            ? 'Open'
            : 'Investigating',
    decision:
      a.status === 'False Positive'
        ? 'Close - False Positive'
        : a.status === 'Escalated'
          ? 'Escalate'
          : 'Pending',
    decisionReason: '',
    createdAt: a.createdAt,
    updatedAt: a.createdAt,
  }));

  // Evidence (30) -----------------------------------------------------------
  const evidence: Evidence[] = [];
  const evTemplates: Record<AlertType, { type: string; title: string; content: string; src: string }[]> = {
    'Card Fraud': [
      { type: 'signal', title: 'Geo/IP mismatch', content: 'Transaction IP resolved to a country different from the card billing country; velocity 4x baseline.', src: 'Fabric Warehouse' },
      { type: 'model', title: 'Model attribution', content: 'Top SHAP drivers: amount_zscore, new_device, ip_country_risk.', src: 'Risk Scoring Service' },
    ],
    AML: [
      { type: 'pattern', title: 'Layering chain', content: 'A→B→C→cash-out within 48h; 92% of inflow externalised.', src: 'Transaction Monitoring' },
      { type: 'narrative', title: 'Suspicious activity', content: 'Round-amount wires inconsistent with declared business activity.', src: 'AML Case Agent' },
    ],
    KYC: [
      { type: 'record', title: 'KYC staleness', content: 'Last CDD 26 months ago; PEP status active; adverse media hit (medium).', src: 'KYC Engine' },
    ],
    Identity: [
      { type: 'signal', title: 'Impossible travel', content: 'Two logins 900km apart within 20 minutes on new device fingerprint.', src: 'Device Intelligence' },
    ],
    'Claims Fraud': [
      { type: 'forensic', title: 'Image hash reuse', content: 'Perceptual hash of damage photo matches 2 prior claims (distance 3).', src: 'Image Forensics' },
      { type: 'anomaly', title: 'Provider concentration', content: 'Repair provider appears in 4 flagged claims this quarter.', src: 'Claims Analytics' },
    ],
    'Collusion Network': [
      { type: 'graph', title: 'Community', content: 'Dense subgraph: 1 provider, 4 claimants, 2 shared devices, modularity 0.71.', src: 'Graph Engine' },
    ],
  };
  cases.forEach((cs) => {
    const alert = alerts.find((a) => a.id === cs.alertId)!;
    const tmpl = evTemplates[alert.alertType];
    tmpl.forEach((t) => {
      evidence.push({
        id: `EVD-${String(evidence.length + 1).padStart(3, '0')}`,
        caseId: cs.id,
        evidenceType: t.type,
        title: t.title,
        content: t.content,
        sourceSystem: t.src,
        confidence: Math.round((0.7 + r() * 0.29) * 100) / 100,
        createdAt: cs.createdAt,
      });
    });
    if (evidence.length < 30 && r() < 0.6) {
      evidence.push({
        id: `EVD-${String(evidence.length + 1).padStart(3, '0')}`,
        caseId: cs.id,
        evidenceType: 'context',
        title: 'Customer risk context',
        content: `Segment ${customers.find((c) => c.id === alert.customerId)?.segment}; KYC ${customers.find((c) => c.id === alert.customerId)?.kycRiskRating}.`,
        sourceSystem: 'Fabric Warehouse',
        confidence: Math.round((0.6 + r() * 0.3) * 100) / 100,
        createdAt: cs.createdAt,
      });
    }
  });
  while (evidence.length < 30) {
    const cs = pick(r, cases);
    evidence.push({
      id: `EVD-${String(evidence.length + 1).padStart(3, '0')}`,
      caseId: cs.id,
      evidenceType: 'context',
      title: 'Historical behaviour',
      content: 'No prior confirmed fraud; 2 previously cleared alerts in 12 months.',
      sourceSystem: 'Fabric Warehouse',
      confidence: Math.round((0.5 + r() * 0.4) * 100) / 100,
      createdAt: cs.createdAt,
    });
  }

  // Entity relationships (collusion network, 20) ---------------------------
  const relationships: EntityRelationship[] = [];
  const provider = 'AutoRepair Pro';
  const ringClaimants = claims.slice(0, 4).map((c) => c.customerId);
  ringClaimants.forEach((cid) => {
    relationships.push({
      id: `REL-${String(relationships.length + 1).padStart(3, '0')}`,
      sourceEntityId: cid,
      targetEntityId: provider,
      relationshipType: 'claims_at_provider',
      weight: Math.round((0.6 + r() * 0.4) * 100) / 100,
    });
  });
  ['DEV-4821', 'DEV-4821', 'DEV-7710'].forEach((dev, i) => {
    relationships.push({
      id: `REL-${String(relationships.length + 1).padStart(3, '0')}`,
      sourceEntityId: ringClaimants[i % ringClaimants.length],
      targetEntityId: dev,
      relationshipType: 'shared_device',
      weight: Math.round((0.7 + r() * 0.3) * 100) / 100,
    });
  });
  while (relationships.length < 20) {
    const a = pick(r, customers).id;
    let b = pick(r, customers).id;
    if (b === a) b = provider;
    relationships.push({
      id: `REL-${String(relationships.length + 1).padStart(3, '0')}`,
      sourceEntityId: a,
      targetEntityId: b,
      relationshipType: pick(r, ['shared_ip', 'same_counterparty', 'shared_beneficiary', 'co_signer']),
      weight: Math.round((0.3 + r() * 0.6) * 100) / 100,
    });
  }

  // Customer 360 event journeys (fraud is one event type) ------------------
  const CITY: Record<string, string> = {
    FR: 'Paris, France', GB: 'London, UK', US: 'New York, USA', DE: 'Berlin, Germany',
    NG: 'Lagos, Nigeria', AE: 'Dubai, UAE', RO: 'Bucharest, Romania', LU: 'Luxembourg', SG: 'Singapore',
  };
  const HOME_CITIES = ['Paris, France', 'London, UK', 'Madrid, Spain', 'Milan, Italy', 'Berlin, Germany', 'Amsterdam, NL', 'Lisbon, Portugal', 'Dublin, Ireland', 'Brussels, Belgium', 'Vienna, Austria'];
  const FOREIGN = ['Beijing, China', 'Lagos, Nigeria', 'Bucharest, Romania', 'Moscow, Russia', 'Dubai, UAE', 'Karachi, Pakistan', 'Kyiv, Ukraine'];
  const ONLINE = ['Web', 'Mobile'];

  type Amt = [number, number] | null;
  interface Stage { event: string; channels: string[]; foreign?: boolean; amount?: Amt; optional?: boolean; desc: string }
  interface Archetype { terminal: string; weight: number; stages: Stage[] }

  const CONSULT: Stage = { event: 'Web account consultation', channels: ONLINE, desc: 'Checked account balance' };
  const LOGIN: Stage = { event: 'Mobile login', channels: ['Mobile'], desc: 'Routine mobile login', optional: true };
  const BRANCH: Stage = { event: 'Branch visit', channels: ['In-branch'], desc: 'Visited local branch', optional: true };

  const archetypes: Archetype[] = [
    { terminal: 'Fraud: Card Fraud', weight: 22, stages: [
      CONSULT, LOGIN,
      { event: 'New device', channels: ONLINE, foreign: true, desc: 'New device fingerprint' },
      { event: 'Debit card', channels: ['Web'], foreign: true, amount: [5, 30], desc: 'Online payment' },
      { event: 'Debit card', channels: ['Web'], foreign: true, amount: [5, 40], desc: 'Online payment' },
      { event: 'Debit card', channels: ['Web'], foreign: true, amount: [150, 900], desc: 'Online payment' },
      { event: 'Fraud: Card Fraud', channels: ['—'], foreign: true, desc: 'Fraud detected — card fraud, impossible travel / location' },
    ] },
    { terminal: 'Fraud: Account Takeover', weight: 16, stages: [
      CONSULT,
      { event: 'Password reset', channels: ONLINE, foreign: true, desc: 'Password reset from new IP' },
      { event: 'New device', channels: ['Mobile'], foreign: true, desc: 'Unrecognized device enrolled' },
      { event: 'Add beneficiary', channels: ['Web'], foreign: true, desc: 'New beneficiary added' },
      { event: 'Wire transfer', channels: ['Web'], foreign: true, amount: [2500, 6000], desc: 'Outbound wire to new beneficiary' },
      { event: 'Fraud: Account Takeover', channels: ['—'], foreign: true, desc: 'Fraud detected — account takeover' },
    ] },
    { terminal: 'Fraud: Money Mule', weight: 14, stages: [
      { event: 'Incoming wire', channels: ['Web'], amount: [5000, 12000], desc: 'Large inbound transfer' },
      LOGIN,
      { event: 'Wire transfer', channels: ['Web', 'In-branch'], amount: [2000, 4000], desc: 'Outbound wire (layering)' },
      { event: 'Wire transfer', channels: ['Web'], amount: [2000, 4000], desc: 'Outbound wire (layering)' },
      { event: 'ATM withdrawal', channels: ['ATM'], amount: [500, 2000], desc: 'Cash-out' },
      { event: 'Fraud: Money Mule', channels: ['—'], desc: 'Fraud detected — mule account, layering & cash-out' },
    ] },
    { terminal: 'Fraud: Identity Fraud', weight: 12, stages: [
      { event: 'New device', channels: ['Mobile'], foreign: true, desc: 'Onboarding on new device' },
      { event: 'KYC update', channels: ONLINE, foreign: true, desc: 'Identity documents updated' },
      { event: 'Address change', channels: ONLINE, foreign: true, desc: 'Address changed' },
      { event: 'Card issued', channels: ['In-branch'], foreign: true, desc: 'New card requested' },
      { event: 'Fraud: Identity Fraud', channels: ['—'], foreign: true, desc: 'Fraud detected — synthetic identity' },
    ] },
    { terminal: 'Card renewal', weight: 9, stages: [
      CONSULT, LOGIN,
      { event: 'Debit card', channels: ['In-branch', 'Web', 'Mobile'], amount: [10, 120], desc: 'Everyday purchase' },
      { event: 'Debit card', channels: ['Web', 'Mobile'], amount: [10, 200], desc: 'Everyday purchase' },
      BRANCH,
      { event: 'Card renewal', channels: ['In-branch'], desc: 'Card renewed' },
    ] },
    { terminal: 'Address change', weight: 7, stages: [
      CONSULT,
      { event: 'Debit card', channels: ['Web', 'Mobile'], amount: [20, 250], desc: 'Online purchase' },
      LOGIN,
      { event: 'Address change', channels: ONLINE, desc: 'Address updated' },
    ] },
    { terminal: 'ATM withdrawal', weight: 9, stages: [
      LOGIN, CONSULT,
      { event: 'Debit card', channels: ['In-branch', 'Web'], amount: [10, 90], desc: 'Everyday purchase' },
      { event: 'ATM withdrawal', channels: ['ATM'], amount: [40, 400], desc: 'Cash withdrawal' },
    ] },
    { terminal: 'Loan approved', weight: 5, stages: [
      CONSULT, BRANCH,
      { event: 'Loan application', channels: ['In-branch', 'Web'], desc: 'Applied for a loan' },
      { event: 'KYC update', channels: ['In-branch'], desc: 'KYC documents refreshed' },
      { event: 'Loan approved', channels: ['In-branch'], desc: 'Loan approved' },
    ] },
    { terminal: 'Account review passed', weight: 6, stages: [
      LOGIN, CONSULT,
      { event: 'Statement download', channels: ONLINE, desc: 'Downloaded statement' },
      { event: 'Account review passed', channels: ['Phone'], desc: 'Periodic review — no issue' },
    ] },
  ];

  const totalW = archetypes.reduce((s, a) => s + a.weight, 0);
  const pickArch = (): Archetype => {
    let x = r() * totalW;
    for (const a of archetypes) {
      x -= a.weight;
      if (x <= 0) return a;
    }
    return archetypes[0];
  };
  const FILLERS: Stage[] = [
    { event: 'Web account consultation', channels: ONLINE, desc: 'Checked account balance' },
    { event: 'Mobile login', channels: ['Mobile'], desc: 'Routine mobile login' },
    { event: 'Statement download', channels: ONLINE, desc: 'Downloaded statement' },
    { event: 'Branch visit', channels: ['In-branch'], desc: 'Visited local branch' },
  ];

  const events: CustomerEvent[] = [];
  let evId = 0;
  const custIds = [
    ...customers.map((c) => c.id),
    ...Array.from({ length: 9980 }, (_, i) => `CX-${String(i + 21).padStart(5, '0')}`),
  ];
  custIds.forEach((cid, idx) => {
    const home = idx < customers.length ? (CITY[customers[idx].country] ?? 'Paris, France') : HOME_CITIES[idx % HOME_CITIES.length];
    const foreign = FOREIGN[idx % FOREIGN.length];
    const arch = pickArch();
    const nf = Math.floor(r() * 3); // 0-2 filler pre-events add journey depth
    const pre = Array.from({ length: nf }, () => FILLERS[Math.floor(r() * FILLERS.length)]);
    const stages = [...pre, ...arch.stages];
    let t = Date.now() - (5 + Math.floor(r() * 40)) * 86400000;
    for (const s of stages) {
      if (s.optional && r() < 0.45) continue;
      t += (5 + Math.floor(r() * 2880)) * 60000;
      evId += 1;
      const amount = s.amount ? Math.round((s.amount[0] + r() * (s.amount[1] - s.amount[0])) * 100) / 100 : null;
      events.push({
        id: `EVT-${String(evId).padStart(4, '0')}`,
        customerId: cid,
        event: s.event,
        occurredAt: new Date(t).toISOString(),
        location: s.foreign ? foreign : home,
        channel: s.channels[Math.floor(r() * s.channels.length)],
        amount,
        description: s.desc,
      });
    }
  });

  return { customers, accounts, policies, transactions, claims, alerts, cases, evidence, relationships, events };
}

export const DATASET: Dataset = buildDataset();
