import { useMemo, useState } from 'react';

import { RiskScoreBadge } from '@/app/components/RiskScoreBadge';
import { useRole } from '@/app/RoleContext';
import { eur } from '@/app/format';
import { amlNarrative } from '@/backend/api/agents';
import { getAlerts } from '@/backend/api/alerts';
import { getCase } from '@/backend/api/cases';
import { warehouse } from '@/backend/services/FabricWarehouseClient';
import type { AgentResult } from '@/backend/agents/AgentOrchestrator';

export function AMLCopilot() {
  const { user } = useRole();
  const alerts = useMemo(() => getAlerts({ type: 'AML' }), []);
  const [caseId, setCaseId] = useState(alerts[0]?.caseId ?? '');
  const [res, setRes] = useState<AgentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const bundle = getCase(caseId);
  const txns = bundle?.account ? warehouse.getTransactionsForAccount(bundle.account.id) : [];

  const generate = async () => {
    setBusy(true);
    setRes(await amlNarrative(caseId, user));
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">AML Copilot</h2>
        <p className="text-sm text-gray-400">
          Transaction-monitoring narrative &amp; SAR readiness, grounded on Fabric data.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="ffi-card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">AML alerts</h3>
          <ul className="space-y-1.5">
            {alerts.map((a) => (
              <li
                key={a.id}
                onClick={() => {
                  setCaseId(a.caseId);
                  setRes(null);
                }}
                className={`rounded-lg px-3 py-2 cursor-pointer ${
                  a.caseId === caseId ? 'bg-indigo-50' : 'hover:bg-gray-50'
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
                <button
                  disabled={busy}
                  onClick={() => void generate()}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  {busy ? 'Generating…' : 'Generate AML narrative'}
                </button>
              </div>

              {res && (
                <div className="rounded-xl border border-gray-100 p-3">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{res.text}</pre>
                  {res.grounding.length > 0 && (
                    <p className="mt-2 text-[11px] text-gray-400">
                      Grounding: {res.grounding.map((g) => g.title).join(', ')}
                    </p>
                  )}
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  Money movement (account {bundle.account?.id ?? '—'})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100">
                        <th className="py-1.5 pr-3">When</th>
                        <th className="py-1.5 pr-3">Amount</th>
                        <th className="py-1.5 pr-3">Channel</th>
                        <th className="py-1.5">Counterparty</th>
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
                            No linked account transactions.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-gray-400">
                  Estimated exposure {eur(txns.reduce((s, t) => s + t.amount, 0))} across {txns.length} movements.
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">Select an AML alert.</p>
          )}
        </section>
      </div>
    </div>
  );
}
