import { orchestrator, type AgentResult } from '@/backend/agents/AgentOrchestrator';

/** POST /api/cases/:id/agent/investigate */
export function investigate(caseId: string, userId: string): Promise<AgentResult | null> {
  return orchestrator.summarizeCase(caseId, userId);
}

/** POST /api/cases/:id/agent/aml-narrative */
export function amlNarrative(caseId: string, userId: string): Promise<AgentResult | null> {
  return orchestrator.generateAMLNarrative(caseId, userId);
}

/** POST /api/cases/:id/agent/claims-summary */
export function claimsSummary(caseId: string, userId: string): Promise<AgentResult | null> {
  return orchestrator.generateClaimsFraudSummary(caseId, userId);
}

export function nextActions(caseId: string, userId: string): Promise<AgentResult | null> {
  return orchestrator.suggestNextActions(caseId, userId);
}

export function investigateAlert(alertId: string, userId: string): Promise<AgentResult | null> {
  return orchestrator.investigateAlert(alertId, userId);
}
