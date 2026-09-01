import { useTranslation } from 'react-i18next';

import { integrationStatus, type FeatureKey } from '@/backend/config';

const DOT: Record<'mock' | 'partial' | 'live', string> = {
  mock: 'bg-slate-300',
  partial: 'bg-amber-400',
  live: 'bg-emerald-400',
};
const PILL: Record<'mock' | 'partial' | 'live', string> = {
  mock: 'text-slate-500 border-slate-200 bg-slate-50',
  partial: 'text-amber-700 border-amber-200 bg-amber-50',
  live: 'text-emerald-700 border-emerald-200 bg-emerald-50',
};
const FEATURES: FeatureKey[] = ['fabric', 'foundry', 'raft', 'workiq', 'webiq', 'teams'];

// Discreet header pill: overall integration mode (mock / partial / live). Hovering lists each
// integration's live-vs-mock state so a degraded demo is honestly, quietly signalled.
export function IntegrationModeBadge() {
  const { t } = useTranslation();
  const status = integrationStatus();
  const tooltip = [
    t('common.mode.tooltip'),
    ...FEATURES.map(
      (f) => `${t(`common.mode.${f}`)}: ${status.features[f] ? t('common.mode.statusLive') : t('common.mode.statusMock')}`
    ),
  ].join('\n');

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${PILL[status.overall]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status.overall]}`} />
      {t(`common.mode.${status.overall}`)}
    </span>
  );
}
