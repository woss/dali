import { getDB } from '../db/connection';
import type { EmbedderService } from '../embedder';
import type { MemoryRecord, SearchResult, SearchOptions } from './types';

interface RankedItem {
  id: string;
  rank: number;
  source: 'vector' | 'fulltext';
}

const DEFAULT_FT_INDEX = 'idx_memories_content_ft';

export class HybridSearch {
  private embedder: EmbedderService;
  private vectorWeight: number;
  private fulltextWeight: number;
  private rrfK: number;

  constructor(embedder: EmbedderService, vectorWeight = 0.5, fulltextWeight = 0.5, rrfK = 60) {
    this.embedder = embedder;
    this.vectorWeight = vectorWeight;
    this.fulltextWeight = fulltextWeight;
    this.rrfK = rrfK;
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const db = getDB();
    const { workspaceId, limit = 10, threshold = 0 } = options ?? {};

    // 1. Generate embedding from query text
    const { embedding } = await this.embedder.embed(query);

    // 2. Run vector search
    let vectorSql =
      'SELECT id, name, content, memory_type, metadata, embedding, workspace_id, created_at, vector::similarity::cosine(embedding, $queryEmbedding) AS vector_score FROM memories';
    const vectorParams: Record<string, unknown> = { queryEmbedding: embedding };

    if (workspaceId) {
      vectorSql += ' WHERE workspace_id = $ws';
      vectorParams.ws = workspaceId;
    }

    vectorSql += ' ORDER BY vector_score DESC LIMIT $limit';
    vectorParams.limit = limit * 3; // Fetch more for fusion quality

    const vectorResults = await db.query<MemoryRecord & { vector_score: number }>(
      vectorSql,
      vectorParams,
    );

    // 3. Run fulltext search
    let ftSql =
      'SELECT id, name, content, memory_type, metadata, embedding, workspace_id, created_at, search::score($ftIndex, content) AS ft_score FROM memories WHERE content @@@ $query';
    const ftParams: Record<string, unknown> = { query, ftIndex: DEFAULT_FT_INDEX };

    if (workspaceId) {
      ftSql += ' AND workspace_id = $ws';
      ftParams.ws = workspaceId;
    }

    ftSql += ' ORDER BY ft_score DESC LIMIT $limit';
    ftParams.limit = limit * 3;

    const ftResults = await db.query<MemoryRecord & { ft_score: number }>(ftSql, ftParams);

    // 4. RRF fusion
    const vectorRanked: RankedItem[] = vectorResults.map((r, i) => ({
      id: r.id,
      rank: i + 1,
      source: 'vector' as const,
    }));

    const ftRanked: RankedItem[] = ftResults.map((r, i) => ({
      id: r.id,
      rank: i + 1,
      source: 'fulltext' as const,
    }));

    // Combine ranks: per doc id, sum weighted RRF scores
    const fusionMap = new Map<
      string,
      {
        totalScore: number;
        vectorScore: number;
        ftScore: number;
        sources: Set<'vector' | 'fulltext'>;
      }
    >();

    for (const item of vectorRanked) {
      const rrfScore = 1 / (this.rrfK + item.rank);
      fusionMap.set(item.id, {
        totalScore: rrfScore * this.vectorWeight,
        vectorScore: rrfScore,
        ftScore: 0,
        sources: new Set(['vector']),
      });
    }

    for (const item of ftRanked) {
      const rrfScore = 1 / (this.rrfK + item.rank);
      const existing = fusionMap.get(item.id);
      if (existing) {
        existing.totalScore += rrfScore * this.fulltextWeight;
        existing.ftScore = rrfScore;
        existing.sources.add('fulltext');
      } else {
        fusionMap.set(item.id, {
          totalScore: rrfScore * this.fulltextWeight,
          vectorScore: 0,
          ftScore: rrfScore,
          sources: new Set(['fulltext']),
        });
      }
    }

    // Build a lookup for memory data
    const memoryLookup = new Map<string, MemoryRecord>();
    for (const r of vectorResults) memoryLookup.set(r.id, r as unknown as MemoryRecord);
    for (const r of ftResults) memoryLookup.set(r.id, r as unknown as MemoryRecord);

    // Sort by fused score descending
    const sorted = [...fusionMap.entries()]
      .sort((a, b) => b[1].totalScore - a[1].totalScore)
      .slice(0, limit);

    // 5. Label + threshold
    const results: SearchResult[] = [];
    for (const [id, data] of sorted) {
      if (data.totalScore < threshold) continue;

      const memory = memoryLookup.get(id);
      if (!memory) continue;

      let matched_on: 'vector' | 'fulltext' | 'both';
      if (data.sources.size === 2) matched_on = 'both';
      else if (data.sources.has('vector')) matched_on = 'vector';
      else matched_on = 'fulltext';

      results.push({
        memory,
        score: data.totalScore,
        matched_on,
      });
    }

    return results;
  }
}
