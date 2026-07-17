// One-off exporter: writes the app's exact demo dataset to JSONL files so a
// Fabric notebook can materialize them as Delta tables in fraud_lakehouse.
import { mkdirSync, writeFileSync } from 'node:fs';

import { DATASET } from '../src/data/seed';

const OUT = process.argv[2] ?? '../artifacts/lakehouse_data';
mkdirSync(OUT, { recursive: true });

// Cap the behavioural event table to the first N distinct customers to keep the
// upload/table size reasonable while staying at demo scale.
const MAX_EVENT_CUST = 2000;
const allowed = new Set<string>();
for (const e of DATASET.events) {
  if (!allowed.has(e.customerId) && allowed.size < MAX_EVENT_CUST) allowed.add(e.customerId);
}
const events = DATASET.events.filter((e) => allowed.has(e.customerId));

// AgentRun is defined in the ontology but not part of the seed → synthesize a
// few grounded runs from the hero cases so the table is populated.
const AGENTS = ['FraudInvestigationAgent', 'AMLCaseAgent', 'ClaimsFraudAgent'];
const agentRuns = DATASET.cases.slice(0, 6).map((c, i) => ({
  id: `AGR-${String(i + 1).padStart(3, '0')}`,
  caseId: c.id,
  agentName: AGENTS[i % AGENTS.length],
  prompt: `Summarize the risk for case ${c.id} and recommend a disposition.`,
  response: `Grounded assessment for ${c.id}: elevated risk; recommend ${
    c.status === 'Escalated' ? 'escalation to SAR filing' : 'continued investigation with evidence review'
  }.`,
  groundingSources: 'fraud_alert;evidence;transaction',
  createdAt: c.createdAt,
  userId: c.assignedTo,
}));

const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

const tables: Record<string, unknown[]> = {
  customer: DATASET.customers,
  account: DATASET.accounts,
  transaction: DATASET.transactions,
  policy: DATASET.policies,
  claim: DATASET.claims,
  fraud_alert: DATASET.alerts,
  fraud_case: DATASET.cases,
  evidence: DATASET.evidence,
  entity_relationship: DATASET.relationships,
  agent_run: agentRuns,
  customer_event: events,
};

let total = 0;
for (const [name, rows] of Object.entries(tables)) {
  writeFileSync(`${OUT}/${name}.jsonl`, jsonl(rows), 'utf8');
  total += rows.length;
  console.log(`${name}: ${rows.length} rows`);
}
console.log(`TOTAL rows=${total} (events capped to ${allowed.size} customers)`);
