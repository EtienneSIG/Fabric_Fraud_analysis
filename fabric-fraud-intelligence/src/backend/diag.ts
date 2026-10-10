// Structured, greppable client diagnostics. Makes silent real→mock fallbacks and slow calls
// visible so failures are found fast — filter the browser console by "[diag:".
// It also forwards to Application Insights when the App Insights JS SDK is loaded (its snippet
// exposes `window.appInsights`); with no SDK present it degrades to console only, so the
// mock-first offline build stays dependency-free.
type Level = 'warn' | 'error' | 'info';

interface AppInsightsSink {
  trackTrace?: (telemetry: { message: string; severityLevel?: number }, properties?: Record<string, unknown>) => void;
  trackException?: (telemetry: { exception?: Error; error?: unknown; severityLevel?: number }, properties?: Record<string, unknown>) => void;
}

// App Insights severityLevel: 0 Verbose · 1 Information · 2 Warning · 3 Error.
const SEVERITY: Record<Level, number> = { info: 1, warn: 2, error: 3 };

function sink(): AppInsightsSink | undefined {
  return (globalThis as unknown as { appInsights?: AppInsightsSink }).appInsights;
}

export function diag(scope: string, message: string, detail?: unknown, level: Level = 'warn'): void {
  const line = `[diag:${scope}] ${message}`;
  if (level === 'error') console.error(line, detail ?? '');
  else if (level === 'info') console.info(line, detail ?? '');
  else console.warn(line, detail ?? '');

  const ai = sink();
  if (!ai) return;
  try {
    const properties = { scope, detail: detail instanceof Error ? detail.message : detail };
    if (level === 'error' && detail instanceof Error) {
      ai.trackException?.({ exception: detail, severityLevel: SEVERITY.error }, { scope, message });
    } else {
      ai.trackTrace?.({ message: line, severityLevel: SEVERITY[level] }, properties);
    }
  } catch {
    /* telemetry must never throw into the app */
  }
}

/** Returns a function giving the elapsed milliseconds since it was created — for latency traces. */
export function startTimer(): () => number {
  const started = performance.now();
  return () => Math.round(performance.now() - started);
}
