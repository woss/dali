/**
 * Migration API - Programmatic migration operations for DaliORM
 *
 * High-level API that accepts SurrealDriver instances directly.
 * Works with both NodeDriver (remote) and EmbeddedDriver (local).
 *
 * @module dali-orm/migration/api
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { EmbeddedConfig, SurrealDriver } from '../sdk/driver/types.js';
import type { AccessConfig, EventConfig, FunctionConfig } from '../sdk/schema.js';
import type { AnalyzerDefinition, TableDefinition } from '../sdk/table.js';
import type { GenerateOptions } from './cli/generate.js';
import { generateFullMigration, generateMigration, generateMigrationFile } from './cli/generate.js';
import { generateColumnDefinition } from './cli/pull.js';
import { tablesToDdl } from './cli/push.js';
import { SurrealQLGenerator } from './core/generator.js';
import { type MigrationResult, MigrationRunner, type MigrationStatus } from './core/runner.js';
import type { DdlDiffResult } from './ddl/ddl.js';
import { ddlDiff } from './ddl/diff.js';
import { introspectDatabase } from './ddl/introspect.js';

// ============================================================================
// Re-exports
// ============================================================================

export {
  type GenerateOptions,
  generateFullMigration,
  generateLiveMigration,
  generateMigration,
  generateMigrationFile,
  generateSnapshotMigration,
  getLiveSchema,
  loadSchemaFiles,
  loadSchemaFromFile,
  type SchemaFilesResult,
} from './cli/generate.js';

export {
  createRunner,
  type MigrationResult,
  MigrationRunner,
  type MigrationStatus,
  type RunnerConfig,
} from './core/runner.js';

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
export async function pushSchemaFromTableDefs(
  driver: SurrealDriver,
  tables: TableDefinition[],
  options: PushSchemaOptions & {
    access?: AccessConfig[];
    events?: EventConfig[];
    functions?: FunctionConfig[];
  } = {},
): Promise<DdlDiffResult> {
  // Guard: fail fast if no tables
  if (!tables.length) {
    throw new Error('No table definitions provided for schema push');
  }

  // Guard: driver must be connected
  if (!driver.isConnected()) {
    await driver.connect();
  }

  // Introspect current database schema
  const currentDdl = await introspectDatabase(driver);

  // Convert user tables to DDL format
  const targetDdl = tablesToDdl(tables, options.access, options.events, options.functions);

  // Calculate diff
  const diffResult = await ddlDiff(currentDdl, targetDdl, 'push');

  // Apply changes if not dry run
  if (!options.dryRun) {
    for (const stmt of diffResult.sqlStatements) {
      if (stmt && !stmt.startsWith('--')) {
        await driver.query(stmt);
      }
    }
  }

  return diffResult;
}

// ============================================================================
// Auto-discovery helpers
// ============================================================================

/**
 * Get caller's directory from V8 stack trace.
 * Walks up `skipFrames` frames from this function to find the actual caller.
 */
function getCallerDir(skipFrames: number = 0): string {
  const err = new Error();
  const stack = err.stack?.split('\n');
  // stack[0] = "Error"
  // stack[skipFrames+1] = this function (getCallerDir)
  // stack[skipFrames+2] = the function we want the caller of
  if (!stack || stack.length < skipFrames + 3) {
    throw new Error(
      'Cannot determine caller directory from stack trace. ' +
        'Ensure dali-orm.config.ts exists in your project root.',
    );
  }
  const frame = stack[skipFrames + 2].trim();
  // Parse "at functionName (/path/file.ts:line:col)" or "at /path/file.ts:line:col"
  const match = frame.match(/\((.+?):\d+:\d+\)/) || frame.match(/at (.+?):\d+:\d+/);
  if (!match) {
    throw new Error(`Cannot parse caller location from stack frame: ${frame}`);
  }
  return path.dirname(match[1]);
}

/**
 * Check if dali-orm.config.ts exists in the given directory.
 */
async function configExists(dir: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, 'dali-orm.config.ts'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Walk up from startDir until dali-orm.config.ts is found.
 * Returns the directory containing the config file.
 * Throws if not found after reaching filesystem root.
 */
async function walkUpForConfig(dir: string): Promise<string | null> {
  let currentDir = path.resolve(dir);
  for (let i = 0; i < 20; i++) {
    if (await configExists(currentDir)) {
      return currentDir;
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break; // reached filesystem root
    currentDir = parent;
  }
  return null;
}

/**
 * Internal test override for config directory.
 * @internal NOT part of public API - for testing only.
 */
let _testConfigDir: string | undefined;

/**
 * @internal - for testing only
 */
export function _setTestConfigDir(dir: string | undefined): void {
  _testConfigDir = dir;
}

/**
 * Resolve config directory by trying:
 * 1. Internal test override
 * 2. CWD walk-up
 * 3. Caller stack trace walk-up
 * Throws if no config found.
 */
async function resolveConfigDir(): Promise<string> {
  // Priority 1: internal test override
  if (_testConfigDir) {
    return _testConfigDir;
  }

  // Priority 2: CWD walk-up
  const cwd = process.cwd();
  const fromCwd = await walkUpForConfig(cwd);
  if (fromCwd) return fromCwd;

  // Priority 3: caller stack trace walk-up
  let callerDir: string;
  try {
    callerDir = getCallerDir(2);
  } catch {
    throw new Error(
      'No dali-orm.config.ts found. ' +
        'Cannot determine caller directory from stack. ' +
        'Ensure dali-orm.config.ts exists in your project root.',
    );
  }
  const fromCaller = await walkUpForConfig(callerDir);
  if (fromCaller) return fromCaller;

  throw new Error(
    'No dali-orm.config.ts found. ' +
      'Searched from CWD (' +
      cwd +
      ') and caller stack (' +
      callerDir +
      '). ' +
      'Create one in your project root with connection settings.',
  );
}

export interface ApiPullOptions {
  /** Specific table to pull (pulls all if undefined) */
  table?: string;
  /** Output directory for schema files */
  outputDir?: string;
  /** Embedded driver configuration (mode, path) */
  embeddedConfig?: EmbeddedConfig;
}

// ============================================================================
// High-level migration API functions
// ============================================================================

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
export async function migrateToDatabase(driver: SurrealDriver): Promise<MigrationResult> {
  // Guard: driver must be connected or able to connect
  if (!driver.isConnected()) {
    await driver.connect();
  }

  const configDir = await resolveConfigDir();

  const runner = new MigrationRunner(driver, {
    migrationsDir: path.join(configDir, 'migrations'),
    migrationsTable: '__migrations',
    journalDir: path.join(configDir, 'meta'),
  });

  await runner.init();
  return runner.up();
}

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
export async function getMigrationStatus(driver: SurrealDriver): Promise<MigrationStatus> {
  // Guard: driver must be connected
  if (!driver.isConnected()) {
    await driver.connect();
  }

  const configDir = await resolveConfigDir();

  const runner = new MigrationRunner(driver, {
    migrationsDir: path.join(configDir, 'migrations'),
    migrationsTable: '__migrations',
    journalDir: path.join(configDir, 'meta'),
  });

  return runner.status();
}

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
export async function generateAndApplyMigration(
  driver: SurrealDriver,
  tables: TableDefinition[],
  options: GenerateAndApplyOptions,
): Promise<{ outputPath: string; result: MigrationResult }> {
  // Guard: fail fast if no tables
  if (!tables.length) {
    throw new Error('No tables provided for migration generation');
  }

  // Guard: fail fast if no name
  if (!options.name) {
    throw new Error('Migration name is required');
  }

  // Guard: driver must be connected
  if (!driver.isConnected()) {
    await driver.connect();
  }

  const configDir = await resolveConfigDir();
  const outputDir = options.outputDir ?? path.join(configDir, 'migrations');

  // Generate migration file
  const generateOptions: GenerateOptions = {
    name: options.name,
    outputDir,
    fullMigration: options.fullMigration,
    snapshotDir: options.snapshotDir,
    driver: options.fullMigration ? undefined : driver,
  };

  const outputPath = await generateMigration(
    tables,
    generateOptions,
    options.access,
    options.events,
    options.functions,
    options.analyzers,
  );

  // Guard: no changes detected
  if (!outputPath) {
    throw new Error('No schema changes detected. Migration not generated.');
  }

  // Apply migration
  const runner = new MigrationRunner(driver, {
    migrationsDir: outputDir,
    journalDir: path.join(configDir, 'meta'),
  });

  await runner.init();
  const result = await runner.up();

  return { outputPath, result };
}

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
export async function pullAndMigrate(
  driver: SurrealDriver,
  options: PullAndMigrateOptions = {},
): Promise<{ schemaPath: string; result: MigrationResult }> {
  // Guard: driver must be connected
  if (!driver.isConnected()) {
    await driver.connect();
  }

  const configDir = await resolveConfigDir();
  const outputDir = options.outputDir ?? path.join(configDir, 'src');
  const absoluteOutputDir = path.resolve(process.cwd(), outputDir);

  // Introspect database
  const ddl = await introspectDatabase(driver, {
    onlyTables: options.table ? [options.table] : undefined,
  });

  // Guard: no tables found
  if (ddl.tables.length === 0) {
    throw new Error('No tables found in database. Nothing to pull.');
  }

  // Generate TypeScript schema content
  const schemaContent = generateTypeScriptSchema(ddl, options.table);
  const filename = options.table ? `${options.table}.schema.ts` : 'schema.ts';
  const schemaPath = path.join(absoluteOutputDir, filename);

  // Write schema file
  await fs.mkdir(absoluteOutputDir, { recursive: true });
  await fs.writeFile(schemaPath, schemaContent, 'utf-8');

  // Convert DDL tables to TableDefinition[]
  const tablesAsTableDef: TableDefinition[] = ddl.tables.map((table) => ({
    name: table.name,
    columns: table.columns.map((col) => ({
      name: col.name,
      tableName: table.name,
      config: {
        type: col.kind ?? 'string',
        optional: col.optional,
        default: col.default as string | undefined,
        flexible: col.flex,
        readonly: col.readonly,
      },
    })),
    config: {
      schema: 'full' as const,
      type: 'normal' as const,
    },
  }));

  // Generate migration SQL
  const generator = new SurrealQLGenerator();

  // Use provided access or introspect from DB
  let accessForMigration: string[] = [];
  if (options.access && options.access.length > 0) {
    const tablesRecord = Object.fromEntries(ddl.tables.map((t) => [t.name, t]));
    for (const acc of options.access) {
      const sql = acc.type
        ? (await import('../sdk/schema.js')).accessToSQL(
            acc,
            tablesRecord as unknown as Record<string, import('../sdk/table.js').TableDefinition>,
          )
        : undefined;
      if (sql) {
        accessForMigration.push(sql);
      }
    }
  } else if (ddl.access.length > 0) {
    accessForMigration = [...ddl.access];
  }

  const { upStatements } = generateFullMigration(
    tablesAsTableDef,
    generator,
    options.access,
  );

  // Inject raw access SQL from DB introspection
  if (accessForMigration.length > 0 && ddl.access.length > 0) {
    for (const sql of ddl.access) {
      upStatements.push(sql);
      // REMOVE ACCESS not generated — down migrations removed
    }
  }

  // Guard: no SQL generated
  if (upStatements.length === 0) {
    throw new Error('No SQL generated for migration.');
  }

  // Write migration file
  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:Z.]/g, '')
    .slice(0, 14);
  const migrationsDir = path.join(configDir, 'migrations');
  await fs.mkdir(migrationsDir, { recursive: true });

  const migrationName = options.migrationName ?? 'init_from_pull';
  const safeName = migrationName.toLowerCase().replace(/\s+/g, '_');
  const migrationDir = path.join(migrationsDir, `${timestamp}_${safeName}`);
  const migrationFilePath = path.join(migrationDir, 'migration.surql');

  const migrationContent = generateMigrationFile(timestamp, migrationName, {
    up: upStatements,
  });

  await fs.mkdir(migrationDir, { recursive: true });
  await fs.writeFile(migrationFilePath, migrationContent, 'utf-8');
  console.log(`Migration generated: ${migrationDir}`);

  // Apply migration
  const runner = new MigrationRunner(driver, {
    migrationsDir,
    migrationsTable: '__migrations',
    journalDir: path.join(configDir, 'meta'),
  });

  await runner.init();
  const result = await runner.up();

  return { schemaPath, result };
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Generate TypeScript schema content from DDL introspection result.
 * Extracted from pull.ts for reuse in API functions.
 */
function generateTypeScriptSchema(
  ddl: {
    tables: Array<{
      name: string;
      columns: Array<{
        name: string;
        kind?: string;
        optional?: boolean;
        default?: unknown;
        flexible?: boolean;
        readonly?: boolean;
        recordTable?: string;
      }>;
    }>;
  },
  tableName?: string,
): string {
  const needsDateTime = ddl.tables.some((t) => t.columns.some((c) => c.kind === 'datetime'));
  const needsNumber = ddl.tables.some((t) =>
    t.columns.some((c) => c.kind === 'int' || c.kind === 'float' || c.kind === 'decimal'),
  );
  const needsBool = ddl.tables.some((t) => t.columns.some((c) => c.kind === 'bool'));
  const needsRecord = ddl.tables.some((t) => t.columns.some((c) => c.recordTable));
  const needsArray = ddl.tables.some((t) => t.columns.some((c) => c.kind === 'array'));

  const imports = [
    `import { defineTable } from '@woss/dali-orm/sdk/table';`,
    needsDateTime
      ? `import { datetime } from '@woss/dali-orm/sdk/schema/column/simple-builders';`
      : '',
    needsNumber ? `import { int } from '@woss/dali-orm/sdk/schema/column/simple-builders';` : '',
    needsBool ? `import { bool } from '@woss/dali-orm/sdk/schema/column/simple-builders';` : '',
    needsArray ? `import { array } from '@woss/dali-orm/sdk/schema/column/simple-builders';` : '',
    needsRecord ? `import { record } from '@woss/dali-orm/sdk/schema/column/record';` : '',
    `import { string } from '@woss/dali-orm/sdk/schema/column/simple-builders';`,
  ]
    .filter(Boolean)
    .join('\n');

  const lines: string[] = [
    `// Generated schema${tableName ? ` for ${tableName}` : ''}`,
    '// DO NOT EDIT - run pull to regenerate',
    '',
    imports,
    '',
  ];

  const schemaExports: string[] = [];

  for (const table of ddl.tables) {
    lines.push(`export const ${table.name}Schema = defineTable('${table.name}', {`);
    schemaExports.push(`${table.name}: ${table.name}Schema`);

    for (const column of table.columns) {
      const columnDef = generateColumnDefinition({
        name: column.name,
        kind: column.kind as any,
        optional: column.optional,
        default: column.default,
        flexible: column.flexible,
        readonly: column.readonly,
        recordTable: column.recordTable,
      });
      lines.push(`  ${columnDef},`);
    }

    lines.push('});');
    lines.push('');
  }

  if (schemaExports.length > 0) {
    lines.push('export default {');
    for (const exportEntry of schemaExports) {
      lines.push(`  ${exportEntry},`);
    }
    lines.push('};');
    lines.push('');
  }

  return lines.join('\n');
}
