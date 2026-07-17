import type { ReactElement } from 'react';

import { Dashboard } from '@/app/pages/Dashboard';
import { AlertQueue } from '@/app/pages/AlertQueue';
import { CaseDetail } from '@/app/pages/CaseDetail';
import { FraudFlow } from '@/app/pages/FraudFlow';
import { AMLCopilot } from '@/app/pages/AMLCopilot';
import { ClaimsFraud } from '@/app/pages/ClaimsFraud';
import { EntityGraph } from '@/app/pages/EntityGraph';
import { Settings } from '@/app/pages/Settings';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
}

export const NAV: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z' },
  { path: '/alerts', label: 'Alert Queue', icon: 'M12 2l9 16H3zM12 9v4M12 16h.01' },
  { path: '/flow', label: 'Fraud Flow', icon: 'M3 6h18M3 12h12M3 18h6' },
  { path: '/aml', label: 'AML Copilot', icon: 'M4 4h16v12H4zM8 20h8M12 16v4' },
  { path: '/claims', label: 'Claims Fraud', icon: 'M6 2h9l5 5v15H6zM14 2v6h6' },
  { path: '/graph', label: 'Entity Graph', icon: 'M5 6a2 2 0 100-4 2 2 0 000 4zM19 8a2 2 0 100-4 2 2 0 000 4zM12 22a2 2 0 100-4 2 2 0 000 4zM6 6l5 10M18 6l-6 10' },
  { path: '/settings', label: 'Settings', icon: 'M12 8a4 4 0 100 8 4 4 0 000-8zM3 12h3M18 12h3M12 3v3M12 18v3' },
];

export interface RouteDef {
  path: string;
  element: ReactElement;
}

export const ROUTES: RouteDef[] = [
  { path: '/', element: <Dashboard /> },
  { path: '/alerts', element: <AlertQueue /> },
  { path: '/flow', element: <FraudFlow /> },
  { path: '/cases/:id', element: <CaseDetail /> },
  { path: '/aml', element: <AMLCopilot /> },
  { path: '/claims', element: <ClaimsFraud /> },
  { path: '/graph', element: <EntityGraph /> },
  { path: '/settings', element: <Settings /> },
];
