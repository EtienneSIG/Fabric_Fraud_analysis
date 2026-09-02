// Runtime Application Insights loader. Complements the build-time snippet in index.html: this reads
// the analyst's browser-local connection string (General settings) and lazily loads the SDK from the
// CDN, exposing window.appInsights — which src/backend/diag.ts forwards diagnostic traces to.
// No-op when nothing is configured, so the mock-first offline build stays dependency-free.
import { getAppInsightsConnectionString } from '@/backend/services/generalSettings';

interface AiClass {
  new (options: { config: { connectionString: string; enableAutoRouteTracking?: boolean } }): {
    loadAppInsights: () => void;
    trackPageView: () => void;
  };
}
interface AiGlobal {
  appInsights?: unknown;
  Microsoft?: { ApplicationInsights?: { ApplicationInsights: AiClass } };
}

let loading = false;

export function initTelemetry(): void {
  const g = globalThis as unknown as AiGlobal;
  if (g.appInsights || loading) return; // already loaded by the build snippet or a prior call
  // Browser-local override (General settings) first, then the build-time VITE_ value.
  const cs = getAppInsightsConnectionString() || import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING || '';
  if (!cs || cs.indexOf('InstrumentationKey=') !== 0) return;
  if (typeof document === 'undefined') return;
  loading = true;
  const s = document.createElement('script');
  s.src = 'https://js.monitor.azure.com/scripts/b/ai.3.gbl.min.js';
  s.crossOrigin = 'anonymous';
  s.onerror = () => { loading = false; }; // let a later save retry if the CDN load failed
  s.onload = () => {
    try {
      const AI = g.Microsoft?.ApplicationInsights;
      if (!AI) return;
      const inst = new AI.ApplicationInsights({ config: { connectionString: cs, enableAutoRouteTracking: true } });
      inst.loadAppInsights();
      inst.trackPageView();
      g.appInsights = inst;
    } catch {
      /* telemetry must never break the app */
    }
  };
  document.head.appendChild(s);
}
