import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AlertTable } from '@/app/components/AlertTable';
import { getAlerts } from '@/backend/api/alerts';
import {
  ALERT_STATUSES,
  ALERT_TYPES,
  SEVERITIES,
  type AlertStatus,
  type AlertType,
  type Severity,
} from '@/backend/models';

export function AlertQueue() {
  const { t } = useTranslation();
  const [type, setType] = useState<AlertType | 'All'>('All');
  const [severity, setSeverity] = useState<Severity | 'All'>('All');
  const [status, setStatus] = useState<AlertStatus | 'All'>('All');
  const [search, setSearch] = useState('');

  // Keep typing responsive: filtering runs against a deferred copy of the query.
  const deferredSearch = useDeferredValue(search);
  const rows = useMemo(
    () => getAlerts({ type, severity, status, search: deferredSearch }),
    [type, severity, status, deferredSearch]
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{t('pages.alertQueue.title')}</h2>
        <p className="text-sm text-gray-400">{t('pages.alertQueue.subtitle')}</p>
      </div>

      <section className="ffi-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('pages.alertQueue.search')}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <Select<AlertType | 'All'> label={t('pages.alertQueue.type')} value={type} onChange={setType} options={['All', ...ALERT_TYPES]} />
          <Select<Severity | 'All'> label={t('pages.alertQueue.severity')} value={severity} onChange={setSeverity} options={['All', ...SEVERITIES]} />
          <Select<AlertStatus | 'All'> label={t('pages.alertQueue.status')} value={status} onChange={setStatus} options={['All', ...ALERT_STATUSES]} />
          <span className="text-xs text-gray-400 ml-auto">{t('pages.alertQueue.count', { count: rows.length })}</span>
        </div>
      </section>

      <section className="ffi-card p-6">
        <AlertTable rows={rows} />
      </section>
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: T[];
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
