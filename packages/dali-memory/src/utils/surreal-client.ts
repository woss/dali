import 'dotenv/config';
import { DaliORM } from '@woss/dali-orm';
import { migrateToDatabase } from '@woss/dali-orm/migration/api';
import type { InferInsertInput, InferSelectResult, InferUpdateInput } from '@woss/dali-orm/query';
import { delete_, insert, relate, select, update, upsert } from '@woss/dali-orm/query';
import type { DaliMemoryConfig } from '../config.ts';
import { logger } from './logger.ts';
import {
  embeddingsSchema,
  factsSchema,
  hasEmbeddingSchema,
  memoriesSchema,
  messagesSchema,
  modelSchema,
  partOfProjectSchema,
  partOfSessionSchema,
  type projectsSchema,
  relatesToSchema,
  schema,
  sessionsSchema,
  usesModelSchema,
} from '../schema.ts';

/**
 * Log structured operation debug info before executing against SurrealDB.
 * For raw SQL: logs SQL string + params.
 * For builder ops: logs structured operation type + table + key data.
 */
function logDebugSQL(op: string, table: string, detail?: Record<string, unknown>): void {
  logger.debug(`SQL >>> ${op} ${table}`, { op, table, ...detail });
}

type WithOptionalId<T> = Omit<T, 'id'> & { id?: string };

export type MemoryRecord = WithOptionalId<InferSelectResult<typeof memoriesSchema>>;
export type MemoryInsertRecord = WithOptionalId<InferInsertInput<typeof memoriesSchema>>;
export type ProjectRecord = WithOptionalId<InferSelectResult<typeof projectsSchema>>;
export type SessionRecord = InferSelectResult<typeof sessionsSchema>;
export type SessionUpdateRecord = InferUpdateInput<typeof sessionsSchema>;
export type MessageRecord = WithOptionalId<InferSelectResult<typeof messagesSchema>>;
export type FactRecord = WithOptionalId<InferSelectResult<typeof factsSchema>>;
export type EmbeddingRecord = WithOptionalId<InferSelectResult<typeof embeddingsSchema>>;

class SurrealClient {
  private _orm: DaliORM | undefined = undefined;

  private isConnected(): boolean {
    return !!this._orm?.isConnected();
  }

  get orm(): DaliORM {
    if (!this._orm) {
      logger.warn('SurrealClient ORM accessed before connection established');
      throw new Error('SurrealClient not connected');
    }
    return this._orm;
  }

  async connect(config: DaliMemoryConfig, _directory?: string): Promise<void> {
    logger.debug('Connecting to SurrealDB', { mode: config.storage.mode });

    try {
      if (config.storage.mode === 'embed') {
        if (!config.storage.embed) {
          throw new Error('Embed mode requires storage.embed configuration');
        }

        const engine = config.storage.embed.engine || 'surrealkv';

        if (engine === 'memory') {
          logger.debug('Using embedded database', { engine: 'memory' });
          logDebugSQL('CONNECT', 'embedded', { engine: 'memory' });
          this._orm = await DaliORM.connect({
            embeddedDriver: { driver: 'embedded', mode: 'memory' },
            schema,
          });
        } else {
          if (!config.storage.embed.dataPath) {
            throw new Error('Embed surrealkv mode requires storage.embed.dataPath configuration');
          }
          const dbPath = `${config.storage.embed.dataPath}memories.db`;
          logger.debug('Using embedded database', { path: dbPath, engine: 'surrealkv' });
          logDebugSQL('CONNECT', 'embedded', { path: dbPath });
          this._orm = await DaliORM.connect({
            embeddedDriver: { driver: 'embedded', path: dbPath, mode: 'surrealkv' },
            schema,
          });
        }
      } else if (config.storage.mode === 'remote') {
        if (!config.storage.remote) {
          throw new Error('Remote mode requires storage.remote configuration');
        }
        const { url, auth, namespace, database } = config.storage.remote;
        logger.debug('Using remote database', { url, namespace, database });

        if (!auth?.username || !auth?.password) {
          throw new Error('Remote mode requires storage.remote.auth with username and password');
        }
        const rootAuth = {
          type: 'root' as const,
          username: auth.username,
          password: auth.password,
        };

        logDebugSQL('CONNECT', 'remote', { url, namespace, database });
        this._orm = await DaliORM.connect({
          nodeDriver: {
            driver: 'node',
            url,
            auth: rootAuth,
            ...(namespace && { namespace }),
          },
          schema,
        });

        if (rootAuth.type === 'root' && namespace) {
          try {
            await this.orm.query(`DEFINE NAMESPACE IF NOT EXISTS \`${namespace}\``);
          } catch (nsError) {
            logger.warn('Could not create namespace (may already exist)', {
              error: String(nsError),
            });
          }
        }

        if (rootAuth.type === 'root' && namespace && database) {
          try {
            await this.orm.query(`DEFINE DATABASE IF NOT EXISTS \`${database}\``);
          } catch (dbError) {
            logger.warn('Could not create database (may already exist)', {
              error: String(dbError),
            });
          }
          await this.orm.use(namespace, database);
        }
      } else {
        throw new Error(
          `Invalid storage mode: ${config.storage.mode as string}. Must be 'embed' or 'remote'`,
        );
      }

      await this.applyPendingMigrations();
      logger.info('SurrealDB connected successfully', { mode: config.storage.mode });
    } catch (error) {
      logger.error('SurrealDB connection failed', {
        error: String(error),
        trace: new Error().stack,
      });
    }
  }

  /**
   * Apply pending migration files from the migrations directory.
   * Delegates to migrateToDatabase from @woss/dali-orm/migration/api.
   * Auto-discovers dali-orm.config.ts from caller location.
   */
  async applyPendingMigrations(): Promise<{ applied: string[] }> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping applyPendingMigrations');
      return { applied: [] };
    }
    logger.debug('Applying pending migrations', {});

    try {
      const driver = this.orm.getDriver();
      const result = await migrateToDatabase(driver);

      if (result.applied.length > 0) {
        logger.info('Applied migration(s)', { migrations: result.applied });
      } else {
        logger.debug('No pending migration files to apply');
      }

      return { applied: result.applied };
    } catch (error) {
      logger.error(`Failed to apply migrations: ${String(error)}`, {
        error: String(error),
        trace: new Error().stack,
      });
      return { applied: [] };
    }
  }

  // ==================== Memories ====================

  async saveMemory(data: {
    memory: MemoryInsertRecord;
    projectId: string;
    sessionId: string;
    embedId: string;
  }): Promise<string> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping saveMemory');
      return '';
    }
    const { memory, projectId, sessionId, embedId } = data;
    const { vector: _vector, content: _content, ...rest } = memory;
    logger.debug('Saving memory record', rest);
    const driver = this.orm.getDriver();

    logDebugSQL('INSERT', 'memories', {
      content_len: (memory.content as string | undefined)?.length ?? 0,
      tags: (memory.tags as string[] | undefined)?.length ?? 0,
      type: memory.type,
      containerTag: memory.container_tag,
    });

    try {
      // Always INSERT — DB computes content_hash via DEFAULT crypto::blake3(content).
      // If content already exists, unique constraint on content_hash triggers a violation.
      // Catch it and SELECT existing record by content field instead.
      let recordId: string;
      try {
        const result = await insert(driver, memoriesSchema).one(memory).execute();
        const record = result[0];
        if (!record?.id) {
          logger.error('Failed to save memory: no record ID returned', {});
          return '';
        }
        recordId = String(record.id);
      } catch (insertError) {
        const msg = String(insertError);
        if (
          !msg.includes('already contains') &&
          !msg.includes('UNIQUE constraint') &&
          !msg.includes('Duplicate')
        ) {
          throw insertError;
        }
        logger.debug(
          'Memory content already exists (unique constraint), finding existing record',
          {},
        );
        const existing = await select(driver, memoriesSchema)
          .where((w) => w.eq('content', memory.content))
          .limit(1)
          .execute();
        if (!existing[0]?.id) {
          logger.error('Failed to find existing memory by content', {});
          return '';
        }
        recordId = String(existing[0].id);
      }

      logger.debug('Linking memory', { memoryId: recordId, projectId, sessionId, embedId });
      await Promise.all([
        this.linkMemoryToProject(recordId, projectId),
        this.linkMemoryToSession(recordId, sessionId),
        this.linkMemoryToEmbedding(recordId, embedId),
      ]);

      return recordId;
    } catch (error) {
      logger.error('Failed to save memory', { error: String(error), trace: new Error().stack });
      throw error;
    }
  }

  async searchMemories(
    query: string,
    vector: number[],
    tags: string[],
    containerTag: string,
    limit: number,
  ): Promise<MemoryRecord[]> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping searchMemories');
      return [];
    }
    logger.debug('Searching memories', { query, tagCount: tags.length, limit });

    const params: Record<string, any> = { containerTag, vector, limit };
    const whereClauses = [`container_tag = $containerTag`];

    if (tags.length > 0) {
      whereClauses.push(`tags CONTAINSALL $tags`);
      params.tags = tags;
    }

    const queryStr = `
        SELECT *, vector::similarity::cosine(vector, $vector) AS score 
        FROM memories 
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY score DESC
        LIMIT $limit
      `;

    logDebugSQL('SELECT', 'memories', { query, tags: tags.length, sql: queryStr.trim() });

    try {
      const results = await this.orm.query<MemoryRecord & { score: number }>(queryStr, params);
      logger.debug('Search complete', { resultCount: results.length });
      return results.map(({ score: _score, ...record }) => record as MemoryRecord);
    } catch (error) {
      logger.error('Failed to search memories', { error: String(error), trace: new Error().stack });
      return [];
    }
  }

  async getMemoryById(id: string): Promise<MemoryRecord | null> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping getMemoryById');
      return null;
    }
    logger.debug('Getting memory by ID', { id });
    const driver = this.orm.getDriver();

    logDebugSQL('SELECT', 'memories', { id });

    try {
      // Use driver.select(id) — SurrealDB's id field is a RecordId, not a plain string.
      // The driver's select with table:id format handles proper RecordId comparison.
      const result = await driver.select<MemoryRecord>(id);
      return result[0] || null;
    } catch (error) {
      logger.error('Failed to get memory by ID', {
        error: String(error),
        trace: new Error().stack,
      });
      return null;
    }
  }

  async deleteMemory(id: string): Promise<void> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping deleteMemory');
      return;
    }
    logger.debug('Deleting memory', { id });
    const driver = this.orm.getDriver();

    logDebugSQL('DELETE', 'memories', { id });

    try {
      await delete_(driver, memoriesSchema).id(id).execute();
      logger.info('Memory deleted', { id });
    } catch (error) {
      logger.error('Failed to delete memory', { error: String(error), trace: new Error().stack });
    }
  }

  async listMemories(containerTag: string, limit: number): Promise<MemoryRecord[]> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping listMemories');
      return [];
    }
    logger.debug('Listing memories', { containerTag, limit });
    const driver = this.orm.getDriver();

    logDebugSQL('SELECT', 'memories', { containerTag, limit });

    try {
      const results = await select(driver, memoriesSchema)
        .where((w) => w.eq('container_tag', containerTag))
        .limit(limit)
        .execute();
      logger.debug('List complete', { resultCount: results.length });
      return results as MemoryRecord[];
    } catch (error) {
      logger.error('Failed to list memories', { error: String(error), trace: new Error().stack });
      return [];
    }
  }

  // ==================== Projects ====================

  async getOrCreateProject(name: string, directoryPath: string): Promise<string> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping getOrCreateProject');
      return '';
    }
    logger.debug('Getting or creating project', { name, directoryPath });
    logDebugSQL('UPSERT', 'projects', { name, directoryPath });

    try {
      const sql =
        'UPSERT projects SET name = $name, directory_path = $directoryPath WHERE directory_path = $directoryPath';
      const result = await this.orm.query<{ id: string }>(sql, { name, directoryPath });
      const record = result?.[0];
      if (record?.id) {
        logger.debug('Project ready', { id: record.id });
        return String(record.id);
      }
      logger.error('Failed to get or create project: no ID returned', {});
      return '';
    } catch (error) {
      logger.error('Failed to get or create project', {
        error: String(error),
        trace: new Error().stack,
      });
      return '';
    }
  }

  // ==================== Sessions ====================

  async upsertModel(providerId: string, modelId: string): Promise<string> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping upsertModel');
      return '';
    }

    logger.debug('Creating model record', { providerId, modelId });
    const driver = this.orm.getDriver();
    logDebugSQL('INSERT', 'models', { providerId, modelId });
    try {
      const result = await upsert(driver, modelSchema)
        .id(`${providerId}:${modelId}`)
        .data({
          provider_id: providerId,
          model_id: modelId,
        })
        .execute();
      const record = result[0] as { id: string } | undefined;
      if (record?.id) {
        logger.debug('Model record created', { id: record.id });
        return String(record.id);
      }
      logger.error('Failed to create model record: no ID returned', {});
      return '';
    } catch (error) {
      logger.debug('Failed to create model record', {
        error: String(error),
        trace: new Error().stack,
      });
      return '';
    }
  }

  async linkModelToSession(modelRecordId: string, sessionId: string): Promise<void> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping linkModelToSession');
      return;
    }
    logger.debug('Linking model to session', { modelRecordId, sessionId });
    try {
      const driver = this.orm.getDriver();
      await relate(driver, usesModelSchema)
        .from(sessionsSchema.$id(sessionId))
        .to(modelRecordId)
        .set('type', 'session_model')
        .execute();
    } catch (error) {
      const msg = String(error);
      if (msg.includes('already contains')) {
        logger.debug('Model already linked to session', { modelRecordId, sessionId });
        return;
      }
      logger.error('Failed to link model to session', { error: msg, trace: new Error().stack });
      return;
    }
  }

  async upsertSession(
    projectId: string,
    session: SessionUpdateRecord & { id: string },
  ): Promise<string> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping upsertSession');
      return '';
    }

    const { id, ...rest } = session;
    logger.debug('Upserting session', { sessionId: id, projectId, rest });
    const driver = this.orm.getDriver();
    logDebugSQL('UPSERT', 'sessions', { sessionId: id, projectId });

    try {
      await upsert(driver, sessionsSchema).id(id).data(rest).execute();
    } catch (error) {
      logger.error('Failed to upsert session', { error: String(error), trace: new Error().stack });
      return '';
    }

    // Return full record ID (table:key) for use in record<> fields
    return `${sessionsSchema.name}:${id}`;
  }

  // ==================== Messages ====================

  async saveMessage(
    sessionId: string,
    role: 'user' | 'agent' | 'system',
    content: string,
  ): Promise<string> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping saveMessage');
      return '';
    }
    logger.debug('Saving message', { sessionId, role });
    const driver = this.orm.getDriver();

    logDebugSQL('INSERT', 'messages', { sessionId, role, content_len: content.length });

    try {
      const result = await insert(driver, messagesSchema)
        .one({ session: sessionId, role, content })
        .execute();
      const record = result[0] as MessageRecord | undefined;
      if (record?.id) {
        logger.debug('Message saved', { id: record.id });
        return String(record.id);
      }
      logger.error('Failed to save message: no record ID returned', {});
      return '';
    } catch (error) {
      logger.error('Failed to save message', { error: String(error), trace: new Error().stack });
      return '';
    }
  }

  // ==================== Facts ====================

  async saveFact(content: string, verified = false): Promise<string> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping saveFact');
      return '';
    }
    logger.debug('Saving fact', { verified });
    const driver = this.orm.getDriver();

    logDebugSQL('INSERT', 'facts', { content_len: content.length, verified });

    try {
      const result = await insert(driver, factsSchema).one({ content, verified }).execute();
      const record = result[0] as FactRecord | undefined;
      if (record?.id) {
        logger.debug('Fact saved', { id: record.id });
        return String(record.id);
      }
      logger.error('Failed to save fact: no record ID returned', {});
      return '';
    } catch (error) {
      logger.error('Failed to save fact', { error: String(error), trace: new Error().stack });
      return '';
    }
  }

  async verifyFact(factId: string): Promise<void> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping verifyFact');
      return;
    }
    logger.debug('Verifying fact', { factId });
    const driver = this.orm.getDriver();

    logDebugSQL('UPDATE', 'facts', { factId });

    try {
      await update(driver, factsSchema).id(factId).data({ verified: true }).execute();
      logger.info('Fact verified', { factId });
    } catch (error) {
      logger.error('Failed to verify fact', { error: String(error), trace: new Error().stack });
    }
  }

  async getFactsForMemory(memoryId: string): Promise<FactRecord[]> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping getFactsForMemory');
      return [];
    }
    logger.debug('Getting facts for memory', { memoryId });

    logDebugSQL('QUERY', 'facts', {
      memoryId,
      sql: 'SELECT * FROM facts WHERE id IN (SELECT VALUE out FROM relates_to WHERE type = "memory_fact" AND in = type::record($memoryId))',
    });

    try {
      // Schema: relates_to { in: facts, out: memories }
      // So we look for relations where out = memoryId, then get the in (fact) values
      const results = await this.orm.query<FactRecord>(
        'SELECT * FROM facts WHERE id IN (SELECT VALUE in FROM relates_to WHERE type = "memory_fact" AND out = type::record($memoryId))',
        { memoryId },
      );
      logger.debug('Facts retrieved', { count: results.length });
      return results;
    } catch (error) {
      logger.error('Failed to get facts for memory', {
        error: String(error),
        trace: new Error().stack,
      });
      return [];
    }
  }

  // ==================== Embeddings ====================

  async getOrCreateEmbedding(model: string, dimensions: number): Promise<string> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping getOrCreateEmbedding');
      return '';
    }
    logger.debug('Getting or creating embedding', { model, dimensions });
    const driver = this.orm.getDriver();

    // Try to find existing
    logDebugSQL('SELECT', 'embeddings', { model, dimensions });

    try {
      // Try to find existing embedding.
      // Table may not exist on first call — SELECT from non-existent table throws.
      let existing: EmbeddingRecord | undefined;
      try {
        const findResult = await select(driver, embeddingsSchema)
          .where((w) => w.eq('model', model).eq('dimensions', dimensions))
          .limit(1)
          .execute();
        existing = findResult[0] as EmbeddingRecord | undefined;
      } catch {
        // Table does not exist yet — will be created on INSERT below
      }

      if (existing?.id) {
        logger.debug('Embedding found', { id: existing.id });
        return String(existing.id);
      }

      // Not found — insert new (creates the table in SurrealDB)
      logger.debug('Creating new embedding', { model, dimensions });
      logDebugSQL('INSERT', 'embeddings', { model, dimensions });
      const createResult = await insert(driver, embeddingsSchema)
        .one({ model, dimensions })
        .execute();
      const record = createResult[0] as EmbeddingRecord | undefined;
      if (record?.id) {
        logger.debug('Embedding created', { id: record.id });
        return String(record.id);
      }
      logger.error('Failed to create embedding: no record ID returned', {});
      return '';
    } catch (error) {
      logger.error('Failed to find or create embedding', {
        error: String(error),
        trace: new Error().stack,
      });
      return '';
    }
  }

  // ==================== Links ====================

  async linkMemoryToProject(memoryId: string, projectId: string): Promise<void> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping linkMemoryToProject');
      return;
    }
    logger.debug('Linking memory to project', { memoryId, projectId });

    try {
      const driver = this.orm.getDriver();
      await relate(driver, partOfProjectSchema)
        .from(projectId)
        .to(memoryId)
        .set('type', 'project_memory')
        .execute();
      logger.info('Memory linked to project', { memoryId, projectId });
    } catch (error) {
      const msg = String(error);
      if (msg.includes('already contains')) {
        logger.debug('Memory already linked to project (duplicate edge)', { memoryId, projectId });
        return;
      }
      logger.error('Failed to link memory to project', {
        error: msg,
        trace: new Error().stack,
      });
    }
  }

  async linkMemoryToSession(memoryId: string, sessionId: string): Promise<void> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping linkMemoryToSession');
      return;
    }
    logger.debug('Linking memory to session', { memoryId, sessionId });

    try {
      const driver = this.orm.getDriver();
      await relate(driver, partOfSessionSchema)
        .from(sessionsSchema.$id(sessionId))
        .to(memoryId)
        .set('type', 'session_memory')
        .execute();
      logger.info('Memory linked to session', { memoryId, sessionId });
    } catch (error) {
      const msg = String(error);
      if (msg.includes('already contains')) {
        logger.debug('Memory already linked to session (duplicate edge)', { memoryId, sessionId });
        return;
      }
      logger.error('Failed to link memory to session', {
        error: msg,
        trace: new Error().stack,
      });
    }
  }

  async linkMemoryToEmbedding(memoryId: string, embeddingId: string): Promise<void> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping linkMemoryToEmbedding');
      return;
    }
    logger.debug('Linking memory to embedding', { memoryId, embeddingId });
    const driver = this.orm.getDriver();

    logDebugSQL('UPDATE', 'memories', { memoryId, embeddingId });

    try {
      await relate(driver, hasEmbeddingSchema)
        .from(embeddingsSchema.$id(embeddingId))
        .to(String(memoryId))
        .execute();
      logger.info('Memory linked to embedding', { memoryId, embeddingId });
    } catch (error) {
      const msg = String(error);
      if (msg.includes('already contains')) {
        logger.debug('Memory already linked to embedding (duplicate edge)', {
          memoryId,
          embeddingId,
        });
        return;
      }
      logger.error('Failed to link memory to embedding', {
        error: msg,
        trace: new Error().stack,
      });
    }
  }

  async linkMemoryToFact(memoryId: string, factId: string): Promise<void> {
    if (!this.isConnected()) {
      logger.warn('SurrealClient not connected, skipping linkMemoryToFact');
      return;
    }
    logger.debug('Linking memory to fact', { memoryId, factId });
    const driver = this.orm.getDriver();

    logDebugSQL('RELATE', 'relates_to', { from: memoryId, to: factId });

    try {
      // Schema: relates_to { in: facts, out: memories }
      // .from() → in (facts), .to() → out (memories)
      await relate(driver, relatesToSchema)
        .from(factId)
        .to(memoryId)
        .set('type', 'memory_fact')
        .execute();
      logger.info('Memory linked to fact', { memoryId, factId });
    } catch (error) {
      logger.error('Failed to link memory to fact', {
        error: String(error),
        trace: new Error().stack,
      });
    }
  }

  // ==================== Connection Management ====================

  async disconnect(): Promise<void> {
    if (!this._orm) {
      return;
    }
    logger.info('Disconnecting from SurrealDB', {});

    logDebugSQL('DISCONNECT', '-', {});

    try {
      await this.orm.disconnect();
      logger.info('SurrealDB disconnected', {});
    } catch (error) {
      logger.error('Failed to disconnect', { error: String(error), trace: new Error().stack });
    }

    this._orm = undefined;
  }
}

const surrealClient = new SurrealClient();
export default surrealClient;
export { SurrealClient };
