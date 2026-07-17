import { useState } from 'react';

import { useRole } from '@/app/RoleContext';
import { fabricConfig } from '@/backend/config';
import { audit } from '@/backend/services/AuditService';
import { ROLES, ROLE_PERMISSIONS } from '@/backend/models';

export function Settings() {
  const { role } = useRole();
  const [, refresh] = useState(0);
  const entries = audit.listEntries();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Settings &amp; Governance</h2>
        <p className="text-sm text-gray-400">
          Role-based access, PII masking, environment and the audit trail.
        </p>
      </div>

      <section className="ffi-card p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Role &amp; access matrix</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100">
              <th className="py-2">Role</th>
              <th className="py-2">View PII</th>
              <th className="py-2">Make decisions</th>
              <th className="py-2">Audit access</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => {
              const p = ROLE_PERMISSIONS[r];
              return (
                <tr key={r} className={`border-b border-gray-50 ${r === role ? 'bg-indigo-50/60' : ''}`}>
                  <td className="py-2 font-medium text-gray-800">
                    {r}
                    {r === role && <span className="ml-2 text-[11px] text-indigo-600">(you)</span>}
                  </td>
                  <td className="py-2">{p.viewPII ? '✓' : '—'}</td>
                  <td className="py-2">{p.decide ? '✓' : '—'}</td>
                  <td className="py-2">{p.audit ? '✓' : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-gray-400">
          PII (name, IBAN) is masked for roles without view permission (e.g. Auditor).
          AI recommendations are always non-binding and require human approval.
        </p>
      </section>

      <section className="ffi-card p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Environment</h3>
        <dl className="grid grid-cols-2 gap-y-2 text-sm max-w-lg">
          <dt className="text-gray-400">App mode</dt>
          <dd className="text-gray-800 font-medium">
            {fabricConfig.mode}
            {fabricConfig.mode === 'mock' && ' (deterministic demo data)'}
          </dd>
          <dt className="text-gray-400">Workspace ID</dt>
          <dd className="text-gray-800 font-medium">{fabricConfig.workspaceId || '—'}</dd>
          <dt className="text-gray-400">Data Agent ID</dt>
          <dd className="text-gray-800 font-medium">{fabricConfig.dataAgentId || 'not configured'}</dd>
          <dt className="text-gray-400">Tenant ID</dt>
          <dd className="text-gray-800 font-medium">{fabricConfig.tenantId || '—'}</dd>
        </dl>
        <p className="mt-3 text-xs text-gray-400">
          When a Fabric Data Agent is configured (FABRIC_APP_MODE=fabric), agents ground
          on live Fabric data over REST; otherwise deterministic demo responses are used.
        </p>
      </section>

      <section className="ffi-card p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Audit trail</h3>
          <button
            onClick={() => refresh((n) => n + 1)}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            Refresh
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-400">
            No audit entries yet. Run an agent or record a decision to populate the trail.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Actor</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Target</th>
                <th className="py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, 20).map((e) => (
                <tr key={e.id} className="border-b border-gray-50">
                  <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">
                    {new Date(e.at).toLocaleTimeString()}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-700">{e.actor}</td>
                  <td className="py-1.5 pr-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                      {e.action}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-gray-600">{e.target}</td>
                  <td className="py-1.5 text-gray-500 truncate max-w-sm">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
