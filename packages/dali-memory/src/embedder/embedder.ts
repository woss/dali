import { z } from 'zod';
import { embedderConfigSchema } from './schemas.ts';
import { RemoteEmbedProvider } from './remote-provider.ts';
import { LocalEmbedProvider } from './local-provider.ts';
import { logger } from '../utils/logger.ts';

export { embedderConfigSchema } from './schemas.ts';

type EmbedderConfig = z.infer<typeof embedderConfigSchema>;

export class EmbedderService {
  private remoteProvider = new RemoteEmbedProvider();
  private localProvider = new LocalEmbedProvider();
  private _activeProvider: RemoteEmbedProvider | LocalEmbedProvider | null = null;
  private _config: EmbedderConfig | null = null;

  get config(): EmbedderConfig | null {
    return this._config;
  }

  async configure(config: EmbedderConfig): Promise<void> {
    this._config = embedderConfigSchema.parse(config);
    if (this._config.provider === 'local') {
      this._activeProvider = this.localProvider;
    } else {
      this._activeProvider = this.remoteProvider;
    }
    await this._activeProvider.configure(this._config);
    logger.debug('EmbedderService configured', { provider: this._config.provider });
  }

  async embed(text: string): Promise<{ vector: Float32Array; dimensions: number } | null> {
    if (!this._activeProvider) {
      logger.error('EmbedderService not configured');
      return null;
    }
    return this._activeProvider.embed(text);
  }

  clearCache(): void {
    this.remoteProvider.clearCache();
    this.localProvider.clearCache();
    logger.debug('EmbedderService cache cleared', {});
  }
}

export const embeddingService = new EmbedderService();
