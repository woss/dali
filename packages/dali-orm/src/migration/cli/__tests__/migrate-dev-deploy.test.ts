/**
 * Tests for migrateDev and migrateDeploy CLI functions.
 *
 * These require mocking connect() since the functions internally
 * create connections for both shadow and target databases.
 *
 * IMPORTANT: Schema files must be created inside the project root
 * (not OS temp dir) because loadSchemaFiles uses file:// URLs
 * for dynamic import, which Vitest cannot resolve outside its root.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbeddedDriver } from '../../../sdk/driver/embedded-driver.js';

// Mock connect before importing the modules under test
vi.mock('../../../sdk/driver/orm-connection.js', () => ({
  connect: vi.fn(),
}));

import { connect } from '../../../sdk/driver/orm-connection.js';
import type { Config } from '../../config.js';
import { migrateDeploy, migrateDev } from '../migrate.js';
import { createMigrationFile } from './helpers.js';

// ============================================================================
// Helpers
// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// Use a tmp dir inside the package for schema files (Vitest can resolve file://)
const LOCAL_TMP = path.join(PACKAGE_ROOT, 'tmp', 'test-schemas');

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    url: '',
    namespace: 'test_ns',
    database: 'test_db',
    schema: { dir: './schema', pattern: '**/*.{js,ts}' },
    migrations: {
      dir: './migrations',
      table: '__test_migrations',
    },
    ...overrides,
  } as Config;
}

function mockConsole(): () => void {
  const origLog = console.log;
  const origErr = console.error;
  console.log = vi.fn();
  console.error = vi.fn();
  return () => {
    console.log = origLog;
    console.error = origErr;
  };
}

/** Track created drivers for cleanup */
const createdDrivers: EmbeddedDriver[] = [];

/** Create a real embedded driver for the given ns/db */
async function createEmbeddedDriver(
  namespace: string,
  database: string,
): Promise<EmbeddedDriver> {
  const driver = new EmbeddedDriver({
    driver: 'embedded',
    namespace,
    database,
    mode: 'memory',
  });
  await driver.connect();
  createdDrivers.push(driver);
  return driver;
}

async function cleanupDrivers(): Promise<void> {
  for (const driver of createdDrivers) {
    await driver.disconnect().catch(() => {});
  }
  createdDrivers.length = 0;
}

/**
 * Create a unique local temp directory name under PACKAGE_ROOT/tmp/test-schemas.
 * This is needed because loadSchemaFiles uses file:// URLs for dynamic import,
 * which Vitest can only resolve for files within the project root.
 */
let testCounter = 0;

async function createLocalTempDir(prefix: string): Promise<string> {
  testCounter++;
  const dirName = `${prefix}-${Date.now()}-${testCounter}`;
  const dirPath = path.join(LOCAL_TMP, dirName);
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

async function cleanupLocalTempDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    // Best effort cleanup
  }
}

/**
 * Create a schema file with plain JS exports (no @woss/dali-orm imports).
 * The file exports a default object with table definitions.
 */
async function createPlainSchemaFile(
  dir: string,
  fileName: string,
  tables: Array<{ name: string; columns: Array<Record<string, unknown>> }>,
): Promise<string> {
  const tableEntries = tables
    .map(
      (t) =>
        `"${t.name}": ${JSON.stringify({
          name: t.name,
          columns: t.columns,
          config: { schema: 'full', type: 'normal' },
        })}`,
    )
    .join(',\n  ');
  const content = `export default {\n  ${tableEntries}\n};\n`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, content);
  return filePath;
}

// ============================================================================
// migrateDev
// ============================================================================

describe('migrateDev', () => {
  let tmpDir: string;
  let schemaDir: string;
  let migrationsDir: string;
  let restoreConsole: () => void;

  beforeEach(async () => {
    tmpDir = await createLocalTempDir('mig-dev-');
    schemaDir = path.join(tmpDir, 'schema');
    migrationsDir = path.join(tmpDir, 'migrations');
    await fs.mkdir(schemaDir, { recursive: true });
    await fs.mkdir(migrationsDir, { recursive: true });
    restoreConsole = mockConsole();
  });

  afterEach(async () => {
    restoreConsole();
    vi.restoreAllMocks();
    await cleanupDrivers();
    await cleanupLocalTempDir(tmpDir);
  });

  it('reports no schema tables when schema dir is empty', async () => {
    const config = makeConfig({
      schema: { dir: schemaDir, pattern: '**/*.ts' },
      migrations: {
        dir: migrationsDir,
        table: '__test_mig_dev_empty',
        journalDir: path.join(tmpDir, 'journal'),
      },
    });

    await migrateDev({ config, name: 'empty_test' });

    const logCalls = vi.mocked(console.log).mock.calls;
    const noSchemaLine = logCalls.find((c) =>
      String(c[0]).includes('No schema tables'),
    );
    expect(noSchemaLine).toBeDefined();
  });

  it('generates migration from schema with no database config', async () => {
    // Schema file in a project-root temp dir so Vitest can resolve imports
    const schemaFile = await createPlainSchemaFile(
      schemaDir,
      'user.schema.ts',
      [
        {
          name: 'user',
          columns: [
            { name: 'name', tableName: 'user', config: { type: 'string' } },
          ],
        },
      ],
    );

    const config = makeConfig({
      url: '',
      namespace: '',
      database: '',
      // Use file path (not directory) so loadSchemaFiles takes single-file path
      schema: { dir: schemaFile, pattern: '**/*.ts' },
      migrations: {
        dir: migrationsDir,
        table: '__test_mig_dev_nodb',
        journalDir: path.join(tmpDir, 'journal'),
      },
    });

    // Mock connect to return a valid driver for the target connection
    const targetDriver = await createEmbeddedDriver(
      'test_mig_dev_nodb',
      `db_nodb_${Date.now()}`,
    );
    vi.mocked(connect).mockResolvedValue(targetDriver);

    await migrateDev({ config, name: 'create_user' });

    // Verify migration directory was created
    const migrationDirs = await fs.readdir(migrationsDir);
    const createUserDir = migrationDirs.find((d) => d.includes('create_user'));
    expect(createUserDir).toBeDefined();

    // Verify migration file content
    const migrationContent = await fs.readFile(
      path.join(migrationsDir, createUserDir!, 'migration.surql'),
      'utf-8',
    );
    expect(migrationContent).toContain(
      'DEFINE TABLE IF NOT EXISTS user SCHEMAFULL',
    );
  });

  it('generates migration and applies to target with embedded driver', async () => {
    // Schema file in a project-root temp dir so Vitest can resolve imports
    const schemaFile = await createPlainSchemaFile(
      schemaDir,
      'user.schema.ts',
      [
        {
          name: 'user',
          columns: [
            { name: 'name', tableName: 'user', config: { type: 'string' } },
          ],
        },
      ],
    );

    const ns = `test_dev_gen_${Date.now()}`;
    const db = `db_gen_${Date.now()}`;

    // Mock connect to return FRESH drivers each call
    // migrateDev does: createConnectionWithTimeout (live comparison),
    //   then safeDisconnect, then createConnection (target)
    // Each call must return a fresh driver since the first one gets disconnected
    vi.mocked(connect).mockImplementation(async (opts: any) => {
      const nsFromOpts =
        opts?.nodeDriver?.namespace ?? opts?.embeddedDriver?.namespace ?? ns;
      const dbFromOpts =
        opts?.nodeDriver?.database ?? opts?.embeddedDriver?.database ?? db;
      return createEmbeddedDriver(nsFromOpts, dbFromOpts);
    });

    const config = makeConfig({
      namespace: ns,
      database: db,
      // Use file path (not directory) so loadSchemaFiles takes single-file path
      schema: { dir: schemaFile, pattern: '**/*.ts' },
      migrations: {
        dir: migrationsDir,
        table: '__test_mig_dev_gen',
        journalDir: path.join(tmpDir, 'journal'),
      },
    });

    await migrateDev({ config, name: 'create_user' });

    // Verify migration directory was created
    const migrationDirs = await fs.readdir(migrationsDir);
    const createUserDir = migrationDirs.find((d) => d.includes('create_user'));
    expect(createUserDir).toBeDefined();

    // Verify migration file content
    const migrationContent = await fs.readFile(
      path.join(migrationsDir, createUserDir!, 'migration.surql'),
      'utf-8',
    );
    expect(migrationContent).toContain('DEFINE TABLE');

    // Verify migration was applied via console.log output
    // (cannot verify by creating a new embedded driver — each instance has
    // its own in-memory SurrealDB; data is not shared across instances)
    const logCalls = vi.mocked(console.log).mock.calls;
    const appliedLine = logCalls.find(
      (c) =>
        String(c[0]).includes('Applied') && String(c[0]).includes('migration'),
    );
    expect(appliedLine).toBeDefined();
  });
});

// ============================================================================
// migrateDeploy
// ============================================================================

describe('migrateDeploy', () => {
  let tmpDir: string;
  let migrationsDir: string;
  let restoreConsole: () => void;

  beforeEach(async () => {
    tmpDir = await createLocalTempDir('mig-deploy-');
    migrationsDir = path.join(tmpDir, 'migrations');
    await fs.mkdir(migrationsDir, { recursive: true });
    restoreConsole = mockConsole();
  });

  afterEach(async () => {
    restoreConsole();
    vi.restoreAllMocks();
    await cleanupDrivers();
    await cleanupLocalTempDir(tmpDir);
  });

  it('throws when shadow config is missing', async () => {
    const config = makeConfig({
      namespace: 'test_deploy_no_shadow',
      database: `db_no_shadow_${Date.now()}`,
      migrations: {
        dir: migrationsDir,
        table: '__test_mig_deploy',
        journalDir: path.join(tmpDir, 'journal'),
      },
    });

    await expect(migrateDeploy({ config })).rejects.toThrow(
      'migrate deploy requires shadow configuration',
    );
  });

  it('applies pending migrations with shadow validation', async () => {
    // Create a migration file
    await createMigrationFile(migrationsDir, 'create_user', [
      'DEFINE TABLE deploy_user SCHEMAFULL',
      'DEFINE FIELD name ON deploy_user TYPE string',
    ]);

    const shadowNs = `shadow_${Date.now()}`;
    const shadowDb = `shadow_db_${Date.now()}`;
    const targetNs = `target_${Date.now()}`;
    const targetDb = `target_db_${Date.now()}`;

    // Mock connect to return a FRESH embedded driver for each call
    vi.mocked(connect).mockImplementation(async (opts: any) => {
      const ns =
        opts?.nodeDriver?.namespace ?? opts?.embeddedDriver?.namespace ?? '';
      const db =
        opts?.nodeDriver?.database ?? opts?.embeddedDriver?.database ?? '';
      return createEmbeddedDriver(ns, db);
    });

    const config = makeConfig({
      url: '',
      namespace: targetNs,
      database: targetDb,
      shadow: { namespace: shadowNs, database: shadowDb },
      migrations: {
        dir: migrationsDir,
        table: '__test_mig_deploy',
        journalDir: path.join(tmpDir, 'journal'),
      },
    });

    await migrateDeploy({ config });

    const logCalls = vi.mocked(console.log).mock.calls;
    const appliedLine = logCalls.find((c) => String(c[0]).includes('Applied'));
    expect(appliedLine).toBeDefined();
  });
});
