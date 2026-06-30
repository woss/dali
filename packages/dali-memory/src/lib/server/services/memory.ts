import { select, create, update, delete_ } from '@woss/dali-orm/query';
import { relate } from '@woss/dali-orm/query/relate';
import { RecordId } from 'surrealdb';
import type { InferSelectResult } from '@woss/dali-orm/query/types';
import { getDB } from '../db/connection';
import { memoriesTable, embeddingsTable, modelsTable, hasEmbeddingTable } from '../db/schema';
import type { EmbedderService } from '../embedder';
import type { MemoryRecord, SearchOptions, SearchResult } from './types';
import { getConfig } from '../config';

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
  // Strip SurrealQL angle-bracket escaping from toString() output
  const clean = str.replace(/[⟨⟩]/g, '');
  return clean.includes(':') ? clean : `memories:${clean}`;
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
    const driver = db.getDriver();

    // Generate slug from name if not provided
    const slug =
      data.slug ??
      data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    // Content dedup: check for existing record with same content + workspace_id
    const existing = await select(driver, memoriesTable)
      .where((w) => w.eq('content', data.content).eq('workspace_id', data.workspace_id))
      .limit(1)
      .execute();

    if (existing.length > 0) {
      throw new Error('Memory with this content already exists in workspace');
    }

    // Check if slug already exists
    const existingBySlug = await driver.select(`memories:${slug}`);
    if (existingBySlug.length > 0) {
      throw new Error(`Memory with slug '${slug}' already exists`);
    }

    // Generate embedding
    const { embedding, model: modelName, dimensions } = await this.embedder.embed(data.content);

    // Create new memory with slug as record ID (no embedding field)
    const result = await create(driver, memoriesTable)
      .id(slug)
      .data({
        name: data.name,
        content: data.content,
        memory_type: data.memory_type ?? 'fact',
        metadata: data.metadata ?? {},
        workspace_id: data.workspace_id,
      })
      .execute();

    // Find or create model record
    const config = getConfig();
    const providerId = config.DALI_MEMORY_EMBEDDING_PROVIDER;

    let modelRecordId: string;
    const existingModels = await select(driver, modelsTable)
      .where((w) => w.eq('provider_id', providerId).eq('model_id', modelName))
      .limit(1)
      .execute();

    if (existingModels.length > 0) {
      modelRecordId = String((existingModels[0] as Record<string, unknown>).id);
    } else {
      const modelResult = await create(driver, modelsTable)
        .data({
          provider_id: providerId,
          model_id: modelName,
          dimensions,
        })
        .execute();
      modelRecordId = String((modelResult[0] as Record<string, unknown>).id);
    }

    // Create embedding record linked to model
    const embId = crypto.randomUUID().replace(/-/g, '');
    await create(driver, embeddingsTable)
      .id(embId)
      .data({
        vector: embedding,
        model: modelRecordId,
        dimensions,
      })
      .execute();

    // Relate embedding -> memory
    await relate(driver, hasEmbeddingTable)
      .from(`embeddings:${embId}`)
      .to(`memories:${slug}`)
      .execute();

    return toMemoryRecord(result[0]);
  }

  async getMemory(id: string): Promise<MemoryRecord | null> {
    const db = getDB();
    const driver = db.getDriver();

    // Normalize: RecordId object, escaped toString(), slug, or qualified ID
    const qualified = toQualifiedId(id);

    // Use native driver.select() which handles RecordId via the SDK
    // instead of parameterized WHERE which can't match record-typed id columns.
    const result = await driver.select(qualified);
    return result[0] ? toMemoryRecord(result[0]) : null;
  }

  async updateMemory(
    id: string,
    data: { name?: string; content?: string; metadata?: Record<string, unknown> },
  ): Promise<MemoryRecord> {
    const db = getDB();
    const driver = db.getDriver();

    const existing = await this.getMemory(id);
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
        const { embedding } = await this.embedder.embed(data.content);

        // Find the embedding record linked via has_embedding edge
        const qualified = toQualifiedId(id);
        const recordKey = qualified.includes(':') ? qualified.split(':')[1] : qualified;

        const edges = await db.query<EdgeIn>(
          'SELECT in FROM has_embedding WHERE out = $memId LIMIT 1',
          { memId: new RecordId('memories', recordKey) },
        );

        if (edges.length > 0) {
          const embRecordId = edges[0].in;
          const embKey = String(embRecordId.id);
          await update(driver, embeddingsTable).id(embKey).data({ vector: embedding }).execute();
        }
      }
    }

    // Normalize to key (bare slug or raw ID part) — strip table prefix and angle brackets
    const qualified = toQualifiedId(id);
    const recordKey = qualified.includes(':') ? qualified.split(':')[1] : qualified;
    const result = await update(driver, memoriesTable).id(recordKey).data(updateData).execute();

    return result[0] ? toMemoryRecord(result[0]) : (await this.getMemory(id))!;
  }

  async deleteMemory(id: string): Promise<void> {
    const db = getDB();
    const driver = db.getDriver();

    // Normalize to qualified ID, then extract parts
    const qualified = toQualifiedId(id);
    const [tableName, key] = qualified.includes(':')
      ? qualified.split(':')
      : [memoriesTable.name, qualified];
    const memRecordId = new RecordId(tableName, key);

    // Find related embedding edge (before deletion)
    const edges = await db.query<EdgeIn>(
      'SELECT in FROM has_embedding WHERE out = $memId LIMIT 1',
      { memId: memRecordId },
    );

    // Delete has_embedding relation
    await db.query('DELETE has_embedding WHERE out = $memId', {
      memId: memRecordId,
    });

    // Delete embedding record if it exists
    if (edges.length > 0) {
      const embRecordId = edges[0].in;
      const embKey = String(embRecordId.id);
      await delete_(driver, embeddingsTable).id(embKey).execute();
    }

    // Delete memory_tags relations
    await db.query('DELETE memory_tags WHERE in = $memId', {
      memId: memRecordId,
    });

    // Delete the memory record
    await delete_(driver, memoriesTable).id(qualified).execute();
  }

  async listMemories(
    workspaceId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<MemoryRecord[]> {
    const db = getDB();
    const driver = db.getDriver();

    const result = await select(driver, memoriesTable)
      .where((w) => w.eq('workspace_id', workspaceId))
      .orderBy('created_at', 'DESC')
      .limit(opts?.limit ?? 50)
      .start(opts?.offset ?? 0)
      .execute();

    return result.map((r) => toMemoryRecord(r));
  }

  async searchSimilar(embedding: number[], options?: SearchOptions): Promise<SearchResult[]> {
    const db = getDB();
    const driver = db.getDriver();
    const limit = options?.limit ?? 10;
    const workspaceId = options?.workspaceId ?? null;
    const threshold = options?.threshold ?? 0;

    // Query embeddings with cosine similarity
    const sql = `SELECT id, vector::similarity::cosine(vector, $queryEmbedding) AS score
FROM embeddings
WHERE ->has_embedding.out.workspace_id = $workspaceId OR $workspaceId IS NONE
ORDER BY score DESC
LIMIT $limit`;

    const rows = await db.query<Record<string, unknown>>(sql, {
      queryEmbedding: embedding,
      workspaceId,
      limit,
    });

    const results: SearchResult[] = [];
    for (const row of rows) {
      const score = Number((row as Record<string, unknown>).score ?? 0);
      if (score < threshold) continue;

      // Fetch the memory linked via has_embedding edge
      const embRecordId = row.id as RecordId;
      const edges = await db.query<EdgeOut>(
        'SELECT out FROM has_embedding WHERE in = $embId LIMIT 1',
        { embId: embRecordId },
      );
      if (edges.length === 0) continue;

      const memRef = edges[0].out;
      const memResult = await driver.select(String(memRef));
      if (!memResult[0]) continue;

      results.push({
        memory: toMemoryRecord(memResult[0]),
        score,
        matched_on: 'vector' as const,
      });
    }

    return results;
  }
}
