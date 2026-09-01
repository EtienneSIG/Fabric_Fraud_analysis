import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';

import { useRole } from '@/app/RoleContext';
import { useToast } from '@/app/toast/ToastProvider';
import { diag } from '@/backend/diag';
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
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useRole();
  const [msgs, setMsgs] = useState<Msg[]>([]);

  const run = useMutation({
    mutationFn: (v: { label: string; fn: Runner }) => v.fn(caseId, user),
    onMutate: (v) => setMsgs((m) => [...m, { kind: 'user', text: v.label }]),
    onSuccess: (res) =>
      setMsgs((m) => [
        ...m,
        { kind: 'agent', text: res?.text ?? t('components.agentChat.noResponse'), result: res ?? undefined },
      ]),
    onError: (e) => {
      diag('agent', 'run failed', e, 'error');
      toast.error(t('toast.agentError'));
    },
  });
  const busy = run.isPending;

  const actions: { label: string; fn: Runner }[] = [
    { label: t('components.agentChat.investigate'), fn: investigate },
    { label: t('components.agentChat.aml'), fn: amlNarrative },
    { label: t('components.agentChat.claims'), fn: claimsSummary },
    { label: t('components.agentChat.nextActions'), fn: nextActions },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-700">{t('components.agentChat.title')}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
          ✨ {t('components.agentChat.grounded')}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {actions.map((a) => (
          <button
            key={a.label}
            disabled={busy}
            onClick={() => run.mutate({ label: a.label, fn: a.fn })}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-auto ffi-scroll pr-1">
        {msgs.length === 0 && (
          <p className="text-sm text-gray-400">
            {t('components.agentChat.emptyHint')}
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
                {m.result?.agentName ?? t('components.agentChat.agent')}
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
                    {t('components.agentChat.groundingSummary', { count: m.result.grounding.length })}
                  </summary>
                  <ul className="mt-1 space-y-0.5">
                    {m.result.grounding.map((g, k) => (
                      <li key={k} className="text-[11px] text-gray-500">
                        • {g.title} — {g.source} ({t('components.agentChat.conf')} {g.confidence})
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
        {t('components.agentChat.footer')}
      </p>
    </div>
  );
}
