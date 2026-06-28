#!/usr/bin/env node

import * as path from 'node:path';
import { createDebug as debug } from 'obug';
import type { SurrealDriver } from '../sdk/driver/types.js';
import {
  createConnection,
  createConnectionWithTimeout,
  formatError,
  safeDisconnect,
} from './cli/operations.js';
import { diffSchema } from './cli/diff.js';
import { generateMigration, loadSchemaFiles } from './cli/generate.js';
import { MigrationRunner } from './core/runner.js';
import { migrateDeploy, migrateDev, migrateResume, migrateSync, migrateUp } from './cli/migrate.js';
import { pullSchema } from './cli/pull.js';
import { pushSchema } from './cli/push.js';
import { loadConfig } from './config.js';
import type { Config } from './config.js';

const log = debug('dali-orm:kit:cli');

interface CLIOptions {
  config?: string;
  dryRun?: boolean;
  force?: boolean;
  offline?: boolean;
  to?: string;
  steps?: number;
  output?: string;
  name?: string;
  schema?: string;
  version?: string;
  /** Snapshot directory for incremental migrations (default: ./meta/snapshots) */
  snapshots?: string;
  /** Generate full migration (ignore snapshots) */
  full?: boolean;
  /** Verbose output (for diff command) */
  verbose?: boolean;
}

/**
 * Convert text to snake_case for migration names.
 * "add user table" → "add_user_table"
 * "Fix Bug!" → "fix_bug"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Main CLI entry point
 */
if (!process.env.VITEST) {
  process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason instanceof Error ? reason.message : reason);
  });
  process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION:', error.message);
  });
}

export async function main(argv?: string[]): Promise<void> {
  const args = argv ?? process.argv.slice(2);
  const command = args[0];

  if (!command) {
    printHelp();
    process.exit(0);
  }

  // Parse global options
  const globalOptions = parseGlobalOptions(args);
  const config = await loadConfig(globalOptions.config);

  try {
    switch (command) {
      case 'migrate':
        await handleMigrate(args.slice(1), globalOptions, config);
        break;

      case 'generate':
        await handleGenerate(args.slice(1), globalOptions, config);
        break;

      case 'pull':
        await handlePull(args.slice(1), globalOptions, config);
        break;

      case 'diff':
        await handleDiff(args.slice(1), globalOptions, config);
        break;

      case 'query':
        await handleQuery(args.slice(1), globalOptions, config);
        break;

      case 'init':
        console.log('Initializing DaliORM project...');
        // Create default config and schema directory
        break;

      case 'help':
      case '--help':
      case '-h':
        printHelp();
        break;

      case '--version':
      case '-v':
        console.log('dali-orm v0.1.0');
        break;

      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function handleMigrate(args: string[], options: CLIOptions, config: Config) {
  const subcommand = args[0];
  log('handleMigrate called with args:', args);
  log('subcommand:', subcommand);
  log('options:', options);

  log('config loaded:', config);

  switch (subcommand) {
    case 'help':
    case '--help':
    case '-h':
      printMigrateHelp();
      break;

    case 'up':
      log('Running migrate up');
      await migrateUp({
        config,
        to: options.to,
        dryRun: options.dryRun,
      });
      break;

    case 'down': {
      log('Running migrate down');
      const downDriver = await createConnection(config);
      try {
        const downRunner = new MigrationRunner(downDriver, {
          migrationsDir: config.migrations?.dir,
          migrationsTable: config.migrations?.table ?? '__migrations',
          journalDir: config.migrations?.journalDir,
        });
        await downRunner.init();
        await downRunner.down(options.steps ?? 1);
        console.log(`✓ Rolled back ${options.steps ?? 1} migration(s)`);
      } finally {
        await safeDisconnect(downDriver);
      }
      break;
    }

    case 'reset': {
      log('Running migrate reset');
      const resetDriver = await createConnection(config);
      try {
        const resetRunner = new MigrationRunner(resetDriver, {
          migrationsDir: config.migrations?.dir,
          migrationsTable: config.migrations?.table ?? '__migrations',
          journalDir: config.migrations?.journalDir,
        });
        await resetRunner.init();
        await resetRunner.reset({ force: options.force });
        console.log('✓ All migrations rolled back');
      } finally {
        await safeDisconnect(resetDriver);
      }
      break;
    }

    case 'status': {
      log('Running migrate status');
      const statusDriver = await createConnection(config);
      try {
        await printMigrationStatus(statusDriver, config);
      } finally {
        await safeDisconnect(statusDriver);
      }
      break;
    }

    case 'sync':
      log('Running migrate sync');
      await migrateSync({ config });
      break;

    case 'resume':
      log('Running migrate resume');
      await migrateResume({ config, dryRun: options.dryRun });
      break;

    case 'dev': {
      log('Running migrate dev');
      if (!options.name && !args[1]) {
        console.error('Usage: dali-orm migrate dev <name> [options]');
        console.error('  --name <name>    Migration name');
        process.exit(1);
      }
      const rawName = options.name ?? args[1];
      const slugName = slugify(rawName);
      if (rawName !== slugName) {
        console.log(`[INFO] Migration name slugified: "${rawName}" → "${slugName}"`);
      }
      await migrateDev({
        config,
        name: slugName,
        dryRun: options.dryRun,
      });
      break;
    }

    case 'deploy':
      log('Running migrate deploy');
      await migrateDeploy({
        config,
        dryRun: options.dryRun,
      });
      break;

    default: {
      // Default to status
      log('No subcommand provided, defaulting to status');
      const statusDriver = await createConnection(config);
      try {
        await printMigrationStatus(statusDriver, config);
      } finally {
        await safeDisconnect(statusDriver);
      }
      break;
    }
  }
}

/**
 * Print migration status to console using a connected driver.
 * Extracted to avoid duplicating status display logic.
 */
async function printMigrationStatus(statusDriver: SurrealDriver, config: Config): Promise<void> {
  const statusRunner = new MigrationRunner(statusDriver, {
    migrationsDir: config.migrations?.dir,
    migrationsTable: config.migrations?.table ?? '__migrations',
    journalDir: config.migrations?.journalDir,
  });
  await statusRunner.init();
  const status = await statusRunner.status();
  console.log('\n  Migration Status');
  console.log('');
  if (status.applied.length > 0) {
    console.log(`  Applied (${status.applied.length}):`);
    for (const m of status.applied) {
      const isCurrent = m.version === status.current;
      const suffix = isCurrent ? '  ◀ current' : '';
      const time = m.appliedAt.includes('T')
        ? (m.appliedAt.split('T')[1]?.split('.')[0] ?? m.appliedAt)
        : m.appliedAt;
      console.log(`    ✔ ${m.version} — ${m.name} (${time})${suffix}`);
    }
  } else {
    console.log('  No migrations applied');
  }
  if (status.pending.length > 0) {
    console.log(`\n  Pending (${status.pending.length}):`);
    for (const m of status.pending) {
      console.log(`    ○ ${m.version} — ${m.name}`);
    }
  }
}

async function handleGenerate(args: string[], options: CLIOptions, config: Config) {
  // Parse positional arguments and options
  let name: string | undefined;
  let schemaPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('-')) {
      name = slugify(arg);
    }
  }

  // Override with explicit options if provided
  if (options.name) {
    name = slugify(options.name);
  }
  if (options.schema) {
    schemaPath = options.schema;
  }

  if (!name) {
    console.error('Usage: dali-orm generate <name> [options]');
    console.error('Options:');
    console.error('  --name <name>       Migration name');
    console.error('  --schema <path>     Schema file or directory');
    console.error('  --output <path>    Output directory (default: ./migrations)');
    console.error('  --version <ver>    Version number');
    console.error(
      '  --offline          Skip database connection, use snapshot comparison if available',
    );
    process.exit(1);
  }

  log('Config loaded: %O', { ...config, auth: config.auth ? '***' : undefined });
  const schemaDir = schemaPath ?? config.schema?.dir ?? './schema';
  log('Schema dir: %s', schemaDir);
  log('Schema pattern: %s', config.schema?.pattern);
  const schemaPattern = config.schema?.pattern ?? '**/*.ts';
  const schemaFiles = await loadSchemaFiles(schemaDir, schemaPattern);
  log('Schema files loaded: %d tables', schemaFiles.tables.length);
  log(
    'Table names: %O',
    schemaFiles.tables.map((t) => t.name),
  );

  if (schemaFiles.tables.length === 0) {
    console.error(`No schema tables found in ${schemaDir}`);
    process.exit(1);
  }

  // Try to connect to database for live schema comparison
  let driver: SurrealDriver | undefined;

  // Skip connection if --offline flag is set
  if (options.offline) {
    console.log('[INFO] Running in offline mode - skipping database connection');
    console.log('[INFO] Offline mode - using snapshot comparison');
  } else if (config.url || config.namespace || config.database) {
    try {
      driver = await createConnectionWithTimeout(config);
      log('Connected to database for live schema comparison');
    } catch (error) {
      const errorMessage = formatError(error);
      console.log('[WARN] Could not connect to database:', errorMessage);
      console.log('[INFO] Falling back to snapshot-based comparison');
      log('Connection failed, falling back to full generation:', error);
    }
  } else {
    console.log('[INFO] No database configuration found');
    console.log('[INFO] Generating full migration (not incremental)');
  }

  // Determine snapshot directory - prefer CLI option, then config, then default
  const resolvedSnapshotDir = options.snapshots
    ? path.resolve(options.snapshots)
    : (config.snapshots?.dir ?? path.resolve('./snapshots'));

  const outputPath = await generateMigration(
    schemaFiles.tables,
    {
      name,
      outputDir: options.output ?? config.migrations?.dir,
      version: options.version,
      driver,
      snapshotDir: resolvedSnapshotDir,
      fullMigration: options.full,
    },
    schemaFiles.access,
    undefined,
    schemaFiles.functions,
    schemaFiles.analyzers,
  );

  // Clean up connection
  if (driver) {
    log('Disconnecting from database');
    await safeDisconnect(driver);
  }

  if (outputPath) {
    console.log(`Migration created: ${outputPath}`);
  } else {
    console.log('No migration file was created');
  }
}

async function _handlePush(_args: string[], options: CLIOptions) {
  const config = await loadConfig(options.config);
  const schemaDir = options.schema ?? config.schema?.dir ?? './schema';
  const schemaFiles = await loadSchemaFiles(schemaDir, config.schema?.pattern);

  await pushSchema({
    config,
    tables: schemaFiles.tables,
    access: schemaFiles.access,
    functions: schemaFiles.functions,
    dryRun: options.dryRun,
    force: options.force,
  });
}

async function handlePull(args: string[], options: CLIOptions, config: Config) {
  await pullSchema({
    config,
    outputDir: options.output,
    table: args[0],
  });
}

async function handleDiff(_args: string[], options: CLIOptions, config: Config) {
  const schemaDir = options.schema ?? config.schema?.dir ?? './schema';
  const schemaFiles = await loadSchemaFiles(schemaDir, config.schema?.pattern);

  await diffSchema({
    config,
    tables: schemaFiles.tables,
    verbose: options.verbose,
  });
}

async function handleQuery(args: string[], options: CLIOptions, config: Config) {
  const query = args[0];
  if (!query) {
    console.error('Usage: dali-orm query "<SURREALQL>" [options]');
    process.exit(1);
  }

  const driver = await createConnection(config);

  try {
    const result = await driver.query(query);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await safeDisconnect(driver);
  }
}

export function parseGlobalOptions(args: string[]): CLIOptions {
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--config':
      case '-c':
        options.config = args[++i];
        break;
      case '--dry-run':
      case '-n':
        options.dryRun = true;
        break;
      case '--force':
      case '-f':
        options.force = true;
        break;
      case '--offline':
        options.offline = true;
        break;
      case '--to':
        options.to = args[++i];
        break;
      case '--steps':
        options.steps = parseInt(args[++i], 10);
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--name':
      case '-m':
        options.name = args[++i];
        break;
      case '--schema':
      case '-s':
        options.schema = args[++i];
        break;
      case '--version':
      case '-v':
        options.version = args[++i];
        break;
      case '--snapshots':
        options.snapshots = args[++i];
        break;
      case '--full':
        options.full = true;
        break;
      case '--verbose':
      case '-V':
        options.verbose = true;
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
DaliORM CLI

Usage:
  dali-orm <command> [options]

Commands:
  migrate [up|down|reset|status|sync|resume|dev|deploy]  Manage migrations
  generate <name>                  Generate a new migration
  pull [table]                    Pull schema from database
  diff                            Show schema diff between DB and schema.ts
  query "<SURREALQL>"             Run raw SurrealQL query
  init                            Initialize a new project
  help                            Show this help message

Options:
  -c, --config <path>    Config file path
  -n, --dry-run          Show what would be done without executing
  -f, --force            Skip confirmation prompts
  --to <version>         Target migration version
  --steps <n>            Number of migration steps
  -o, --output <path>    Output directory
  -m, --name <name>      Migration name (for generate, migrate dev)
  -s, --schema <path>    Schema file or directory (for generate)
  --version <ver>        Version number (for generate)
  --offline              Skip DB connection, use snapshot-based comparison (for generate)
  --snapshots <dir>      Snapshot directory for incremental migrations
  --full                 Generate full migration (ignore snapshots)
  -V, --verbose        Verbose output (for diff)

Examples:
  dali-orm migrate status
  dali-orm migrate up
  dali-orm migrate dev add_users_table
  dali-orm migrate dev "add user table"
  dali-orm migrate deploy
  dali-orm migrate down --steps 2
  dali-orm generate add_users_table
  dali-orm generate "create posts table"
  dali-orm generate --name create_posts --schema ./schema --output ./migrations
  dali-orm pull users
  `);
}

function printMigrateHelp() {
  console.log(`
Migrate Commands

Usage:
  dali-orm migrate <command> [options]

Commands:
  up                   Run pending migrations
  down                 Revert migrations
  reset                Revert all migrations
  status               Show migration status
  sync                 Sync journal from database state
  resume               Resume partial migrations
  dev <name>           Create migration from schema changes, validate with shadow, apply
  deploy               Apply pending migrations with shadow validation

Options:
  --to <version>       Target migration version (for up)
  --steps <n>          Number of migrations to revert (for down)
  -f, --force          Skip confirmation prompts
  --name <name>        Migration name (for dev)

Examples:
  dali-orm migrate up
  dali-orm migrate dev add_users_table
  dali-orm migrate deploy
  dali-orm migrate down --steps 2
  dali-orm migrate reset
  dali-orm migrate status
  `);
}

// Run CLI (only when not imported as module in tests)
if (!process.env.VITEST) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// main is already exported via `export async function main`
