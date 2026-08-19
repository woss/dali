import type { EmbedderResult } from './types';
export declare class EmbedderService {
    private provider;
    initialize(): Promise<void>;
    embed(text: string): Promise<EmbedderResult>;
    embedBatch(texts: string[]): Promise<EmbedderResult[]>;
}
//# sourceMappingURL=index.d.ts.map