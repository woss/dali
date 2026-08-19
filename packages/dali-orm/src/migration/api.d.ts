/**
 * Migration API - Programmatic migration operations for DaliORM
 *
 * High-level API that accepts SurrealDriver instances directly.
 * Works with both NodeDriver (remote) and EmbeddedDriver (local).
 *
 * @module dali-orm/migration/api
 */
import type { EmbeddedConfig, SurrealDriver } from '../sdk/driver/types.js';
import type { AccessConfig, EventConfig, FunctionConfig } from '../sdk/schema.js';
import type { AnalyzerDefinition, TableDefinition } from '../sdk/table.js';
import { type MigrationResult, type MigrationStatus } from './core/runner.js';
import type { DdlDiffResult } from './ddl/ddl.js';
export { type GenerateOptions, generateFullMigration, generateLiveMigration, generateMigration, generateMigrationFile, generateSnapshotMigration, getLiveSchema, loadSchemaFiles, loadSchemaFromFile, type SchemaFilesResult, } from './cli/generate.js';
export { createRunner, type MigrationResult, MigrationRunner, type MigrationStatus, type RunnerConfig, } from './core/runner.js';
/**
 * Options for generating and applying a migration
 */
export interface GenerateAndApplyOptions {
    /** Migration name (required) */
    name: string;
    /** Output directory for migration file (default: ./migrations) */
    outputDir?: string;
    /** Generate full migration instead of incremental (default: false) */
    fullMigration?: boolean;
    /** Snapshot directory for incremental comparison */
    snapshotDir?: string;
    /** Access definitions to include in migration */
    access?: AccessConfig[];
    /** Event definitions to include in migration */
    events?: EventConfig[];
    /** Function definitions to include in migration */
    functions?: FunctionConfig[];
    /** Analyzer definitions to include in migration */
    analyzers?: AnalyzerDefinition[];
}
/**
 * Options for pulling schema and generating init migration
 */
export interface PullAndMigrateOptions {
    /** Output directory for schema files (default: ./schema) */
    outputDir?: string;
    /** Specific table to pull (pulls all if undefined) */
    table?: string;
    /** Migration name (default: init_from_pull) */
    migrationName?: string;
    /** Access definitions to include in migration */
    access?: AccessConfig[];
    /** Event definitions to include in migration */
    events?: EventConfig[];
    /** Function definitions to include in migration */
    functions?: FunctionConfig[];
}
/**
 * Extended pull options that accept embedded driver config
 * Fixes the bug where embedded mode defaulted to 'memory' without
 * allowing mode/path configuration
 */
/**
 * Options for pushing schema from table definitions
 */
export interface PushSchemaOptions {
    /** If true, only diff without applying changes (default: false) */
    dryRun?: boolean;
}
/**
 * Push schema changes to a database using the introspection + diff pipeline.
 * Uses the same logic as the CLI `push` command but accepts an existing driver
 * and table definitions directly (no config file needed).
 *
 * @param driver - Connected SurrealDriver
 * @param tables - Table definitions to push
 * @param options - Push options
 * @returns DdlDiffResult with statements, SQL, warnings, data loss ops
 *
 * @example
 * ```ts
 * const driver = orm.getDriver();
 * const result = await pushSchemaFromTableDefs(driver, schema.getTables());
 * console.log(`Applied ${result.sqlStatements.length} statements`);
 * ```
 */
export declare function pushSchemaFromTableDefs(driver: SurrealDriver, tables: TableDefinition[], options?: PushSchemaOptions & {
    access?: AccessConfig[];
    events?: EventConfig[];
    functions?: FunctionConfig[];
}): Promise<DdlDiffResult>;
/**
 * Set the config directory for testing purposes.
 *
 * @internal NOT part of public API — for testing only.
 * @deprecated Internal test utility. Do not use in production code.
 *   This mutates global module state and is only intended for test setup.
 */
export declare function _setTestConfigDir(dir: string | undefined): void;
export interface ApiPullOptions {
    /** Specific table to pull (pulls all if undefined) */
    table?: string;
    /** Output directory for schema files */
    outputDir?: string;
    /** Embedded driver configuration (mode, path) */
    embeddedConfig?: EmbeddedConfig;
}
/**
 * Apply pending migrations to a database using an existing driver.
 *
 * @param driver - Connected SurrealDriver (NodeDriver or EmbeddedDriver)
 * @param options - Migration configuration
 * @returns MigrationResult with applied/skipped migration names
 *
 * @example
 * ```ts
 * const driver = await connect({ nodeDriver: { ... } });
 * const result = await migrateToDatabase(driver, {
 *   migrationsDir: './migrations',
 *   migrationsTable: '__migrations',
 * });
 * console.log(`Applied: ${result.applied.join(', ')}`);
 * ```
 */
export declare function migrateToDatabase(driver: SurrealDriver): Promise<MigrationResult>;
/**
 * Get migration status - applied and pending migrations.
 *
 * @param driver - Connected SurrealDriver
 * @param options - Status configuration
 * @returns MigrationStatus with applied/pending/current info
 *
 * @example
 * ```ts
 * const status = await getMigrationStatus(driver);
 * console.log(`Pending: ${status.pending.length}, Current: ${status.current}`);
 * ```
 */
export declare function getMigrationStatus(driver: SurrealDriver): Promise<MigrationStatus>;
/**
 * Generate a migration from table definitions and apply it immediately.
 *
 * Combines migration generation and application in a single operation.
 *
 * @param driver - Connected SurrealDriver
 * @param tables - Table definitions to generate migration for
 * @param options - Generation and application options
 * @returns Output path and migration result
 *
 * @example
 * ```ts
 * const { outputPath, result } = await generateAndApplyMigration(driver, [userTable], {
 *   name: 'add_user_table',
 *   fullMigration: true,
 * });
 * ```
 */
export declare function generateAndApplyMigration(driver: SurrealDriver, tables: TableDefinition[], options: GenerateAndApplyOptions): Promise<{
    outputPath: string;
    result: MigrationResult;
}>;
/**
 * Pull schema from database, generate TypeScript schema file, and apply init migration.
 *
 * This is the programmatic version of `pullSchema()` from `cli/pull.ts`.
 * Accepts an existing driver instead of creating a new connection.
 *
 * @param driver - Connected SurrealDriver (NodeDriver or EmbeddedDriver)
 * @param options - Pull and migrate options
 * @returns Schema output path and migration result
 *
 * @example
 * ```ts
 * const { schemaPath, result } = await pullAndMigrate(driver, {
 *   outputDir: './schema',
 *   migrationName: 'init_from_db',
 * });
 * ```
 */
export declare function pullAndMigrate(driver: SurrealDriver, options?: PullAndMigrateOptions): Promise<{
    schemaPath: string;
    result: MigrationResult;
}>;
//# sourceMappingURL=api.d.ts.map