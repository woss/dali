import { createDebug as debug } from 'obug';
import { validateAuthConfig } from './auth/validate.js';
import { loadConfig } from './config/loader.js';
import { parseConfig } from './config/schema.js';
import { EmbeddedDriver } from './embedded-driver.js';
import { NodeDriver } from './node-driver.js';
import { isHttpProtocol } from './orm-interfaces.js';
import type { DriverConfig, EmbeddedConfig, SurrealDriver } from './types.js';

const log = debug('dali-orm:orm');
const connectLog = log.extend('connect');

/**
 * Resolve driver options from config and explicit options
 * Priority: explicit options > config file
 */
export function resolveDriverOptions(
  explicitOptions: DriverConfig | EmbeddedConfig,
  configFromFile: { url: string; namespace: string; database: string; auth?: unknown } | undefined,
): DriverConfig | EmbeddedConfig {
  if (!configFromFile) return explicitOptions;

  const base = {
    url: configFromFile.url,
    namespace: configFromFile.namespace,
    database: configFromFile.database,
    ...(configFromFile.auth ? { auth: configFromFile.auth } : {}),
  };

  return { ...base, ...explicitOptions } as DriverConfig | EmbeddedConfig;
}

/**
 * Connect and return SurrealDriver directly
 */
export async function connect(
  config: import('./orm-interfaces.js').SurrealORMConfig,
): Promise<SurrealDriver> {
  let driver: SurrealDriver;

  // Step1: Resolve config
  let resolvedConfig:
    | { url: string; namespace: string; database: string; auth?: unknown }
    | undefined;

  if (config.config) {
    if (config.config === true) {
      const { config: discovered } = await loadConfig();
      resolvedConfig = discovered;
    } else if (typeof config.config === 'string') {
      const { config: loaded } = await loadConfig({ path: config.config });
      resolvedConfig = loaded;
    } else {
      const parsed = parseConfig(config.config);
      resolvedConfig = parsed;
    }
  }

  // Step 2: Create driver
  if (config.nodeDriver) {
    const driverOptions = resolveDriverOptions(config.nodeDriver, resolvedConfig);

    if ('auth' in driverOptions && driverOptions.auth) {
      const authValidation = validateAuthConfig(driverOptions.auth);
      if (!authValidation.valid) {
        const errorDetails =
          authValidation.errors?.map((e) => `${e.field}: ${e.message}`).join('; ') ??
          'Unknown validation error';
        throw new Error(`Auth configuration validation failed: ${errorDetails}`);
      }
    }

    driver = new NodeDriver({
      ...(driverOptions as DriverConfig),
      codecOptions: config.codecOptions,
      reconnect: config.reconnect,
    });
  } else if (config.embeddedDriver) {
    const driverOptions = resolveDriverOptions(config.embeddedDriver, resolvedConfig);
    driver = new EmbeddedDriver(driverOptions as EmbeddedConfig);
  } else {
    throw new Error('Must provide nodeDriver or embeddedDriver config');
  }

  await driver.connect();
  connectLog('Connecting to database %s', driver.getUrl());

  const httpConnection = isHttpProtocol(driver.getUrl());
  if (httpConnection) {
    log(
      'Using HTTP endpoint - transactions and live queries are not supported. Use ws:// or wss:// for full functionality.',
    );
  }

  return driver;
}

// ==================== Utility Functions ====================

/**
 * Execute a query object (with toSQL/toParams) and return results
 */
export async function execute(
  driver: SurrealDriver,
  queryObj: { toSQL(): string; toParams?(): Record<string, unknown> },
): Promise<unknown[]> {
  const sql = queryObj.toSQL();
  const params = queryObj.toParams?.() || {};
  return driver.query(sql, params);
}

/**
 * Show changes for a table since a given point
 */
export async function showChanges<T = unknown>(
  driver: SurrealDriver,
  table: string,
  options?: { since?: string | number; limit?: number },
): Promise<T[]> {
  const since = options?.since ?? 0;
  const limit = options?.limit ?? 10;
  const sinceClause = since === 0 ? '0' : `${since}`;
  const sanitizedTable = table.replace(/[^a-zA-Z0-9_:]/g, '');
  const sql = `SHOW CHANGES FOR TABLE ${sanitizedTable} SINCE ${sinceClause} LIMIT ${limit}`;
  return driver.query<T>(sql);
}
