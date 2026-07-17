import type { AgentRun } from '@/backend/models';

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
}

/**
 * AuditService — append-only audit trail for decisions and agent runs. In a
 * deployed app these also persist to the AgentRun entity via the Rayfin client.
 */
export class AuditService {
  private entries: AuditEntry[] = [];
  private runs: AgentRun[] = [];

  logDecision(actor: string, caseId: string, decision: string, reason: string): void {
    this.entries.unshift({
      id: `AUD-${Date.now()}-${this.entries.length}`,
      at: new Date().toISOString(),
      actor,
      action: 'decision',
      target: caseId,
      detail: `${decision}${reason ? ` — ${reason}` : ''}`,
    });
  }

  logAgentRun(run: AgentRun): void {
    this.runs.unshift(run);
    this.entries.unshift({
      id: `AUD-${Date.now()}-${this.entries.length}`,
      at: run.createdAt,
      actor: run.userId,
      action: 'agent_run',
      target: run.caseId,
      detail: `${run.agentName}: ${run.response.slice(0, 80)}…`,
    });
  }

  listEntries(): AuditEntry[] {
    return this.entries;
  }
  listRuns(caseId?: string): AgentRun[] {
    return caseId ? this.runs.filter((r) => r.caseId === caseId) : this.runs;
  }
}

export const audit = new AuditService();
