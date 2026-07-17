import type { CustomerEvent } from '@/backend/models';
import { WORLD_LAND } from '@/data/worldLand';

const W = 720;
const H = 360;

const project = (lat: number, lng: number): [number, number] => [
  ((lng + 180) / 360) * W,
  ((90 - lat) / 180) * H,
];

const LAND_PATH = WORLD_LAND.map(
  (ring) =>
    'M' +
    ring
      .map(([lng, lat]) => {
        const [x, y] = project(lat, lng);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join('L') +
    'Z'
).join(' ');

const CITY_COORDS: Record<string, [number, number]> = {
  'Paris, France': [48.85, 2.35],
  'London, UK': [51.5, -0.12],
  'Madrid, Spain': [40.4, -3.7],
  'Milan, Italy': [45.46, 9.19],
  'Berlin, Germany': [52.52, 13.4],
  'Amsterdam, NL': [52.37, 4.9],
  'Lisbon, Portugal': [38.72, -9.14],
  'Dublin, Ireland': [53.35, -6.26],
  'Brussels, Belgium': [50.85, 4.35],
  'Vienna, Austria': [48.21, 16.37],
  'New York, USA': [40.71, -74.0],
  'Beijing, China': [39.9, 116.4],
  'Lagos, Nigeria': [6.52, 3.38],
  'Bucharest, Romania': [44.43, 26.1],
  'Moscow, Russia': [55.75, 37.62],
  'Dubai, UAE': [25.2, 55.27],
  'Karachi, Pakistan': [24.86, 67.0],
  'Kyiv, Ukraine': [50.45, 30.52],
  Luxembourg: [49.61, 6.13],
  Singapore: [1.35, 103.8],
};

interface MapPoint {
  n: number;
  event: CustomerEvent;
  x: number;
  y: number;
  fraud: boolean;
}

export function JourneyMap({ events }: { events: CustomerEvent[] }) {
  const seen = new Map<string, number>();
  const points: MapPoint[] = events.map((e, i) => {
    const c = CITY_COORDS[e.location];
    let [x, y] = c ? project(c[0], c[1]) : [W / 2, H / 2];
    const key = `${Math.round(x)},${Math.round(y)}`;
    const dup = seen.get(key) ?? 0;
    seen.set(key, dup + 1);
    if (dup > 0) {
      x += dup * 9;
      y -= dup * 8;
    }
    return { n: i + 1, event: e, x, y, fraud: e.event.startsWith('Fraud') };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ background: '#eff6ff', borderRadius: 12 }} role="img" aria-label="Event locations map">
          <defs>
            <marker id="jm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
            </marker>
          </defs>
          {/* continents */}
          <path d={LAND_PATH} fill="#dbe3ec" stroke="#b6c2d1" strokeWidth={0.4} fillRule="evenodd" />
          {/* graticule */}
          {[60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660].map((x) => (
            <line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} stroke="#dbeafe" strokeWidth={1} />
          ))}
          {[45, 90, 135, 180, 225, 270, 315].map((y) => (
            <line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} stroke="#dbeafe" strokeWidth={1} />
          ))}
          {/* journey path */}
          {points.slice(1).map((p, i) => {
            const a = points[i];
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={p.x}
                y2={p.y}
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                markerEnd="url(#jm-arrow)"
              />
            );
          })}
          {/* markers */}
          {points.map((p) => (
            <g key={p.n}>
              <circle cx={p.x} cy={p.y} r={11} fill={p.fraud ? '#dc2626' : '#4f46e5'} stroke="#fff" strokeWidth={2} />
              <text x={p.x} y={p.y + 3.5} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: '#fff' }}>
                {p.n}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <ol className="space-y-1.5">
        {points.map((p) => (
          <li key={p.n} className="flex items-start gap-2 text-sm">
            <span
              className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: p.fraud ? '#dc2626' : '#4f46e5' }}
            >
              {p.n}
            </span>
            <span>
              <span className={`font-medium ${p.fraud ? 'text-red-700' : 'text-gray-800'}`}>{p.event.event}</span>
              <span className="text-gray-500"> — {p.event.location}</span>
              <span className="text-gray-400"> · {p.event.channel}</span>
            </span>
          </li>
        ))}
        {points.length === 0 && <li className="text-sm text-gray-400">No events.</li>}
      </ol>
    </div>
  );
}
