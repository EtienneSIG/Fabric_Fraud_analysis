import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SankeyLink, SankeyNode } from '@/backend/api/flow';

interface Props {
  nodes: SankeyNode[];
  links: SankeyLink[];
  columns: readonly string[];
  height?: number;
}

interface Laid {
  node: SankeyNode;
  x: number;
  y0: number;
  h: number;
}

const WIDTH = 1000;
const NODE_W = 12;
const PAD_X = 150;
const PAD_Y = 18;
const GAP = 7;

export function Sankey({ nodes, links, columns, height = 520 }: Props) {
  const { t: tr } = useTranslation();
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const ncol = columns.length;

  const { laid, colX } = useMemo(() => {
    const colX: number[] = [];
    const usable = WIDTH - PAD_X * 2 - NODE_W;
    for (let c = 0; c < ncol; c++) colX.push(PAD_X + (ncol === 1 ? 0 : (usable * c) / (ncol - 1)));
    const byCol: SankeyNode[][] = Array.from({ length: ncol }, () => []);
    for (const n of nodes) byCol[n.col]?.push(n);
    byCol.forEach((col) => col.sort((a, b) => b.value - a.value));
    const totals = byCol.map((col) => col.reduce((s, n) => s + n.value, 0));
    const maxTotal = Math.max(...totals, 1);
    const maxGaps = Math.max(...byCol.map((c) => Math.max(c.length - 1, 0) * GAP), 0);
    const scale = (height - PAD_Y * 2 - maxGaps) / maxTotal;
    const laid = new Map<string, Laid>();
    byCol.forEach((col, ci) => {
      let y = PAD_Y;
      for (const node of col) {
        const h = Math.max(node.value * scale, 3);
        laid.set(node.id, { node, x: colX[ci], y0: y, h });
        y += h + GAP;
      }
    });
    return { laid, colX };
  }, [nodes, height, ncol]);

  const nodeKeys = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const lk of links) for (const id of lk.nodes) {
      if (!map.has(id)) map.set(id, new Set());
      map.get(id)!.add(lk.key);
    }
    return map;
  }, [links]);

  const activeKeys = useMemo<Set<string> | null>(() => {
    if (hoverKey) return new Set([hoverKey]);
    if (hoverNode) return nodeKeys.get(hoverNode) ?? new Set();
    return null;
  }, [hoverKey, hoverNode, nodeKeys]);

  const ribbonGeo = useMemo(() => {
    const outOff = new Map<string, number>();
    const inOff = new Map<string, number>();
    const sorted = [...links].sort((a, b) => (laid.get(a.source)?.y0 ?? 0) - (laid.get(b.source)?.y0 ?? 0));
    const out: { id: string; key: string; d: string; color: string; width: number; value: number; sLabel: string; tLabel: string }[] = [];
    for (const lk of sorted) {
      const s = laid.get(lk.source);
      const t = laid.get(lk.target);
      if (!s || !t) continue;
      const thick = Math.max((lk.value / (s.node.value || 1)) * s.h, 1.2);
      const so = outOff.get(lk.source) ?? 0;
      const to = inOff.get(lk.target) ?? 0;
      outOff.set(lk.source, so + thick);
      inOff.set(lk.target, to + thick);
      const x0 = s.x + NODE_W / 2;
      const x1 = t.x + NODE_W / 2;
      const xm = (x0 + x1) / 2;
      const sy = s.y0 + so + thick / 2;
      const ty = t.y0 + to + thick / 2;
      const d = `M${x0},${sy} C${xm},${sy} ${xm},${ty} ${x1},${ty}`;
      const width = Math.min(Math.max(Math.sqrt(lk.value) * 0.45, 1), 2.5);
      out.push({ id: `${lk.key}:${lk.source}>${lk.target}`, key: lk.key, d, color: lk.color, width, value: lk.value, sLabel: s.node.label, tLabel: t.node.label });
    }
    return out;
  }, [links, laid]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseMove={(e) => {
        const r = wrapRef.current?.getBoundingClientRect();
        if (r) setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
    >
      <svg
        viewBox={`0 0 ${WIDTH} ${height + 26}`}
        className="w-full"
        role="img"
        aria-label="Fraud alert pipeline Sankey"
        onMouseLeave={() => {
          setHoverKey(null);
          setHoverNode(null);
          setTip(null);
        }}
      >
      {columns.map((c, i) => (
        <text key={c} x={colX[i] + NODE_W / 2} y={height + 18} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 11, fontWeight: 600 }}>
          {c}
        </text>
      ))}
      {ribbonGeo.map((rb) => {
        const on = activeKeys ? activeKeys.has(rb.key) : null;
        const strokeOpacity = on === false ? 0.08 : on === true ? 0.82 : 0.4;
        return (
          <path
            key={rb.id}
            d={rb.d}
            fill="none"
            stroke={rb.color}
            strokeOpacity={strokeOpacity}
            strokeWidth={rb.width + (on === true ? 1 : 0)}
            vectorEffect="non-scaling-stroke"
            style={{ cursor: 'pointer', transition: 'stroke-opacity 120ms, stroke-width 120ms' }}
            onMouseEnter={() => {
              setHoverKey(rb.key);
              setTip(`${rb.sLabel} → ${rb.tLabel} · ${tr('components.sankey.customers', { count: rb.value })}`);
            }}
            onMouseLeave={() => {
              setHoverKey(null);
              setTip(null);
            }}
          >
            <title>{tr('components.sankey.customers', { count: rb.value })}</title>
          </path>
        );
      })}
      {[...laid.values()].map(({ node, x, y0, h }) => {
        const on = activeKeys ? [...(nodeKeys.get(node.id) ?? [])].some((k) => activeKeys.has(k)) : null;
        const dim = on === false;
        const isLast = node.col === ncol - 1;
        const isFirst = node.col === 0;
        const anchor = isFirst ? 'end' : isLast ? 'start' : 'middle';
        const tx = isFirst ? x - 7 : isLast ? x + NODE_W + 7 : x + NODE_W / 2;
        const ty = isFirst || isLast ? y0 + h / 2 : y0 - 4;
        return (
          <g key={node.id} onMouseEnter={() => { setHoverNode(node.id); setTip(`${node.label} · ${tr('components.sankey.customers', { count: node.value })}`); }} onMouseLeave={() => { setHoverNode(null); setTip(null); }} style={{ cursor: 'pointer' }}>
            <rect x={x} y={y0} width={NODE_W} height={h} rx={1.5} fill={node.color} opacity={dim ? 0.25 : 0.82} />
            <text x={tx} y={ty} textAnchor={anchor} dominantBaseline={isFirst || isLast ? 'middle' : 'auto'} opacity={dim ? 0.3 : 1} className="fill-slate-600" style={{ fontSize: 10 }}>
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
      {tip && (
        <div
          className="absolute pointer-events-none z-10 rounded-md bg-slate-900 text-white text-xs px-2 py-1 shadow-lg whitespace-nowrap"
          style={{ left: pos.x + 12, top: pos.y + 12 }}
        >
          {tip}
        </div>
      )}
    </div>
  );
}
