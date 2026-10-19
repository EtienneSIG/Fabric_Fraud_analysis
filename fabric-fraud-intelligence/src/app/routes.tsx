import { lazy, type ReactElement } from 'react';

import { Dashboard } from '@/app/pages/Dashboard';

// Heavy/secondary pages are code-split so the initial bundle stays small.
const AlertQueue = lazy(() => import('@/app/pages/AlertQueue').then((m) => ({ default: m.AlertQueue })));
const CaseDetail = lazy(() => import('@/app/pages/CaseDetail').then((m) => ({ default: m.CaseDetail })));
const FraudFlow = lazy(() => import('@/app/pages/FraudFlow').then((m) => ({ default: m.FraudFlow })));
const AMLCopilot = lazy(() => import('@/app/pages/AMLCopilot').then((m) => ({ default: m.AMLCopilot })));
const ClaimsFraud = lazy(() => import('@/app/pages/ClaimsFraud').then((m) => ({ default: m.ClaimsFraud })));
const EntityGraph = lazy(() => import('@/app/pages/EntityGraph').then((m) => ({ default: m.EntityGraph })));
const FraudIQ = lazy(() => import('@/app/pages/FraudIQ').then((m) => ({ default: m.FraudIQ })));
const Settings = lazy(() => import('@/app/pages/Settings').then((m) => ({ default: m.Settings })));

export interface NavItem {
  path: string;
  label: string;
  icon: string;
}

export const NAV: NavItem[] = [
  { path: '/', label: 'nav.dashboard', icon: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z' },
  { path: '/alerts', label: 'nav.alerts', icon: 'M12 2l9 16H3zM12 9v4M12 16h.01' },
  { path: '/flow', label: 'nav.flow', icon: 'M3 6h18M3 12h12M3 18h6' },
  { path: '/aml', label: 'nav.aml', icon: 'M4 4h16v12H4zM8 20h8M12 16v4' },
  { path: '/claims', label: 'nav.claims', icon: 'M6 2h9l5 5v15H6zM14 2v6h6' },
  { path: '/graph', label: 'nav.graph', icon: 'M5 6a2 2 0 100-4 2 2 0 000 4zM19 8a2 2 0 100-4 2 2 0 000 4zM12 22a2 2 0 100-4 2 2 0 000 4zM6 6l5 10M18 6l-6 10' },
  { path: '/fraud-iq', label: 'nav.fraudIq', icon: 'M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4z' },
  { path: '/settings', label: 'nav.settings', icon: 'M12 8a4 4 0 100 8 4 4 0 000-8zM3 12h3M18 12h3M12 3v3M12 18v3' },
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
  { path: '/fraud-iq', element: <FraudIQ /> },
  { path: '/settings', element: <Settings /> },
];
