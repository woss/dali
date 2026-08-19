export interface MemoryRecord {
    id: string;
    name: string;
    content: string;
    memory_type: string;
    metadata?: Record<string, unknown>;
    embedding?: number[];
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
//# sourceMappingURL=types.d.ts.map