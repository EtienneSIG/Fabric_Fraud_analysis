import { DATASET } from '@/data/seed';

export interface VectorHit {
  id: string;
  caseId: string;
  title: string;
  snippet: string;
  score: number;
  source: string;
}

/**
 * VectorSearchClient — mock semantic search over evidence narratives. Designed
 * to be swapped for a Fabric AI / vector index later.
 */
export class VectorSearchClient {
  search(query: string, topK = 5): VectorHit[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return DATASET.evidence
      .map((e) => {
        const hay = `${e.title} ${e.content} ${e.evidenceType}`.toLowerCase();
        const score =
          terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0) / Math.max(terms.length, 1);
        return {
          id: e.id,
          caseId: e.caseId,
          title: e.title,
          snippet: e.content.slice(0, 140),
          score: Math.round((score * 0.7 + e.confidence * 0.3) * 100) / 100,
          source: e.sourceSystem,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

export const vectorSearch = new VectorSearchClient();
