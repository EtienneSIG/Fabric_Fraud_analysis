import { DATASET } from '@/data/seed';
import type { CustomerEvent } from '@/backend/models';

export type GraphNodeKind = 'fraud' | 'customer';

export interface EntityNode {
  id: string;
  label: string;
  kind: GraphNodeKind;
  risk: number;
  degree: number;
  closeness: number;
  betweenness: number;
  fraudType?: string;
}
export interface EntityEdge {
  source: string;
  target: string;
  relationshipType: string;
  weight: number;
}

let _seq: CustomerEvent[][] | null = null;
function sequences(): CustomerEvent[][] {
  if (_seq) return _seq;
  const m = new Map<string, CustomerEvent[]>();
  for (const e of DATASET.events) {
    const arr = m.get(e.customerId);
    if (arr) arr.push(e);
    else m.set(e.customerId, [e]);
  }
  const seqs = [...m.values()];
  seqs.forEach((arr) => arr.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)));
  _seq = seqs;
  return seqs;
}

/**
 * GET /api/entity-graph — built from the Customer 360 event table.
 * Red hub nodes are the fraud TYPES; the other nodes are the CUSTOMERS whose
 * journey ended in that fraud. Customers sharing the same fraud location are
 * linked (potential collusion rings).
 */
export function getEntityGraph(perType = 14): { nodes: EntityNode[]; edges: EntityEdge[] } {
  const groups = new Map<string, { cust: string; last: string; loc: string }[]>();
  for (const arr of sequences()) {
    if (!arr.length) continue;
    const term = arr[arr.length - 1].event;
    if (!term.startsWith('Fraud')) continue;
    const last = arr.length >= 2 ? arr[arr.length - 2].event : 'onboarding';
    const loc = arr[arr.length - 1].location;
    const g = groups.get(term) ?? [];
    if (g.length < perType) g.push({ cust: arr[0].customerId, last, loc });
    groups.set(term, g);
  }

  const nodes: EntityNode[] = [];
  const edges: EntityEdge[] = [];
  const degree = new Map<string, number>();
  const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1);
  const byLoc = new Map<string, string[]>();

  for (const [type, members] of groups) {
    nodes.push({
      id: type,
      label: type.replace('Fraud: ', ''),
      kind: 'fraud',
      risk: 0.95,
      degree: members.length,
      closeness: 0,
      betweenness: 0,
      fraudType: type,
    });
    for (const m of members) {
      nodes.push({ id: m.cust, label: m.cust, kind: 'customer', risk: 0.8, degree: 1, closeness: 0, betweenness: 0, fraudType: type });
      edges.push({ source: m.cust, target: type, relationshipType: `via ${m.last}`, weight: 0.8 });
      bump(m.cust);
      bump(type);
      const arr = byLoc.get(m.loc) ?? [];
      arr.push(m.cust);
      byLoc.set(m.loc, arr);
    }
  }

  // Link customers sharing the same fraud location (collusion signal).
  for (const [loc, custs] of byLoc) {
    for (let i = 0; i < custs.length - 1 && i < 6; i++) {
      edges.push({ source: custs[i], target: custs[i + 1], relationshipType: `shared location: ${loc}`, weight: 0.5 });
      bump(custs[i]);
      bump(custs[i + 1]);
    }
  }

  for (const n of nodes) n.degree = degree.get(n.id) ?? n.degree;

  // Centrality — closeness (BFS) + betweenness (Brandes) on the undirected graph.
  const ids = nodes.map((n) => n.id);
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
    adj.get(e.target)?.push(e.source);
  }
  const between = new Map<string, number>(ids.map((id) => [id, 0]));
  const closeness = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const s of ids) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>(ids.map((i) => [i, []]));
    const sigma = new Map<string, number>(ids.map((i) => [i, 0]));
    const dist = new Map<string, number>(ids.map((i) => [i, -1]));
    sigma.set(s, 1);
    dist.set(s, 0);
    const queue: string[] = [s];
    let head = 0;
    while (head < queue.length) {
      const v = queue[head++];
      stack.push(v);
      for (const w of adj.get(v)!) {
        if (dist.get(w)! < 0) {
          dist.set(w, dist.get(v)! + 1);
          queue.push(w);
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!);
          pred.get(w)!.push(v);
        }
      }
    }
    let sum = 0;
    let reach = 0;
    for (const id of ids) {
      const d = dist.get(id)!;
      if (d > 0) {
        sum += d;
        reach += 1;
      }
    }
    closeness.set(s, sum > 0 ? reach / sum : 0);
    const delta = new Map<string, number>(ids.map((i) => [i, 0]));
    while (stack.length) {
      const w = stack.pop()!;
      for (const v of pred.get(w)!) {
        delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
      }
      if (w !== s) between.set(w, between.get(w)! + delta.get(w)!);
    }
  }
  for (const n of nodes) {
    n.closeness = Math.round((closeness.get(n.id) ?? 0) * 1000) / 1000;
    n.betweenness = Math.round(((between.get(n.id) ?? 0) / 2) * 100) / 100;
  }

  return { nodes, edges };
}
