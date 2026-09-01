import { isWebIqEnabled } from '@/backend/config';
import { postJson } from '@/backend/services/backendApi';
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
      const res = await postJson<{ citations: RegulatoryCitation[] }>('/api/webiq/search', {
        query,
        caseId,
        locale,
      });
      return res.citations;
    } catch (e) {
      diag('webiq', 'search failed; using static resources', e);
      return null;
    }
  }
}

export const webIq = new WebIqClient();
