import { select, insert, update, delete_ } from '@woss/dali-orm/query';
import type { InferSelectResult } from '@woss/dali-orm/query/types';
import { getDB } from '../db/connection';
import { memoriesTable } from '../db/schema';
import type { EmbedderService } from '../embedder';
import type { MemoryRecord, SearchOptions, SearchResult } from './types';

export class MemoryService {
  constructor(private embedder: EmbedderService) {}

  async createMemory(data: {
    name: string;
    content: string;
    memory_type?: string;
    workspace_id: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemoryRecord> {
    const db = getDB();
    const driver = db.getDriver();

    // Content dedup: check for existing record with same content + workspace_id
    const existing = await select(driver, memoriesTable)
      .where((w) => w.eq('content', data.content).eq('workspace_id', data.workspace_id))
      .limit(1)
      .execute();

    if (existing.length > 0) {
      throw new Error('Memory with this content already exists in workspace');
    }

    // Generate embedding
    const { embedding } = await this.embedder.embed(data.content);

    // Insert new memory
    const result = await insert(driver, memoriesTable)
      .one({
        name: data.name,
        content: data.content,
        memory_type: data.memory_type ?? 'fact',
        metadata: data.metadata ?? {},
        embedding,
        workspace_id: data.workspace_id,
      })
      .execute();

    return result[0] as unknown as MemoryRecord;
  }

  async getMemory(id: string): Promise<MemoryRecord | null> {
    const db = getDB();
    const driver = db.getDriver();

    const result = await select(driver, memoriesTable)
      .where((w) => w.eq('id', id))
      .execute();

    return (result[0] as unknown as MemoryRecord) ?? null;
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

    const result = await update(driver, memoriesTable).id(id).data(updateData).execute();

    return result[0] as unknown as MemoryRecord;
  }

  async deleteMemory(id: string): Promise<void> {
    const db = getDB();

    // Delete memory_tags relations first
    await db.query('DELETE memory_tags WHERE in = $id', { id });

    // Delete the memory record
    const driver = db.getDriver();
    await delete_(driver, memoriesTable).id(id).execute();
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

    return result as unknown as MemoryRecord[];
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
        memory: r as MemoryRecord,
        score: r.score,
        matched_on: 'vector' as const,
      }));
  }
}
