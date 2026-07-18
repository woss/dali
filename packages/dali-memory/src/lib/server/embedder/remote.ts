import type { EmbedderProvider, EmbedderResult } from './types';
import { getConfig } from '../config';

export class RemoteEmbedder implements EmbedderProvider {
  private endpoint: string;
  private apiKey?: string;
  private model: string;
  private dims: number;

  constructor() {
    const config = getConfig();
    this.endpoint = config.DALI_MEMORY_EMBEDDING_ENDPOINT;
    this.apiKey = config.DALI_MEMORY_EMBEDDING_API_KEY;
    this.model = config.DALI_MEMORY_EMBEDDING_MODEL;
    this.dims = config.DALI_MEMORY_EMBEDDING_DIMENSION;
  }

  async embed(text: string): Promise<EmbedderResult> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.endpoint}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ input: text, model: this.model }),
    });

    if (!res.ok) {
      throw new Error(`Remote embedding failed: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as any;
    const embedding = json.data[0].embedding as number[];
    return { embedding, model: this.model, dimensions: this.dims };
  }

  async embedBatch(texts: string[]): Promise<EmbedderResult[]> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.endpoint}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ input: texts, model: this.model }),
    });

    if (!res.ok) {
      throw new Error(`Remote batch embedding failed: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as any;
    return json.data.map((d: any, _i: number) => ({
      embedding: d.embedding as number[],
      model: this.model,
      dimensions: this.dims,
    }));
  }
}
