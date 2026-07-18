import { createLogger } from '../logger';
import { ConnectionError, MigrationError } from '@woss/dali-orm/core/errors';
import { DaliORM } from '@woss/dali-orm';
import { generateAndApplyMigration } from '@woss/dali-orm/migration/api';
import { schema } from './schema';

export type DB = Awaited<ReturnType<typeof connect>>;

let instance: DaliORM | null = null;

export async function connect() {
  if (instance) return instance;

  const log = createLogger(['dali-memory', 'db']);
  const url = process.env.DALI_MEMORY_SURREAL_URL || 'ws://localhost:10101';
  log.info('Connecting to SurrealDB at ' + url);

  try {
    const orm = await DaliORM.connect({
      nodeDriver: {
        driver: 'node' as const,
        url,
        namespace: process.env.DALI_MEMORY_SURREAL_NS || 'memory',
        database: process.env.DALI_MEMORY_SURREAL_DB || 'memory',
        auth: {
          type: 'root' as const,
          username: process.env.DALI_MEMORY_SURREAL_USER || 'admin',
          password: process.env.DALI_MEMORY_SURREAL_PASS || 'admin',
        },
      },
      schema,
    });

    // Apply schema migration
    const driver = orm.getDriver();
    try {
      await generateAndApplyMigration(driver, schema.getTables(), {
        name: 'init',
        fullMigration: false,
        access: schema.getAccess(),
        analyzers: schema.getAnalyzers(),
      });
    } catch (err: any) {
      if (err.message?.includes('No schema changes detected')) {
        // Schema already matches the live DB — no migration needed
      } else {
        throw err;
      }
    }

    // Migrate workspace index: global unique → per-user unique
    try {
      await driver.query('REMOVE INDEX idx_workspaces_name ON workspaces');
    } catch {
      // Index may not exist yet on fresh databases — ignore
    }
    try {
      await driver.query(
        'DEFINE INDEX idx_workspaces_name ON workspaces FIELDS name, user_id UNIQUE',
      );
    } catch {
      // May already exist with correct definition — ignore
    }

    instance = orm;
    log.info('Connected to SurrealDB');
    return orm;
  } catch (error) {
    log.error(
      'Failed to connect to SurrealDB: ' + (error instanceof Error ? error.message : String(error)),
    );
    // Re-throw MigrationError as-is — it's already a typed error from dali-orm
    if (error instanceof MigrationError) throw error;
    throw new ConnectionError('Failed to connect to SurrealDB', {
      url,
      namespace: process.env.DALI_MEMORY_SURREAL_NS || 'memory',
      database: process.env.DALI_MEMORY_SURREAL_DB || 'memory',
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

export async function disconnect() {
  if (instance) {
    await instance.disconnect();
    instance = null;
  }
  createLogger(['dali-memory', 'db']).debug('Disconnected from SurrealDB');
}

export function getDB(): DaliORM {
  if (!instance) throw new Error('Database not connected. Call connect() first.');
  return instance;
}
