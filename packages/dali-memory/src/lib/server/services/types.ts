import { RecordId } from 'surrealdb';

export interface MemoryRecord {
  id: string;
  slug: string;
  name: string;
  content: string;
  memory_type: string;
  metadata?: Record<string, unknown>;
  workspace_id: string;
  created_at: string;
}

export interface TagRecord {
  id: string;
  name: string;
}

export interface SearchResult {
  memory: MemoryRecord;
  score: number;
  matched_on: 'vector' | 'fulltext' | 'both';
}

export interface SearchOptions {
  workspaceId?: string;
  limit?: number;
  threshold?: number;
}

/** Transform raw DB record to MemoryRecord, extracting slug from RecordId */
export function toMemoryRecord(raw: unknown): MemoryRecord {
  const record = raw as Record<string, unknown>;
  const id = record.id;
  const slug =
    id instanceof RecordId
      ? String(id.id)
      : typeof id === 'string'
        ? id.includes(':') ? id.split(':')[1] : id
        : String(id);
  return { ...record, slug } as unknown as MemoryRecord;
}
