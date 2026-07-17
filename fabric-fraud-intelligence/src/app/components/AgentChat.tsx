import { useState } from 'react';

import { useRole } from '@/app/RoleContext';
import {
  amlNarrative,
  claimsSummary,
  investigate,
  nextActions,
} from '@/backend/api/agents';
import type { AgentResult } from '@/backend/agents/AgentOrchestrator';

interface Msg {
  kind: 'user' | 'agent';
  text: string;
  result?: AgentResult;
}

type Runner = (caseId: string, userId: string) => Promise<AgentResult | null>;

export function AgentChat({ caseId }: { caseId: string }) {
  const { user } = useRole();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);

  const run = async (label: string, fn: Runner) => {
    setBusy(true);
    setMsgs((m) => [...m, { kind: 'user', text: label }]);
    const res = await fn(caseId, user);
    setMsgs((m) => [
      ...m,
      { kind: 'agent', text: res?.text ?? 'No response.', result: res ?? undefined },
    ]);
    setBusy(false);
  };

  const actions: { label: string; fn: Runner }[] = [
    { label: 'Investigate', fn: investigate },
    { label: 'AML narrative', fn: amlNarrative },
    { label: 'Claims summary', fn: claimsSummary },
    { label: 'Next actions', fn: nextActions },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-700">Investigation Copilot</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
          ✨ grounded on Fabric data
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {actions.map((a) => (
          <button
            key={a.label}
            disabled={busy}
            onClick={() => void run(a.label, a.fn)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-auto ffi-scroll pr-1">
        {msgs.length === 0 && (
          <p className="text-sm text-gray-400">
            Ask the copilot to investigate this case. All responses are advisory
            and require your approval.
          </p>
        )}
        {msgs.map((m, i) =>
          m.kind === 'user' ? (
            <div key={i} className="text-right">
              <span className="inline-block rounded-2xl bg-gray-100 px-3 py-1.5 text-sm text-gray-700">
                {m.text}
              </span>
            </div>
          ) : (
            <div key={i} className="rounded-2xl border border-gray-100 p-3">
              <p className="text-xs font-semibold text-indigo-700 mb-1">
                {m.result?.agentName ?? 'Agent'}
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{m.text}</p>
              {m.result?.actions && (
                <ul className="mt-2 space-y-1">
                  {m.result.actions.map((a, j) => (
                    <li key={j} className="text-xs text-gray-600">
                      <span className="font-semibold">[{a.priority}]</span> {a.action} — {a.rationale}
                    </li>
                  ))}
                </ul>
              )}
              {m.result && m.result.grounding.length > 0 && (
                <details className="mt-2">
                  <summary className="text-[11px] text-gray-400 cursor-pointer">
                    Grounding sources ({m.result.grounding.length}) + generated query
                  </summary>
                  <ul className="mt-1 space-y-0.5">
                    {m.result.grounding.map((g, k) => (
                      <li key={k} className="text-[11px] text-gray-500">
                        • {g.title} — {g.source} (conf {g.confidence})
                      </li>
                    ))}
                  </ul>
                  <pre className="mt-2 rounded-lg bg-gray-900 text-gray-100 text-[10px] p-2 overflow-x-auto">
                    {m.result.generatedQuery}
                  </pre>
                </details>
              )}
            </div>
          )
        )}
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        AI recommendations are non-binding and logged to the audit trail (AgentRun).
      </p>
    </div>
  );
}
