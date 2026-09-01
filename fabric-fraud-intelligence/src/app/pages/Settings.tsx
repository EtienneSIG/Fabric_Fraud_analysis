import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useRole } from '@/app/RoleContext';
import { fabricConfig, integrationConfig, isFoundryEnabled, isWebIqEnabled } from '@/backend/config';
import { audit } from '@/backend/services/AuditService';
import { getWebIqKey, hasWebIqKey, setWebIqKey } from '@/backend/services/webIqSettings';
import { webIq } from '@/backend/services/WebIqClient';
import { foundryAgent } from '@/backend/services/FoundryAgentClient';
import type { ProbeState, ProbeResult } from '@/backend/services/probe';
import {
  DEFAULT_FOUNDRY_AGENT,
  KNOWN_FOUNDRY_AGENTS,
  getFoundryAgent,
  setFoundryAgent,
} from '@/backend/services/foundrySettings';
import { raftEval, type RaftEvaluation } from '@/backend/services/RaftEvalClient';
import { ROLES, ROLE_PERMISSIONS } from '@/backend/models';

type SettingsTab = 'governance' | 'agents' | 'quality';
const TAB_LABELS: Record<SettingsTab, string> = {
  governance: 'pages.settings.tabGovernance',
  agents: 'pages.settings.tabAgents',
  quality: 'pages.settings.tabModelQuality',
};

export function Settings() {
  const { t } = useTranslation();
  const { role } = useRole();
  const [, refresh] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<SettingsTab>('governance');
  const entries = audit.listEntries();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{t('pages.settings.title')}</h2>
        <p className="text-sm text-gray-400">{t('pages.settings.subtitle')}</p>
      </div>

      <div className="flex gap-1 border-b border-gray-100">
        {(['governance', 'quality', 'agents'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === k ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t(TAB_LABELS[k])}
          </button>
        ))}
      </div>

      {tab === 'agents' && <AgentsTab />}

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
                <tr key={r} className={`border-b border-gray-50 ${r === role ? 'bg-indigo-50/60 dark:bg-indigo-500/15' : ''}`}>
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
          <dt className="text-gray-400">{t('pages.settings.deployedAt')}</dt>
          <dd className="text-gray-800 font-medium">{new Date(__BUILD_TIME__).toLocaleString()}</dd>
          <dt className="text-gray-400">{t('pages.settings.commit')}</dt>
          <dd className="font-mono text-gray-800 font-medium">{__COMMIT__}</dd>
        </dl>
        <p className="mt-3 text-xs text-gray-400">{t('pages.settings.envNote')}</p>
      </section>

      <section className="ffi-card p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">{t('pages.settings.auditTrail')}</h3>
          <button
            onClick={() => {
              setRefreshing(true);
              refresh((n) => n + 1);
              setTimeout(() => setRefreshing(false), 600);
            }}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
          >
            <svg
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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

function AgentsTab() {
  return (
    <>
      <FoundryAgentCard />
      <WebIqKeyCard />
    </>
  );
}

// On-demand connectivity check: pings the backend and shows the real availability (green = live).
const PROBE_DOT: Record<ProbeState | 'idle' | 'testing', string> = {
  live: 'bg-emerald-500',
  mock: 'bg-amber-500',
  unreachable: 'bg-red-500',
  off: 'bg-gray-400',
  idle: 'bg-gray-300',
  testing: 'bg-indigo-400 animate-pulse',
};

function ConnectionProbe({ run }: { run: () => Promise<ProbeResult> }) {
  const { t } = useTranslation();
  const [state, setState] = useState<ProbeState | 'idle' | 'testing'>('idle');
  const [detail, setDetail] = useState<string>();
  const test = async () => {
    setState('testing');
    setDetail(undefined);
    const r = await run();
    setState(r.state);
    setDetail(r.detail);
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        onClick={test}
        disabled={state === 'testing'}
        className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700"
      >
        {state === 'testing' ? t('pages.settings.probe.testing') : t('pages.settings.probe.test')}
      </button>
      {state !== 'idle' && (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500" title={detail}>
          <span className={`h-2 w-2 rounded-full ${PROBE_DOT[state]}`} />
          {state !== 'testing' && t(`pages.settings.probe.${state}`)}
        </span>
      )}
      {detail && state !== 'testing' && (
        <code className="max-w-[240px] truncate text-[11px] text-gray-400 dark:text-gray-500" title={detail}>
          {detail}
        </code>
      )}
    </div>
  );
}

function FoundryAgentCard() {
  const { t } = useTranslation();
  const { role } = useRole();
  const [value, setValue] = useState(getFoundryAgent());
  const [, bump] = useState(0);

  const endpoint = integrationConfig.foundryEndpoint;
  const live = isFoundryEnabled();
  const custom = getFoundryAgent().length > 0;
  const effective = value.trim() || DEFAULT_FOUNDRY_AGENT;

  const save = () => {
    if (!value.trim()) return;
    setFoundryAgent(value);
    audit.logConfigChange(role, 'Foundry agent', t('pages.settings.foundry.auditSet', { name: value.trim() }));
    bump((n) => n + 1);
  };
  const reset = () => {
    setFoundryAgent('');
    setValue('');
    audit.logConfigChange(role, 'Foundry agent', t('pages.settings.foundry.auditReset'));
    bump((n) => n + 1);
  };

  return (
    <section className="ffi-card p-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{t('pages.settings.foundry.title')}</h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            live ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-gray-400'}`} />
          {live ? t('pages.settings.foundry.statusLive') : t('pages.settings.foundry.statusMock')}
        </span>
      </div>
      <p className="mb-3 max-w-lg text-xs text-gray-400">{t('pages.settings.foundry.desc')}</p>
      <dl className="mb-4 grid max-w-lg grid-cols-[8rem_1fr] gap-y-1 text-sm">
        <dt className="text-gray-400">{t('pages.settings.foundry.project')}</dt>
        <dd className="truncate font-medium text-gray-800">{endpoint || t('pages.settings.notConfigured')}</dd>
        <dt className="text-gray-400">{t('pages.settings.foundry.active')}</dt>
        <dd className="font-medium text-gray-800">{effective}</dd>
      </dl>
      <label className="mb-1 block text-xs font-medium text-gray-500">{t('pages.settings.foundry.agentLabel')}</label>
      <div className="flex max-w-lg gap-2">
        <input
          list="ffi-foundry-agents"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={DEFAULT_FOUNDRY_AGENT}
          className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <datalist id="ffi-foundry-agents">
          {KNOWN_FOUNDRY_AGENTS.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <button
          onClick={save}
          disabled={!value.trim()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {t('pages.settings.foundry.save')}
        </button>
        <button
          onClick={reset}
          disabled={!custom}
          className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
        >
          {t('pages.settings.foundry.reset')}
        </button>
      </div>
      {custom && <p className="mt-2 text-xs text-amber-600">{t('pages.settings.foundry.overrideNote')}</p>}
      <ConnectionProbe run={() => foundryAgent.probe()} />
    </section>
  );
}

function WebIqKeyCard() {
  const { t } = useTranslation();
  const { role } = useRole();
  const [value, setValue] = useState(getWebIqKey());
  const [, bump] = useState(0);

  const configured = hasWebIqKey();
  const live = isWebIqEnabled();

  const save = () => {
    const v = value.trim();
    if (!v) return;
    setWebIqKey(v);
    audit.logConfigChange(role, 'Web IQ', t('pages.settings.webiq.auditSet'));
    bump((n) => n + 1);
  };
  const clear = () => {
    setWebIqKey('');
    setValue('');
    audit.logConfigChange(role, 'Web IQ', t('pages.settings.webiq.auditCleared'));
    bump((n) => n + 1);
  };

  return (
    <section className="ffi-card p-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{t('pages.settings.webiq.title')}</h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            configured && live ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${configured && live ? 'bg-emerald-500' : 'bg-gray-400'}`} />
          {configured && live ? t('pages.settings.webiq.statusLive') : t('pages.settings.webiq.statusMock')}
        </span>
      </div>
      <p className="mb-3 max-w-lg text-xs text-gray-400">{t('pages.settings.webiq.desc')}</p>
      <label className="mb-1 block text-xs font-medium text-gray-500">{t('pages.settings.webiq.keyLabel')}</label>
      <div className="flex max-w-lg gap-2">
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('pages.settings.webiq.placeholder')}
          className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          onClick={save}
          disabled={!value.trim()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {t('pages.settings.webiq.save')}
        </button>
        <button
          onClick={clear}
          disabled={!configured}
          className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
        >
          {t('pages.settings.webiq.clear')}
        </button>
      </div>
      {configured && !live && <p className="mt-2 text-xs text-amber-600">{t('pages.settings.webiq.needsBackend')}</p>}
      <ConnectionProbe run={() => webIq.probe()} />
    </section>
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
