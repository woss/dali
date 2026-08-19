import type { EmbedderProvider, EmbedderResult } from './types';
export declare class LocalEmbedder implements EmbedderProvider {
    private pipeline;
    private modelId;
    private dims;
    constructor();
    init(): Promise<void>;
    embed(text: string): Promise<EmbedderResult>;
    embedBatch(texts: string[]): Promise<EmbedderResult[]>;
}
//# sourceMappingURL=local.d.ts.map