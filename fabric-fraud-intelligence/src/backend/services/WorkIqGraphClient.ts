import { isWorkIqEnabled } from '@/backend/config';
import { getJson } from '@/backend/services/backendApi';
import { diag } from '@/backend/diag';

export type IqFlavor = 'aml' | 'card' | 'claim' | 'takeover' | 'generic';

/**
 * WorkIqGraphClient — surfaces Microsoft 365 work-graph signals (Teams, Outlook,
 * SharePoint, calendar) related to an entity, via the backend `/api/workiq/signals`
 * using delegated Microsoft Graph (OBO). Returns `null` when Work IQ is not enabled,
 * so callers use the static locale resources instead (mock mode).
 */
export class WorkIqGraphClient {
  async getSignals(entityId: string, flavor: IqFlavor, locale: string): Promise<string[] | null> {
    if (!isWorkIqEnabled()) return null;
    try {
      const res = await getJson<{ signals: string[] }>('/api/workiq/signals', {
        entityId,
        flavor,
        locale,
      });
      return res.signals;
    } catch (e) {
      diag('workiq', 'signals fetch failed; using static resources', e);
      return null;
    }
  }
}

export const workIq = new WorkIqGraphClient();
