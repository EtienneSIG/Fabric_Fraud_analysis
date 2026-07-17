import { useMemo, useRef, useState } from 'react';

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
const PAD_X = 90;
const PAD_Y = 18;
const GAP = 7;

export function Sankey({ nodes, links, columns, height = 520 }: Props) {
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

  const ribbons = useMemo(() => {
    const outOff = new Map<string, number>();
    const inOff = new Map<string, number>();
    const sorted = [...links].sort((a, b) => (laid.get(a.source)?.y0 ?? 0) - (laid.get(b.source)?.y0 ?? 0));
    return sorted.map((lk, i) => {
      const s = laid.get(lk.source);
      const t = laid.get(lk.target);
      if (!s || !t) return null;
      const thick = Math.max((lk.value / (s.node.value || 1)) * s.h, 1.2);
      const so = outOff.get(lk.source) ?? 0;
      const to = inOff.get(lk.target) ?? 0;
      outOff.set(lk.source, so + thick);
      inOff.set(lk.target, to + thick);
      const x0 = s.x + NODE_W;
      const x1 = t.x;
      const xm = (x0 + x1) / 2;
      const sy = s.y0 + so;
      const ty = t.y0 + to;
      const d = `M${x0},${sy} C${xm},${sy} ${xm},${ty} ${x1},${ty} L${x1},${ty + thick} C${xm},${ty + thick} ${xm},${sy + thick} ${x0},${sy + thick} Z`;
      const on = activeKeys ? activeKeys.has(lk.key) : null;
      const opacity = on === null ? 0.36 : on ? 0.82 : 0.08;
      return (
        <path
          key={i}
          d={d}
          fill={lk.color}
          fillOpacity={opacity}
          style={{ cursor: 'pointer', transition: 'fill-opacity 120ms' }}
          onMouseEnter={() => {
            setHoverKey(lk.key);
            setTip(`${s.node.label} → ${t.node.label} · ${lk.value} customer${lk.value > 1 ? 's' : ''}`);
          }}
          onMouseLeave={() => {
            setHoverKey(null);
            setTip(null);
          }}
        >
          <title>{`${lk.value} customer${lk.value > 1 ? 's' : ''}`}</title>
        </path>
      );
    });
  }, [links, laid, activeKeys]);

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
      {ribbons}
      {[...laid.values()].map(({ node, x, y0, h }) => {
        const on = activeKeys ? [...(nodeKeys.get(node.id) ?? [])].some((k) => activeKeys.has(k)) : null;
        const dim = on === false;
        const isLast = node.col === ncol - 1;
        const isFirst = node.col === 0;
        const anchor = isLast ? 'end' : isFirst ? 'start' : 'middle';
        const tx = isLast ? x - 6 : isFirst ? x + NODE_W + 6 : x + NODE_W / 2;
        const ty = isFirst || isLast ? y0 + h / 2 : y0 - 4;
        return (
          <g key={node.id} onMouseEnter={() => { setHoverNode(node.id); setTip(`${node.label} · ${node.value} customer${node.value > 1 ? 's' : ''}`); }} onMouseLeave={() => { setHoverNode(null); setTip(null); }} style={{ cursor: 'pointer' }}>
            <rect x={x} y={y0} width={NODE_W} height={h} rx={2} fill={node.color} opacity={dim ? 0.25 : 1} />
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
