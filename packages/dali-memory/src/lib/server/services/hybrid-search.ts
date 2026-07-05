import { getDB } from '../db/connection';
import type { EmbedderService } from '../embedder';
import { type MemoryRecord, type SearchResult, type SearchOptions, toMemoryRecord } from './types';
import { RecordId } from 'surrealdb';

interface RankedItem {
  id: string;
  rank: number;
  source: 'vector' | 'fulltext';
}

interface EdgeOut {
  out: RecordId;
}

const DEFAULT_FT_INDEX = 0; // SurrealDB v3.x uses numeric index_ref (0-255), not string index names

/**
 * Build a stable string key from a SurrealDB RecordId, e.g. "memories:test-memory".
 */
function memKey(rid: RecordId): string {
  return `${rid.table.name}:${rid.id}`;
}


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
    const driver = db.getDriver();
    const { workspaceId, limit = 10, threshold = 0 } = options ?? {};

    // 1. Generate embedding from query text
    const { embedding } = await this.embedder.embed(query);

    // 2. Vector search on embeddings table → traverse has_embedding edge to memory
    const vLimit = limit * 3;
    let vSql = `SELECT id, vector::similarity::cosine(vector, $queryEmbedding) AS vector_score
FROM embeddings`;
    const vParams: Record<string, unknown> = { queryEmbedding: embedding, vLimit };

    if (workspaceId) {
      vSql += '\nWHERE ->has_embedding.out.workspace_id = $ws';
      vParams.ws = workspaceId;
    }

    vSql += '\nORDER BY vector_score DESC\nLIMIT $vLimit';

    const vectorRows = await db.query<Record<string, unknown>>(vSql, vParams);

    const memoryLookup = new Map<string, MemoryRecord>();
    const vectorRanked: RankedItem[] = [];

    for (const row of vectorRows) {
      const embId = row.id as RecordId;
      const edges = await db.query<EdgeOut>(
        'SELECT out FROM has_embedding WHERE in = $embId LIMIT 1',
        { embId },
      );
      if (edges.length === 0) continue;

      const memRef = edges[0].out;
      const key = memKey(memRef);

      const memResult = await driver.select(String(memRef));
      if (!memResult[0]) continue;

      memoryLookup.set(key, toMemoryRecord(memResult[0]));
      vectorRanked.push({ id: key, rank: vectorRanked.length + 1, source: 'vector' });
    }

    // 3. Fulltext search on memories table (no embedding column — lives on embeddings table)
    // SurrealDB v3.x: @N@ (matches operator with predicate ref), not v2 @@@
    // search::score(N) corresponds to predicate ref N in @N@ operator
    let ftSql = `SELECT id, name, content, memory_type, metadata, workspace_id, created_at,
search::score(${DEFAULT_FT_INDEX}) AS ft_score
FROM memories WHERE content @${DEFAULT_FT_INDEX}@ $searchText`;
    const ftParams: Record<string, unknown> = { searchText: query, fLimit: limit * 3 };

    if (workspaceId) {
      ftSql += ' AND workspace_id = $ws';
      ftParams.ws = workspaceId;
    }

    ftSql += ' ORDER BY ft_score DESC LIMIT $fLimit';

    const ftRows = await db.query<Record<string, unknown>>(ftSql, ftParams);

    const ftRanked: RankedItem[] = [];
    for (const row of ftRows) {
      const key = memKey(row.id as RecordId);
      if (!memoryLookup.has(key)) {
        memoryLookup.set(key, toMemoryRecord(row));
      }
      ftRanked.push({ id: key, rank: ftRanked.length + 1, source: 'fulltext' });
    }

    // 4. RRF fusion — combine vector and fulltext ranks per memory
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

    // 5. Sort by fused score, apply threshold, return
    const sorted = [...fusionMap.entries()]
      .sort((a, b) => b[1].totalScore - a[1].totalScore)
      .slice(0, limit);

    const results: SearchResult[] = [];
    for (const [id, data] of sorted) {
      if (data.totalScore < threshold) continue;

      const memory = memoryLookup.get(id);
      if (!memory) continue;

      let matched_on: 'vector' | 'fulltext' | 'both';
      if (data.sources.size === 2) matched_on = 'both';
      else if (data.sources.has('vector')) matched_on = 'vector';
      else matched_on = 'fulltext';

      results.push({ memory, score: data.totalScore, matched_on });
    }

    return results;
  }
}
