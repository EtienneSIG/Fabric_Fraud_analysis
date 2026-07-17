import { useEffect, useMemo, useRef, useState } from 'react';

import { askMicrosoftIq, IQS, SAMPLE_QUESTIONS, type IqId, type IqResult } from '@/backend/api/microsoftIq';

const LIVE: Record<IqId, boolean> = { fabric: true, work: false, foundry: false };

export function MicrosoftIQ() {
  const [question, setQuestion] = useState(SAMPLE_QUESTIONS[0]);
  const [result, setResult] = useState<IqResult | null>(null);
  const [phase, setPhase] = useState(0); // 0 idle/running, 1 fabric, 2 work, 3 foundry, 4 answer
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const run = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setResult(askMicrosoftIq(question));
    setPhase(0);
    [500, 1000, 1500, 2000].forEach((ms, i) => {
      timers.current.push(window.setTimeout(() => setPhase(i + 1), ms));
    });
  };

  const running = result !== null && phase < 4;
  const cols = useMemo(
    () => IQS.map((iq) => ({ iq, items: result ? result[iq.id] : [] })),
    [result]
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Microsoft IQ</h2>
        <p className="text-sm text-gray-400 max-w-3xl">
          Microsoft IQ is the shared intelligence layer that grounds AI agents across three domains.
          This fraud platform combines all three: <strong>Fabric IQ</strong> (live, from the deployed
          ontology &amp; lakehouse), <strong>Work IQ</strong> and <strong>Foundry IQ</strong> (simulated).
        </p>
      </div>

      {/* The three IQs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {IQS.map((iq) => (
          <section key={iq.id} className="ffi-card p-5 border-t-4" style={{ borderTopColor: iq.color }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: iq.color }}>
                {iq.name}
              </h3>
              <span
                className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                  LIVE[iq.id] ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {LIVE[iq.id] ? 'Live' : 'Simulated'}
              </span>
            </div>
            <p className="text-xs font-medium text-gray-500 mt-0.5">{iq.tagline}</p>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 mt-2">Grounds</p>
            <p className="text-sm text-gray-700">{iq.grounds}</p>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">{iq.description}</p>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 mt-3">In this app</p>
            <ul className="mt-1 space-y-1">
              {iq.fraudUse.map((u, i) => (
                <li key={i} className="flex gap-1.5 text-xs text-gray-600">
                  <span style={{ color: iq.color }}>•</span>
                  <span>{u}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Grounded investigation */}
      <section className="ffi-card p-6">
        <div className="flex items-center gap-2">
          <span aria-hidden>✨</span>
          <h3 className="text-sm font-semibold text-gray-800">Grounded investigation</h3>
          <span className="text-xs text-gray-400">— ask a fraud question across the three IQs</span>
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
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="Ask about a customer, alert or typology (e.g. CUST-014, AML, card fraud)…"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={run}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {running ? 'Grounding…' : 'Run'}
          </button>
        </div>

        {result && (
          <>
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
              {cols.map(({ iq, items }, ci) => {
                const revealed = phase >= ci + 1;
                return (
                  <div key={iq.id} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold" style={{ color: iq.color }}>
                        {iq.name}
                      </h4>
                      <span
                        className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                          LIVE[iq.id] ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {LIVE[iq.id] ? 'Live' : 'Simulated'}
                      </span>
                    </div>
                    {revealed ? (
                      <ul className="mt-2 space-y-1.5">
                        {items.map((it, i) => (
                          <li key={i} className="flex gap-1.5 text-xs text-gray-600 leading-relaxed">
                            <span style={{ color: iq.color }}>•</span>
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
              })}
            </div>

            <div
              className={`mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 transition-opacity ${
                phase >= 4 ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span aria-hidden>🧠</span>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  Synthesized answer
                </h4>
                <span className="ml-auto text-[10px] text-indigo-400">grounded across Microsoft IQ</span>
              </div>
              {phase >= 4 ? (
                <p className="mt-1.5 text-sm leading-relaxed text-gray-700">{result.answer}</p>
              ) : (
                <p className="mt-1.5 text-xs text-gray-400">Synthesizing across the three IQs…</p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
