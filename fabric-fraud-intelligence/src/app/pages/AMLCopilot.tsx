import { Fragment, type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RiskScoreBadge } from '@/app/components/RiskScoreBadge';
import { useRole } from '@/app/RoleContext';
import { eur } from '@/app/format';
import { amlNarrative } from '@/backend/api/agents';
import { getAlerts } from '@/backend/api/alerts';
import { getCase } from '@/backend/api/cases';
import { SEVERITY_COLORS } from '@/backend/models';
import { warehouse } from '@/backend/services/FabricWarehouseClient';
import { raftModel, type RaftAnswer, type RaftComparison, type RaftScenario, RAFT_QUESTIONS, RAFT_SYSTEM_PROMPT } from '@/backend/services/RaftModelClient';
import type { AgentResult } from '@/backend/agents/AgentOrchestrator';

function parseNarrative(text: string) {
  const lines = text.split('\n');
  const grab = (label: string) => {
    const l = lines.find((x) => x.toLowerCase().startsWith(label.toLowerCase()));
    return l ? l.slice(l.indexOf(':') + 1).trim() : '';
  };
  return {
    subject: grab('Subject'),
    pattern: grab('Pattern'),
    typology: grab('Typology'),
    assessment: grab('Assessment'),
    recommendation: grab('Recommendation'),
  };
}

export function AMLCopilot() {
  const { t } = useTranslation();
  const { user } = useRole();
  const alerts = useMemo(() => getAlerts({ type: 'AML' }), []);
  const [caseId, setCaseId] = useState(alerts[0]?.caseId ?? '');
  const [res, setRes] = useState<AgentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [ab, setAb] = useState<RaftComparison | null>(null);
  const [abBusy, setAbBusy] = useState(false);
  const bundle = getCase(caseId);
  const txns = bundle?.account ? warehouse.getTransactionsForAccount(bundle.account.id) : [];

  const generate = async () => {
    setBusy(true);
    setRes(await amlNarrative(caseId, user));
    setBusy(false);
  };

  const [scenario, setScenario] = useState<RaftScenario>('layering');
  const [modelView, setModelView] = useState<AbView>('baseline');
  const compare = async (sc: RaftScenario) => {
    setScenario(sc);
    setAbBusy(true);
    setAb(
      await raftModel.compare({
        prompt: RAFT_QUESTIONS[sc],
        subject: bundle?.customer?.name ?? bundle?.account?.id ?? caseId,
        context: { caseId, alertId: bundle?.alert?.id, role: user },
        locale: 'en',
        scenario: sc,
      })
    );
    setAbBusy(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{t('pages.aml.title')}</h2>
        <p className="text-sm text-gray-400">{t('pages.aml.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="ffi-card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('pages.aml.alerts')}</h3>
          <ul className="space-y-1.5">
            {alerts.map((a) => (
              <li
                key={a.id}
                onClick={() => {
                  setCaseId(a.caseId);
                  setRes(null);
                  setAb(null);
                }}
                className={`rounded-lg px-3 py-2 cursor-pointer ${
                  a.caseId === caseId ? 'bg-indigo-50 dark:bg-indigo-500/20' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">{a.id}</span>
                  <RiskScoreBadge score={a.riskScore} severity={a.severity} size="sm" />
                </div>
                <p className="text-xs text-gray-500 truncate">{a.customerName}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="ffi-card p-5 lg:col-span-2 space-y-4">
          {bundle ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{bundle.customer?.name ?? '—'}</p>
                  <p className="text-xs text-gray-400">
                    {bundle.customer?.segment} · KYC {bundle.customer?.kycRiskRating}
                    {bundle.customer?.pepFlag ? ' · PEP' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value as RaftScenario)}
                    disabled={abBusy}
                    title={t('pages.aml.abScenario')}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="structuring">{t('pages.aml.scStructuring')}</option>
                    <option value="smurfing">{t('pages.aml.scSmurfing')}</option>
                    <option value="layering">{t('pages.aml.scLayering')}</option>
                    <option value="not-aml">{t('pages.aml.scNotAml')}</option>
                  </select>
                  <select
                    value={modelView}
                    onChange={(e) => setModelView(e.target.value as AbView)}
                    title={t('pages.aml.abModel')}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="baseline">{t('pages.aml.abModelBaseline')}</option>
                    <option value="raft">{t('pages.aml.abModelRaft')}</option>
                    <option value="both">{t('pages.aml.abModelBoth')}</option>
                  </select>
                  <button
                    disabled={abBusy}
                    onClick={() => void compare(scenario)}
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 disabled:opacity-50"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className={abBusy ? 'animate-spin' : ''}>
                      {abBusy ? (
                        <path d="M12 2a10 10 0 00-9.95 9h2.02A8 8 0 1112 20v2a10 10 0 000-20z" />
                      ) : (
                        <path d="M9 3H3v6h2V5h4zm12 0h-6v2h4v4h2zM5 15H3v6h6v-2H5zm16 0h-2v4h-4v2h6z" />
                      )}
                    </svg>
                    {abBusy ? t('pages.aml.abComparing') : t('pages.aml.abCompare')}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void generate()}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className={busy ? 'animate-spin' : ''}>
                      {busy ? (
                        <path d="M12 2a10 10 0 00-9.95 9h2.02A8 8 0 1112 20v2a10 10 0 000-20z" />
                      ) : (
                        <path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
                      )}
                    </svg>
                    {busy ? t('pages.aml.generating') : t('pages.aml.generate')}
                  </button>
                </div>
              </div>

              {ab && <AbPanel ab={ab} live={ab.mode === 'foundry'} view={modelView} />}

              {res && (() => {
                const p = parseNarrative(res.text);
                const sev = bundle.risk.severity;
                const sevColor = SEVERITY_COLORS[sev];
                const grounds = [...new Set(res.grounding.map((g) => g.title))];
                return (
                  <div className="overflow-hidden rounded-2xl border border-indigo-100 shadow-sm">
                    {/* Header */}
                    <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-white">
                      <div className="flex items-center gap-2.5">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                          <path d="M7 3h7l4 4v14H7z" strokeLinejoin="round" />
                          <path d="M14 3v4h4M9.5 12l1.5 1.5L14 10" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-indigo-100">{t('pages.aml.aiNarrative')}</p>
                          <p className="text-sm font-semibold">{t('pages.aml.sar')} · {bundle.alert?.id}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
                        {t('pages.aml.advisory')}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="space-y-4 bg-white p-5">
                      <div className="flex items-center gap-4">
                        <RiskDonut score={bundle.risk.score} color={sevColor} severity={sev} />
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wide text-gray-400">{t('pages.aml.subject')}</p>
                          <p className="text-sm font-medium text-gray-800">{p.subject}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('pages.aml.typologyLayering')}</p>
                        <div className="mt-1.5">
                          <FlowPills steps={[t('pages.aml.flowInbound'), t('pages.aml.flowLinked'), t('pages.aml.flowRapid')]} />
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-gray-700">{p.typology}</p>
                      </div>

                      <Section label={t('pages.aml.pattern')}>{p.pattern}</Section>
                      <Section label={t('pages.aml.assessment')}>{p.assessment}</Section>

                      <div className="rounded-xl border-l-4 border-amber-400 bg-amber-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                          {t('pages.aml.recommendation')}
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed text-gray-700">{p.recommendation}</p>
                      </div>

                      {grounds.length > 0 && (
                        <div className="border-t border-gray-100 pt-3">
                          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-400">
                            {t('pages.aml.groundedOn')}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {grounds.map((g, i) => (
                              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  {t('pages.aml.moneyMovement', { id: bundle.account?.id ?? '—' })}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100">
                        <th className="py-1.5 pr-3">{t('pages.aml.when')}</th>
                        <th className="py-1.5 pr-3">{t('pages.aml.amount')}</th>
                        <th className="py-1.5 pr-3">{t('pages.aml.channel')}</th>
                        <th className="py-1.5">{t('pages.aml.counterparty')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txns.slice(0, 8).map((t) => (
                        <tr key={t.id} className="border-b border-gray-50">
                          <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">
                            {new Date(t.timestamp).toLocaleDateString()}
                          </td>
                          <td className="py-1.5 pr-3 font-medium text-gray-800">
                            {t.currency} {t.amount}
                          </td>
                          <td className="py-1.5 pr-3">
                            <span className={t.channel === 'wire' ? 'text-red-600 font-medium' : 'text-gray-600'}>
                              {t.channel}
                            </span>
                          </td>
                          <td className="py-1.5 text-gray-500">{t.counterpartyId || '—'}</td>
                        </tr>
                      ))}
                      {txns.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-gray-400 text-xs">
                            {t('pages.aml.noLinkedTxns')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-gray-400">
                  {t('pages.aml.exposure', { amount: eur(txns.reduce((s, tx) => s + tx.amount, 0)), count: txns.length })}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">{t('pages.aml.selectAlert')}</p>
          )}
        </section>
      </div>
    </div>
  );
}
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-gray-700">{children}</p>
    </div>
  );
}

function FlowPills({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => (
        <Fragment key={s}>
          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
            {s}
          </span>
          {i < steps.length - 1 && <span className="text-gray-300">→</span>}
        </Fragment>
      ))}
    </div>
  );
}

function RiskDonut({ score, color, severity }: { score: number; color: string; severity: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = Math.round(score * 100);
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 64 64" className="h-20 w-20 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" className="stroke-slate-100" strokeWidth="8" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-base font-bold" style={{ color }}>
          {pct}
        </span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase" style={{ color }}>
          {severity}
        </span>
      </div>
    </div>
  );
}

type AbView = 'baseline' | 'raft' | 'both';

function AbPanel({ ab, live, view }: { ab: RaftComparison; live: boolean; view: AbView }) {
  const { t } = useTranslation();
  const showBase = view !== 'raft';
  const showRaft = view !== 'baseline';
  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">{t('pages.aml.abTitle')}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            live ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {live ? t('pages.aml.abLive') : t('pages.aml.abSimulated')}
        </span>
      </div>
      {ab.question && <p className="mb-2 -mt-1 text-xs italic text-gray-500">{ab.question}</p>}
      <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-2.5">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          {t('pages.aml.abSystemPrompt')}
        </p>
        <p className="text-[11px] leading-relaxed text-gray-500">{RAFT_SYSTEM_PROMPT}</p>
      </div>
      <div className={`grid grid-cols-1 gap-3 ${view === 'both' ? 'md:grid-cols-2' : ''}`}>
        {showBase && <AbColumn label={t('pages.aml.abBaseline')} answer={ab.baseline} accent="gray" />}
        {showRaft && <AbColumn label={t('pages.aml.abRaft')} answer={ab.raft} accent="violet" />}
      </div>
      <p className="mt-3 text-[11px] text-gray-400">{t('pages.aml.abNote')}</p>
    </div>
  );
}

function AbColumn({ label, answer, accent }: { label: string; answer: RaftAnswer; accent: 'gray' | 'violet' }) {
  const { t } = useTranslation();
  const head = accent === 'violet' ? 'text-violet-700' : 'text-gray-600';
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wide ${head}`}>{label}</span>
        <span className="text-[10px] text-gray-400">{answer.model}</span>
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{answer.text}</p>
      <div className="mt-2 flex flex-wrap gap-3 border-t border-gray-50 pt-2 text-[11px] text-gray-400">
        <span>{t('pages.aml.abTokens', { count: answer.tokens })}</span>
        <span>{t('pages.aml.abLatency', { ms: answer.latencyMs })}</span>
      </div>
    </div>
  );
}
