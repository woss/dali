import { RecordId } from 'surrealdb';
import { getDB } from '../db/connection';
import { tagsTable, memoryTagsTable } from '../db/schema';
import type { TagRecord, MemoryRecord } from './types';

/** Strip SurrealQL angle-bracket escaping from RecordId.toString() */
function stripBrackets(s: string): string {
  return s.replace(/[⟨⟩]/g, '');
}

/** Strip SurrealDB table prefix from record ID (table:abc → abc) */
function rawId(id: string): string {
  const clean = stripBrackets(id);
  const idx = clean.indexOf(':');
  return idx >= 0 ? clean.slice(idx + 1) : clean;
}

/** Normalize record ID to "table:key" format, stripping SurrealQL escaping */
function normalizeId(id: string): string {
  const clean = stripBrackets(id);
  return clean.includes(':') ? clean : `memories:${clean}`;
}

export class TagService {
  async createTag(name: string): Promise<TagRecord> {
    const db = getDB();

    // Check for existing tag with same name (unique constraint in schema)
    const existing = await db
      .model(tagsTable)
      .select()
      .where((w) => w.eq('name', name))
      .execute();
    if (existing.length > 0) {
      return existing[0] as unknown as TagRecord;
    }

    const result = await db.model(tagsTable).insert().one({ name }).execute();

    return result[0] as unknown as TagRecord;
  }

  async getTag(id: string): Promise<TagRecord | null> {
    const db = getDB();

    const result = await db
      .model(tagsTable)
      .select()
      .where((w) => w.eq('id', rawId(id)))
      .execute();

    return (result[0] as unknown as TagRecord) ?? null;
  }

  async findByName(name: string): Promise<TagRecord | null> {
    const db = getDB();

    const result = await db
      .model(tagsTable)
      .select()
      .where((w) => w.eq('name', name))
      .execute();

    return (result[0] as unknown as TagRecord) ?? null;
  }

  async listTags(): Promise<TagRecord[]> {
    const db = getDB();

    const result = await db.model(tagsTable).select().orderBy('name', 'ASC').execute();

    return result as unknown as TagRecord[];
  }

  async addTagToMemory(memoryId: string, tagId: string): Promise<void> {
    const db = getDB();

    // Format record IDs for RELATE — strip any SurrealQL escaping
    const memId = normalizeId(memoryId);
    const tagNorm = stripBrackets(tagId);
    const tagIdFormatted = tagNorm.includes(':') ? tagNorm : `tags:${rawId(tagNorm)}`;

    await db.model(memoryTagsTable).relate().from(memId).to(tagIdFormatted).execute();
  }

  async removeTagFromMemory(memoryId: string, tagId: string): Promise<void> {
    const db = getDB();

    const memId = normalizeId(memoryId);
    const tagNorm = stripBrackets(tagId);
    const tagIdFormatted = tagNorm.includes(':') ? tagNorm : `tags:${rawId(tagNorm)}`;

    // Use RecordId objects so the embedded engine matches record-typed columns
    await db.query('DELETE FROM memory_tags WHERE in = $memId AND out = $tagId', {
      memId: new RecordId('memories', rawId(memId)),
      tagId: new RecordId('tags', rawId(tagIdFormatted)),
    });
  }

  async getMemoryTags(memoryId: string): Promise<TagRecord[]> {
    const db = getDB();

    const memId = normalizeId(memoryId);
    const [table, key] = memId.includes(':') ? memId.split(':') : ['memories', memId];

    // Use RecordId object so the embedded engine matches graph edge traversal
    // from the correct record (string param in FROM doesn't resolve record edges).
    const result = await db.query<TagRecord>('SELECT ->memory_tags->tags.* AS tags FROM $memId', {
      memId: new RecordId(table, key),
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

    // Use graph traversal entirely in SurrealQL to avoid passing
    // array-of-RecordId parameters through the embedded engine.
    // Each memory must have edges to ALL requested tags.
    const conditions = tagNames
      .map((_, i) => `->memory_tags->tags.name CONTAINS $tagName${i}`)
      .join(' AND ');

    const params: Record<string, string> = {};
    tagNames.forEach((name, i) => {
      params[`tagName${i}`] = name;
    });

    const result = await db.query<MemoryRecord>(
      `SELECT * FROM memories WHERE ${conditions}`,
      params,
    );

    return result as unknown as MemoryRecord[];
  }
}
