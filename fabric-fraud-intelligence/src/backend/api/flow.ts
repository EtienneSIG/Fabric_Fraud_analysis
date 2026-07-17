import { DATASET } from '@/data/seed';
import type { CustomerEvent } from '@/backend/models';

export interface SankeyNode {
  id: string;
  label: string;
  col: number;
  value: number;
  color: string;
}
export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  key: string;
  nodes: string[];
  color: string;
}

const FRAUD_RED = '#dc2626';

function colorForEvent(event: string): string {
  if (event.startsWith('Fraud')) return FRAUD_RED;
  if (['Debit card', 'Card issued', 'Card renewal'].includes(event)) return '#2563eb';
  if (['Wire transfer', 'Incoming wire', 'ATM withdrawal'].includes(event)) return '#ea580c';
  if (['New device', 'Password reset', 'Add beneficiary', 'KYC update'].includes(event)) return '#9333ea';
  if (['Web account consultation', 'Mobile login'].includes(event)) return '#64748b';
  if (['Block card', 'Unblock card', 'Address change'].includes(event)) return '#0891b2';
  return '#475569';
}

/** Group each customer's events into an ordered sequence (cached). */
let _seqCache: CustomerEvent[][] | null = null;
function sequences(): CustomerEvent[][] {
  if (_seqCache) return _seqCache;
  const m = new Map<string, CustomerEvent[]>();
  for (const e of DATASET.events) {
    const arr = m.get(e.customerId);
    if (arr) arr.push(e);
    else m.set(e.customerId, [e]);
  }
  const seqs = [...m.values()];
  seqs.forEach((arr) => arr.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)));
  _seqCache = seqs;
  return seqs;
}

/** Distinct terminal (last) events across journeys — fraud types listed first. */
export function terminalEvents(): string[] {
  const set = new Set<string>();
  for (const arr of sequences()) if (arr.length) set.add(arr[arr.length - 1].event);
  return [...set].sort(
    (a, b) =>
      (a.startsWith('Fraud') ? 0 : 1) - (b.startsWith('Fraud') ? 0 : 1) || a.localeCompare(b)
  );
}

export function journeyColumns(steps: number): string[] {
  const cols: string[] = [];
  for (let i = 0; i < steps; i++) cols.push(`Step -${steps - i}`);
  cols.push('Selected event');
  return cols;
}

/** Number of journeys ending in each terminal event. */
export function terminalCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const arr of sequences()) {
    if (!arr.length) continue;
    const t = arr[arr.length - 1].event;
    out[t] = (out[t] ?? 0) + 1;
  }
  return out;
}

/** First full customer journey that ends with the selected terminal event. */
export function exampleJourney(terminal: string): CustomerEvent[] {
  for (const arr of sequences()) {
    if (arr.length && arr[arr.length - 1].event === terminal) return arr;
  }
  return [];
}

/**
 * Build a journey Sankey: the selected terminal event is the final column and
 * the `steps` columns to its left are the most frequent preceding events.
 */
export function buildJourneyFlow(
  terminal: string,
  steps = 5
): { nodes: SankeyNode[]; links: SankeyLink[] } {
  const isFraud = terminal.startsWith('Fraud');
  const groups = new Map<string, { ids: string[]; count: number }>();
  for (const arr of sequences()) {
    if (!arr.length || arr[arr.length - 1].event !== terminal) continue;
    const win = arr.slice(Math.max(0, arr.length - (steps + 1)));
    const offset = steps - (win.length - 1);
    const ids = win.map((e, k) => `c${offset + k}:${e.event}`);
    const key = ids.join('>');
    const g = groups.get(key) ?? { ids, count: 0 };
    g.count += 1;
    groups.set(key, g);
  }

  const labelOf = (id: string) => id.slice(id.indexOf(':') + 1);
  const colOf = (id: string) => Number(id.slice(1, id.indexOf(':')));

  const nodes = new Map<string, SankeyNode>();
  const add = (id: string, value: number) => {
    const n = nodes.get(id);
    if (n) n.value += value;
    else nodes.set(id, { id, label: labelOf(id), col: colOf(id), value, color: colorForEvent(labelOf(id)) });
  };

  const links: SankeyLink[] = [];
  for (const [key, g] of groups) {
    g.ids.forEach((id) => add(id, g.count));
    for (let k = 0; k < g.ids.length - 1; k++) {
      links.push({
        source: g.ids[k],
        target: g.ids[k + 1],
        value: g.count,
        key,
        nodes: g.ids,
        color: isFraud ? FRAUD_RED : '#4f46e5',
      });
    }
  }
  return { nodes: [...nodes.values()], links };
}
