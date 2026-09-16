import type { SurrealDriver } from '../../sdk/driver/types.js';
import type { Config } from '../config.js';
import { MigrationRunner } from '../core/runner.js';
export interface MigrateOptions {
  to?: string;
  dryRun?: boolean;
  force?: boolean;
  config: Config;
  autoResume?: boolean;
  embeddedDriver?: boolean;
}
/**
 * Run pending migrations
 */
export declare function migrateUp(
  options: MigrateOptions,
  driver?: SurrealDriver,
): Promise<void>;
/**
 * Sync journal from database state
 */
export declare function migrateSync(
  options: {
    config: Config;
    embeddedDriver?: boolean;
  },
  driver?: SurrealDriver,
): Promise<void>;
/**
 * Resume a partially applied migration
 */
export declare function migrateResume(
  options: {
    config: Config;
    dryRun?: boolean;
    embeddedDriver?: boolean;
  },
  driver?: SurrealDriver,
): Promise<void>;
/**
 * Get migration progress as string (e.g., "3/7 statements applied")
 */
export declare function getMigrationProgressString(
  runner: MigrationRunner,
  migrationName: string,
): Promise<string>;
/**
 * Handle resume with progress display
 */
export declare function handleResumeWithProgress(
  runner: MigrationRunner,
): Promise<void>;
/**
 * migrate dev — Generate + validate + apply migration.
 * Like Prisma's migrate dev: creates migration, validates on shadow, applies to target.
 * No changes = stops (no empty migration).
 */
export declare function migrateDev(
  options: MigrateOptions & {
    name: string;
  },
  driver?: SurrealDriver,
): Promise<void>;
/**
 * migrate deploy — Apply pending migrations with shadow validation.
 * REQUIRES shadow config — fails hard if not set.
 */
export declare function migrateDeploy(
  options: MigrateOptions,
  _driver?: SurrealDriver,
): Promise<void>;
//# sourceMappingURL=migrate.d.ts.map
