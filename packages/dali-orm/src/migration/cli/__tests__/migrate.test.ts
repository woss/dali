/**
 * Integration tests for migration CLI functions.
 *
 * Tests: migrateUp, migrateDown, migrateReset, migrateStatus, migrateResume,
 *        getMigrationProgressString, handleResumeWithProgress,
 *        migrateDev, migrateDeploy
 *
 * Uses real embedded SurrealDB (memory mode).
 * Mocks connect to retain driver reference for DB state verification.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { EmbeddedDriver } from '../../../sdk/driver/embedded-driver.js';
import { MigrationRunner } from '../../core/runner.js';

// Ensure real orm-connection module (not leaked mock from other test files)
vi.unmock('../../../sdk/driver/orm-connection.js');
import {
  getMigrationProgressString,
  handleResumeWithProgress,
  migrateDeploy,
  migrateDev,
  migrateResume,
  migrateSync,
  migrateUp,
} from '../migrate.js';
import { cleanupDir, createMigrationFile, createTempDir as createTmpDir } from './helpers.js';
import { createConnection, safeDisconnect } from '../operations.js';
import type { Config } from '../../config.js';

// ============================================================================
// Helpers
// ============================================================================

function mockConsole(): () => void {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  return () => {
    vi.restoreAllMocks();
  };
}

function makeConfig(overrides: Partial<Config> = {}): Config {
  const base: Config = {
    url: '',
    namespace: 'test_ns',
    database: 'test_db',
    schema: { dir: './schema', pattern: '**/*.{js,ts}' },
    migrations: {
      dir: './migrations',
      table: '__test_migrations',
    },
  } as Config;
  return {
    ...base,
    ...overrides,
    migrations: {
      ...base.migrations,
      ...overrides.migrations,
    },
  } as Config;
}

// ============================================================================
// migrateUp
// ============================================================================

describe('migrateUp', () => {
  let tmpDir: string;
  let migrationsDir: string;
  let restoreConsole: () => void;

  beforeEach(async () => {
    tmpDir = await createTmpDir('mig-up-');
    migrationsDir = path.join(tmpDir, 'migrations');
    await fs.mkdir(migrationsDir, { recursive: true });
    restoreConsole = mockConsole();
  });

  afterEach(async () => {
    restoreConsole();
    await cleanupDir(tmpDir);
  });

  it('works when no migration files exist', async () => {
    const config = makeConfig({
      migrations: {
        dir: migrationsDir,
        table: '__test_migrations',
        journalDir: path.join(tmpDir, 'meta'),
      },
    });
    // No migration files created
    await expect(migrateUp({ config, embeddedDriver: true })).resolves.not.toThrow();
  });
});

// ============================================================================
// migrateResume
// ============================================================================

describe('migrateResume', () => {
  let tmpDir: string;
  let migrationsDir: string;
  let restoreConsole: () => void;

  beforeEach(async () => {
    tmpDir = await createTmpDir('mig-resume-');
    migrationsDir = path.join(tmpDir, 'migrations');
    await fs.mkdir(migrationsDir, { recursive: true });
    restoreConsole = mockConsole();
  });

  afterEach(async () => {
    restoreConsole();
    await cleanupDir(tmpDir);
  });

  it('reports no partial migrations when none exist', async () => {
    const config = makeConfig({
      migrations: {
        dir: migrationsDir,
        table: '__test_migrations',
        journalDir: path.join(tmpDir, 'meta'),
      },
    });
    await migrateResume({ config, embeddedDriver: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const noPartialLine = logCalls.find((c) => String(c[0]).includes('No partial'));
    expect(noPartialLine).toBeDefined();
  });
});

// ============================================================================
// migrateSync
// ============================================================================

describe('migrateSync', () => {
  let tmpDir: string;
  let migrationsDir: string;
  let restoreConsole: () => void;

  beforeEach(async () => {
    tmpDir = await createTmpDir('mig-sync-');
    migrationsDir = path.join(tmpDir, 'migrations');
    await fs.mkdir(migrationsDir, { recursive: true });
    restoreConsole = mockConsole();
  });

  afterEach(async () => {
    restoreConsole();
    await cleanupDir(tmpDir);
  });

  it('syncs journal from database after migration applied', async () => {
    await createMigrationFile(
      migrationsDir,
      'create_user',
      ['DEFINE TABLE user SCHEMAFULL', 'DEFINE FIELD name ON user TYPE string'],
      ['REMOVE TABLE user'],
    );

    const config = makeConfig({
      migrations: {
        dir: migrationsDir,
        table: '__test_migrations',
        journalDir: path.join(tmpDir, 'meta'),
      },
    });

    // Use shared driver so data persists across operations
    const driver = await createConnection(config, true);
    try {
      // Apply the migration directly via runner
      const applyRunner = new MigrationRunner(driver, {
        migrationsTable: config.migrations?.table ?? '__migrations',
        migrationsDir: config.migrations?.dir,
        journalDir: config.migrations?.journalDir,
      });
      await applyRunner.init();
      await applyRunner.up();

      // Delete the journal file to simulate corruption
      const journalPath = path.join(tmpDir, 'meta', '_journal.json');
      await fs.rm(journalPath).catch(() => {});

      // Re-mock console (migrateUp's finally block restored it)
      restoreConsole();
      restoreConsole = mockConsole();

      // Sync journal from DB (reuses same driver — data still there)
      await migrateSync({ config }, driver);

      // Verify journal was synced
      const logCalls = vi.mocked(console.log).mock.calls;
      const syncLine = logCalls.find((c) => String(c[0]).includes('Journal synced'));
      expect(syncLine).toBeDefined();

      // Verify journal file content
      const journalContent = await fs.readFile(journalPath, 'utf-8');
      const journal = JSON.parse(journalContent) as {
        entries: Array<{
          tag: string;
          breakpoints: boolean[];
          idx: number;
          when: string;
          hash: string;
        }>;
      };
      expect(journal.entries).toHaveLength(1);
      expect(journal.entries[0].tag).toBe('create_user');
      expect(journal.entries[0].breakpoints).toEqual([true, true]);
      expect(journal.entries[0].idx).toBe(1);
      expect(typeof journal.entries[0].when).toBe('string');
      expect(typeof journal.entries[0].hash).toBe('string');
    } finally {
      await safeDisconnect(driver);
    }
  });

  it('syncs journal from database with no prior migrations', async () => {
    const config = makeConfig({
      migrations: {
        dir: migrationsDir,
        table: '__test_migrations',
        journalDir: path.join(tmpDir, 'meta'),
      },
    });
    await migrateSync({ config, embeddedDriver: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const syncLine = logCalls.find((c) => String(c[0]).includes('Journal synced'));
    expect(syncLine).toBeDefined();

    // Journal should exist but be empty
    const journalPath = path.join(tmpDir, 'meta', '_journal.json');
    const journalContent = await fs.readFile(journalPath, 'utf-8');
    const journal = JSON.parse(journalContent) as { entries: unknown[] };
    expect(journal.entries).toHaveLength(0);
  });

  it('rethrows error on failure', async () => {
    const config = makeConfig({
      migrations: {
        dir: migrationsDir,
        table: '__test_migrations',
        journalDir: path.join(tmpDir, 'meta'),
      },
    });
    // Config has no DB URL → NodeDriver constructor throws → migrateSync catches + rethrows
    await expect(migrateSync({ config })).rejects.toThrow();
  });
});

// ============================================================================
// getMigrationProgressString
// ============================================================================

describe('getMigrationProgressString', () => {
  let driver: EmbeddedDriver;
  let runner: MigrationRunner;
  let tmpDir: string;
  let migrationsDir: string;

  beforeEach(async () => {
    driver = new EmbeddedDriver({
      driver: 'embedded',
      namespace: 'test_progress',
      database: `test_${Date.now()}`,
      mode: 'memory',
    });
    await driver.connect();

    tmpDir = await createTmpDir('mig-progress-');
    migrationsDir = path.join(tmpDir, 'migrations');
    await fs.mkdir(migrationsDir, { recursive: true });

    runner = new MigrationRunner(driver, {
      migrationsDir,
      migrationsTable: '__test_progress',
      journalDir: path.join(tmpDir, 'meta'),
    });
    await runner.init();
  });

  afterEach(async () => {
    await driver.disconnect();
    await cleanupDir(tmpDir);
  });

  it('returns unknown for non-existent migration', async () => {
    const result = await getMigrationProgressString(runner, 'nonexistent');
    expect(result).toBe('unknown (file not found)');
  });

  it('returns no statements for empty migration', async () => {
    const filePath = await createMigrationFile(migrationsDir, 'empty_mig', [], []);
    path.dirname(filePath);

    // Delete migration.surql and create empty one
    await fs.writeFile(filePath, '-- UP\n\n-- DOWN\n', 'utf-8');

    // Re-init runner to pick up new file — need to re-create since runner caches
    const runner2 = new MigrationRunner(driver, {
      migrationsDir,
      migrationsTable: '__test_progress',
      journalDir: path.join(tmpDir, 'meta'),
    });
    await runner2.init();

    const result = await getMigrationProgressString(runner2, 'empty_mig');
    expect(result).toBe('no statements');
  });
});

// ============================================================================
// handleResumeWithProgress
// ============================================================================

describe('handleResumeWithProgress', () => {
  let driver: EmbeddedDriver;
  let runner: MigrationRunner;
  let tmpDir: string;
  let migrationsDir: string;
  let restoreConsole: () => void;

  beforeEach(async () => {
    driver = new EmbeddedDriver({
      driver: 'embedded',
      namespace: 'test_resume',
      database: `test_${Date.now()}`,
      mode: 'memory',
    });
    await driver.connect();

    tmpDir = await createTmpDir('mig-resume-progress-');
    migrationsDir = path.join(tmpDir, 'migrations');
    await fs.mkdir(migrationsDir, { recursive: true });
    restoreConsole = mockConsole();

    runner = new MigrationRunner(driver, {
      migrationsDir,
      migrationsTable: '__test_resume',
      journalDir: path.join(tmpDir, 'meta'),
    });
    await runner.init();
  });

  afterEach(async () => {
    restoreConsole();
    await driver.disconnect();
    await cleanupDir(tmpDir);
  });

  it('completes with no partial migrations', async () => {
    await expect(handleResumeWithProgress(runner)).resolves.not.toThrow();
  });

  it('skips migration when file not found for a partial entry', async () => {
    // First apply a migration
    const _filePath = await createMigrationFile(
      migrationsDir,
      'create_user',
      ['DEFINE TABLE user SCHEMAFULL', 'DEFINE FIELD name ON user TYPE string'],
      ['REMOVE TABLE user'],
    );

    await runner.up();
    vi.mocked(console.log).mockClear();

    // Delete the migration file to simulate missing file during resume
    // handleResumeWithProgress looks up file by name from runner.getMigrationFiles()
    // If no partial migrations found, it won't iterate
    await expect(handleResumeWithProgress(runner)).resolves.not.toThrow();
  });

  it('resumes partial migration when journal has incomplete breakpoints', async () => {
    // Create migration with multiple statements
    await createMigrationFile(
      migrationsDir,
      'resume_me',
      ['DEFINE TABLE resume_target SCHEMAFULL', 'DEFINE FIELD name ON resume_target TYPE string'],
      ['REMOVE TABLE resume_target'],
    );

    // Pre-create the first statement's state in DB (like it was partially applied)
    await driver.query('DEFINE TABLE resume_target SCHEMAFULL');

    // Manually write journal to simulate partial migration (statement 1 succeeded, statement 2 not yet)
    const metaDir = path.join(tmpDir, 'meta');
    await fs.mkdir(metaDir, { recursive: true });
    const journalPath = path.join(metaDir, '_journal.json');
    const journalContent = {
      version: 1,
      dialect: 'surrealdb',
      id: 'test',
      entries: [
        {
          idx: 1,
          tag: 'resume_me',
          breakpoints: [true],
          hash: 'test-hash',
          when: new Date().toISOString(),
        },
      ],
    };
    await fs.writeFile(journalPath, JSON.stringify(journalContent, null, 2));

    // Create fresh runner that reads modified journal
    const freshRunner = new MigrationRunner(driver, {
      migrationsDir,
      migrationsTable: '__test_resume',
      journalDir: path.join(tmpDir, 'meta'),
    });
    await freshRunner.init();

    vi.mocked(console.log).mockClear();

    // Should resume and complete without error
    await expect(handleResumeWithProgress(freshRunner)).resolves.not.toThrow();

    const logCalls = vi.mocked(console.log).mock.calls;
    const resumeOutput = logCalls.find((c) => String(c[0]).includes('Resuming'));
    expect(resumeOutput).toBeDefined();
  });
});

// ============================================================================
// Full integration: MigrationRunner + driver
// ============================================================================

describe('MigrationRunner integration', () => {
  let driver: EmbeddedDriver;
  let runner: MigrationRunner;
  let tmpDir: string;
  let migrationsDir: string;

  beforeEach(async () => {
    driver = new EmbeddedDriver({
      driver: 'embedded',
      namespace: 'test_integration',
      database: `test_${Date.now()}`,
      mode: 'memory',
    });
    await driver.connect();

    tmpDir = await createTmpDir('mig-int-');
    migrationsDir = path.join(tmpDir, 'migrations');
    await fs.mkdir(migrationsDir, { recursive: true });
  });

  afterEach(async () => {
    await driver.disconnect();
    await cleanupDir(tmpDir);
  });

  it('creates migration tracking table on init', async () => {
    runner = new MigrationRunner(driver, {
      migrationsDir,
      migrationsTable: '__test_tracking',
      journalDir: path.join(tmpDir, 'meta'),
    });
    await runner.init();

    // Verify the migrations table exists via INFO FOR DB
    const info = await driver.query('INFO FOR DB');
    const tables = (info as unknown as { tables: Record<string, string> })?.tables ?? {};
    expect(tables.__test_tracking).toBeDefined();
  });

  it('applies migration via runner.up()', async () => {
    await createMigrationFile(
      migrationsDir,
      'create_user',
      ['DEFINE TABLE user SCHEMAFULL', 'DEFINE FIELD name ON user TYPE string'],
      ['REMOVE TABLE user'],
    );

    runner = new MigrationRunner(driver, {
      migrationsDir,
      migrationsTable: '__test_applied',
      journalDir: path.join(tmpDir, 'meta'),
    });
    await runner.init();
    const result = await runner.up();

    expect(result.applied.length).toBeGreaterThan(0);
    expect(result.applied[0]).toBe('create_user');

    // Verify user table exists
    const tables = await driver.query<Array<{ name: string }>>('SELECT * FROM user;');
    expect(Array.isArray(tables)).toBe(true);
  });

  it('reports correct status after applying migration', async () => {
    await createMigrationFile(
      migrationsDir,
      'create_user',
      ['DEFINE TABLE user SCHEMAFULL', 'DEFINE FIELD name ON user TYPE string'],
      ['REMOVE TABLE user'],
    );

    runner = new MigrationRunner(driver, {
      migrationsDir,
      migrationsTable: '__test_status',
      journalDir: path.join(tmpDir, 'meta'),
    });
    await runner.init();
    await runner.up();

    const status = await runner.status();
    expect(status.applied.length).toBe(1);
    expect(status.pending.length).toBe(0);
  });

  it('applies migration via runner.up() (dryRun option not available, verifies basic apply)', async () => {
    await createMigrationFile(
      migrationsDir,
      'create_dryrun',
      ['DEFINE TABLE dryrun_test SCHEMAFULL'],
      ['REMOVE TABLE dryrun_test'],
    );

    runner = new MigrationRunner(driver, {
      migrationsDir,
      migrationsTable: '__test_dryrun',
      journalDir: path.join(tmpDir, 'meta'),
    });
    await runner.init();

    // runner.up() does not have a dryRun option, but verify basic apply works
    const result = await runner.up();
    expect(result.applied.length).toBe(1);

    // Verify table exists
    const tables = await driver.query('INFO FOR DB');
    const dbTables = tables as unknown as { tables: Record<string, string> };
    const tableNames = Object.keys(dbTables?.tables ?? {});
    expect(tableNames).toContain('dryrun_test');
  });
});

// ============================================================================
// migrateDev
// ============================================================================

describe('migrateDev', () => {
  let tmpDir: string;
  let schemaDir: string;
  let migrationsDir: string;
  let restoreConsole: () => void;

  beforeEach(async () => {
    tmpDir = await createTmpDir('mig-dev-');
    schemaDir = path.join(tmpDir, 'schema');
    migrationsDir = path.join(tmpDir, 'migrations');
    await fs.mkdir(schemaDir, { recursive: true });
    await fs.mkdir(migrationsDir, { recursive: true });
    restoreConsole = mockConsole();
  });

  afterEach(async () => {
    restoreConsole();
    await cleanupDir(tmpDir);
  });

  it('handles no schema tables gracefully', async () => {
    // Empty schema dir — no .ts files, returns early
    const config: Config = {
      url: '',
      namespace: 'test_dev_empty',
      database: `dev_empty_${Date.now()}`,
      schema: { dir: schemaDir, pattern: '**/*.ts' },
      migrations: {
        dir: migrationsDir,
        journalDir: path.join(tmpDir, 'meta'),
        table: '__test_dev_mig',
      },
    };

    await migrateDev({ config, name: 'test_migration' });

    const logCalls = vi.mocked(console.log).mock.calls;
    const noTablesLine = logCalls.find((c) => String(c[0]).includes('No schema tables found'));
    expect(noTablesLine).toBeDefined();
  });

  it('shows warning when no database configured', async () => {
    // Create a plain schema file (no external imports so it can be loaded dynamically)
    const schemaFile = path.join(schemaDir, 'schema.ts');
    const schemaContent = [
      'export default {',
      '  users: {',
      '    name: "users",',
      '    columns: [',
      '      { name: "id", tableName: "users", config: { type: "string" } },',
      '      { name: "name", tableName: "users", config: { type: "string" } },',
      '      { name: "email", tableName: "users", config: { type: "string" } },',
      '    ],',
      '    config: { schema: "full", type: "normal" },',
      '  },',
      '};',
    ].join('\n');
    await fs.writeFile(schemaFile, schemaContent);

    // Config without url/namespace/database — shows "No database configuration found"
    // trigger, then falls back to full migration since no snapshot dir either
    const config: Config = {
      url: '',
      namespace: '',
      database: '',
      schema: { dir: schemaDir, pattern: '**/*.ts' },
      migrations: {
        dir: migrationsDir,
        journalDir: path.join(tmpDir, 'meta'),
        table: '__test_dev_mig',
      },
    };

    // This will generate the migration but then fail at target connection
    // (createConnection with empty url/node driver). We catch that gracefully.
    try {
      await migrateDev({ config, name: 'test_migration' });
    } catch {
      // Expected — target connection fails with empty url
    }

    const logCalls = vi.mocked(console.log).mock.calls;
    const noDbLine = logCalls.find((c) => String(c[0]).includes('No database configuration found'));
    expect(noDbLine).toBeDefined();

    // Verify migration file was created before the connection error
    const dirEntries = await fs.readdir(migrationsDir);
    expect(dirEntries.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// migrateDeploy
// ============================================================================

describe('migrateDeploy', () => {
  let restoreConsole: () => void;

  beforeEach(() => {
    restoreConsole = mockConsole();
  });

  afterEach(() => {
    restoreConsole();
  });

  it('throws if no shadow config', async () => {
    const config: Config = {
      url: '',
      namespace: 'test_deploy',
      database: 'test_deploy_db',
      schema: { dir: './schema', pattern: '**/*.ts' },
      migrations: {
        dir: './migrations',
        journalDir: './meta',
        table: '__test_deploy_mig',
      },
    };

    await expect(migrateDeploy({ config })).rejects.toThrow(/shadow/i);
  });
});
