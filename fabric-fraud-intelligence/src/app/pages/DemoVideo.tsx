import { useTranslation } from 'react-i18next';

const DEMO_VIDEO_URL =
  'https://raw.githubusercontent.com/EtienneSIG/Fabric_Fraud_analysis/main/video/Fabric%20Fraud%20Intelligence%20%28live%29.mp4';

export function DemoVideo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{t('pages.demoVideo.title')}</h2>
        <p className="text-sm text-gray-400">{t('pages.demoVideo.subtitle')}</p>
      </div>

      <section className="ffi-card overflow-hidden p-0">
        <div className="bg-slate-950">
          <video
            className="aspect-video w-full bg-black"
            controls
            preload="metadata"
            playsInline
            aria-label={t('pages.demoVideo.playerLabel')}
          >
            <source src={DEMO_VIDEO_URL} type="video/mp4" />
            {t('pages.demoVideo.unsupported')}
          </video>
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-200 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{t('pages.demoVideo.cardTitle')}</h3>
            <p className="mt-1 text-sm text-gray-500">{t('pages.demoVideo.cardDescription')}</p>
          </div>
          <a
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
            href={DEMO_VIDEO_URL}
            target="_blank"
            rel="noreferrer"
          >
            {t('pages.demoVideo.openSource')}
          </a>
        </div>
      </section>
    </div>
  );
}
