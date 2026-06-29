import { select, create, update, delete_ } from '@woss/dali-orm/query';
import { RecordId } from 'surrealdb';
import type { InferSelectResult } from '@woss/dali-orm/query/types';
import { getDB } from '../db/connection';
import { memoriesTable } from '../db/schema';
import type { EmbedderService } from '../embedder';
import type { MemoryRecord, SearchOptions, SearchResult } from './types';

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
    const { embedding } = await this.embedder.embed(data.content);

    // Create new memory with slug as record ID
    const result = await create(driver, memoriesTable)
      .id(slug)
      .data({
        name: data.name,
        content: data.content,
        memory_type: data.memory_type ?? 'fact',
        metadata: data.metadata ?? {},
        embedding,
        workspace_id: data.workspace_id,
      })
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

    // If content changed, re-generate embedding
    if (data.content !== undefined) {
      updateData.content = data.content;
      if (data.content !== existing.content) {
        const { embedding } = await this.embedder.embed(data.content);
        updateData.embedding = embedding;
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

    // Normalize to qualified ID, then extract parts
    const qualified = toQualifiedId(id);
    const [tableName, key] = qualified.includes(':') ? qualified.split(':') : [memoriesTable.name, qualified];

    // Delete memory_tags relations first — use RecordId object so the embedded
    // engine matches the record-typed `in` column (string params don't coerce).
    await db.query('DELETE memory_tags WHERE in = $memId', {
      memId: new RecordId(tableName, key),
    });

    // Delete the memory record — DeleteBuilder handles full RecordId strings
    const driver = db.getDriver();
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
    const limit = options?.limit ?? 10;
    const workspaceId = options?.workspaceId ?? null;
    const threshold = options?.threshold ?? 0;

    const sql = `SELECT *, vector::similarity::cosine(embedding, $queryEmbedding) AS score
FROM memories
WHERE (workspace_id = $workspaceId OR $workspaceId IS NONE)
ORDER BY score DESC
LIMIT $limit`;

    const params = { queryEmbedding: embedding, workspaceId, limit };

    const result = await db.query<MemoryRecord & { score: number }>(sql, params);

    return result
      .filter((r) => r.score >= threshold)
      .map((r) => ({
        memory: toMemoryRecord(r),
        score: r.score,
        matched_on: 'vector' as const,
      }));
  }
}
