import type { InferSelectResult } from '@woss/dali-orm/query/types';
import { select, insert, delete_ } from '@woss/dali-orm/query';
import { relate } from '@woss/dali-orm/query/relate';
import { getDB } from '../db/connection';
import { tagsTable, memoryTagsTable } from '../db/schema';
import type { TagRecord, MemoryRecord } from './types';

/** Strip SurrealDB table prefix from record ID (table:abc → abc) */
function rawId(id: string): string {
  const idx = id.indexOf(':');
  return idx >= 0 ? id.slice(idx + 1) : id;
}

export class TagService {
  async createTag(name: string): Promise<TagRecord> {
    const db = getDB();
    const driver = db.getDriver();

    // Check for existing tag with same name (unique constraint in schema)
    const existing = await select(driver, tagsTable)
      .where((w) => w.eq('name', name))
      .execute();
    if (existing.length > 0) {
      return existing[0] as unknown as TagRecord;
    }

    const result = await insert(driver, tagsTable).one({ name }).execute();

    return result[0] as unknown as TagRecord;
  }

  async getTag(id: string): Promise<TagRecord | null> {
    const db = getDB();
    const driver = db.getDriver();

    const result = await select(driver, tagsTable)
      .where((w) => w.eq('id', rawId(id)))
      .execute();

    return (result[0] as unknown as TagRecord) ?? null;
  }

  async findByName(name: string): Promise<TagRecord | null> {
    const db = getDB();
    const driver = db.getDriver();

    const result = await select(driver, tagsTable)
      .where((w) => w.eq('name', name))
      .execute();

    return (result[0] as unknown as TagRecord) ?? null;
  }

  async listTags(): Promise<TagRecord[]> {
    const db = getDB();
    const driver = db.getDriver();

    const result = await select(driver, tagsTable).orderBy('name', 'ASC').execute();

    return result as unknown as TagRecord[];
  }

  async addTagToMemory(memoryId: string, tagId: string): Promise<void> {
    const db = getDB();
    const driver = db.getDriver();

    // Format record IDs for RELATE
    const memId = memoryId.includes(':') ? memoryId : `memories:${rawId(memoryId)}`;
    const tagIdFormatted = tagId.includes(':') ? tagId : `tags:${rawId(tagId)}`;

    await relate(driver, memoryTagsTable).from(memId).to(tagIdFormatted).execute();
  }

  async removeTagFromMemory(memoryId: string, tagId: string): Promise<void> {
    const db = getDB();

    const memId = memoryId.includes(':') ? memoryId : `memories:${rawId(memoryId)}`;
    const tagIdFormatted = tagId.includes(':') ? tagId : `tags:${rawId(tagId)}`;

    await db.query('DELETE FROM memory_tags WHERE in = $memId AND out = $tagId', {
      memId,
      tagId: tagIdFormatted,
    });
  }

  async getMemoryTags(memoryId: string): Promise<TagRecord[]> {
    const db = getDB();

    const memId = memoryId.includes(':') ? memoryId : `memories:${rawId(memoryId)}`;

    const result = await db.query<TagRecord>('SELECT ->memory_tags->tags.* AS tags FROM $memId', {
      memId,
    });

    // Extract tags from the nested structure
    if (result.length === 0) return [];
    const row = result[0] as unknown as Record<string, unknown>;
    const tags = row.tags;
    if (Array.isArray(tags)) return tags as TagRecord[];
    if (tags && typeof tags === 'object') return [tags as TagRecord];
    return [];
  }

  async unionTags(tagNames: string[]): Promise<MemoryRecord[]> {
    if (tagNames.length === 0) return [];

    const db = getDB();

    const result = await db.query<MemoryRecord>(
      `SELECT * FROM memories WHERE ->memory_tags->tags.name CONTAINSANY $tagNames`,
      { tagNames },
    );

    return result as unknown as MemoryRecord[];
  }

  async intersectTags(tagNames: string[]): Promise<MemoryRecord[]> {
    if (tagNames.length === 0) return [];

    const db = getDB();

    // First resolve tag names to IDs
    const tagResult = await db.query<{ id: string }>(
      'SELECT id FROM tags WHERE name INSIDE $tagNames',
      { tagNames },
    );
    const tagIds = tagResult.map((t) => t.id);
    if (tagIds.length === 0) return [];
    if (tagIds.length < tagNames.length) {
      // Some tags not found — intersection with missing tags is empty
      return [];
    }

    const tagCount = tagIds.length;

    const result = await db.query<MemoryRecord>(
      `SELECT * FROM memories WHERE (SELECT count() FROM memory_tags WHERE in = memories.id AND out INSIDE $tagIds) = $tagCount`,
      { tagIds, tagCount },
    );

    return result as unknown as MemoryRecord[];
  }
}
