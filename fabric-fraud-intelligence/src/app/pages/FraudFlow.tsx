import { useMemo, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';

import { JourneyMap } from '@/app/components/JourneyMap';
import { Sankey } from '@/app/components/Sankey';
import {
  buildJourneyFlow,
  exampleJourney,
  journeyColumns,
  terminalCounts,
  terminalEvents,
} from '@/backend/api/flow';
import { seedCustomerEvents } from '@/backend/api/seedEvents';
import { isLocalBackend } from '@/services/rayfinClient';

const STEPS = 5;

export function FraudFlow() {
  const { t } = useTranslation();
  const [, startTransition] = useTransition();
  const terminals = useMemo(() => terminalEvents(), []);
  const [terminal, setTerminal] = useState(terminals[0] ?? '');
  const { nodes, links } = useMemo(() => buildJourneyFlow(terminal, STEPS), [terminal]);
  const columns = useMemo(() => journeyColumns(STEPS), []);
  const example = useMemo(() => exampleJourney(terminal), [terminal]);
  const counts = useMemo(() => terminalCounts(), []);
  const total = useMemo(() => Object.values(counts).reduce((s, n) => s + n, 0), [counts]);
  const fraudTotal = useMemo(
    () => Object.entries(counts).filter(([k]) => k.startsWith('Fraud')).reduce((s, [, n]) => s + n, 0),
    [counts]
  );
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const [fraudOnly, setFraudOnly] = useState(false);
  const visibleTerminals = useMemo(
    () => (fraudOnly ? terminals.filter((t) => t.startsWith('Fraud')) : terminals),
    [fraudOnly, terminals]
  );
  const local = isLocalBackend();

  const seed = async () => {
    setSeeding(true);
    setSeedMsg(t('pages.fraudFlow.seeding'));
    try {
      const { created } = await seedCustomerEvents(300, setSeedMsg);
      setSeedMsg(t('pages.fraudFlow.seeded', { count: created }));
    } catch (e) {
      setSeedMsg(t('pages.fraudFlow.seedFailed', { msg: (e as Error).message }));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('pages.fraudFlow.title')}</h2>
          <p className="text-sm text-gray-400">{t('pages.fraudFlow.subtitle')}</p>
          <p className="text-xs text-gray-500 mt-1">
            {t('pages.fraudFlow.journeysStat', {
              count: (counts[terminal] ?? 0).toLocaleString(),
              terminal,
              total: total.toLocaleString(),
              fraud: fraudTotal.toLocaleString(),
              pct: total ? Math.round((fraudTotal / total) * 100) : 0,
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={fraudOnly}
              onChange={(e) => {
                const on = e.target.checked;
                setFraudOnly(on);
                if (on && !terminal.startsWith('Fraud')) {
                  const firstFraud = terminals.find((t) => t.startsWith('Fraud'));
                  if (firstFraud) setTerminal(firstFraud);
                }
              }}
              className="h-3.5 w-3.5 accent-red-600"
            />
            {t('pages.fraudFlow.fraudEventsOnly')}
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            {t('pages.fraudFlow.finalEvent')}
            <select
              value={terminal}
              onChange={(e) => startTransition(() => setTerminal(e.target.value))}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
            >
              {visibleTerminals.map((t) => (
                <option key={t} value={t}>
                  {t} ({(counts[t] ?? 0).toLocaleString()})
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => void seed()}
            disabled={seeding || local}
            title={local ? t('pages.fraudFlow.seedTitleLocal') : t('pages.fraudFlow.seedTitle')}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {seeding ? t('pages.fraudFlow.seeding') : t('pages.fraudFlow.seedBtn')}
          </button>
          {seedMsg && <span className="text-[11px] text-gray-400 max-w-56 text-right">{seedMsg}</span>}
        </div>
      </div>

      <section className="ffi-card p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          {t('pages.fraudFlow.topPaths', { terminal })}
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          {t('pages.fraudFlow.ribbonNote')}
        </p>
        {nodes.length === 0 ? (
          <p className="text-center text-gray-400 py-16 text-sm">{t('pages.fraudFlow.noJourneys')}</p>
        ) : (
          <Sankey nodes={nodes} links={links} columns={columns} height={330} />
        )}
      </section>

      <section className="ffi-card p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            {t('pages.fraudFlow.mapTitle')}{example.length ? ` — ${example[0].customerId}` : ''}
          </h3>
          <span className="text-xs text-gray-400">{t('pages.fraudFlow.geoPath')}</span>
        </div>
        <JourneyMap events={example} />
      </section>

      <section className="ffi-card p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          {t('pages.fraudFlow.eventLog')}{example.length ? ` — ${example[0].customerId}` : ''}
        </h3>
        <div className="overflow-x-auto ffi-cv-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="py-2 pr-3">{t('pages.fraudFlow.thClient')}</th>
                <th className="py-2 pr-3">{t('pages.fraudFlow.thEvent')}</th>
                <th className="py-2 pr-3">{t('pages.fraudFlow.thDate')}</th>
                <th className="py-2 pr-3">{t('pages.fraudFlow.thLocation')}</th>
                <th className="py-2 pr-3">{t('pages.fraudFlow.thChannel')}</th>
                <th className="py-2 pr-3 text-right">{t('pages.fraudFlow.thAmount')}</th>
                <th className="py-2">{t('pages.fraudFlow.thDescription')}</th>
              </tr>
            </thead>
            <tbody>
              {example.map((e) => {
                const fraud = e.event.startsWith('Fraud');
                return (
                  <tr key={e.id} className={`border-b border-gray-50 ${fraud ? 'bg-red-50' : ''}`}>
                    <td className="py-1.5 pr-3 text-gray-600">{e.customerId}</td>
                    <td className={`py-1.5 pr-3 font-medium ${fraud ? 'text-red-700' : 'text-gray-800'}`}>{e.event}</td>
                    <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">
                      {new Date(e.occurredAt).toLocaleString()}
                    </td>
                    <td className={`py-1.5 pr-3 ${e.location.includes('China') || e.location.includes('Nigeria') || e.location.includes('Romania') ? 'text-red-600' : 'text-gray-600'}`}>
                      {e.location}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-600">{e.channel}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-700">
                      {e.amount == null ? '—' : `€${e.amount}`}
                    </td>
                    <td className="py-1.5 text-gray-500">{e.description}</td>
                  </tr>
                );
              })}
              {example.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-400 text-xs">
                    {t('pages.fraudFlow.noExample')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
