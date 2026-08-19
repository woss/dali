import type { EmbedderService } from '../embedder';
import type { SearchResult, SearchOptions } from './types';
export declare class HybridSearch {
    private embedder;
    private vectorWeight;
    private fulltextWeight;
    private rrfK;
    constructor(embedder: EmbedderService, vectorWeight?: number, fulltextWeight?: number, rrfK?: number);
    search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}
//# sourceMappingURL=hybrid-search.d.ts.map