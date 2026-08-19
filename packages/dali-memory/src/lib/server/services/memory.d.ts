import type { EmbedderService } from '../embedder';
import type { MemoryRecord, SearchOptions, SearchResult } from './types';
export declare class MemoryService {
    private embedder;
    constructor(embedder: EmbedderService);
    createMemory(data: {
        name: string;
        content: string;
        memory_type?: string;
        workspace_id: string;
        metadata?: Record<string, unknown>;
    }): Promise<MemoryRecord>;
    getMemory(id: string): Promise<MemoryRecord | null>;
    updateMemory(id: string, data: {
        name?: string;
        content?: string;
        metadata?: Record<string, unknown>;
    }): Promise<MemoryRecord>;
    deleteMemory(id: string): Promise<void>;
    listMemories(workspaceId: string, opts?: {
        limit?: number;
        offset?: number;
    }): Promise<MemoryRecord[]>;
    searchSimilar(embedding: number[], options?: SearchOptions): Promise<SearchResult[]>;
}
//# sourceMappingURL=memory.d.ts.map