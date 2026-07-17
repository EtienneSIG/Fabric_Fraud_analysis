import {
  type PointerEvent as RPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { EntityEdge, EntityNode, GraphNodeKind } from '@/backend/api/entity-graph';

export type GraphMetric = 'degree' | 'closeness' | 'betweenness';

interface Props {
  nodes: EntityNode[];
  edges: EntityEdge[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  height?: number;
  metric?: GraphMetric;
}

interface Pt {
  x: number;
  y: number;
}
interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

const W = 1000;
export const KIND_COLORS: Record<GraphNodeKind, string> = {
  fraud: '#dc2626',
  customer: '#4f46e5',
};

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

function layout(nodes: EntityNode[], edges: EntityEdge[], H: number, seed: number): Map<string, Pt> {
  const r = rng(seed);
  const pos = new Map<string, Pt>();
  nodes.forEach((n) =>
    pos.set(n.id, { x: W / 2 + (r() - 0.5) * W * 0.6, y: H / 2 + (r() - 0.5) * H * 0.6 })
  );
  const k = Math.sqrt((W * H) / Math.max(nodes.length, 1)) * 0.8;
  const iters = 260;
  for (let it = 0; it < iters; it++) {
    const disp = new Map<string, Pt>(nodes.map((n) => [n.id, { x: 0, y: 0 }]));
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = pos.get(nodes[i].id)!;
        const b = pos.get(nodes[j].id)!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const f = (k * k) / dist;
        disp.get(nodes[i].id)!.x += (dx / dist) * f;
        disp.get(nodes[i].id)!.y += (dy / dist) * f;
        disp.get(nodes[j].id)!.x -= (dx / dist) * f;
        disp.get(nodes[j].id)!.y -= (dy / dist) * f;
      }
    }
    for (const e of edges) {
      const a = pos.get(e.source);
      const b = pos.get(e.target);
      if (!a || !b) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const f = ((dist * dist) / k) * (0.4 + e.weight);
      disp.get(e.source)!.x -= (dx / dist) * f;
      disp.get(e.source)!.y -= (dy / dist) * f;
      disp.get(e.target)!.x += (dx / dist) * f;
      disp.get(e.target)!.y += (dy / dist) * f;
    }
    const temp = (1 - it / iters) * (W * 0.05);
    for (const n of nodes) {
      const d = disp.get(n.id)!;
      const p = pos.get(n.id)!;
      const len = Math.hypot(d.x, d.y) || 0.01;
      p.x += (d.x / len) * Math.min(len, temp);
      p.y += (d.y / len) * Math.min(len, temp);
      p.x = Math.max(24, Math.min(W - 24, p.x));
      p.y = Math.max(24, Math.min(H - 24, p.y));
    }
  }
  return pos;
}

export function EntityNetwork({ nodes, edges, selected, onSelect, height = 520, metric = 'degree' }: Props) {
  const [seed, setSeed] = useState(7);
  const initial = useMemo(() => layout(nodes, edges, height, seed), [nodes, edges, height, seed]);
  const maxMetric = useMemo(() => Math.max(...nodes.map((n) => n[metric]), 0.0001), [nodes, metric]);
  const [pos, setPos] = useState<Map<string, Pt>>(initial);
  useEffect(() => setPos(new Map(initial)), [initial]);

  const base = useMemo<View>(() => ({ x: 0, y: 0, w: W, h: height }), [height]);
  const [view, setView] = useState<View>(base);
  useEffect(() => setView(base), [base]);

  const [hover, setHover] = useState<string | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef({ id: null as string | null, panning: false, lastX: 0, lastY: 0, moved: false });

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!m.has(e.source)) m.set(e.source, new Set());
      if (!m.has(e.target)) m.set(e.target, new Set());
      m.get(e.source)!.add(e.target);
      m.get(e.target)!.add(e.source);
    }
    return m;
  }, [edges]);

  const focus = hover ?? selected;
  const active = (id: string): boolean | null => {
    if (!focus) return null;
    if (id === focus) return true;
    return neighbors.get(focus)?.has(id) ?? false;
  };

  const toSvg = (cx: number, cy: number, v: View): Pt => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: v.x + ((cx - rect.left) / rect.width) * v.w,
      y: v.y + ((cy - rect.top) / rect.height) * v.h,
    };
  };

  const zoomAt = (clientX: number, clientY: number, factor: number) => {
    setView((v) => {
      const w = Math.max(150, Math.min(W * 3, v.w * factor));
      const h = w * (height / W);
      const p = toSvg(clientX, clientY, v);
      return { w, h, x: p.x - ((p.x - v.x) * w) / v.w, y: p.y - ((p.y - v.y) * h) / v.h };
    });
  };

  const zoomCenter = (factor: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  };

  // Native, non-passive wheel listener so zooming never scrolls the page.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1.12 : 0.89);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (d.id) {
      d.moved = true;
      const p = toSvg(e.clientX, e.clientY, viewRef.current);
      setPos((prev) => new Map(prev).set(d.id!, { x: p.x, y: p.y }));
    } else if (d.panning) {
      d.moved = true;
      const dx = ((e.clientX - d.lastX) / svgRef.current!.clientWidth) * viewRef.current.w;
      const dy = ((e.clientY - d.lastY) / svgRef.current!.clientHeight) * viewRef.current.h;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      setView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
    }
  };
  const endDrag = () => {
    drag.current = { id: null, panning: false, lastX: 0, lastY: 0, moved: false };
    setGrabbing(false);
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="w-full touch-none select-none"
        style={{ height, background: '#f8fafc', borderRadius: 12, cursor: grabbing ? 'grabbing' : 'grab' }}
        onPointerDown={(e) => {
          drag.current = { id: null, panning: true, lastX: e.clientX, lastY: e.clientY, moved: false };
          setGrabbing(true);
        }}
        onPointerMove={onMove}
        onPointerUp={(e) => {
          if (!drag.current.moved && !drag.current.id) onSelect(null);
          endDrag();
          void e;
        }}
        onPointerLeave={endDrag}
      >
        {edges.map((e, i) => {
          const a = pos.get(e.source);
          const b = pos.get(e.target);
          if (!a || !b) return null;
          const inc = focus === e.source || focus === e.target;
          const op = focus === null ? 0.25 : inc ? 0.8 : 0.05;
          return (
            <g key={i}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={e.relationshipType.includes('shared') ? '#dc2626' : '#94a3b8'}
                strokeWidth={0.8 + e.weight * 3}
                strokeOpacity={op}
              />
              {inc && (
                <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 2} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 8 }}>
                  {e.relationshipType}
                </text>
              )}
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id);
          if (!p) return null;
          const val = n[metric];
          const rad = (n.kind === 'fraud' ? 13 : 5) + (val / maxMetric) * (n.kind === 'fraud' ? 15 : 18);
          const a = active(n.id);
          return (
            <g
              key={n.id}
              transform={`translate(${p.x},${p.y})`}
              style={{ cursor: 'pointer' }}
              opacity={a === false ? 0.2 : 1}
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.target as Element).setPointerCapture(e.pointerId);
                drag.current = { id: n.id, panning: false, lastX: e.clientX, lastY: e.clientY, moved: false };
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                if (!drag.current.moved) onSelect(n.id === selected ? null : n.id);
                endDrag();
              }}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
            >
              <circle
                r={rad}
                fill={KIND_COLORS[n.kind]}
                stroke={n.id === selected ? '#0f172a' : '#fff'}
                strokeWidth={n.id === selected ? 3 : 1.5}
              />
              {(n.kind === 'fraud' || n.degree >= 3 || focus === n.id) && (
                <text y={-rad - 4} textAnchor="middle" className="fill-slate-700" style={{ fontSize: n.kind === 'fraud' ? 12 : 9, fontWeight: n.kind === 'fraud' ? 700 : 500 }}>
                  {n.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Zoom / manipulation controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5">
        <CtrlButton label="Auto" title="Auto arrange" onClick={() => { setSeed((s) => s + 1); setView(base); }} wide />
        <CtrlButton label="+" title="Zoom in" onClick={() => zoomCenter(0.8)} />
        <CtrlButton label="−" title="Zoom out" onClick={() => zoomCenter(1.25)} />
        <CtrlButton label="⤢" title="Reset view" onClick={() => setView(base)} />
      </div>
      <div className="absolute bottom-3 left-3 text-[11px] text-slate-400 bg-white/70 rounded-md px-2 py-0.5">
        Scroll to zoom · drag background to pan · drag nodes · click to inspect
      </div>
    </div>
  );
}

function CtrlButton({ label, title, onClick, wide }: { label: string; title: string; onClick: () => void; wide?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`h-8 rounded-lg bg-white border border-gray-200 shadow-sm text-gray-700 hover:bg-gray-50 flex items-center justify-center text-sm font-semibold ${wide ? 'px-2 w-auto' : 'w-8'}`}
    >
      {label}
    </button>
  );
}
