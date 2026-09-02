import { isWebIqEnabled } from '@/backend/config';
import { postJson } from '@/backend/services/backendApi';
import { getWebIqKey, hasWebIqKey } from '@/backend/services/webIqSettings';
import type { ProbeState, ProbeResult } from '@/backend/services/probe';
import { diag } from '@/backend/diag';

export interface RegulatoryCitation {
  title: string;
  url: string;
  snippet: string;
}

/**
 * WebIqClient — retrieves regulatory citations from official sources via the backend
 * `/api/webiq/search`, which grounds on Microsoft Web IQ, restricts results to the
 * official-domain allow-list and strips PII from the query server-side. Returns `null`
 * when Web IQ is not enabled, so callers fall back to the static locale resources.
 */
export class WebIqClient {
  async getCitations(query: string, locale: string, caseId?: string): Promise<RegulatoryCitation[] | null> {
    if (!isWebIqEnabled()) return null;
    try {
      const key = getWebIqKey();
      const res = await postJson<{ citations: RegulatoryCitation[] }>(
        '/api/webiq/search',
        { query, caseId, locale },
        undefined,
        key ? { 'x-webiq-key': key } : undefined
      );
      return res.citations;
    } catch (e) {
      diag('webiq', 'search failed; using static resources', e);
      return null;
    }
  }

  /** On-demand connectivity probe: pings the backend and reports the real service mode + detail. */
  async probe(locale = 'en'): Promise<ProbeResult> {
    if (!isWebIqEnabled()) {
      // The key is a secret consumed by the backend proxy (the SPA can't call Web IQ directly), so
      // the live pillar also needs a reachable backend (VITE_BACKEND_API_URL). Say which is missing.
      const detail = hasWebIqKey()
        ? 'Key saved — the live pillar also needs a reachable backend proxy (none deployed).'
        : 'Web IQ not configured (demo mode)';
      return { state: 'off', detail };
    }
    const started = Date.now();
    try {
      const key = getWebIqKey();
      const res = await postJson<{ mode?: string }>(
        '/api/webiq/search',
        { query: 'ping', locale },
        8000,
        key ? { 'x-webiq-key': key } : undefined
      );
      const state: ProbeState = res.mode === 'webiq' ? 'live' : 'mock';
      const detail = `mode=${res.mode ?? 'unknown'} · ${Date.now() - started} ms`;
      diag('webiq', `probe -> ${state} (${detail})`, undefined, state === 'live' ? 'info' : 'warn');
      return { state, detail };
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      diag('webiq', `probe -> unreachable (${detail})`, e, 'error');
      return { state: 'unreachable', detail };
    }
  }
}

export const webIq = new WebIqClient();
