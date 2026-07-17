import { DATASET } from '@/data/seed';
import { audit } from '@/backend/services/AuditService';
import {
  dataAgent,
  type GroundingSource,
} from '@/backend/services/FabricDataAgentClient';
import type { AgentRun } from '@/backend/models';
import { buildBundle, type CaseBundle } from './context';
import { fraudInvestigationAgent, type SuggestedAction } from './FraudInvestigationAgent';
import { amlCaseAgent } from './AMLCaseAgent';
import { claimsFraudAgent } from './ClaimsFraudAgent';

export interface AgentResult {
  runId: string;
  agentName: string;
  text: string;
  generatedQuery: string;
  grounding: GroundingSource[];
  actions?: SuggestedAction[];
}

/**
 * AgentOrchestrator — routes a case to the right specialized agent, grounds the
 * response via the Fabric Data Agent client, and records every interaction in
 * the audit trail (AgentRun). All outputs are advisory and require approval.
 */
export class AgentOrchestrator {
  private async persist(
    caseId: string,
    agentName: string,
    prompt: string,
    text: string,
    userId: string
  ): Promise<{ runId: string; generatedQuery: string; grounding: GroundingSource[] }> {
    const da = await dataAgent.askDataAgent(prompt, {
      caseId,
      alertId: DATASET.cases.find((c) => c.id === caseId)?.alertId,
      role: userId,
    });
    const run: AgentRun = {
      id: da.runId,
      caseId,
      agentName,
      prompt,
      response: text,
      groundingSources: JSON.stringify(da.groundingSources),
      createdAt: new Date().toISOString(),
      userId,
    };
    audit.logAgentRun(run);
    return { runId: da.runId, generatedQuery: da.generatedQuery, grounding: da.groundingSources };
  }

  private caseForAlert(alertId: string): CaseBundle | undefined {
    const cs = DATASET.cases.find((c) => c.alertId === alertId);
    return cs ? buildBundle(cs.id) : undefined;
  }

  async investigateAlert(alertId: string, userId = 'system'): Promise<AgentResult | null> {
    const b = this.caseForAlert(alertId);
    if (!b) return null;
    const text = fraudInvestigationAgent.investigate(b);
    const actions = fraudInvestigationAgent.suggestActions(b);
    const meta = await this.persist(b.case.id, fraudInvestigationAgent.name, `Investigate alert ${alertId}`, text, userId);
    return { ...meta, agentName: fraudInvestigationAgent.name, text, actions };
  }

  async summarizeCase(caseId: string, userId = 'system'): Promise<AgentResult | null> {
    const b = buildBundle(caseId);
    if (!b) return null;
    const text = fraudInvestigationAgent.investigate(b);
    const meta = await this.persist(caseId, fraudInvestigationAgent.name, `Summarize case ${caseId}`, text, userId);
    return { ...meta, agentName: fraudInvestigationAgent.name, text };
  }

  async generateAMLNarrative(caseId: string, userId = 'system'): Promise<AgentResult | null> {
    const b = buildBundle(caseId);
    if (!b) return null;
    const text = amlCaseAgent.narrative(b);
    const meta = await this.persist(caseId, amlCaseAgent.name, `Generate AML narrative for ${caseId}`, text, userId);
    return { ...meta, agentName: amlCaseAgent.name, text };
  }

  async generateClaimsFraudSummary(caseId: string, userId = 'system'): Promise<AgentResult | null> {
    const b = buildBundle(caseId);
    if (!b) return null;
    const text = claimsFraudAgent.summary(b);
    const meta = await this.persist(caseId, claimsFraudAgent.name, `Generate claims summary for ${caseId}`, text, userId);
    return { ...meta, agentName: claimsFraudAgent.name, text };
  }

  async suggestNextActions(caseId: string, userId = 'system'): Promise<AgentResult | null> {
    const b = buildBundle(caseId);
    if (!b) return null;
    const actions = fraudInvestigationAgent.suggestActions(b);
    const text = actions.map((a) => `[${a.priority}] ${a.action} — ${a.rationale}`).join('\n');
    const meta = await this.persist(caseId, fraudInvestigationAgent.name, `Suggest next actions for ${caseId}`, text, userId);
    return { ...meta, agentName: fraudInvestigationAgent.name, text, actions };
  }
}

export const orchestrator = new AgentOrchestrator();
