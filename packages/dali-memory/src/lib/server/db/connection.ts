import { createLogger } from '../logger';
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

    instance = orm;
    log.info('Connected to SurrealDB');
    return orm;
  } catch (error) {
    log.error(
      'Failed to connect to SurrealDB: ' + (error instanceof Error ? error.message : String(error)),
    );
    throw error;
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
