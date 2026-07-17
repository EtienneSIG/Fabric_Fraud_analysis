import { fabricConfig, isMock } from '@/backend/config';
import { vectorSearch } from '@/backend/services/VectorSearchClient';

export interface GroundingSource {
  title: string;
  source: string;
  confidence: number;
}

export interface DataAgentContext {
  caseId?: string;
  alertId?: string;
  role?: string;
}

export interface DataAgentResponse {
  runId: string;
  answer: string;
  generatedQuery: string;
  groundingSources: GroundingSource[];
  mode: 'mock' | 'fabric';
}

/**
 * FabricDataAgentClient — abstraction over the Fabric Data Agent. In mock mode
 * it returns deterministic, grounded responses from the seeded dataset. When a
 * FABRIC_DATA_AGENT_ID is configured it can POST to the Data Agent REST API
 * (askDataAgent) and return the generated NL2SQL query + grounding sources.
 */
export class FabricDataAgentClient {
  private runs = new Map<string, DataAgentResponse>();

  async askDataAgent(question: string, context: DataAgentContext): Promise<DataAgentResponse> {
    const runId = `RUN-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    if (!isMock()) {
      // Real integration point (Fabric Data Agent REST). Falls back to mock
      // if the call is not available in this environment.
      try {
        return await this.callFabricDataAgent(question, context, runId);
      } catch {
        /* fall through to mock */
      }
    }
    const hits = vectorSearch.search(question, 4);
    const grounding: GroundingSource[] = hits.map((h) => ({
      title: h.title,
      source: h.source,
      confidence: h.score,
    }));
    const generatedQuery = this.mockQuery(context);
    const answer =
      `Grounded on ${grounding.length} evidence source(s): ` +
      hits.map((h) => h.snippet).slice(0, 2).join(' · ');
    const res: DataAgentResponse = {
      runId,
      answer,
      generatedQuery,
      groundingSources: grounding,
      mode: 'mock',
    };
    this.runs.set(runId, res);
    return res;
  }

  getGeneratedQuery(runId: string): string {
    return this.runs.get(runId)?.generatedQuery ?? '';
  }

  listGroundingSources(runId: string): GroundingSource[] {
    return this.runs.get(runId)?.groundingSources ?? [];
  }

  private mockQuery(ctx: DataAgentContext): string {
    return [
      'SELECT a.id AS alert_id, a.alertType, a.riskScore, c.name, t.amount, t.currency, t.ipCountry',
      'FROM FraudAlert a',
      'LEFT JOIN Customer c ON c.id = a.customerId',
      'LEFT JOIN [Transaction] t ON t.id = a.transactionId',
      `WHERE a.id = '${ctx.alertId ?? '@alertId'}'`,
    ].join('\n');
  }

  private async callFabricDataAgent(
    question: string,
    context: DataAgentContext,
    runId: string
  ): Promise<DataAgentResponse> {
    // Placeholder for the real REST call:
    //   POST {workload}/dataagents/{FABRIC_DATA_AGENT_ID}/query
    //   body: { question, context }
    void fabricConfig;
    void question;
    void context;
    void runId;
    throw new Error('Fabric Data Agent endpoint not configured');
  }
}

export const dataAgent = new FabricDataAgentClient();
