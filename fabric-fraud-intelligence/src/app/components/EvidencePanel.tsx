import { useTranslation } from 'react-i18next';

import type { Evidence } from '@/backend/models';

export function EvidencePanel({ evidence }: { evidence: Evidence[] }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {evidence.map((e) => (
        <div key={e.id} className="rounded-xl border border-gray-100 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">{e.title}</span>
            <span className="text-[11px] rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5">
              {e.evidenceType}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">{e.content}</p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
            <span>{t('components.evidence.source', { system: e.sourceSystem })}</span>
            <span>{t('components.evidence.confidence', { value: e.confidence })}</span>
          </div>
        </div>
      ))}
      {evidence.length === 0 && (
        <p className="text-sm text-gray-400">{t('components.evidence.none')}</p>
      )}
    </div>
  );
}
