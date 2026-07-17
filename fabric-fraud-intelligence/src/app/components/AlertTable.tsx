import { useNavigate } from 'react-router-dom';

import type { AlertRow } from '@/backend/api/alerts';
import { RiskScoreBadge } from './RiskScoreBadge';

const STATUS_STYLE: Record<string, string> = {
  New: 'bg-blue-50 text-blue-700',
  'In Review': 'bg-violet-50 text-violet-700',
  Escalated: 'bg-red-50 text-red-700',
  Closed: 'bg-gray-100 text-gray-500',
  'False Positive': 'bg-emerald-50 text-emerald-700',
};

export function AlertTable({ rows }: { rows: AlertRow[] }) {
  const nav = useNavigate();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100">
            <th className="py-2 pr-3">Alert</th>
            <th className="py-2 pr-3">Type</th>
            <th className="py-2 pr-3">Customer</th>
            <th className="py-2 pr-3">Risk</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2">Explanation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr
              key={a.id}
              className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
              onClick={() => a.caseId && nav(`/cases/${a.caseId}`)}
            >
              <td className="py-2 pr-3 font-medium text-gray-800 whitespace-nowrap">{a.id}</td>
              <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{a.alertType}</td>
              <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{a.customerName}</td>
              <td className="py-2 pr-3">
                <RiskScoreBadge score={a.riskScore} severity={a.severity} size="sm" />
              </td>
              <td className="py-2 pr-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    STATUS_STYLE[a.status] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {a.status}
                </span>
              </td>
              <td className="py-2 text-gray-500 max-w-md truncate">{a.explanationShort}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-10 text-center text-gray-400 text-sm">
                No alerts match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
