import type { EmbedderProvider, EmbedderResult } from './types';
export declare class RemoteEmbedder implements EmbedderProvider {
    private endpoint;
    private apiKey?;
    private model;
    private dims;
    constructor();
    embed(text: string): Promise<EmbedderResult>;
    embedBatch(texts: string[]): Promise<EmbedderResult[]>;
}
//# sourceMappingURL=remote.d.ts.map