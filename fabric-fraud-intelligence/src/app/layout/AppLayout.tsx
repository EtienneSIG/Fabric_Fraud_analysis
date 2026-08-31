import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/hooks/AuthContext';
import { useRole } from '@/app/RoleContext';
import { NAV } from '@/app/routes';
import { ROLES } from '@/backend/models';
import { SUPPORTED_LOCALES } from '@/i18n/i18n';
import { IntegrationModeBadge } from '@/app/layout/IntegrationModeBadge';

export function AppLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const { role, setRole, user } = useRole();
  const { t, i18n } = useTranslation();

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--ffi-bg)' }}>
      <aside
        className="w-60 shrink-0 flex flex-col"
        style={{ background: 'var(--ffi-sidebar)' }}
      >
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center text-white font-bold">
            F
          </div>
          <div className="leading-tight">
            <p className="text-white text-sm font-semibold">{t('common.brandTop')}</p>
            <p className="text-slate-400 text-xs">{t('common.brandBottom')}</p>
          </div>
        </div>
        <nav className="px-3 space-y-1 mt-2">
          {NAV.map((n) => (
            <NavLink
              key={n.path}
              to={n.path}
              end={n.path === '/'}
              className={({ isActive }) => `ffi-sidebar-link ${isActive ? 'active' : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d={n.icon} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t(n.label)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-5 py-4 text-[11px] text-slate-500">
          {t('common.platform')}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <h1 className="text-sm font-semibold text-gray-800">
            {t('common.appTitle')}
          </h1>
          <div className="flex items-center gap-4">
            <IntegrationModeBadge />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{t('common.language')}</span>
              <select
                value={i18n.resolvedLanguage}
                onChange={(e) => void i18n.changeLanguage(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
              >
                {SUPPORTED_LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {t(`lang.${l}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{t('common.role')}</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-sm text-gray-500" title={user}>
              {user}
            </span>
            <button
              onClick={() => void signOut()}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              {t('common.signOut')}
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto ffi-scroll px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
