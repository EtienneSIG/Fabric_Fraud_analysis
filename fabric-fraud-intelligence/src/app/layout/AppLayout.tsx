import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuth } from '@/hooks/AuthContext';
import { useRole } from '@/app/RoleContext';
import { NAV } from '@/app/routes';
import { ROLES } from '@/backend/models';

export function AppLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const { role, setRole, user } = useRole();

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
            <p className="text-white text-sm font-semibold">Fabric Fraud</p>
            <p className="text-slate-400 text-xs">Intelligence</p>
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
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-5 py-4 text-[11px] text-slate-500">
          Microsoft Fabric · Rayfin App
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <h1 className="text-sm font-semibold text-gray-800">
            Fabric Fraud Intelligence
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Role</span>
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
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto ffi-scroll px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
