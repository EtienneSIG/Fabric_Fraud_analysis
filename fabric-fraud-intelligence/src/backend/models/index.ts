// Domain types for Fabric Fraud Intelligence (frontend + mock services).
// These mirror the deployable @entity models in rayfin/data/*.ts.

export type Role = 'Analyst' | 'Manager' | 'Auditor';
export const ROLES: Role[] = ['Analyst', 'Manager', 'Auditor'];

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export const SEVERITIES: Severity[] = ['Low', 'Medium', 'High', 'Critical'];

export const SEVERITY_COLORS: Record<Severity, string> = {
  Low: '#16a34a',
  Medium: '#d97706',
  High: '#ea580c',
  Critical: '#dc2626',
};

export type AlertType =
  | 'Card Fraud'
  | 'AML'
  | 'KYC'
  | 'Identity'
  | 'Claims Fraud'
  | 'Collusion Network';
export const ALERT_TYPES: AlertType[] = [
  'Card Fraud',
  'AML',
  'KYC',
  'Identity',
  'Claims Fraud',
  'Collusion Network',
];

export type AlertStatus =
  | 'New'
  | 'In Review'
  | 'Escalated'
  | 'Closed'
  | 'False Positive';
export const ALERT_STATUSES: AlertStatus[] = [
  'New',
  'In Review',
  'Escalated',
  'Closed',
  'False Positive',
];

export type CaseStatus = 'Open' | 'Investigating' | 'Escalated' | 'Closed';

export type Decision =
  | 'Pending'
  | 'Escalate'
  | 'Monitor'
  | 'Close - False Positive'
  | 'Request Documents'
  | 'Confirmed Fraud';

export interface Customer {
  id: string;
  name: string;
  segment: string;
  country: string;
  kycRiskRating: string;
  pepFlag: boolean;
  sanctionsFlag: boolean;
}

export interface Account {
  id: string;
  customerId: string;
  ibanHash: string;
  accountOpenDate: string;
  status: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  timestamp: string;
  amount: number;
  currency: string;
  merchant: string;
  merchantCategory: string;
  channel: string;
  country: string;
  deviceId: string;
  ipCountry: string;
  counterpartyId: string;
}

export interface FraudAlert {
  id: string;
  alertType: AlertType;
  source: string;
  riskScore: number;
  severity: Severity;
  status: AlertStatus;
  createdAt: string;
  customerId: string;
  transactionId: string;
  claimId: string;
  explanationShort: string;
}

export interface FraudCase {
  id: string;
  alertId: string;
  assignedTo: string;
  status: CaseStatus;
  decision: Decision;
  decisionReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface Claim {
  id: string;
  policyId: string;
  customerId: string;
  claimType: string;
  claimDate: string;
  amountClaimed: number;
  repairProvider: string;
  status: string;
  location: string;
}

export interface Policy {
  id: string;
  customerId: string;
  policyType: string;
  startDate: string;
  premium: number;
  status: string;
}

export interface Evidence {
  id: string;
  caseId: string;
  evidenceType: string;
  title: string;
  content: string;
  sourceSystem: string;
  confidence: number;
  createdAt: string;
}

export interface EntityRelationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: string;
  weight: number;
}

export interface AgentRun {
  id: string;
  caseId: string;
  agentName: string;
  prompt: string;
  response: string;
  groundingSources: string;
  createdAt: string;
  userId: string;
}

export interface CustomerEvent {
  id: string;
  customerId: string;
  event: string;
  occurredAt: string;
  location: string;
  channel: string;
  amount: number | null;
  description: string;
}

// ---------------------------------------------------------------------------
// Governance: role-based access + PII masking
// ---------------------------------------------------------------------------
export interface RolePermissions {
  viewPII: boolean;
  decide: boolean;
  audit: boolean;
}

export const ROLE_PERMISSIONS: Record<Role, RolePermissions> = {
  Analyst: { viewPII: true, decide: true, audit: false },
  Manager: { viewPII: true, decide: true, audit: true },
  Auditor: { viewPII: false, decide: false, audit: true },
};

/** Mask a PII value unless the role is allowed to view it. */
export function maskPII(value: string, role: Role): string {
  if (ROLE_PERMISSIONS[role].viewPII) return value;
  if (!value) return value;
  const head = value.slice(0, 2);
  return `${head}${'•'.repeat(Math.max(value.length - 2, 3))}`;
}

export function canDecide(role: Role): boolean {
  return ROLE_PERMISSIONS[role].decide;
}
