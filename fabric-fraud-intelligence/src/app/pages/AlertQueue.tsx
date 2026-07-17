import { useMemo, useState } from 'react';

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
  const [type, setType] = useState<AlertType | 'All'>('All');
  const [severity, setSeverity] = useState<Severity | 'All'>('All');
  const [status, setStatus] = useState<AlertStatus | 'All'>('All');
  const [search, setSearch] = useState('');

  const rows = useMemo(
    () => getAlerts({ type, severity, status, search }),
    [type, severity, status, search]
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Alert Queue</h2>
        <p className="text-sm text-gray-400">
          Triage cross-channel fraud, AML, KYC, identity &amp; claims alerts.
        </p>
      </div>

      <section className="ffi-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search alerts…"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <Select<AlertType | 'All'> label="Type" value={type} onChange={setType} options={['All', ...ALERT_TYPES]} />
          <Select<Severity | 'All'> label="Severity" value={severity} onChange={setSeverity} options={['All', ...SEVERITIES]} />
          <Select<AlertStatus | 'All'> label="Status" value={status} onChange={setStatus} options={['All', ...ALERT_STATUSES]} />
          <span className="text-xs text-gray-400 ml-auto">{rows.length} alerts</span>
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
