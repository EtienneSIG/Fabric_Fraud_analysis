import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

type ToastKind = 'success' | 'error' | 'info' | 'warning';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const STYLE: Record<ToastKind, string> = {
  success: 'border-emerald-400 bg-emerald-50 text-emerald-800',
  error: 'border-red-400 bg-red-50 text-red-800',
  warning: 'border-amber-400 bg-amber-50 text-amber-800',
  info: 'border-indigo-400 bg-indigo-50 text-indigo-800',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => setToasts((xs) => xs.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((xs) => [...xs, { id, kind, message }]);
      window.setTimeout(() => remove(id), 5000);
    },
    [remove]
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'error'),
      info: (m) => show(m, 'info'),
      warning: (m) => show(m, 'warning'),
    }),
    [show]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[90vw] flex-col gap-2">
        {toasts.map((x) => (
          <div
            key={x.id}
            role="status"
            className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm shadow-md ${STYLE[x.kind]}`}
          >
            <span className="flex-1">{x.message}</span>
            <button
              onClick={() => remove(x.id)}
              aria-label={t('common.close')}
              className="shrink-0 opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
