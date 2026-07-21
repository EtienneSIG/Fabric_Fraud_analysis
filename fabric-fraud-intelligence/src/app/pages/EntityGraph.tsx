import { useEffect, useMemo, useRef, useState } from 'react';

import { EntityNetwork, KIND_COLORS, type GraphMetric } from '@/app/components/EntityNetwork';
import { getEntityGraph } from '@/backend/api/entity-graph';
import { entityNarrative } from '@/backend/api/narrative';

const METRICS: { id: GraphMetric; label: string }[] = [
  { id: 'degree', label: 'Degree' },
  { id: 'closeness', label: 'Closeness' },
  { id: 'betweenness', label: 'Betweenness' },
];

export function EntityGraph() {
  const { nodes, edges } = useMemo(() => getEntityGraph(), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [metric, setMetric] = useState<GraphMetric>('degree');

  // Fraud-type filter (multi-select). Empty set = show all fraud types.
  const fraudTypes = useMemo(
    () => nodes.filter((n) => n.kind === 'fraud').map((n) => ({ id: n.id, label: n.label })),
    [nodes]
  );
  const [selTypes, setSelTypes] = useState<Set<string>>(new Set());
  const toggleType = (id: string) =>
    setSelTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const shown = useMemo(() => {
    if (selTypes.size === 0) return { nodes, edges };
    const keep = new Set<string>();
    for (const n of nodes) {
      if (n.kind === 'fraud' && selTypes.has(n.id)) keep.add(n.id);
      else if (n.kind === 'customer' && n.fraudType && selTypes.has(n.fraudType)) keep.add(n.id);
    }
    return {
      nodes: nodes.filter((n) => keep.has(n.id)),
      edges: edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
    };
  }, [selTypes, nodes, edges]);

  const node = shown.nodes.find((n) => n.id === selected) ?? null;
  const links = useMemo(() => {
    if (!selected) return [];
    return shown.edges
      .filter((e) => e.source === selected || e.target === selected)
      .map((e) => ({
        other: e.source === selected ? e.target : e.source,
        type: e.relationshipType,
        weight: e.weight,
      }))
      .sort((a, b) => b.weight - a.weight);
  }, [selected, shown.edges]);

  const sharedCount = useMemo(() => links.filter((l) => l.type.includes('shared')).length, [links]);
  const narrative = useMemo(() => (node ? entityNarrative(node, sharedCount) : null), [node, sharedCount]);

  // Measure the graph container so the network fills 100% of the available height.
  const graphRef = useRef<HTMLDivElement>(null);
  const [graphH, setGraphH] = useState(640);
  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const h = Math.round(entries[0].contentRect.height);
      if (h > 120) setGraphH(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] gap-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Entity Graph</h2>
        <p className="text-sm text-gray-400">
          Built from the Customer 360 event table — red hubs are fraud types,
          the other nodes are customers whose journey ended in that fraud.
        </p>
      </div>

      <section className="ffi-card p-6 flex-1 flex flex-col min-h-0">
        <div className="flex flex-wrap items-center gap-4 mb-3">
          {(['fraud', 'customer'] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: KIND_COLORS[k] }} />
              <span className="text-xs text-gray-500 capitalize">{k}</span>
            </span>
          ))}
          <label className="flex items-center gap-2 text-xs text-gray-500 ml-auto">
            Size by
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as GraphMetric)}
              className="rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
            >
              {METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Fraud-type filter */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-medium text-gray-500">Filter fraud:</span>
          <button
            onClick={() => setSelTypes(new Set())}
            className={`rounded-full px-3 py-1 text-xs font-medium border ${
              selTypes.size === 0
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {fraudTypes.map((f) => {
            const on = selTypes.has(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggleType(f.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium border ${
                  on
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            );
          })}
          <span className="text-xs text-gray-400 ml-auto">
            {shown.nodes.length} nodes · size = {metric}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          <div ref={graphRef} className="lg:col-span-2 rounded-xl border border-gray-100 overflow-hidden min-h-0 h-full">
            <EntityNetwork
              nodes={shown.nodes}
              edges={shown.edges}
              selected={selected}
              onSelect={setSelected}
              height={graphH}
              metric={metric}
            />
          </div>
          <div className="rounded-xl border border-gray-100 p-4 min-h-0 h-full overflow-auto">
            {node ? (
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: KIND_COLORS[node.kind] }} />
                  <h3 className="text-sm font-semibold text-gray-800">{node.label}</h3>
                </div>
                <p className="text-xs text-gray-400 mt-1 capitalize">
                  {node.kind} · risk {node.risk.toFixed(2)}
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Metric k="Degree" v={node.degree} active={metric === 'degree'} />
                  <Metric k="Closeness" v={node.closeness} active={metric === 'closeness'} />
                  <Metric k="Betweenness" v={node.betweenness} active={metric === 'betweenness'} />
                </div>
                <div className="mt-4 overflow-hidden rounded-xl border border-indigo-100">
                  <div className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-white">
                    <span aria-hidden>✨</span>
                    <h4 className="text-xs font-semibold uppercase tracking-wide">AI narrative</h4>
                    <span className="ml-auto text-[10px] text-indigo-100">Fabric Data Agent</span>
                  </div>
                  {narrative && (
                    <div className="space-y-2.5 bg-white p-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                          style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}
                        >
                          {narrative.typeLabel}
                        </span>
                        <div className="ml-auto flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400">risk</span>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                            <div className="h-full bg-red-600" style={{ width: `${narrative.riskPct}%` }} />
                          </div>
                          <span className="text-[11px] font-bold text-red-700">{narrative.riskPct}</span>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-gray-700">{narrative.summary}</p>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Key signals</p>
                        <ul className="mt-1 space-y-1">
                          {narrative.signals.map((s, i) => (
                            <li key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-gray-600">
                              <span className="text-indigo-500">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-gray-600">
                        <span className="font-semibold text-gray-500">Network · </span>
                        {narrative.network}
                      </div>
                      <div className="rounded-lg border-l-2 border-green-400 bg-green-50 px-2.5 py-1.5 text-[11px] text-gray-700">
                        <span className="font-semibold text-green-700">Recommended · </span>
                        {narrative.action}
                      </div>
                    </div>
                  )}
                </div>
                <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Relationships ({links.length})
                </h4>
                <ul className="mt-2 space-y-1.5">
                  {links.map((l, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between text-sm cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1"
                      onClick={() => setSelected(l.other)}
                    >
                      <span className="text-gray-700">{l.other}</span>
                      <span className={`text-xs ${l.type.includes('shared') ? 'text-red-600' : 'text-gray-400'}`}>
                        {l.type} · {(l.weight * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-center text-gray-400 text-sm py-16">
                Click an entity to inspect its network.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ k, v, active }: { k: string; v: number; active: boolean }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 text-center ${active ? 'bg-indigo-50' : 'bg-gray-50'}`}>
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{k}</p>
      <p className={`text-sm font-semibold ${active ? 'text-indigo-700' : 'text-gray-700'}`}>{v}</p>
    </div>
  );
}
