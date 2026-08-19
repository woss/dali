export interface EmbedderResult {
    embedding: number[];
    model: string;
    dimensions: number;
}
export interface EmbedderProvider {
    embed(text: string): Promise<EmbedderResult>;
    embedBatch(texts: string[]): Promise<EmbedderResult[]>;
}
export type EmbedderProviderType = 'local' | 'remote';
//# sourceMappingURL=types.d.ts.map