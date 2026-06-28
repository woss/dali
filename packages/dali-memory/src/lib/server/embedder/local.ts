import type { EmbedderProvider, EmbedderResult } from './types';
import { getConfig } from '../config';

export class LocalEmbedder implements EmbedderProvider {
  private pipeline: any = null;
  private modelId: string;
  private dims: number;

  constructor() {
    const config = getConfig();
    this.modelId = config.DALI_MEMORY_EMBEDDING_MODEL;
    this.dims = config.DALI_MEMORY_EMBEDDING_DIMENSION;
  }

  async init(): Promise<void> {
    const { pipeline } = await import('@huggingface/transformers');
    this.pipeline = await pipeline('feature-extraction', this.modelId);
  }

  async embed(text: string): Promise<EmbedderResult> {
    if (!this.pipeline) await this.init();
    const result = await this.pipeline!(text, { pooling: 'mean', normalize: true });
    const embedding = Array.from(result.data) as number[];
    return { embedding, model: this.modelId, dimensions: this.dims };
  }

  async embedBatch(texts: string[]): Promise<EmbedderResult[]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}
