import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { AgentChat } from '@/app/components/AgentChat';
import { CaseTimeline, type TimelineEvent } from '@/app/components/CaseTimeline';
import { EvidencePanel } from '@/app/components/EvidencePanel';
import { RiskScoreBadge } from '@/app/components/RiskScoreBadge';
import { useRole } from '@/app/RoleContext';
import { eur } from '@/app/format';
import { getCase, postDecision } from '@/backend/api/cases';
import { audit } from '@/backend/services/AuditService';
import { canDecide, maskPII, type Decision } from '@/backend/models';

const DECISIONS: { label: string; decision: Decision; tone: string }[] = [
  { label: 'Escalate', decision: 'Escalate', tone: 'bg-red-600 hover:bg-red-700' },
  { label: 'Monitor', decision: 'Monitor', tone: 'bg-amber-600 hover:bg-amber-700' },
  { label: 'Close (false positive)', decision: 'Close - False Positive', tone: 'bg-emerald-600 hover:bg-emerald-700' },
  { label: 'Request documents', decision: 'Request Documents', tone: 'bg-indigo-600 hover:bg-indigo-700' },
];

export function CaseDetail() {
  const { id = '' } = useParams();
  const { role, user } = useRole();
  const [, force] = useState(0);
  const bundle = getCase(id);

  if (!bundle) {
    return <p className="text-sm text-gray-400">Case {id} not found.</p>;
  }
  const { alert, customer, account, transaction, claim, evidence, risk, case: kase } = bundle;

  const decide = (decision: Decision) => {
    postDecision(id, { decision, reason: `${decision} by ${role}`, userId: user });
    force((n) => n + 1);
  };

  const timeline: TimelineEvent[] = [
    { at: alert.createdAt, label: `Alert ${alert.id} raised`, detail: alert.explanationShort, tone: 'alert' as const },
    { at: kase.createdAt, label: `Case ${kase.id} opened`, detail: `Assigned to ${kase.assignedTo}` },
    ...evidence.slice(0, 2).map((e) => ({ at: e.createdAt, label: `Evidence: ${e.title}`, detail: e.sourceSystem })),
    ...audit.listRuns(id).map((r) => ({ at: r.createdAt, label: `Agent: ${r.agentName}`, detail: r.response.slice(0, 80), tone: 'agent' as const })),
    ...(kase.decision !== 'Pending'
      ? [{ at: kase.updatedAt, label: `Decision: ${kase.decision}`, detail: kase.decisionReason, tone: 'decision' as const }]
      : []),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">{kase.id}</h2>
          <span className="text-sm text-gray-400">{alert.alertType} · {alert.source}</span>
          <RiskScoreBadge score={risk.score} severity={risk.severity} />
        </div>
        <span className="text-xs rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">{kase.status}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: evidence + case facts */}
        <div className="lg:col-span-2 space-y-4">
          <section className="ffi-card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Customer profile</h3>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <Field k="Name" v={maskPII(customer?.name ?? '—', role)} />
              <Field k="Segment" v={customer?.segment ?? '—'} />
              <Field k="Country" v={customer?.country ?? '—'} />
              <Field k="KYC rating" v={customer?.kycRiskRating ?? '—'} />
              <Field k="PEP" v={customer?.pepFlag ? 'Yes' : 'No'} />
              <Field k="Sanctions" v={customer?.sanctionsFlag ? '⚠ Potential' : 'No'} />
              {account && <Field k="IBAN" v={maskPII(account.ibanHash, role)} />}
            </dl>
          </section>

          {transaction && (
            <section className="ffi-card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Transaction</h3>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <Field k="Amount" v={`${transaction.currency} ${transaction.amount}`} />
                <Field k="Merchant" v={transaction.merchant} />
                <Field k="Channel" v={transaction.channel} />
                <Field k="Country / IP" v={`${transaction.country} / ${transaction.ipCountry}`} />
                <Field k="Device" v={transaction.deviceId} />
                <Field k="MCC" v={transaction.merchantCategory} />
              </dl>
            </section>
          )}

          {claim && (
            <section className="ffi-card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Claim</h3>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <Field k="Type" v={claim.claimType} />
                <Field k="Amount" v={eur(claim.amountClaimed)} />
                <Field k="Provider" v={claim.repairProvider} />
                <Field k="Location" v={claim.location} />
                <Field k="Status" v={claim.status} />
              </dl>
            </section>
          )}

          <section className="ffi-card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Evidence</h3>
            <EvidencePanel evidence={evidence} />
          </section>

          <section className="ffi-card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Case timeline</h3>
            <CaseTimeline events={timeline} />
          </section>
        </div>

        {/* Right: copilot + actions + decisions */}
        <div className="space-y-4">
          <section className="ffi-card p-5 h-[440px]">
            <AgentChat caseId={id} />
          </section>

          <section className="ffi-card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Model drivers</h3>
            <div className="space-y-2">
              {risk.drivers.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-36 shrink-0 text-xs text-gray-600">{d.name.replace(/_/g, ' ')}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className="h-3 rounded-full bg-gradient-to-r from-amber-400 to-red-600" style={{ width: `${Math.min(d.weight, 1) * 100}%` }} />
                  </div>
                  <div className="w-9 text-right text-xs text-gray-600">{d.weight}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="ffi-card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Decision</h3>
            {!canDecide(role) && (
              <p className="mb-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
                Role “{role}” is read-only. Decisions require Analyst or Manager.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {DECISIONS.map((d) => (
                <button
                  key={d.decision}
                  disabled={!canDecide(role)}
                  onClick={() => decide(d.decision)}
                  className={`rounded-lg px-3 py-2 text-xs font-medium text-white disabled:opacity-40 ${d.tone}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {kase.decision !== 'Pending' && (
              <p className="mt-3 text-xs text-gray-500">
                Current decision: <strong>{kase.decision}</strong> — {kase.decisionReason}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-gray-400">{k}</dt>
      <dd className="text-gray-800 font-medium text-right pr-1">{v}</dd>
    </>
  );
}
