import { z } from 'zod';
import { resolveSecretValue } from '../config.ts';
import { logger } from '../utils/logger.ts';
import { embedderConfigSchema } from './schemas.ts';

type EmbedderConfig = z.infer<typeof embedderConfigSchema>;

export class RemoteEmbedProvider {
  private cache = new Map<string, Float32Array>();
  private readonly CACHE_SIZE = 100;
  private _config: EmbedderConfig | null = null;

  configure(config: EmbedderConfig): void {
    this._config = config;
    logger.debug('Remote embedding provider configured', {
      endpoint: config.endpoint,
      model: config.model,
    });
  }

  get config(): EmbedderConfig | null {
    return this._config;
  }

  async embed(text: string): Promise<{ vector: Float32Array; dimensions: number } | null> {
    logger.debug('Embedding text', { textLength: text.length });

    const cached = this.cache.get(text);
    if (cached) {
      logger.debug('Embedding cache hit', { textLength: text.length, dimensions: cached.length });
      // Re-set to move to end of Map (LRU: most recently used)
      this.cache.delete(text);
      this.cache.set(text, cached);
      return { vector: cached, dimensions: cached.length };
    }

    if (!this._config) {
      logger.error('RemoteEmbedProvider not configured', { trace: new Error().stack });
      return null;
    }

    if (!this._config.endpoint) {
      logger.error('Remote embedding endpoint not configured', {});
      return null;
    }

    const apiKey = resolveSecretValue(this._config.apiKey);
    const url = `${this._config.endpoint}/embeddings`;
    const model = this._config.model;

    logger.debug('Requesting embedding', { model, endpoint: this._config.endpoint });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ input: text, model }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const embedding = data.data?.[0]?.embedding;
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response format');
      }

      logger.debug('Embedding received', { dimension: embedding.length });
      const result = { vector: new Float32Array(embedding), dimensions: embedding.length };

      if (this.cache.size >= this.CACHE_SIZE) {
        const { value: firstKey } = this.cache.keys().next();
        if (firstKey !== undefined) this.cache.delete(firstKey);
      }
      this.cache.set(text, result.vector);
      return result;
    } catch (error) {
      logger.error('Embedding failed', { error: String(error), trace: new Error().stack });
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
    logger.debug('Remote embedding cache cleared', {});
  }
}
