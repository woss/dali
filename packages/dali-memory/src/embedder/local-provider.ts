import { pipeline } from '@huggingface/transformers';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import { embedderConfigSchema } from './schemas.ts';
import { logger } from '../utils/logger.ts';

type EmbedderConfig = z.infer<typeof embedderConfigSchema>;

const DEFAULT_CACHE_DIR = join(homedir(), '.config/dali-memory/model_cache/');
const DEFAULT_MODEL = 'Xenova/bge-large-en-v1.5';

export class LocalEmbedProvider {
  private pipe: any = null;
  private _config: EmbedderConfig | null = null;

  get config(): EmbedderConfig | null {
    return this._config;
  }

  async configure(config: EmbedderConfig): Promise<void> {
    const cacheDir = config.modelCacheDir || DEFAULT_CACHE_DIR;
    logger.debug('Loading local embedding model', { model: DEFAULT_MODEL, cacheDir });
    this.pipe = await pipeline('feature-extraction', DEFAULT_MODEL, {
      cache_dir: cacheDir,
      dtype: 'fp32',
    });
    this._config = config;
    logger.debug('Local embedding model loaded', { model: DEFAULT_MODEL });
  }

  async embed(text: string): Promise<{ vector: Float32Array; dimensions: number } | null> {
    if (!this.pipe) {
      logger.error('LocalEmbedProvider not configured');
      return null;
    }
    try {
      const output = await this.pipe(text, { pooling: 'mean', normalize: true });
      const vector = new Float32Array(output.data);
      const dimensions = output.dims[output.dims.length - 1];
      return { vector, dimensions };
    } catch (error) {
      logger.error('Local embedding failed', { error: String(error) });
      return null;
    }
  }

  clearCache(): void {
    logger.debug('Local embedding cache clear called (no-op)', {});
  }
}
