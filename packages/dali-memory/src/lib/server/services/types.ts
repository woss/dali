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
