import type { SurrealDriver } from '../../sdk/driver/types.js';
import {
  createConnection,
  createConnectionWithTimeout,
  formatError,
  safeDisconnect,
} from './operations.js';
import type { Config } from '../config.js';
import { MigrationRunner } from '../core/runner.js';
import { connectToShadow, destroyShadow, validateWithShadow } from '../core/shadow.js';
import { generateMigration, loadSchemaFiles } from './generate.js';

export interface MigrateOptions {
  to?: string; // Target version
  steps?: number; // Number of steps to migrate down
  dryRun?: boolean; // Show what would be executed
  force?: boolean; // Force operation
  config: Config;
  autoResume?: boolean; // Auto-resume partial migrations (default from config)
  embeddedDriver?: boolean; // Use embedded driver instead of node driver
}

/**
 * Run pending migrations
 */
export async function migrateUp(options: MigrateOptions, driver?: SurrealDriver): Promise<void> {
  const { config, embeddedDriver } = options;

  let ownsDriver = false;
  if (!driver) {
    ownsDriver = true;
    driver = await createConnection(config, embeddedDriver);
  }

  try {
    const runner = new MigrationRunner(driver, {
      migrationsTable: config.migrations?.table ?? '__migrations',
      migrationsDir: config.migrations?.dir,
      journalDir: config.migrations?.journalDir,
    });

    // Initialize if needed
    await runner.init();

    const status = await runner.status();

    console.log('\n  Migration Status');
    console.log('');

    if (status.applied.length > 0) {
      console.log(`  Applied (${status.applied.length}):`);
      for (const m of status.applied) {
        const isCurrent = m.version === status.current;
        const suffix = isCurrent ? '  ◀ current' : '';
        // Show shorter time (HH:MM:SS) and mark the current one
        const time = m.appliedAt.includes('T')
          ? (m.appliedAt.split('T')[1]?.split('.')[0] ?? m.appliedAt)
          : m.appliedAt;
        console.log(`    ✔ ${m.version} — ${m.name} (${time})${suffix}`);
      }
    } else {
      console.log('  No migrations applied');
    }

    // Show partial migrations with progress
    const partialMigrations = await runner.findPartialMigrations();
    if (partialMigrations.length > 0) {
      console.log(`\n  Partial (${partialMigrations.length}):`);
      for (const partialName of partialMigrations) {
        const progress = await getMigrationProgressString(runner, partialName);
        console.log(`    ◐ ${partialName}: ${progress}`);
      }
    }

    if (status.pending.length > 0) {
      console.log(`\n  Pending (${status.pending.length}):`);
      for (const m of status.pending) {
        console.log(`    ○ ${m.version} — ${m.name}`);
      }
    }

    // Apply pending migrations
    if (status.pending.length > 0) {
      console.log(`\n  Applying ${status.pending.length} pending migration(s)...`);
      const result = await runner.up(options.to);
      console.log(`\n  ✔ Applied ${result.applied.length} migration(s):`);
      for (const name of result.applied) {
        console.log(`    ✓ ${name}`);
      }
      if (result.skipped.length > 0) {
        console.log(`\n  ○ Skipped ${result.skipped.length} migration(s) (beyond target)`);
      }
    } else {
      console.log('\n  No pending migrations to apply.');
    }
  } catch (error) {
    console.error('migrateUp error:', error);
  } finally {
    if (ownsDriver) {
      await safeDisconnect(driver);
    }
  }
}

/**
 * Sync journal from database state
 */
export async function migrateSync(
  options: {
    config: Config;
    embeddedDriver?: boolean;
  },
  driver?: SurrealDriver,
): Promise<void> {
  const { config, embeddedDriver } = options;
  let ownsDriver = false;

  try {
    if (!driver) {
      ownsDriver = true;
      driver = await createConnection(config, embeddedDriver);
    }

    try {
      const runner = new MigrationRunner(driver, {
        migrationsTable: config.migrations?.table ?? '__migrations',
        migrationsDir: config.migrations?.dir,
        journalDir: config.migrations?.journalDir,
      });

      await runner.init();
      await runner.syncJournalWithDb();
      console.log('✔ Journal synced from database');
    } finally {
      if (ownsDriver) {
        await safeDisconnect(driver);
      }
    }
  } catch (error) {
    console.error('migrateSync error:', error);
    process.exit(1);
  }
}

/**
 * Resume a partially applied migration
 */
export async function migrateResume(
  options: {
    config: Config;
    dryRun?: boolean;
    embeddedDriver?: boolean;
  },
  driver?: SurrealDriver,
): Promise<void> {
  const { config, dryRun, embeddedDriver } = options;
  let ownsDriver = false;

  if (!driver) {
    ownsDriver = true;
    driver = await createConnection(config, embeddedDriver);
  }

  try {
    const runner = new MigrationRunner(driver, {
      migrationsTable: config.migrations?.table ?? '__migrations',
      migrationsDir: config.migrations?.dir,
      journalDir: config.migrations?.journalDir,
    });

    // Initialize if needed
    await runner.init();

    // Check for partial migrations
    const partialMigrations = await runner.findPartialMigrations();

    if (partialMigrations.length === 0) {
      console.log('No partial migrations found to resume');
      console.log('\nAll migrations are complete.');
      return;
    }

    // Show what will be resumed
    console.log('Partial migration(s) to resume:');
    for (const partialName of partialMigrations) {
      const progress = await getMigrationProgressString(runner, partialName);
      console.log(`  ◐ ${partialName}: ${progress}`);
    }

    if (dryRun) {
      console.log('\nDry run - would resume the above migration(s)');
      return;
    }

    // Resume with progress display
    await handleResumeWithProgress(runner);

    console.log('\nAll partial migrations completed.');
  } catch (error) {
    console.error(`Resume failed: ${(error as Error).message}`);
    throw error;
  } finally {
    if (ownsDriver) {
      await safeDisconnect(driver);
    }
  }
}

/**
 * Get migration progress as string (e.g., "3/7 statements applied")
 */
export async function getMigrationProgressString(
  runner: MigrationRunner,
  migrationName: string,
): Promise<string> {
  const progress = await runner.getMigrationProgress(migrationName);

  // Guard: migration not found
  if (!progress) {
    return 'unknown (file not found)';
  }

  // Guard: no statements
  if (progress.totalStatements === 0) {
    return 'no statements';
  }

  return `${progress.appliedStatements}/${progress.totalStatements} statements applied`;
}

/**
 * Handle resume with progress display
 */
export async function handleResumeWithProgress(runner: MigrationRunner): Promise<void> {
  const progressList = await runner.getPartialMigrationsProgress();

  for (const progress of progressList) {
    const migrationFiles = await runner.getMigrationFiles();
    const migration = migrationFiles.find((f) => f.name === progress.name);

    if (!migration) {
      console.log(`Warning: Migration file not found for ${progress.name}, skipping.`);
      continue;
    }

    const startFrom = progress.appliedStatements + 1;
    const total = progress.totalStatements;

    console.log(`\nResuming migration ${progress.name} from statement ${startFrom}/${total}`);

    // Resume the migration
    await runner.resume(migration);

    // Show checkpoint progress after each statement
    for (let i = startFrom; i <= total; i++) {
      console.log(`  ✔ Statement ${i}/${total} applied`);
    }

    console.log(`  ✔ Migration ${progress.name} completed`);
  }
}

/**
 * migrate dev — Generate + validate + apply migration.
 * Like Prisma's migrate dev: creates migration, validates on shadow, applies to target.
 * No changes = stops (no empty migration).
 */
export async function migrateDev(
  options: MigrateOptions & { name: string },
  driver?: SurrealDriver,
): Promise<void> {
  const { config, name } = options;
  let ownsDriver = false;

  // 1. Load schema files
  console.log('Loading schema...');
  const schemaDir = config.schema?.dir ?? './schema';
  const schemaFiles = await loadSchemaFiles(schemaDir, config.schema?.pattern);

  if (schemaFiles.tables.length === 0) {
    console.log('No schema tables found. Nothing to migrate.');
    return;
  }

  // 2. Generate migration with live DB comparison
  console.log('Generating migration...');

  // Try to connect to database for live schema comparison
  let liveDriver: SurrealDriver | undefined;
  let snapshotDir = config.snapshots?.dir;

  if (config.url || config.namespace || config.database) {
    try {
      if (!driver) {
        ownsDriver = true;
        liveDriver = await createConnectionWithTimeout(config);
      } else {
        liveDriver = driver;
      }
      console.log('Connected to database for live schema comparison');
    } catch (error) {
      const errorMessage = formatError(error);
      console.log('[WARN] Could not connect to database:', errorMessage);
      console.log('[INFO] Falling back to snapshot-based comparison');
      snapshotDir = config.snapshots?.dir;
    }
  } else {
    console.log('[INFO] No database configuration found');
    console.log('[INFO] Generating full migration (not incremental)');
    // Leave snapshotDir as-is (config.snapshots?.dir) so generateMigration falls back
    // to full generation when no snapshot is configured (instead of forcing default path
    // that triggers snapshot-based comparison with an empty snapshot dir).
  }

  const outputPath = await generateMigration(
    schemaFiles.tables,
    {
      name,
      outputDir: config.migrations?.dir,
      fullMigration: false,
      snapshotDir,
      driver: liveDriver,
    },
    schemaFiles.access,
    undefined,
    schemaFiles.functions,
  );

  // Clean up driver connection if used
  if (ownsDriver && liveDriver) {
    await safeDisconnect(liveDriver);
  }

  // 3. No new changes — still apply pending migrations
  if (!outputPath) {
    console.log('No new schema changes detected. Applying pending migrations...');
  } else {
    console.log(`Migration generated: ${outputPath}`);
  }

  // 4. Shadow validation (optional — skip if no shadow config)
  const shadow = config.shadow;
  if (shadow) {
    console.log(`Validating on shadow (${shadow.namespace}/${shadow.database})...`);
    const shadowDriver = await connectToShadow(config, shadow);
    try {
      // Destroy any leftover shadow state from previous runs
      await destroyShadow(shadowDriver, shadow);

      // Reconnect after destroy (REMOVE DATABASE invalidates the connection)
      // Actually, after REMOVE DATABASE, we need to reconnect because the db is gone
      // Let's destroy first, then connect fresh for validation
    } finally {
      await safeDisconnect(shadowDriver);
    }

    // Fresh connect for validation
    const validateDriver = await connectToShadow(config, shadow);
    try {
      const result = await validateWithShadow(validateDriver, {
        migrationsDir: config.migrations?.dir,
        migrationsTable: config.migrations?.table,
        journalDir: config.migrations?.journalDir,
      });

      if (!result.success) {
        console.error('\n❌ Shadow validation FAILED — target DB untouched.');
        for (const err of result.errors) {
          console.error(`   Error: ${err}`);
        }
        throw new Error('Shadow validation failed — target DB was not modified.');
      }

      console.log(
        `✓ Shadow validation passed (${result.appliedCount} migrations applied on shadow)`,
      );
    } finally {
      await destroyShadow(validateDriver, shadow);
      await safeDisconnect(validateDriver);
    }
  } else {
    console.log('No shadow config — applying directly to target.');
  }

  // 5. Apply to target
  console.log('Applying to target database...');
  const targetDriver = await createConnection(config);

  try {
    const runner = new MigrationRunner(targetDriver, {
      migrationsDir: config.migrations?.dir,
      migrationsTable: config.migrations?.table ?? '__migrations',
      journalDir: config.migrations?.journalDir,
    });

    await runner.init();
    const result = await runner.up();

    console.log(`\n✓ Applied ${result.applied.length} migration(s) to target:`);
    for (const name of result.applied) {
      console.log(`  ✓ ${name}`);
    }
  } finally {
    await safeDisconnect(targetDriver);
  }
}

/**
 * migrate deploy — Apply pending migrations with shadow validation.
 * REQUIRES shadow config — fails hard if not set.
 */
export async function migrateDeploy(
  options: MigrateOptions,
  _driver?: SurrealDriver,
): Promise<void> {
  const { config } = options;
  // _driver param accepted for injection API consistency;
  // internal connections remain unchanged since they span 3 separate databases (shadow cleanup, shadow validation, target)

  // 1. Require shadow config
  const shadow = config.shadow;
  if (!shadow) {
    throw new Error(
      'migrate deploy requires shadow configuration in your config file.\n' +
        'Add shadow: { namespace: "your_shadow_ns", database: "your_shadow_db" } to your config.',
    );
  }

  // 2. Validate pending migrations on shadow
  console.log(
    `Validating pending migrations on shadow (${shadow.namespace}/${shadow.database})...`,
  );

  // Destroy any leftover shadow state first
  const cleanupDriver = await connectToShadow(config, shadow);
  try {
    await destroyShadow(cleanupDriver, shadow);
  } finally {
    await safeDisconnect(cleanupDriver);
  }

  // Fresh connect for validation
  const validateDriver = await connectToShadow(config, shadow);
  try {
    const result = await validateWithShadow(validateDriver, {
      migrationsDir: config.migrations?.dir,
      migrationsTable: config.migrations?.table,
      journalDir: config.migrations?.journalDir,
    });

    if (!result.success) {
      console.error('\n❌ Shadow validation FAILED — target DB untouched.');
      for (const err of result.errors) {
        console.error(`   Error: ${err}`);
      }
      throw new Error('Shadow validation failed — target DB was not modified.');
    }

    console.log(`✓ Shadow validation passed (${result.appliedCount} migrations applied on shadow)`);
  } finally {
    await destroyShadow(validateDriver, shadow);
    await safeDisconnect(validateDriver);
  }

  // 3. Apply to target
  console.log('Applying to target database...');
  const targetDriver = await createConnection(config);

  try {
    const runner = new MigrationRunner(targetDriver, {
      migrationsDir: config.migrations?.dir,
      migrationsTable: config.migrations?.table ?? '__migrations',
      journalDir: config.migrations?.journalDir,
    });

    await runner.init();
    const result = await runner.up();

    console.log(`\n✓ Applied ${result.applied.length} migration(s) to target:`);
    for (const name of result.applied) {
      console.log(`  ✓ ${name}`);
    }
  } finally {
    await safeDisconnect(targetDriver);
  }
}
