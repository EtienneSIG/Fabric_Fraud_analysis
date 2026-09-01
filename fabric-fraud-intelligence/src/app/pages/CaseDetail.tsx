import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AgentChat } from '@/app/components/AgentChat';
import { CaseTimeline, type TimelineEvent } from '@/app/components/CaseTimeline';
import { EvidencePanel } from '@/app/components/EvidencePanel';
import { RiskScoreBadge } from '@/app/components/RiskScoreBadge';
import { useRole } from '@/app/RoleContext';
import { useToast } from '@/app/toast/ToastProvider';
import { eur } from '@/app/format';
import { getCase, postDecision } from '@/backend/api/cases';
import { audit } from '@/backend/services/AuditService';
import { canDecide, maskPII, type Decision } from '@/backend/models';

const DECISIONS: { labelKey: string; decision: Decision; tone: string }[] = [
  { labelKey: 'pages.caseDetail.decisions.escalate', decision: 'Escalate', tone: 'bg-red-600 hover:bg-red-700' },
  { labelKey: 'pages.caseDetail.decisions.monitor', decision: 'Monitor', tone: 'bg-amber-600 hover:bg-amber-700' },
  { labelKey: 'pages.caseDetail.decisions.closeFalsePositive', decision: 'Close - False Positive', tone: 'bg-emerald-600 hover:bg-emerald-700' },
  { labelKey: 'pages.caseDetail.decisions.requestDocuments', decision: 'Request Documents', tone: 'bg-indigo-600 hover:bg-indigo-700' },
];

export function CaseDetail() {
  const { t } = useTranslation();
  const toast = useToast();
  const { id = '' } = useParams();
  const { role, user } = useRole();
  const [, force] = useState(0);
  const bundle = getCase(id);

  if (!bundle) {
    return <p className="text-sm text-gray-400">{t('pages.caseDetail.notFound', { id })}</p>;
  }
  const { alert, customer, account, transaction, claim, evidence, risk, case: kase } = bundle;

  const decide = (decision: Decision) => {
    postDecision(id, { decision, reason: `${decision} by ${role}`, userId: user });
    toast.success(t('toast.decisionRecorded', { decision }));
    force((n) => n + 1);
  };

  const timeline: TimelineEvent[] = [
    { at: alert.createdAt, label: t('pages.caseDetail.tl.alertRaised', { id: alert.id }), detail: alert.explanationShort, tone: 'alert' as const },
    { at: kase.createdAt, label: t('pages.caseDetail.tl.caseOpened', { id: kase.id }), detail: t('pages.caseDetail.tl.assignedTo', { name: kase.assignedTo }) },
    ...evidence.slice(0, 2).map((e) => ({ at: e.createdAt, label: t('pages.caseDetail.tl.evidence', { title: e.title }), detail: e.sourceSystem })),
    ...audit.listRuns(id).map((r) => ({ at: r.createdAt, label: t('pages.caseDetail.tl.agent', { name: r.agentName }), detail: r.response.slice(0, 80), tone: 'agent' as const })),
    ...(kase.decision !== 'Pending'
      ? [{ at: kase.updatedAt, label: t('pages.caseDetail.tl.decision', { decision: kase.decision }), detail: kase.decisionReason, tone: 'decision' as const }]
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
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('pages.caseDetail.customerProfile')}</h3>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <Field k={t('pages.caseDetail.fields.name')} v={maskPII(customer?.name ?? '—', role)} />
              <Field k={t('pages.caseDetail.fields.segment')} v={customer?.segment ?? '—'} />
              <Field k={t('pages.caseDetail.fields.country')} v={customer?.country ?? '—'} />
              <Field k={t('pages.caseDetail.fields.kyc')} v={customer?.kycRiskRating ?? '—'} />
              <Field k={t('pages.caseDetail.fields.pep')} v={customer?.pepFlag ? t('pages.caseDetail.yes') : t('pages.caseDetail.no')} />
              <Field k={t('pages.caseDetail.fields.sanctions')} v={customer?.sanctionsFlag ? t('pages.caseDetail.sanctionsPotential') : t('pages.caseDetail.no')} />
              {account && <Field k={t('pages.caseDetail.fields.iban')} v={maskPII(account.ibanHash, role)} />}
            </dl>
          </section>

          {transaction && (
            <section className="ffi-card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('pages.caseDetail.transaction')}</h3>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <Field k={t('pages.caseDetail.fields.amount')} v={`${transaction.currency} ${transaction.amount}`} />
                <Field k={t('pages.caseDetail.fields.merchant')} v={transaction.merchant} />
                <Field k={t('pages.caseDetail.fields.channel')} v={transaction.channel} />
                <Field k={t('pages.caseDetail.fields.countryIp')} v={`${transaction.country} / ${transaction.ipCountry}`} />
                <Field k={t('pages.caseDetail.fields.device')} v={transaction.deviceId} />
                <Field k={t('pages.caseDetail.fields.mcc')} v={transaction.merchantCategory} />
              </dl>
            </section>
          )}

          {claim && (
            <section className="ffi-card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('pages.caseDetail.claim')}</h3>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <Field k={t('pages.caseDetail.fields.type')} v={claim.claimType} />
                <Field k={t('pages.caseDetail.fields.amount')} v={eur(claim.amountClaimed)} />
                <Field k={t('pages.caseDetail.fields.provider')} v={claim.repairProvider} />
                <Field k={t('pages.caseDetail.fields.location')} v={claim.location} />
                <Field k={t('pages.caseDetail.fields.status')} v={claim.status} />
              </dl>
            </section>
          )}

          <section className="ffi-card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('pages.caseDetail.evidence')}</h3>
            <EvidencePanel evidence={evidence} />
          </section>

          <section className="ffi-card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('pages.caseDetail.timeline')}</h3>
            <CaseTimeline events={timeline} />
          </section>
        </div>

        {/* Right: copilot + actions + decisions */}
        <div className="space-y-4">
          <section className="ffi-card p-5 h-[440px]">
            <AgentChat caseId={id} />
          </section>

          <section className="ffi-card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('pages.caseDetail.modelDrivers')}</h3>
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
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('pages.caseDetail.decision')}</h3>
            {!canDecide(role) && (
              <p className="mb-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
                {t('pages.caseDetail.readOnly', { role })}
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
                  {t(d.labelKey)}
                </button>
              ))}
            </div>
            {kase.decision !== 'Pending' && (
              <p className="mt-3 text-xs text-gray-500">
                {t('pages.caseDetail.currentDecision')}: <strong>{kase.decision}</strong> — {kase.decisionReason}
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
