export interface Kpi {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}

export function KPIGrid({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {items.map((k) => (
        <div key={k.label} className="ffi-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {k.label}
          </p>
          <p className="mt-1 text-2xl font-bold" style={{ color: k.accent ?? '#111827' }}>
            {k.value}
          </p>
          {k.hint && <p className="mt-1 text-xs text-gray-400">{k.hint}</p>}
        </div>
      ))}
    </div>
  );
}
