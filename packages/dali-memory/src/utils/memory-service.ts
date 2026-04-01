import 'dotenv/config';
import type { EventSessionCreated, EventSessionUpdated } from '@opencode-ai/sdk/v2';
import { type DaliMemoryConfig, getTags, initConfig } from '../config.ts';
import { embedderConfigSchema } from '../embedder/schemas.ts';
import { embeddingService } from '../embedder/embedder.ts';
import { logger } from './logger.ts';
import type { FactRecord, MemoryInsertRecord, MemoryRecord } from './surreal-client.ts';
import surrealClient from './surreal-client.ts';

class MemoryService {
  private _config: DaliMemoryConfig | null = null;
  private _initializing = false;
  private _initPromise: Promise<void> | null = null;
  #projectId: string | null = null;

  private isInitialized(): boolean {
    return this._config !== null;
  }

  private getConfig(): DaliMemoryConfig | null {
    return this._config;
  }

  set projectId(projectId: string) {
    this.#projectId = projectId;
  }

  get projectId(): string {
    if (!this.#projectId) {
      throw new Error('Project ID is not set');
    }
    return this.#projectId;
  }

  async initialize(directory: string): Promise<void> {
    if (this._config) return;
    if (this._initializing) {
      await this._initPromise;
      return;
    }
    this._initializing = true;
    this._initPromise = this._doInitialize(directory);
    await this._initPromise;
  }

  private async _doInitialize(directory: string): Promise<void> {
    logger.debug('Initializing MemoryService', { directory });

    try {
      const config = initConfig(directory);
      await embeddingService.configure(embedderConfigSchema.parse(config.embedding));
      await surrealClient.connect(config);
      this._config = config;
    } catch (error) {
      this._initializing = false;
      this._initPromise = null;
      logger.error('Failed to initialize MemoryService', {
        error: String(error),
        trace: new Error().stack,
      });
    }
  }

  async addMemory(
    content: string,
    tags: string[],
    type: string,
    containerTag: string,
    sessionId: string,
  ): Promise<string> {
    logger.debug('Adding memory', { type, tagCount: tags.length });
    if (!this.isInitialized()) return '';
    const config = this.getConfig();
    if (!config) return '';

    try {
      const embedding = await embeddingService.embed(content);
      if (!embedding) return '';
      const embedId = await this.getOrCreateEmbedding(
        config.embedding!.model,
        embedding.dimensions,
      );
      const nowMs = Date.now();
      const now = new Date(nowMs).toISOString();
      const record: MemoryInsertRecord = {
        content,
        vector: Array.from(embedding.vector),
        tags,
        type,
        container_tag: containerTag,
        metadata: { timestamp: nowMs, source: 'dali-memory' },
        is_pinned: false,
        created_at: now,
        updated_at: now,
      };
      const result = await surrealClient.saveMemory({
        memory: record,
        projectId: this.projectId,
        sessionId,
        embedId,
      });
      if (result) {
        logger.info('Memory added', { id: result, type });
        return result;
      }
      return '';
    } catch (error) {
      logger.error('Failed to add memory', { error: String(error), trace: new Error().stack });
      throw error;
    }
  }

  async searchMemories(
    query: string,
    containerTag: string,
    options?: { tags?: string[]; limit?: number },
  ): Promise<MemoryRecord[]> {
    logger.debug('Searching memories', { query });
    if (!this.isInitialized()) return [];
    const config = this.getConfig();
    if (!config) return [];
    const tags = options?.tags || [];
    const limit = options?.limit || 10;

    try {
      const embedding = await embeddingService.embed(query);
      if (!embedding) return [] as MemoryRecord[];
      const result = await surrealClient.searchMemories(
        query,
        Array.from(embedding.vector),
        tags,
        containerTag,
        limit,
      );
      logger.debug('Search returned results', { resultCount: result.length });
      return result;
    } catch (error) {
      logger.error('Failed to search memories', { error: String(error), trace: new Error().stack });
      return [];
    }
  }

  async getMemory(id: string): Promise<MemoryRecord | null> {
    logger.debug('Getting memory', { id });
    if (!this.isInitialized()) return null;

    try {
      const result = await surrealClient.getMemoryById(id);
      return result;
    } catch (error) {
      logger.error('Failed to get memory', { error: String(error), trace: new Error().stack });
      return null;
    }
  }

  async deleteMemory(id: string): Promise<void> {
    logger.debug('Deleting memory', { id });
    if (!this.isInitialized()) return;

    try {
      await surrealClient.deleteMemory(id);
    } catch (error) {
      logger.error('Failed to delete memory', { error: String(error), trace: new Error().stack });
      throw error;
    }
  }

  async listMemories(containerTag: string, limit?: number): Promise<MemoryRecord[]> {
    logger.debug('Listing memories', { containerTag });
    if (!this.isInitialized()) return [];
    const resultLimit = limit || 50;

    try {
      const result = await surrealClient.listMemories(containerTag, resultLimit);
      logger.debug('List returned results', { resultCount: result.length });
      return result;
    } catch (error) {
      logger.error('Failed to list memories', { error: String(error), trace: new Error().stack });
      return [];
    }
  }

  async getTags(directory: string): Promise<{ userTag: string; projectTag: string }> {
    logger.debug('Getting tags', { directory });

    try {
      const result = getTags(directory);
      return result;
    } catch (error) {
      logger.error('Failed to get tags', { error: String(error), trace: new Error().stack });
      return { userTag: '', projectTag: '' };
    }
  }

  async getOrCreateProject(name: string, directoryPath: string): Promise<string> {
    logger.debug('Getting or creating project', { name, directoryPath });
    if (!this.isInitialized()) return '';
    const config = this.getConfig();
    if (!config) return '';

    try {
      const result = await surrealClient.getOrCreateProject(name, directoryPath);
      if (result) {
        logger.info('Project ready', { projectId: result });
        return result;
      }
      return '';
    } catch (error) {
      logger.error('Failed to get or create project', {
        error: String(error),
        trace: new Error().stack,
      });
      throw error;
    }
  }

  async upsertSession(projectId: string, data: EventSessionCreated): Promise<string> {
    logger.debug('Creating session', { projectId, sessionId: data.properties.info.id });
    if (!this.isInitialized()) return '';
    const config = this.getConfig();
    if (!config) return '';

    try {
      const now = new Date(data.properties.info.time.created).toISOString();
      const modelId = await surrealClient.upsertModel(
        data.properties.info.model?.providerID || 'unknown',
        data.properties.info.model?.id || 'unknown',
      );
      const result = await surrealClient.upsertSession(projectId, {
        id: data.properties.info.id,
        title: data.properties.info.title,
        slug: data.properties.info.slug,
        created_at: now,
        updated_at: now,
      });
      if (result) {
        logger.info('Session created', { sessionRecordId: result });
        await surrealClient.linkModelToSession(modelId, data.properties.info.id);
        return result;
      }
      return '';
    } catch (error) {
      logger.error('Failed to create session', { error: String(error), trace: new Error().stack });
      throw error;
    }
  }

  async updateSession(data: EventSessionUpdated): Promise<void> {
    if (!this.isInitialized()) return;

    try {
      const rawModel = data.properties.info.model;
      const normalizedModel =
        typeof rawModel === 'string'
          ? { providerID: 'unknown', id: rawModel }
          : (rawModel ?? { providerID: 'unknown', id: 'unknown' });

      await surrealClient.upsertSession(this.projectId, {
        id: data.properties.info.id,
        title: data.properties.info.title,
        slug: data.properties.info.slug,
        created_at: new Date(data.properties.info.time.created).toISOString(),
      });
      const modelId = await surrealClient.upsertModel(
        normalizedModel.providerID,
        normalizedModel.id,
      );
      await surrealClient.linkModelToSession(modelId, data.properties.info.id);
    } catch (error) {
      logger.error('Failed to update session', { error: String(error), trace: new Error().stack });
      throw error;
    }
  }

  async saveMessage(
    sessionId: string,
    role: 'user' | 'agent' | 'system',
    content: string,
  ): Promise<string> {
    logger.debug('Saving message', { sessionId, role });
    if (!this.isInitialized()) return '';
    const config = this.getConfig();
    if (!config) return '';

    try {
      const result = await surrealClient.saveMessage(sessionId, role, content);
      if (result) {
        logger.info('Message saved', { messageId: result });
        return result;
      }
      return '';
    } catch (error) {
      logger.error('Failed to save message', { error: String(error), trace: new Error().stack });
      throw error;
    }
  }

  async saveFact(content: string, verified = false): Promise<string> {
    logger.debug('Saving fact', { verified });
    if (!this.isInitialized()) return '';
    const config = this.getConfig();
    if (!config) return '';

    try {
      const result = await surrealClient.saveFact(content, verified);
      if (result) {
        logger.info('Fact saved', { factId: result });
        return result;
      }
      return '';
    } catch (error) {
      logger.error('Failed to save fact', { error: String(error), trace: new Error().stack });
      throw error;
    }
  }

  async verifyFact(factId: string): Promise<void> {
    logger.debug('Verifying fact', { factId });
    if (!this.isInitialized()) return;

    try {
      await surrealClient.verifyFact(factId);
    } catch (error) {
      logger.error('Failed to verify fact', { error: String(error), trace: new Error().stack });
      throw error;
    }
  }

  async getFactsForMemory(memoryId: string): Promise<FactRecord[]> {
    logger.debug('Getting facts for memory', { memoryId });
    if (!this.isInitialized()) return [];
    const config = this.getConfig();
    if (!config) return [];

    try {
      const result = await surrealClient.getFactsForMemory(memoryId);
      logger.debug('Facts retrieved', { count: result.length });
      return result;
    } catch (error) {
      logger.error('Failed to get facts for memory', {
        error: String(error),
        trace: new Error().stack,
      });
      return [];
    }
  }

  async getOrCreateEmbedding(model: string, dimensions: number): Promise<string> {
    logger.debug('Getting or creating embedding', { model, dimensions });
    if (!this.isInitialized()) return '';
    const config = this.getConfig();
    if (!config) {
      logger.error('MemoryService not initialized, cannot get config');
      return '';
    }

    try {
      const result = await surrealClient.getOrCreateEmbedding(model, dimensions);
      if (result) {
        logger.info('Embedding ready', { embeddingId: result });
        return result;
      }
      return '';
    } catch (error) {
      logger.error('Failed to get or create embedding', {
        error: String(error),
        trace: new Error().stack,
      });
      throw error;
    }
  }

  async linkMemoryToProject(memoryId: string, projectId: string): Promise<void> {
    logger.debug('Linking memory to project', { memoryId, projectId });
    if (!this.isInitialized()) return;

    try {
      await surrealClient.linkMemoryToProject(memoryId, projectId);
    } catch (error) {
      logger.error('Failed to link memory to project', {
        error: String(error),
        trace: new Error().stack,
      });
      throw error;
    }
  }

  async linkMemoryToSession(memoryId: string, sessionId: string): Promise<void> {
    logger.debug('Linking memory to session', { memoryId, sessionId });
    if (!this.isInitialized()) return;

    try {
      await surrealClient.linkMemoryToSession(memoryId, sessionId);
    } catch (error) {
      logger.error('Failed to link memory to session', {
        error: String(error),
        trace: new Error().stack,
      });
      throw error;
    }
  }

  async linkMemoryToEmbedding(memoryId: string, embeddingId: string): Promise<void> {
    logger.debug('Linking memory to embedding', { memoryId, embeddingId });
    if (!this.isInitialized()) return;

    try {
      await surrealClient.linkMemoryToEmbedding(memoryId, embeddingId);
    } catch (error) {
      logger.error('Failed to link memory to embedding', {
        error: String(error),
        trace: new Error().stack,
      });
      throw error;
    }
  }

  async linkMemoryToFact(memoryId: string, factId: string): Promise<void> {
    logger.debug('Linking memory to fact', { memoryId, factId });
    if (!this.isInitialized()) return;

    try {
      await surrealClient.linkMemoryToFact(memoryId, factId);
    } catch (error) {
      logger.error('Failed to link memory to fact', {
        error: String(error),
        trace: new Error().stack,
      });
      throw error;
    }
  }

  async applyPendingMigrations(): Promise<{ applied: string[] }> {
    logger.debug('Applying pending migrations', {});
    if (!this.isInitialized()) return { applied: [] };

    try {
      const result = await surrealClient.applyPendingMigrations();
      return result;
    } catch (error) {
      logger.error('Failed to apply pending migrations', {
        error: String(error),
        trace: new Error().stack,
      });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.getConfig()) return;
    logger.debug('Shutting down MemoryService', {});

    try {
      await surrealClient.disconnect();
      this._config = null;
    } catch (error) {
      logger.error('Failed to shutdown MemoryService', {
        error: String(error),
        trace: new Error().stack,
      });
    }
  }
}

const memoryService = new MemoryService();
export default memoryService;
export { MemoryService };
