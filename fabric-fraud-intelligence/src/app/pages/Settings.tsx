import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useRole } from '@/app/RoleContext';
import { fabricConfig } from '@/backend/config';
import { audit } from '@/backend/services/AuditService';
import { raftEval, type RaftEvaluation } from '@/backend/services/RaftEvalClient';
import { ROLES, ROLE_PERMISSIONS } from '@/backend/models';

export function Settings() {
  const { t } = useTranslation();
  const { role } = useRole();
  const [, refresh] = useState(0);
  const [tab, setTab] = useState<'governance' | 'quality'>('governance');
  const entries = audit.listEntries();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{t('pages.settings.title')}</h2>
        <p className="text-sm text-gray-400">{t('pages.settings.subtitle')}</p>
      </div>

      <div className="flex gap-1 border-b border-gray-100">
        {(['governance', 'quality'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === k ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t(k === 'governance' ? 'pages.settings.tabGovernance' : 'pages.settings.tabModelQuality')}
          </button>
        ))}
      </div>

      {tab === 'quality' && <ModelQualityTab />}

      {tab === 'governance' && (
        <>
          <section className="ffi-card p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('pages.settings.roleMatrix')}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100">
              <th className="py-2">{t('pages.settings.role')}</th>
              <th className="py-2">{t('pages.settings.viewPII')}</th>
              <th className="py-2">{t('pages.settings.makeDecisions')}</th>
              <th className="py-2">{t('pages.settings.auditAccess')}</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => {
              const p = ROLE_PERMISSIONS[r];
              return (
                <tr key={r} className={`border-b border-gray-50 ${r === role ? 'bg-indigo-50/60' : ''}`}>
                  <td className="py-2 font-medium text-gray-800">
                    {r}
                    {r === role && <span className="ml-2 text-[11px] text-indigo-600">{t('pages.settings.you')}</span>}
                  </td>
                  <td className="py-2">{p.viewPII ? '✓' : '—'}</td>
                  <td className="py-2">{p.decide ? '✓' : '—'}</td>
                  <td className="py-2">{p.audit ? '✓' : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-gray-400">{t('pages.settings.piiNote')}</p>
      </section>

      <section className="ffi-card p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('pages.settings.environment')}</h3>
        <dl className="grid grid-cols-2 gap-y-2 text-sm max-w-lg">
          <dt className="text-gray-400">{t('pages.settings.appMode')}</dt>
          <dd className="text-gray-800 font-medium">
            {fabricConfig.mode}
            {fabricConfig.mode === 'mock' && t('pages.settings.mockSuffix')}
          </dd>
          <dt className="text-gray-400">{t('pages.settings.workspaceId')}</dt>
          <dd className="text-gray-800 font-medium">{fabricConfig.workspaceId || '—'}</dd>
          <dt className="text-gray-400">{t('pages.settings.dataAgentId')}</dt>
          <dd className="text-gray-800 font-medium">{fabricConfig.dataAgentId || t('pages.settings.notConfigured')}</dd>
          <dt className="text-gray-400">{t('pages.settings.tenantId')}</dt>
          <dd className="text-gray-800 font-medium">{fabricConfig.tenantId || '—'}</dd>
        </dl>
        <p className="mt-3 text-xs text-gray-400">{t('pages.settings.envNote')}</p>
      </section>

      <section className="ffi-card p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">{t('pages.settings.auditTrail')}</h3>
          <button
            onClick={() => refresh((n) => n + 1)}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            {t('pages.settings.refresh')}
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-400">{t('pages.settings.noAudit')}</p>
        ) : (
          <table className="w-full text-sm ffi-cv-auto">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="py-2 pr-3">{t('pages.settings.thWhen')}</th>
                <th className="py-2 pr-3">{t('pages.settings.thActor')}</th>
                <th className="py-2 pr-3">{t('pages.settings.thAction')}</th>
                <th className="py-2 pr-3">{t('pages.settings.thTarget')}</th>
                <th className="py-2">{t('pages.settings.thDetail')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, 20).map((e) => (
                <tr key={e.id} className="border-b border-gray-50">
                  <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">
                    {new Date(e.at).toLocaleTimeString()}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-700">{e.actor}</td>
                  <td className="py-1.5 pr-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                      {e.action}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-gray-600">{e.target}</td>
                  <td className="py-1.5 text-gray-500 truncate max-w-sm">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
        </>
      )}
    </div>
  );
}

function ModelQualityTab() {
  const { t } = useTranslation();
  const [evaluation, setEvaluation] = useState<RaftEvaluation | null>(null);

  useEffect(() => {
    let active = true;
    void raftEval.getEvaluation().then((e) => {
      if (active) setEvaluation(e);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!evaluation) {
    return (
      <section className="ffi-card p-6">
        <p className="text-sm text-gray-400">{t('pages.settings.modelQuality.noResults')}</p>
      </section>
    );
  }

  const { baseline, raft } = evaluation.summary;
  const quality: { key: string; b: number; r: number; pct: boolean }[] = [
    { key: 'groundedness', b: baseline.groundedness, r: raft.groundedness, pct: true },
    { key: 'retrievalQuality', b: baseline.retrieval_quality, r: raft.retrieval_quality, pct: true },
    { key: 'relevance', b: baseline.relevance, r: raft.relevance, pct: true },
  ];
  const economics: { key: string; b: number; r: number; fmt: (n: number) => string }[] = [
    { key: 'tokensPerInvestigation', b: baseline.tokens_per_investigation, r: raft.tokens_per_investigation, fmt: (n) => n.toLocaleString() },
    { key: 'latency', b: baseline.latency_ms, r: raft.latency_ms, fmt: (n) => `${n} ms` },
    { key: 'costPer1000', b: baseline.cost_per_1000, r: raft.cost_per_1000, fmt: (n) => `$${n.toFixed(2)}` },
  ];

  return (
    <section className="ffi-card p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700">{t('pages.settings.modelQuality.title')}</h3>
        <p className="text-xs text-gray-400">{t('pages.settings.modelQuality.subtitle')}</p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100">
            <th className="py-2">{t('pages.settings.modelQuality.metric')}</th>
            <th className="py-2 text-right">{t('pages.settings.modelQuality.baseline')}</th>
            <th className="py-2 text-right">{t('pages.settings.modelQuality.raft')}</th>
            <th className="py-2 text-right">{t('pages.settings.modelQuality.delta')}</th>
          </tr>
        </thead>
        <tbody>
          {quality.map((m) => (
            <tr key={m.key} className="border-b border-gray-50">
              <td className="py-1.5 text-gray-700">{t(`pages.settings.modelQuality.${m.key}`)}</td>
              <td className="py-1.5 text-right text-gray-600">{Math.round(m.b * 100)}%</td>
              <td className="py-1.5 text-right font-medium text-gray-800">{Math.round(m.r * 100)}%</td>
              <td className="py-1.5 text-right font-medium text-emerald-600">+{Math.round((m.r - m.b) * 100)}</td>
            </tr>
          ))}
          {economics.map((m) => (
            <tr key={m.key} className="border-b border-gray-50">
              <td className="py-1.5 text-gray-700">{t(`pages.settings.modelQuality.${m.key}`)}</td>
              <td className="py-1.5 text-right text-gray-600">{m.fmt(m.b)}</td>
              <td className="py-1.5 text-right font-medium text-gray-800">{m.fmt(m.r)}</td>
              <td className="py-1.5 text-right font-medium text-emerald-600">{m.fmt(m.b - m.r)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <span>
          {t('pages.settings.modelQuality.source')}:{' '}
          {evaluation.live ? t('pages.settings.modelQuality.live') : t('pages.settings.modelQuality.sample')}
          {' · '}
          {t('pages.settings.modelQuality.generatedAt', { at: new Date(evaluation.generated_at).toLocaleDateString() })}
        </span>
      </div>
      <p className="text-xs text-gray-400">{t('pages.settings.modelQuality.advisory')}</p>
    </section>
  );
}
