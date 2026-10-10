import { useTranslation } from 'react-i18next';

/** Loading state for lazy pages: an indeterminate progress bar + a spinner. */
export function PageLoader({ bar = false }: { bar?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="w-full">
      {bar && (
        <div className="ffi-progress mb-8 h-0.5 w-full overflow-hidden rounded bg-gray-100">
          <span />
        </div>
      )}
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-600" />
        <span className="text-sm">{t('common.loading')}</span>
      </div>
    </div>
  );
}
