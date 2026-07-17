import { SEVERITY_COLORS, type Severity } from '@/backend/models';

function sevOf(score: number): Severity {
  if (score >= 0.9) return 'Critical';
  if (score >= 0.75) return 'High';
  if (score >= 0.5) return 'Medium';
  return 'Low';
}

export function RiskScoreBadge({
  score,
  severity,
  size = 'md',
}: {
  score: number;
  severity?: Severity;
  size?: 'sm' | 'md';
}) {
  const sev = severity ?? sevOf(score);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold text-white ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
      style={{ backgroundColor: SEVERITY_COLORS[sev] }}
    >
      {Math.round(score * 100)}
      <span className="opacity-80">· {sev}</span>
    </span>
  );
}
