import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
  askMicrosoftIq,
  cardFraudScenario,
  flavor,
  IQS,
  getSampleQuestions,
  type IqId,
  type IqResult,
} from '@/backend/api/microsoftIq';
import { isWorkIqEnabled, isFoundryEnabled } from '@/backend/config';
import { workIq } from '@/backend/services/WorkIqGraphClient';
import { askFoundryAgent, foundryDirectConfigured } from '@/services/FoundryAgentClient';
import { diag, startTimer } from '@/backend/diag';

// Foundry + Web are "live" only when the deployed agent is actually wired (direct SPA path or
// backend proxy). A configured-but-degraded run flips the badge back to Simulated at render time.
const foundryConfigured = (): boolean => isFoundryEnabled() || foundryDirectConfigured();
const isLive = (id: IqId): boolean =>
  id === 'fabric'
    ? true
    : id === 'work'
      ? isWorkIqEnabled()
      : foundryConfigured();
const COLOR: Record<IqId, string> = { fabric: '#4f46e5', work: '#0d9488', foundry: '#7c3aed', web: '#ea580c' };
const IQ_BY_ID = Object.fromEntries(IQS.map((i) => [i.id, i])) as Record<IqId, (typeof IQS)[number]>;

function Badge({ live }: { live: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
        live ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {live ? t('common.live') : t('common.simulated')}
    </span>
  );
}

function MarkdownContent({ children, compact = false }: { children: string; compact?: boolean }) {
  return (
    <div className={`min-w-0 text-gray-700 [overflow-wrap:anywhere] ${compact ? 'space-y-2 text-xs leading-relaxed' : 'space-y-3 text-sm leading-6'}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children: heading }) => <h5 className={compact ? 'text-xs font-semibold text-gray-800' : 'text-base font-bold text-gray-900'}>{heading}</h5>,
          h2: ({ children: heading }) => <h5 className={compact ? 'text-xs font-semibold text-gray-800' : 'text-sm font-bold text-gray-900'}>{heading}</h5>,
          h3: ({ children: heading }) => <h6 className={compact ? 'text-xs font-semibold text-gray-800' : 'text-sm font-semibold text-gray-800'}>{heading}</h6>,
          p: ({ children: paragraph }) => <p>{paragraph}</p>,
          ul: ({ children: list }) => <ul className={`ml-5 list-disc space-y-1.5 ${compact ? 'marker:text-violet-600' : ''}`}>{list}</ul>,
          ol: ({ children: list }) => <ol className={`ml-5 list-decimal space-y-1.5 ${compact ? 'marker:text-violet-600' : ''}`}>{list}</ol>,
          li: ({ children: item }) => <li className="pl-1">{item}</li>,
          strong: ({ children: strong }) => <strong className="font-semibold text-gray-900">{strong}</strong>,
          blockquote: ({ children: quote }) => (
            <blockquote className="border-l-2 border-violet-300 bg-violet-50 px-3 py-2 text-gray-600">
              {quote}
            </blockquote>
          ),
          a: ({ children: link, ...props }) => (
            <a {...props} className="text-indigo-600 underline underline-offset-2" target="_blank" rel="noreferrer">
              {link}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function compactMarkdown(value: string): string {
  const text = value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function IqColumn({
  id,
  items,
  revealed,
  embedded = false,
  live,
}: {
  id: IqId;
  items: string[];
  revealed: boolean;
  embedded?: boolean;
  live?: boolean;
}) {
  const { t } = useTranslation();
  const iq = IQ_BY_ID[id];
  return (
    <div className={`min-w-0 p-4 ${embedded ? '' : 'rounded-xl border border-gray-100'}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold" style={{ color: COLOR[id] }}>
          {iq.name}
        </h4>
        {/* Resolve the Live/Simulated pill only once the column reveals, so it can't flash "Simulated" while auth/grounding is still running. */}
        {revealed && <Badge live={live ?? isLive(id)} />}
      </div>
      <p className="text-[11px] text-gray-400">{t(`fraudIqPage.iq.${id}.grounds`)}</p>
      {revealed ? (
        id === 'foundry' && items.length ? (
          <div className="mt-3 min-w-0">
            <MarkdownContent compact>{items[0]}</MarkdownContent>
            {items.length > 1 && (
              <ul className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                {items.slice(1).map((item, index) => {
                  const url = item.match(/https:\/\/\S+$/)?.[0];
                  return (
                    <li key={index} className="flex min-w-0 gap-2 text-xs leading-relaxed text-gray-600">
                      <span className="shrink-0" style={{ color: COLOR[id] }}>•</span>
                      {url ? (
                        <a className="min-w-0 break-all text-indigo-600 underline" href={url} target="_blank" rel="noreferrer">
                          {item.slice(0, -url.length).trim()}
                        </a>
                      ) : (
                        <span className="min-w-0 break-words">{item}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
        <ul className="mt-2 min-w-0 space-y-1.5">
          {items.map((it, i) => {
            const url = it.match(/https:\/\/\S+$/)?.[0];
            return (
            <li key={i} className="flex min-w-0 gap-1.5 text-xs text-gray-600 leading-relaxed">
              <span className="shrink-0" style={{ color: COLOR[id] }}>•</span>
              {url ? (
                <a className="min-w-0 break-all text-indigo-600 underline" href={url} target="_blank" rel="noreferrer">
                  {it.slice(0, -url.length).trim()}
                </a>
              ) : (
                <span className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{it}</span>
              )}
            </li>
            );
          })}
        </ul>
        )
      ) : (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
          {t('fraudIqPage.groundingCol')}
        </div>
      )}
    </div>
  );
}

function FoundryWebColumn({
  foundry,
  web,
  revealed,
  live,
}: {
  foundry: string[];
  web: string[];
  revealed: boolean;
  live?: boolean;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-gray-100 sm:col-span-2">
      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 border-b border-gray-100 lg:border-b-0 lg:border-r">
          <IqColumn id="foundry" items={foundry} revealed={revealed} embedded live={live} />
        </div>
        <IqColumn id="web" items={web} revealed={revealed} embedded live={live} />
      </div>
    </div>
  );
}

export function FraudIQ() {
  const { t, i18n } = useTranslation();
  // Localized content: rebuild when the UI language changes (i18n is read inside).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scenario = useMemo(() => cardFraudScenario(), [i18n.language]);

  // Flagship scenario run
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState(0); // 1 work · 2 fabric · 3 foundry · 4 recommendation
  const [scenarioFoundry, setScenarioFoundry] = useState<string[]>([]);
  const [scenarioWeb, setScenarioWeb] = useState<string[]>(scenario.web);
  const [scenarioFoundryLive, setScenarioFoundryLive] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [scenarioRunning, setScenarioRunning] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const runScenario = async () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStarted(true);
    setPhase(0);
    setScenarioError(null);
    setScenarioWeb(scenario.web);
    setScenarioRunning(true);
    timers.current.push(window.setTimeout(() => setPhase((p) => Math.max(p, 1)), 600));
    timers.current.push(window.setTimeout(() => setPhase((p) => Math.max(p, 2)), 1200));
    const configured = foundryConfigured();
    const elapsed = startTimer();
    diag('fraudiq', `scenario run \u2014 foundry ${configured ? 'configured (live path)' : 'not configured (mock)'}`, { alertId: scenario.alertId }, 'info');
    try {
      const foundry = await askFoundryAgent(
        `${scenario.prompt}\n\nContexte Fabric : alerte ${scenario.alertId}, client ${scenario.customerId}. ` +
        `${scenario.context.join('; ')}. Sépare les faits, les obligations réglementaires et les actions ` +
        'à soumettre à validation humaine. Cite uniquement des sources officielles.',
        i18n.resolvedLanguage
      );
      const live = configured && !foundry.degraded;
      setScenarioFoundryLive(live);
      setScenarioFoundry([foundry.answer]);
      if (foundry.citations.length) {
        setScenarioWeb(foundry.citations.map((citation) => `${citation.title} \u00b7 ${citation.url}`));
      }
      diag(
        'fraudiq',
        `scenario result \u2014 ${live ? 'LIVE Foundry agent' : 'DEGRADED \u2192 mock'} in ${elapsed()}ms (${foundry.answer.length} chars, ${foundry.citations.length} citations)`,
        { live, degraded: !!foundry.degraded, configured },
        live ? 'info' : 'warn'
      );
      // Reveal Foundry/Web then the recommendation. Monotonic + timed so an instant mock resolve
      // can't let the 600/1200ms phase timers roll the phase backward (Foundry/Web would never show).
      timers.current.push(window.setTimeout(() => setPhase((p) => Math.max(p, 3)), 1800));
      timers.current.push(window.setTimeout(() => setPhase((p) => Math.max(p, 4)), 2400));
    } catch (error) {
      diag('fraudiq', `scenario run failed after ${elapsed()}ms`, error, 'error');
      setScenarioError(error instanceof Error ? error.message : 'Foundry IQ request failed.');
    } finally {
      setScenarioRunning(false);
    }
  };
  const done = phase >= 4;

  // Free-form multi-IQ ask
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const samples = useMemo(() => getSampleQuestions(), [i18n.language]);
  const [question, setQuestion] = useState(samples[0]);
  const [result, setResult] = useState<IqResult | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [askRunning, setAskRunning] = useState(false);
  const [askPhase, setAskPhase] = useState(0);
  const askTimers = useRef<number[]>([]);
  useEffect(() => () => askTimers.current.forEach(clearTimeout), []);
  const runAsk = async () => {
    askTimers.current.forEach(clearTimeout);
    askTimers.current = [];
    setResult(null);
    setAskError(null);
    setAskRunning(true);
    setAskPhase(0);
    const elapsed = startTimer();
    diag('fraudiq', `free ask \u2014 foundry ${foundryConfigured() ? 'configured (live path)' : 'not configured (mock)'}`, { question: question.slice(0, 80) }, 'info');
    try {
      const res = await askMicrosoftIq(question, i18n.resolvedLanguage);
      setResult(res);
      diag(
        'fraudiq',
        `free ask result \u2014 ${res.foundryLive ? 'LIVE Foundry agent' : 'DEGRADED \u2192 mock'} in ${elapsed()}ms`,
        { foundryLive: res.foundryLive },
        res.foundryLive ? 'info' : 'warn'
      );
      [400, 800, 1200, 1600].forEach((ms, i) =>
        askTimers.current.push(window.setTimeout(() => setAskPhase(i + 1), ms))
      );
      if (isWorkIqEnabled()) {
        void workIq.getSignals(question, flavor(question), i18n.language).then((signals) => {
          if (signals && signals.length) setResult((current) => (current ? { ...current, work: signals } : current));
        });
      }
    } catch (error) {
      diag('fraudiq', `free ask failed after ${elapsed()}ms`, error, 'error');
      setAskError(error instanceof Error ? error.message : 'Foundry IQ request failed.');
    } finally {
      setAskRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{t('fraudIqPage.fraudIqTitle')}</h2>
        <p className="text-sm text-gray-400 max-w-3xl">
          <Trans i18nKey="fraudIqPage.microsoftIqIntro" components={{ b: <strong /> }} />
        </p>
      </div>

      {/* The three IQ surfaces */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {IQS.filter((iq) => iq.id === 'fabric' || iq.id === 'work').map((iq) => (
          <section key={iq.id} className="ffi-card overflow-hidden p-0">
            <div className="h-1.5" style={{ backgroundColor: iq.color }} />
            <div className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold" style={{ color: iq.color }}>
                  {iq.name}
                </h3>
                <Badge live={isLive(iq.id)} />
              </div>
              <p className="text-xs font-medium text-gray-500">{t(`fraudIqPage.iq.${iq.id}.tagline`)}</p>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                {t(`fraudIqPage.iq.${iq.id}.description`)}
              </p>
            </div>
          </section>
        ))}
        <section className="ffi-card overflow-hidden p-0">
          <div className="h-1.5 bg-gradient-to-r from-[#7c3aed] to-[#ea580c]" />
          <div className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <h3 className="text-sm font-bold">
                <span style={{ color: COLOR.foundry }}>{IQ_BY_ID.foundry.name}</span>
                <span className="text-gray-400"> + </span>
                <span style={{ color: COLOR.web }}>{IQ_BY_ID.web.name}</span>
              </h3>
              <div className="flex items-center gap-1.5">
                {(['foundry', 'web'] as const).map((id) => (
                  <span key={id} className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold" style={{ color: COLOR[id] }}>
                      {IQ_BY_ID[id].name}
                    </span>
                    <Badge live={isLive(id)} />
                  </span>
                ))}
              </div>
            </div>
            <p className="text-xs font-medium text-gray-500">{t('fraudIqPage.iq.knowledge.tagline')}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
              {t('fraudIqPage.iq.knowledge.description')}
            </p>
          </div>
        </section>
      </div>

      {/* Flagship scenario */}
      <section className="ffi-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-red-600 text-white text-[11px] font-semibold px-2 py-0.5">
            {t('fraudIqPage.scenarioBadge')}
          </span>
          <h3 className="text-sm font-bold text-gray-900">
            {t('fraudIqPage.scenarioTitle')}
          </h3>
        </div>

        {/* Alert context */}
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/40">
          <div className="flex items-center gap-2">
            <span aria-hidden>🚨</span>
            <span className="text-sm font-semibold text-red-700 dark:text-red-300">
              {t('fraudIqPage.alertLine', { alertId: scenario.alertId, name: scenario.customerName, customerId: scenario.customerId })}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {scenario.context.map((ctx) => (
              <span key={ctx} className="rounded-full bg-white border border-red-200 text-red-700 text-xs px-2.5 py-1 dark:bg-red-950/60 dark:border-red-800/70 dark:text-red-200">
                {ctx}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Before */}
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">{t('fraudIqPage.withoutIq')}</h4>
              <span className="rounded-md bg-gray-900 text-white text-xs font-bold px-2 py-0.5">{t('fraudIqPage.approx90')}</span>
            </div>
            <ol className="mt-2 space-y-1">
              {scenario.beforeSteps.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-500">
                  <span className="text-gray-400">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-gray-400">{t('fraudIqPage.manualSteps')}</p>
          </div>

          {/* After */}
          <div className="rounded-xl border-2 border-indigo-200 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-indigo-700">{t('fraudIqPage.withIq')}</h4>
              {done && (
                <span className="rounded-md bg-green-600 text-white text-xs font-bold px-2 py-0.5">{t('fraudIqPage.approx30')}</span>
              )}
            </div>
            <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-sm text-gray-700 italic">
              “{scenario.prompt}”
            </div>
            {!started ? (
              <button
                onClick={runScenario}
                disabled={scenarioRunning}
                className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                {scenarioRunning ? t('fraudIqPage.grounding') : t('fraudIqPage.launch')}
              </button>
            ) : (
              <button
                onClick={runScenario}
                disabled={scenarioRunning}
                className="mt-3 w-full rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
              >
                {scenarioRunning ? t('fraudIqPage.grounding') : t('fraudIqPage.rerun')}
              </button>
            )}
          </div>
        </div>

        {/* Agentic reveal */}
        {started && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <IqColumn id="work" items={scenario.work} revealed={phase >= 1} />
              <IqColumn id="fabric" items={scenario.fabric} revealed={phase >= 2} />
              <FoundryWebColumn foundry={scenarioFoundry} web={scenarioWeb} revealed={phase >= 3} live={scenarioFoundryLive} />
            </div>

            {scenarioError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                Foundry IQ indisponible : {scenarioError}
              </p>
            )}

            <div
              className={`mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 dark:bg-indigo-500/10 p-4 transition-opacity ${
                done ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span aria-hidden>🧠</span>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  {t('fraudIqPage.foundryRecommendation')}
                </h4>
                <span className="ml-auto text-[10px] text-indigo-400">{t('fraudIqPage.groundedMultiIq')}</span>
              </div>
              {done ? (
                <div className="mt-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">{t('fraudIqPage.fraudConfidence')}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden max-w-xs">
                      <div
                        className="h-full bg-red-600"
                        style={{ width: `${Math.round(scenario.recommendation.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-red-700 dark:text-red-300">
                      {Math.round(scenario.recommendation.confidence * 100)}%
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {scenario.recommendation.actions.map((a) => (
                      <span key={a} className="rounded-full bg-white border border-indigo-200 text-indigo-700 text-xs px-3 py-1">
                        ✓ {a}
                      </span>
                    ))}
                    <span className="rounded-full bg-indigo-600 text-white text-xs px-3 py-1">
                      {t('fraudIqPage.caseCreated', { caseId: scenario.recommendation.caseId })}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-gray-400">{t('fraudIqPage.reasoning')}</p>
              )}
            </div>
          </>
        )}
      </section>

      {/* Free-form multi-IQ investigation */}
      <section className="ffi-card p-6">
        <div className="flex items-center gap-2">
          <span aria-hidden>✨</span>
          <h3 className="text-sm font-semibold text-gray-800">{t('fraudIqPage.investigationTitle')}</h3>
          <span className="text-xs text-gray-400">{t('fraudIqPage.askHint')}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {samples.map((q) => (
            <button
              key={q}
              onClick={() => setQuestion(q)}
              className={`rounded-full px-3 py-1 text-xs border ${
                question === q
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runAsk()}
            placeholder={t('fraudIqPage.placeholder')}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={runAsk}
            disabled={askRunning || !question.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {askRunning || (result && askPhase < 4) ? t('fraudIqPage.grounding') : t('fraudIqPage.run')}
          </button>
        </div>
        {askError && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            Foundry IQ indisponible : {askError}
          </p>
        )}
        {result && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <IqColumn id="fabric" items={result.fabric} revealed={askPhase >= 1} />
              <IqColumn id="work" items={result.work} revealed={askPhase >= 2} />
              <FoundryWebColumn foundry={result.foundry} web={result.web} revealed={askPhase >= 3} live={result.foundryLive} />
            </div>
            <div
              className={`mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 dark:bg-indigo-500/10 p-4 transition-opacity ${
                askPhase >= 4 ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span aria-hidden>🧠</span>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  {t('fraudIqPage.synthesisTitle')}
                </h4>
                <span className="ml-auto text-[10px] text-indigo-400">{t('fraudIqPage.groundedAcross')}</span>
              </div>
              {askPhase >= 4 ? (
                <div className="mt-2 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white">
                      {result.synthesis.verdict}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{t('fraudIqPage.confidence')}</span>
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full bg-indigo-600"
                          style={{ width: `${Math.round(result.synthesis.confidence * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-indigo-700">
                        {Math.round(result.synthesis.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5 rounded-lg border border-gray-100 bg-white p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {t('fraudIqPage.contributionByIq')}
                    </p>
                    {(['fabric', 'work', 'foundry'] as IqId[]).map((id) => {
                      const top = compactMarkdown(
                        (id === 'fabric' ? result.fabric : id === 'work' ? result.work : result.foundry)[0]
                      );
                      return (
                        <div key={id} className="flex gap-2 text-[11px]">
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLOR[id] }} />
                          <span>
                            <span className="font-semibold" style={{ color: COLOR[id] }}>
                              {IQ_BY_ID[id].name}
                            </span>
                            <span className="text-gray-600"> — {top}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <MarkdownContent>{result.synthesis.rationale}</MarkdownContent>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        {t('fraudIqPage.keyFindings')}
                      </p>
                      <ul className="space-y-1">
                        {result.synthesis.findings.map((x, i) => (
                          <li key={i} className="flex gap-1.5 text-xs text-gray-600">
                            <span className="text-indigo-500">•</span>
                            <span>{x}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        {t('fraudIqPage.recommendedActions')}
                      </p>
                      <ul className="space-y-1">
                        {result.synthesis.actions.map((x, i) => (
                          <li key={i} className="flex gap-1.5 text-xs text-gray-700">
                            <span className="text-green-600">✓</span>
                            <span>{x}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="rounded-lg border-l-4 border-emerald-400 bg-emerald-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      {t('fraudIqPage.businessImpact')}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {result.synthesis.businessImpact.map((x, i) => (
                        <li key={i} className="flex gap-1.5 text-xs text-gray-700">
                          <span className="text-emerald-600">↗</span>
                          <span>{x}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="border-t border-indigo-100 pt-2 text-[11px] text-gray-400">
                    {t('fraudIqPage.advisoryNote')}
                  </p>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-gray-400">{t('fraudIqPage.synthesisInProgress')}</p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
