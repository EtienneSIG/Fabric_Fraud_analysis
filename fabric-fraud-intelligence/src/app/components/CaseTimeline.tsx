export interface TimelineEvent {
  at: string;
  label: string;
  detail?: string;
  tone?: 'default' | 'alert' | 'agent' | 'decision';
}

const TONE: Record<NonNullable<TimelineEvent['tone']>, string> = {
  default: '#94a3b8',
  alert: '#dc2626',
  agent: '#4f46e5',
  decision: '#16a34a',
};

export function CaseTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative border-l border-gray-200 ml-2">
      {events.map((e, i) => (
        <li key={i} className="mb-5 ml-4">
          <span
            className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white"
            style={{ backgroundColor: TONE[e.tone ?? 'default'] }}
          />
          <time className="text-[11px] text-gray-400">
            {new Date(e.at).toLocaleString()}
          </time>
          <p className="text-sm font-medium text-gray-800">{e.label}</p>
          {e.detail && <p className="text-sm text-gray-500">{e.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
