import { RecordId } from 'surrealdb';
import { QueryError } from '@woss/dali-orm/core/errors';
import { createLogger, CAT } from '../logger';
import { getDB } from '../db/connection';
import { memoriesTable, embeddingsTable, modelsTable, hasEmbeddingTable } from '../db/schema';
import type { EmbedderService } from '../embedder';
import type { MemoryRecord, SearchOptions, SearchResult } from './types';
import { getConfig } from '../config';
import { chunkContent } from '../chunking';

const log = createLogger(CAT.db);

/**
 * Normalize a record ID to "table:key" format.
 * Handles RecordId objects, escaped toString() output (with ⟨⟩ brackets),
 * bare slugs, and already-qualified IDs.
 */
function toQualifiedId(id: unknown): string {
  if (id instanceof RecordId) {
    return `${id.table.name}:${id.id}`;
  }
  const str = String(id);
  // Angle-bracket format: table⟨key⟩ — extract key
  const openIdx = str.indexOf('⟨');
  const closeIdx = str.lastIndexOf('⟩');
  if (openIdx !== -1 && closeIdx !== -1 && closeIdx > openIdx) {
    const key = str.substring(openIdx + 1, closeIdx);
    return `memories:${key}`;
  }
  // Already colon-qualified: table:key
  if (str.includes(':')) {
    const key = str.split(':').slice(1).join(':');
    return `memories:${key}`;
  }
  // Bare key
  return `memories:${str}`;
}

/** Result shape for edge-table queries returning in/out RecordIds */
interface EdgeIn {
  in: RecordId;
}
interface EdgeOut {
  out: RecordId;
}

/** Transform raw DB record to MemoryRecord, extracting slug from the RecordId */
function toMemoryRecord(raw: unknown): MemoryRecord {
  const record = raw as Record<string, unknown>;
  const id = record.id;
  const slug =
    id instanceof RecordId
      ? String(id.id)
      : typeof id === 'string'
        ? id.includes(':')
          ? id.split(':')[1]
          : id
        : String(id);
  return { ...record, slug } as unknown as MemoryRecord;
}

/**
 * Wrap an ORM call with structured QueryError context on failure.
 * Re-throws QueryError instances unchanged; wraps generic errors.
 */
async function withQueryError<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof QueryError) throw error;
    log.error(`${operation} failed`, {
      error: error instanceof Error ? error.message : String(error),
      className: error?.constructor?.name ?? 'Unknown',
    });
    throw new QueryError(`${operation} failed`, {
      operation,
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

export class MemoryService {
  constructor(private embedder: EmbedderService) {}

  async createMemory(data: {
    name: string;
    content: string;
    memory_type?: string;
    workspace_id: string;
    metadata?: Record<string, unknown>;
    slug?: string;
  }): Promise<MemoryRecord> {
    const db = getDB();

    // Validate workspace exists
    const wsRecordId =
      typeof data.workspace_id !== 'string'
        ? (data.workspace_id as unknown as RecordId)
        : new RecordId('workspaces', data.workspace_id.split(':').pop()!);
    const wsResult = await withQueryError('workspace validation', () =>
      db.query<Record<string, unknown>>(
        'SELECT id FROM workspaces WHERE id = $wsId AND deleted_at = none LIMIT 1',
        { wsId: wsRecordId },
      ),
    );
    if (!wsResult || wsResult.length === 0) {
      throw new Error('Workspace not found');
    }

    // Generate slug from name if not provided
    const slug =
      data.slug ??
      data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    // Content dedup: check for existing record with same content + workspace_id
    const existing = await withQueryError('content dedup check', () =>
      db
        .model(memoriesTable)
        .select()
        .where((w) => w.eq('content', data.content).eq('workspace_id', wsRecordId))
        .limit(1)
        .execute(),
    );

    if (existing.length > 0) {
      throw new Error('Memory with this content already exists in workspace');
    }

    // Check if slug already exists
    const driver = db.getDriver();
    const existingBySlug = await withQueryError('slug dedup check', () =>
      driver.select(`memories:${slug}`),
    );
    if (existingBySlug.length > 0) {
      throw new Error(`Memory with slug '${slug}' already exists`);
    }

    // Generate embedding(s)
    const { embedding, model: modelName, dimensions } = await this.embedder.embed(data.content);

    // For long content, split into chunks and embed each separately
    const chunks = chunkContent(data.content);
    const isMultiChunk = chunks.length > 1;

    // Create new memory with slug as record ID
    const result = await withQueryError('create memory', () =>
      db
        .model(memoriesTable)
        .create()
        .id(slug)
        .data({
          name: data.name,
          content: data.content,
          memory_type: data.memory_type ?? 'fact',
          metadata: data.metadata ?? {},
          workspace_id: wsRecordId,
        })
        .execute(),
    );

    const memoryRecord = result[0] as Record<string, unknown>;

    // Find or create model record
    const config = getConfig();
    const providerId = config.DALI_MEMORY_EMBEDDING_PROVIDER;

    let modelRecordId: string;
    const existingModels = await withQueryError('find model record', () =>
      db
        .model(modelsTable)
        .select()
        .where((w) => w.eq('provider_id', providerId).eq('model_id', modelName))
        .limit(1)
        .execute(),
    );

    if (existingModels.length > 0) {
      modelRecordId = String((existingModels[0] as Record<string, unknown>).id);
    } else {
      const modelResult = await withQueryError('create model record', () =>
        db
          .model(modelsTable)
          .create()
          .data({
            provider_id: providerId,
            model_id: modelName,
            dimensions,
          })
          .execute(),
      );
      modelRecordId = String((modelResult[0] as Record<string, unknown>).id);
    }

    // Create embedding record(s) — one per chunk, or one for the full content
    const embeddingsToCreate = isMultiChunk
      ? chunks
      : [{ text: data.content, chunkIndex: 0, section: '' }];

    for (const chunk of embeddingsToCreate) {
      // Embed each chunk individually
      const chunkResult = isMultiChunk
        ? await this.embedder.embed(chunk.text)
        : { embedding, model: modelName, dimensions };

      const embId = crypto.randomUUID().replace(/-/g, '');
      await withQueryError('create embedding', () =>
        db
          .model(embeddingsTable)
          .create()
          .id(embId)
          .data({
            vector: chunkResult.embedding,
            model: modelRecordId,
            chunk_index: isMultiChunk ? chunk.chunkIndex : undefined,
            chunk_text: isMultiChunk ? chunk.text : undefined,
            section: chunk.section || undefined,
          })
          .execute(),
      );

      // Relate embedding -> memory
      await withQueryError('relate embedding to memory', () =>
        db
          .model(hasEmbeddingTable)
          .relate()
          .from(`embeddings:${embId}`)
          .to(`memories:${slug}`)
          .execute(),
      );
    }

    return toMemoryRecord(result[0]);
  }

  async getMemory(id: string, workspaceId?: string): Promise<MemoryRecord | null> {
    const db = getDB();
    const driver = db.getDriver();

    // Normalize: RecordId object, escaped toString(), slug, or qualified ID
    const qualified = toQualifiedId(id);

    // Use native driver.select() which handles RecordId via the SDK
    // instead of parameterized WHERE which can't match record-typed id columns.
    const result = await withQueryError('get memory', () =>
      driver.select(qualified),
    );
    const memory = result[0] ? toMemoryRecord(result[0]) : null;

    if (memory && workspaceId !== undefined) {
      if (memory.workspace_id) {
        // Extract bare key from both sides for comparison
        const memWsKey = memory.workspace_id instanceof RecordId
          ? String(memory.workspace_id.id)
          : String(memory.workspace_id).includes(':')
            ? String(memory.workspace_id).split(':').pop()!
            : String(memory.workspace_id);
        const paramWsKey = workspaceId.includes(':')
          ? workspaceId.split(':').pop()!
          : workspaceId;
        if (memWsKey !== paramWsKey) {
          throw new Error('Memory not found in workspace');
        }
      }
    }

    return memory;
  }

  async updateMemory(
    id: string,
    data: { name?: string; content?: string; metadata?: Record<string, unknown> },
    workspaceId?: string,
  ): Promise<MemoryRecord> {
    const db = getDB();

    const existing = await this.getMemory(id, workspaceId);
    if (!existing) {
      throw new Error(`Memory not found: ${id}`);
    }

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    // If content changed, re-generate embedding and update the related embedding record
    if (data.content !== undefined) {
      updateData.content = data.content;
      if (data.content !== existing.content) {
        const { embedding, model: modelName, dimensions } = await this.embedder.embed(data.content);

        // Find all existing embeddings for this memory
        const qualified = toQualifiedId(id);
        const recordKey = qualified.includes(':') ? qualified.split(':')[1] : qualified;

        const edges = await withQueryError('find memory embeddings', () =>
          db.query<EdgeIn>('SELECT in FROM has_embedding WHERE out = $memId', {
            memId: new RecordId('memories', recordKey),
          }),
        );

        // Delete old has_embedding edges and old embedding records
        await withQueryError('delete old embedding edges', () =>
          db.query('DELETE has_embedding WHERE out = $memId', {
            memId: new RecordId('memories', recordKey),
          }),
        );

        for (const edge of edges) {
          const embKey = String(edge.in.id);
          await withQueryError('delete old embedding', () =>
            db.model(embeddingsTable).delete().id(embKey).execute(),
          );
        }

        // Re-chunk and re-embed the updated content
        const chunks = chunkContent(data.content);
        const isMultiChunk = chunks.length > 1;

        const config = getConfig();
        const providerId = config.DALI_MEMORY_EMBEDDING_PROVIDER;

        let modelRecordId: string;
        const existingModels = await withQueryError('find model record', () =>
          db
            .model(modelsTable)
            .select()
            .where((w) => w.eq('provider_id', providerId).eq('model_id', modelName))
            .limit(1)
            .execute(),
        );

        if (existingModels.length > 0) {
          modelRecordId = String((existingModels[0] as Record<string, unknown>).id);
        } else {
          const modelResult = await withQueryError('create model record', () =>
            db
              .model(modelsTable)
              .create()
              .data({ provider_id: providerId, model_id: modelName, dimensions })
              .execute(),
          );
          modelRecordId = String((modelResult[0] as Record<string, unknown>).id);
        }

        // Create new embeddings from re-chunked content
        const embeddingsToCreate = isMultiChunk
          ? chunks
          : [{ text: data.content, chunkIndex: 0, section: chunks[0]?.section ?? '' }];

        for (const chunk of embeddingsToCreate) {
          const chunkResult = isMultiChunk
            ? await this.embedder.embed(chunk.text)
            : { embedding, model: modelName, dimensions };

          const embId = crypto.randomUUID().replace(/-/g, '');
          await withQueryError('create embedding', () =>
            db
              .model(embeddingsTable)
              .create()
              .id(embId)
              .data({
                vector: chunkResult.embedding,
                model: modelRecordId,
                chunk_index: isMultiChunk ? chunk.chunkIndex : undefined,
                chunk_text: isMultiChunk ? chunk.text : undefined,
                section: chunk.section || undefined,
              })
              .execute(),
          );

          await withQueryError('relate embedding to memory', () =>
            db
              .model(hasEmbeddingTable)
              .relate()
              .from(`embeddings:${embId}`)
              .to(`memories:${recordKey}`)
              .execute(),
          );
        }
      }
    }

    // Normalize to key (bare slug or raw ID part) — strip table prefix and angle brackets
    const qualified = toQualifiedId(id);
    const recordKey = qualified.includes(':') ? qualified.split(':')[1] : qualified;
    const result = await withQueryError('update memory', () =>
      db.model(memoriesTable).update().id(recordKey).data(updateData).execute(),
    );

    return result[0] ? toMemoryRecord(result[0]) : (await this.getMemory(id))!;
  }

  async deleteMemory(id: string, workspaceId?: string): Promise<void> {
    const db = getDB();

    if (workspaceId !== undefined) {
      const memory = await this.getMemory(id, workspaceId);
      if (!memory) {
        throw new Error('Memory not found in workspace');
      }
    }

    // Normalize to qualified ID, then extract parts
    const qualified = toQualifiedId(id);
    const [tableName, key] = qualified.includes(':')
      ? qualified.split(':')
      : [memoriesTable.name, qualified];
    const memRecordId = new RecordId(tableName, key);

    // Find all related embeddings via has_embedding edge
    const edges = await withQueryError('find memory embeddings', () =>
      db.query<EdgeIn>('SELECT in FROM has_embedding WHERE out = $memId', {
        memId: memRecordId,
      }),
    );

    // Delete has_embedding relation
    await withQueryError('delete embedding edges', () =>
      db.query('DELETE has_embedding WHERE out = $memId', {
        memId: memRecordId,
      }),
    );

    // Delete ALL embedding records (not just the first)
    for (const edge of edges) {
      const embKey = String(edge.in.id);
      await withQueryError('delete embedding', () =>
        db.model(embeddingsTable).delete().id(embKey).execute(),
      );
    }

    // Delete memory_tags relations
    await withQueryError('delete memory tags', () =>
      db.query('DELETE memory_tags WHERE in = $memId', {
        memId: memRecordId,
      }),
    );

    // Delete the memory record
    await withQueryError('delete memory', () =>
      db.model(memoriesTable).delete().id(qualified).execute(),
    );
  }

  async listMemories(
    workspaceId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<MemoryRecord[]> {
    const db = getDB();

    // Convert bare string to RecordId so SurrealDB can match record<workspaces>
    const wsId = new RecordId('workspaces', workspaceId);

    const result = await withQueryError('list memories', () =>
      db
        .model(memoriesTable)
        .select()
        .where((w) => w.eq('workspace_id', wsId))
        .orderBy('created_at', 'DESC')
        .limit(opts?.limit ?? 50)
        .start(opts?.offset ?? 0)
        .execute(),
    );

    return result.map((r) => toMemoryRecord(r));
  }

  async listAllMemories(opts?: { limit?: number; offset?: number }): Promise<MemoryRecord[]> {
    const db = getDB();

    const result = await withQueryError('list all memories', () =>
      db
        .model(memoriesTable)
        .select()
        .orderBy('created_at', 'DESC')
        .limit(opts?.limit ?? 50)
        .start(opts?.offset ?? 0)
        .execute(),
    );

    return result.map((r) => toMemoryRecord(r));
  }

  async searchSimilar(embedding: number[], options?: SearchOptions): Promise<SearchResult[]> {
    const db = getDB();
    const driver = db.getDriver();
    const limit = options?.limit ?? 10;
    const rawWsId = options?.workspaceId ?? null;
    const threshold = options?.threshold ?? 0;

    // Convert string workspaceId to RecordId for proper record-type comparison
    const wsParam: RecordId | null = rawWsId
      ? new RecordId('workspaces', rawWsId.includes(':') ? rawWsId.split(':').pop()! : rawWsId)
      : null;

    const sql = `SELECT id, vector::similarity::cosine(vector, $queryEmbedding) AS score
FROM embeddings
WHERE ->has_embedding.out.workspace_id CONTAINS $wsRid OR $wsRid IS NONE
ORDER BY score DESC
LIMIT 500`;

    const rows = await withQueryError('vector similarity search', () =>
      db.query<Record<string, unknown>>(sql, {
        queryEmbedding: embedding,
        wsRid: wsParam,
      }),
    );

    // Deduplicate by parent memory — keep only the highest-scoring chunk per memory
    const memScores = new Map<string, { score: number; memRef: RecordId }>();

    for (const row of rows) {
      const score = Number((row as Record<string, unknown>).score ?? 0);
      if (score < threshold) continue;

      const embRecordId = row.id as RecordId;
      const edges = await withQueryError('find embedding parent', () =>
        db.query<EdgeOut>(
          'SELECT out FROM has_embedding WHERE in = $embId LIMIT 1',
          { embId: embRecordId },
        ),
      );
      if (edges.length === 0) continue;

      const memRef = edges[0].out;
      // Build clean key: extract table/id from RecordId to avoid
      // angle-bracket wrapping that String(RecordId) produces for non-alphanumeric IDs
      const memObj = memRef as unknown as Record<string, unknown>;
      const tbl = String(memObj.tb ?? memObj.table ?? '');
      const rid = String(memObj.id ?? '');
      const memKey = `${tbl}:${rid}`;

      // Keep only the best score per memory
      if (!memScores.has(memKey) || score > memScores.get(memKey)!.score) {
        memScores.set(memKey, { score, memRef });
      }
    }

    // Fetch the best unique memories — use the clean tb:id string
    // to avoid angle-bracket wrapping that breaks driver.select() / parseTableWithId()
    const results: SearchResult[] = [];
    for (const [memKey, { score }] of memScores) {
      const memResult = await withQueryError('fetch similar memory', () =>
        driver.select(memKey),
      );
      if (!memResult[0]) continue;

      results.push({
        memory: toMemoryRecord(memResult[0]),
        score,
        matched_on: 'vector' as const,
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }
}
