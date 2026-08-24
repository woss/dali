/**
 * Shadow Database Validation
 *
 * Pre-validates migrations on a shadow DB before applying to target.
 * Shadow is destroyed after each validation run.
 */

import { escapeIdent } from '../../core/surql.ts';
import { connect } from '../../sdk/driver/orm-connection.js';
import type { SurrealDriver } from '../../sdk/driver/types.js';
import type { Config } from '../config.js';
import { MigrationRunner } from './runner.js';

/**
 * Shadow database configuration
 */
export interface ShadowConfig {
  namespace: string;
  database: string;
}

/**
 * Result of shadow validation
 */
export interface ShadowValidationResult {
  success: boolean;
  errors: string[];
  appliedCount: number;
}

/**
 * Guard: shadow ns/db must not match real ns/db
 */
function guardShadowNotTarget(
  shadow: ShadowConfig,
  target: { namespace: string; database: string },
): void {
  if (
    shadow.namespace === target.namespace &&
    shadow.database === target.database
  ) {
    throw new Error(
      `Shadow (${shadow.namespace}/${shadow.database}) cannot match target. Use different ns/db.`,
    );
  }
}

/**
 * Create a new connection to the shadow database.
 * Shadow DB auto-created on first USE by SurrealDB.
 */
export async function connectToShadow(
  config: Config,
  shadow: ShadowConfig,
): Promise<SurrealDriver> {
  guardShadowNotTarget(shadow, {
    namespace: config.namespace,
    database: config.database,
  });

  return connect({
    nodeDriver: {
      driver: 'node',
      url: config.url,
      namespace: shadow.namespace,
      database: shadow.database,
      auth: config.auth,
    },
  });
}

/**
 * Destroy the shadow database after validation.
 * Best-effort — non-fatal if cleanup fails.
 */
export async function destroyShadow(
  driver: SurrealDriver,
  shadow: ShadowConfig,
): Promise<void> {
  try {
    // Switch to shadow ns (needed for REMOVE DATABASE)
    await driver.use(shadow.namespace, shadow.database);
    await driver.query(
      `REMOVE DATABASE IF EXISTS ${escapeIdent(shadow.database)}`,
    );
  } catch {
    // Non-fatal — cleanup is best-effort
  }
}

/**
 * Validate pending migrations on shadow DB.
 * Applies all pending migrations, returns success/error.
 */
export async function validateWithShadow(
  shadowDriver: SurrealDriver,
  options?: {
    targetVersion?: string;
    migrationsDir?: string;
    migrationsTable?: string;
    journalDir?: string;
  },
): Promise<ShadowValidationResult> {
  const runner = new MigrationRunner(shadowDriver, {
    migrationsDir: options?.migrationsDir,
    migrationsTable: options?.migrationsTable ?? '__migrations',
    journalDir: options?.journalDir,
  });

  try {
    await runner.init();
    const result = await runner.up(options?.targetVersion);

    return {
      success: true,
      errors: [],
      appliedCount: result.applied.length,
    };
  } catch (error) {
    return {
      success: false,
      errors: [(error as Error).message],
      appliedCount: 0,
    };
  }
}
