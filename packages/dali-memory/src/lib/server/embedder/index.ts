import { createLogger } from '../logger';
import type { EmbedderProvider, EmbedderResult, EmbedderProviderType } from './types';
import { getConfig } from '../config';
import { LocalEmbedder } from './local';
import { RemoteEmbedder } from './remote';

export class EmbedderService {
  private provider: EmbedderProvider | null = null;

  async initialize(): Promise<void> {
    const config = getConfig();
    const type: EmbedderProviderType = config.DALI_MEMORY_EMBEDDING_PROVIDER;

    createLogger(['dali-memory', 'embedder']).info('Initializing embedder with provider: ' + type);

    if (type === 'local') {
      const local = new LocalEmbedder();
      await local.init();
      this.provider = local;
    } else {
      this.provider = new RemoteEmbedder();
    }
  }

  async embed(text: string): Promise<EmbedderResult> {
    if (!this.provider) throw new Error('Embedder not initialized');

    const log = createLogger(['dali-memory', 'embedder']);
    log.debug(`Embedding text of length ${text.length}`);

    try {
      return await this.provider.embed(text);
    } catch (error) {
      log.error('Embedding failed: ' + (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }

  async embedBatch(texts: string[]): Promise<EmbedderResult[]> {
    if (!this.provider) throw new Error('Embedder not initialized');
    return this.provider.embedBatch(texts);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: EmbedderService | null = null;

/**
 * Initialize the singleton embedder. Idempotent — subsequent calls return
 * immediately without re-initializing. Safe to call at server startup.
 */
export async function initEmbedder(): Promise<void> {
  if (instance !== null) return;
  const svc = new EmbedderService();
  await svc.initialize();
  instance = svc;
  createLogger(['dali-memory', 'embedder']).info('Embedder singleton initialized');
}

/**
 * Get the initialized singleton embedder.
 * @throws Error if initEmbedder() has not been called yet.
 */
export function getEmbedder(): EmbedderService {
  if (!instance) throw new Error('Embedder not initialized. Call initEmbedder() first.');
  return instance;
}
