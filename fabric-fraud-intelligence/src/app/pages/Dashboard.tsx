import { useTranslation } from 'react-i18next';

import { KPIGrid } from '@/app/components/KPIGrid';
import { AlertTable } from '@/app/components/AlertTable';
import { eur } from '@/app/format';
import { getAlerts } from '@/backend/api/alerts';
import { getKpis } from '@/backend/api/dashboard';
import { SEVERITY_COLORS } from '@/backend/models';

export function Dashboard() {
  const { t } = useTranslation();
  const k = getKpis();
  const highRisk = getAlerts()
    .filter((a) => a.severity === 'High' || a.severity === 'Critical')
    .slice(0, 7);
  const maxType = Math.max(...k.byType.map((x) => x.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{t('pages.dashboard.title')}</h2>
        <p className="text-sm text-gray-400">{t('pages.dashboard.subtitle')}</p>
      </div>

      <KPIGrid
        items={[
          { label: t('pages.dashboard.kpiAlertsToday'), value: String(k.alertsToday), accent: '#4f46e5' },
          { label: t('pages.dashboard.kpiHighRisk'), value: String(k.highRiskAlerts), accent: '#dc2626' },
          { label: t('pages.dashboard.kpiAvgInvestigation'), value: `${k.avgInvestigationHours}h` },
          { label: t('pages.dashboard.kpiFraudExposure'), value: eur(k.estimatedFraudExposure), accent: '#dc2626' },
          { label: t('pages.dashboard.kpiFalsePositive'), value: `${k.falsePositiveRate}%`, accent: '#16a34a' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="ffi-card p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('pages.dashboard.byType')}</h3>
          <div className="space-y-2.5">
            {k.byType.map((t) => (
              <div key={t.type} className="flex items-center gap-3">
                <div className="w-36 shrink-0 text-sm text-gray-600">{t.type}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-4 rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600"
                    style={{ width: `${(t.count / maxType) * 100}%` }}
                  />
                </div>
                <div className="w-8 text-right text-sm font-medium text-gray-700">{t.count}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="ffi-card p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('pages.dashboard.severityMix')}</h3>
          <div className="space-y-2.5">
            {k.bySeverity.map((s) => (
              <div key={s.severity} className="flex items-center gap-3">
                <div className="w-24 shrink-0 text-sm text-gray-600">{s.severity}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-4 rounded-full"
                    style={{
                      width: `${(s.count / Math.max(k.highRiskAlerts + 5, 1)) * 100}%`,
                      backgroundColor: SEVERITY_COLORS[s.severity],
                    }}
                  />
                </div>
                <div className="w-8 text-right text-sm font-medium text-gray-700">{s.count}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="ffi-card p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('pages.dashboard.topHighRisk')}</h3>
        <AlertTable rows={highRisk} />
      </section>
    </div>
  );
}
