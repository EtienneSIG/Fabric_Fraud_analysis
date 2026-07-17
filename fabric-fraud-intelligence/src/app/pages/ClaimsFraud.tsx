import { useMemo, useState } from 'react';

import { RiskScoreBadge } from '@/app/components/RiskScoreBadge';
import { useRole } from '@/app/RoleContext';
import { eur } from '@/app/format';
import { claimsSummary } from '@/backend/api/agents';
import { getAlerts } from '@/backend/api/alerts';
import { getCase } from '@/backend/api/cases';
import { DATASET } from '@/data/seed';
import type { AgentResult } from '@/backend/agents/AgentOrchestrator';

export function ClaimsFraud() {
  const { user } = useRole();
  const alerts = useMemo(
    () => getAlerts().filter((a) => a.alertType === 'Claims Fraud' || a.alertType === 'Collusion Network'),
    []
  );
  const [caseId, setCaseId] = useState(alerts[0]?.caseId ?? '');
  const [res, setRes] = useState<AgentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const bundle = getCase(caseId);
  const claim = bundle?.claim;

  const providerStats = useMemo(() => {
    const m = new Map<string, { count: number; amount: number }>();
    DATASET.claims.forEach((c) => {
      const e = m.get(c.repairProvider) ?? { count: 0, amount: 0 };
      e.count += 1;
      e.amount += c.amountClaimed;
      m.set(c.repairProvider, e);
    });
    return [...m.entries()]
      .map(([provider, v]) => ({ provider, ...v }))
      .sort((a, b) => b.count - a.count);
  }, []);

  const generate = async () => {
    setBusy(true);
    setRes(await claimsSummary(caseId, user));
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Claims Fraud</h2>
        <p className="text-sm text-gray-400">
          Insurance claim investigation — image reuse, provider concentration &amp; collusion.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="ffi-card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Claims alerts</h3>
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
                <p className="text-xs text-gray-500">{a.alertType}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="ffi-card p-5 lg:col-span-2 space-y-4">
          {bundle ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {claim ? `${claim.claimType} claim ${claim.id}` : 'Claim'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {claim ? `${eur(claim.amountClaimed)} · ${claim.repairProvider} · ${claim.location}` : '—'}
                  </p>
                </div>
                <button
                  disabled={busy}
                  onClick={() => void generate()}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  {busy ? 'Generating…' : 'Generate claims summary'}
                </button>
              </div>

              {res && (
                <div className="rounded-xl border border-gray-100 p-3">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{res.text}</pre>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  Repair-provider concentration
                </h4>
                <div className="space-y-2">
                  {providerStats.map((p) => (
                    <div key={p.provider} className="flex items-center gap-3">
                      <div className="w-40 shrink-0 text-sm text-gray-600">{p.provider}</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-4 rounded-full ${p.count >= 3 ? 'bg-red-500' : 'bg-indigo-400'}`}
                          style={{ width: `${(p.count / Math.max(providerStats[0].count, 1)) * 100}%` }}
                        />
                      </div>
                      <div className="w-24 text-right text-xs text-gray-500">
                        {p.count} · {eur(p.amount)}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-gray-400">
                  Providers appearing in ≥3 claims are flagged as concentration risk.
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">Select a claims alert.</p>
          )}
        </section>
      </div>
    </div>
  );
}
