import { useEffect, useMemo, useRef, useState } from 'react';

import {
  askMicrosoftIq,
  cardFraudScenario,
  IQS,
  SAMPLE_QUESTIONS,
  type IqId,
  type IqResult,
} from '@/backend/api/microsoftIq';

const LIVE: Record<IqId, boolean> = { fabric: true, work: false, foundry: false };
const COLOR: Record<IqId, string> = { fabric: '#4f46e5', work: '#0d9488', foundry: '#7c3aed' };
const IQ_BY_ID = Object.fromEntries(IQS.map((i) => [i.id, i])) as Record<IqId, (typeof IQS)[number]>;

function Badge({ live }: { live: boolean }) {
  return (
    <span
      className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
        live ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {live ? 'Live' : 'Simulated'}
    </span>
  );
}

function IqColumn({ id, items, revealed }: { id: IqId; items: string[]; revealed: boolean }) {
  const iq = IQ_BY_ID[id];
  return (
    <div className="rounded-xl border border-gray-100 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold" style={{ color: COLOR[id] }}>
          {iq.name}
        </h4>
        <Badge live={LIVE[id]} />
      </div>
      <p className="text-[11px] text-gray-400">{iq.grounds}</p>
      {revealed ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-1.5 text-xs text-gray-600 leading-relaxed">
              <span style={{ color: COLOR[id] }}>•</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
          grounding…
        </div>
      )}
    </div>
  );
}

export function FraudIQ() {
  const scenario = useMemo(() => cardFraudScenario(), []);

  // Flagship scenario run
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState(0); // 1 work · 2 fabric · 3 foundry · 4 recommendation
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const runScenario = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStarted(true);
    setPhase(0);
    [600, 1200, 1800, 2600].forEach((ms, i) =>
      timers.current.push(window.setTimeout(() => setPhase(i + 1), ms))
    );
  };
  const done = phase >= 4;

  // Free-form multi-IQ ask
  const [question, setQuestion] = useState(SAMPLE_QUESTIONS[0]);
  const [result, setResult] = useState<IqResult | null>(null);
  const [askPhase, setAskPhase] = useState(0);
  const askTimers = useRef<number[]>([]);
  useEffect(() => () => askTimers.current.forEach(clearTimeout), []);
  const runAsk = () => {
    askTimers.current.forEach(clearTimeout);
    askTimers.current = [];
    setResult(askMicrosoftIq(question));
    setAskPhase(0);
    [400, 800, 1200, 1600].forEach((ms, i) =>
      askTimers.current.push(window.setTimeout(() => setAskPhase(i + 1), ms))
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Fraud IQ</h2>
        <p className="text-sm text-gray-400 max-w-3xl">
          L’intelligence anti-fraude propulsée par <strong>Microsoft IQ</strong> :
          <strong> Fabric IQ</strong> (données &amp; ontologie, en direct sur nos tables),
          <strong> Work IQ</strong> (contexte de travail Microsoft 365) et
          <strong> Foundry IQ</strong> (connaissance &amp; raisonnement des agents).
        </p>
      </div>

      {/* The three IQs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {IQS.map((iq) => (
          <section key={iq.id} className="ffi-card p-4 border-t-4" style={{ borderTopColor: iq.color }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: iq.color }}>
                {iq.name}
              </h3>
              <Badge live={LIVE[iq.id]} />
            </div>
            <p className="text-xs font-medium text-gray-500">{iq.tagline}</p>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{iq.description}</p>
          </section>
        ))}
      </div>

      {/* Flagship scenario */}
      <section className="ffi-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-red-600 text-white text-[11px] font-semibold px-2 py-0.5">
            Scénario
          </span>
          <h3 className="text-sm font-bold text-gray-900">
            Fraude carte bancaire en temps réel — de 90 minutes à 30 secondes
          </h3>
        </div>

        {/* Alert context */}
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <span aria-hidden>🚨</span>
            <span className="text-sm font-semibold text-red-700">
              Alerte {scenario.alertId} — {scenario.customerName} ({scenario.customerId})
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {scenario.context.map((ctx) => (
              <span key={ctx} className="rounded-full bg-white border border-red-200 text-red-700 text-xs px-2.5 py-1">
                {ctx}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Before */}
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">Sans Fraud IQ</h4>
              <span className="rounded-md bg-gray-900 text-white text-xs font-bold px-2 py-0.5">≈ 90 min</span>
            </div>
            <ol className="mt-2 space-y-1">
              {scenario.beforeSteps.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-500">
                  <span className="text-gray-400">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-gray-400">10 étapes manuelles, plusieurs outils, un appel à un collègue.</p>
          </div>

          {/* After */}
          <div className="rounded-xl border-2 border-indigo-200 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-indigo-700">Avec Fraud IQ</h4>
              {done && (
                <span className="rounded-md bg-green-600 text-white text-xs font-bold px-2 py-0.5">≈ 30 sec</span>
              )}
            </div>
            <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-sm text-gray-700 italic">
              “{scenario.prompt}”
            </div>
            {!started ? (
              <button
                onClick={runScenario}
                className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                ▶ Lancer l’investigation agentique
              </button>
            ) : (
              <button
                onClick={runScenario}
                className="mt-3 w-full rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
              >
                ↻ Relancer
              </button>
            )}
          </div>
        </div>

        {/* Agentic reveal */}
        {started && (
          <>
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <IqColumn id="work" items={scenario.work} revealed={phase >= 1} />
              <IqColumn id="fabric" items={scenario.fabric} revealed={phase >= 2} />
              <IqColumn id="foundry" items={scenario.foundry} revealed={phase >= 3} />
            </div>

            <div
              className={`mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 transition-opacity ${
                done ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span aria-hidden>🧠</span>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  Recommandation Foundry IQ
                </h4>
                <span className="ml-auto text-[10px] text-indigo-400">raisonnement ancré multi-IQ</span>
              </div>
              {done ? (
                <div className="mt-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">Confiance fraude</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden max-w-xs">
                      <div
                        className="h-full bg-red-600"
                        style={{ width: `${Math.round(scenario.recommendation.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-red-700">
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
                      Dossier {scenario.recommendation.caseId} créé
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-gray-400">Raisonnement en cours…</p>
              )}
            </div>
          </>
        )}
      </section>

      {/* Free-form multi-IQ investigation */}
      <section className="ffi-card p-6">
        <div className="flex items-center gap-2">
          <span aria-hidden>✨</span>
          <h3 className="text-sm font-semibold text-gray-800">Investigation libre</h3>
          <span className="text-xs text-gray-400">— posez une question sur un client, une alerte ou une typologie</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLE_QUESTIONS.map((q) => (
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
            placeholder="Ex. CUST-014, AML, card fraud…"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={runAsk}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {result && askPhase < 4 ? 'Grounding…' : 'Run'}
          </button>
        </div>
        {result && (
          <>
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <IqColumn id="fabric" items={result.fabric} revealed={askPhase >= 1} />
              <IqColumn id="work" items={result.work} revealed={askPhase >= 2} />
              <IqColumn id="foundry" items={result.foundry} revealed={askPhase >= 3} />
            </div>
            <div
              className={`mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 transition-opacity ${
                askPhase >= 4 ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span aria-hidden>🧠</span>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  Synthèse Fraud IQ
                </h4>
                <span className="ml-auto text-[10px] text-indigo-400">grounded across Microsoft IQ</span>
              </div>
              {askPhase >= 4 ? (
                <div className="mt-2 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white">
                      {result.synthesis.verdict}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Confiance</span>
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
                      Contribution par IQ
                    </p>
                    {(['fabric', 'work', 'foundry'] as IqId[]).map((id) => {
                      const top = (id === 'fabric' ? result.fabric : id === 'work' ? result.work : result.foundry)[0];
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
                  <p className="text-sm leading-relaxed text-gray-700">{result.synthesis.rationale}</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        Findings clés
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
                        Actions recommandées
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
                      Apport business
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
                    Advisory · approbation humaine requise avant action.
                  </p>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-gray-400">Synthèse en cours…</p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
