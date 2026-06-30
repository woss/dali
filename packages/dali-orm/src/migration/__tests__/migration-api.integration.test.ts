/**
 * Integration tests for migration API functions
 *
 * Tests migrateToDatabase, pushSchemaFromTableDefs, and getMigrationStatus
 * against a REAL embedded SurrealDB instance (in-memory).
 * Each test gets a fresh in-memory DB.
 */
import * as fs from 'node:fs/promises';
import os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { EmbeddedDriver } from '../../sdk/driver/embedded-driver.js';
import type { ColumnDefinition, TableDefinition } from '../../sdk/table.js';
import {
  getMigrationStatus,
  migrateToDatabase,
  pushSchemaFromTableDefs,
  _setTestConfigDir,
} from '../api.js';

// ============================================================================
// Helpers
// ============================================================================

let _counter = 0;

function createDriver(): EmbeddedDriver {
  _counter++;
  return new EmbeddedDriver({
    driver: 'embedded',
    namespace: 'mig_api_int',
    database: `test_${Date.now()}_${_counter}`,
    mode: 'memory',
  });
}

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'mig-api-int-'));
}

/** Set up a temp dir with dali-orm.config.ts + migrations/ + meta/ subdirs */
async function setupTestProject(): Promise<{
  rootDir: string;
  migrationsDir: string;
  journalDir: string;
}> {
  const rootDir = await createTempDir();
  const migrationsDir = path.join(rootDir, 'migrations');
  const journalDir = path.join(rootDir, 'meta');

  await fs.mkdir(migrationsDir, { recursive: true });
  await fs.mkdir(journalDir, { recursive: true });

  // Write dali-orm.config.ts
  const configContent = [
    'export default {',
    "  url: 'http://localhost:8000',",
    "  namespace: 'mig_api_int',",
    "  database: 'test_db',",
    '};',
  ].join('\n');
  await fs.writeFile(path.join(rootDir, 'dali-orm.config.ts'), configContent, 'utf-8');

  return { rootDir, migrationsDir, journalDir };
}

async function createMigrationFile(
  dir: string,
  name: string,
  upStatements: string[],
): Promise<string> {
  const timestamp = Date.now().toString();
  const migrationDir = path.join(dir, `${timestamp}_${name}`);
  const filePath = path.join(migrationDir, 'migration.surql');
  await fs.mkdir(migrationDir, { recursive: true });

  const content = [
    `-- Migration: ${name}`,
    `-- Created at: ${new Date().toISOString()}`,
    '',
    '-- UP',
    ...upStatements.map((s) => `${s};`),
  ].join('\n');

  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

function column(name: string, type: string, optional = false): ColumnDefinition {
  return {
    name,
    tableName: 'user',
    config: { type: type as any, optional },
  };
}

function userTable(): TableDefinition {
  return {
    name: 'user',
    columns: [column('name', 'string'), column('email', 'string'), column('age', 'int', true)],
    config: { schema: 'full', type: 'normal' },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Migration API (integration)', () => {
  let driver: EmbeddedDriver;
  let testProject: { rootDir: string; migrationsDir: string; journalDir: string };

  beforeEach(async () => {
    driver = createDriver();
    await driver.connect();
    testProject = await setupTestProject();
    _setTestConfigDir(testProject.rootDir);
  });

  afterEach(async () => {
    _setTestConfigDir(undefined);
    await driver.disconnect();
    await fs.rm(testProject.rootDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // migrateToDatabase
  // ==========================================================================

  describe('migrateToDatabase', () => {
    it('applies migration and verifies DB structure', async () => {
      await createMigrationFile(testProject.migrationsDir, 'add_user', [
        'DEFINE TABLE user SCHEMAFULL',
        'DEFINE FIELD name ON user TYPE string',
        'DEFINE FIELD email ON user TYPE string',
      ]);

      const result = await migrateToDatabase(driver);

      expect(result.applied).toHaveLength(1);

      // Verify DB has the structure
      const dbInfo = await driver.query('INFO FOR TABLE user');
      const tableInfo = Array.isArray(dbInfo) ? dbInfo[0] : dbInfo;
      expect(tableInfo).toBeDefined();

      const fields = (tableInfo as Record<string, unknown>).fields as
        | Record<string, unknown>
        | undefined;
      expect(fields).toBeDefined();
      expect(fields?.name).toBeDefined();
      expect(fields?.email).toBeDefined();
    });

    it('applies multiple migrations and tracks applied state', async () => {
      await createMigrationFile(testProject.migrationsDir, '001_create_user', [
        'DEFINE TABLE user SCHEMAFULL',
        'DEFINE FIELD name ON user TYPE string',
      ]);

      await new Promise((r) => setTimeout(r, 10));

      await createMigrationFile(testProject.migrationsDir, '002_add_email', [
        'DEFINE FIELD email ON user TYPE string',
      ]);

      const result = await migrateToDatabase(driver);

      expect(result.applied).toHaveLength(2);

      // Verify both fields exist
      const dbInfo = await driver.query('INFO FOR TABLE user');
      const tableInfo = Array.isArray(dbInfo) ? dbInfo[0] : dbInfo;
      const fields = (tableInfo as Record<string, unknown>).fields as
        | Record<string, unknown>
        | undefined;
      expect(fields?.name).toBeDefined();
      expect(fields?.email).toBeDefined();
    });

    it('auto-connects when driver is disconnected', async () => {
      await driver.disconnect();

      await createMigrationFile(testProject.migrationsDir, 'add_table', [
        'DEFINE TABLE test_table SCHEMAFULL',
        'DEFINE FIELD val ON test_table TYPE string',
      ]);

      const result = await migrateToDatabase(driver);

      expect(result.applied).toHaveLength(1);
      expect(driver.isConnected()).toBe(true);
    });

    it('rejects invalid SQL in migration', async () => {
      await createMigrationFile(testProject.migrationsDir, 'bad_migration', [
        'THIS IS NOT VALID SURREALQL',
      ]);

      await expect(migrateToDatabase(driver)).rejects.toThrow();
    });

    it('handles empty migrations directory', async () => {
      // Use a separate empty config dir with no migrations
      const emptyDir = await createTempDir();
      await fs.mkdir(path.join(emptyDir, 'migrations'), { recursive: true });
      await fs.mkdir(path.join(emptyDir, 'meta'), { recursive: true });
      const configContent = [
        'export default {',
        "  url: 'http://localhost:8000',",
        "  namespace: 'test_ns',",
        "  database: 'test_db',",
        '};',
      ].join('\n');
      await fs.writeFile(path.join(emptyDir, 'dali-orm.config.ts'), configContent, 'utf-8');

      _setTestConfigDir(emptyDir);
      const result = await migrateToDatabase(driver);

      expect(result.applied).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);

      _setTestConfigDir(testProject.rootDir);
      await fs.rm(emptyDir, { recursive: true, force: true });
    });
  });

  // ==========================================================================
  // pushSchemaFromTableDefs
  // ==========================================================================

  describe('pushSchemaFromTableDefs', () => {
    it('creates table and column definitions in DB', async () => {
      const tables = [userTable()];

      const result = await pushSchemaFromTableDefs(driver, tables);

      expect(result.sqlStatements.length).toBeGreaterThan(0);

      // Verify actual DB structure
      const info = await driver.query('INFO FOR TABLE user');
      expect(info).toBeDefined();

      const tableInfo = Array.isArray(info) ? info[0] : info;
      const fields = (tableInfo as Record<string, unknown>).fields as
        | Record<string, unknown>
        | undefined;
      const fieldNames = fields ? Object.keys(fields) : [];
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('age');
    });

    it('dryRun does not create tables in DB', async () => {
      const tables = [userTable()];

      const result = await pushSchemaFromTableDefs(driver, tables, { dryRun: true });

      expect(result.sqlStatements.length).toBeGreaterThan(0);

      // Table should NOT exist
      const dbInfo = await driver.query('INFO FOR DB');
      const tablesInDb = (Array.isArray(dbInfo) ? dbInfo[0] : dbInfo) as Record<string, unknown>;
      const tablesObj = tablesInDb.tables as Record<string, unknown> | undefined;
      expect(tablesObj?.user).toBeUndefined();
    });

    it('throws on empty tables array', async () => {
      await expect(pushSchemaFromTableDefs(driver, [])).rejects.toThrow(
        'No table definitions provided',
      );
    });

    it('handles tables with datetime and record columns', async () => {
      const refTable: TableDefinition = {
        name: 'project',
        columns: [column('title', 'string')],
        config: { schema: 'full', type: 'normal' },
      };

      const taskTable: TableDefinition = {
        name: 'task',
        columns: [
          column('title', 'string'),
          { name: 'due_date', tableName: 'task', config: { type: 'datetime' as const } },
          { name: 'assignee', tableName: 'task', config: { type: 'record' as const } },
          {
            name: 'completed',
            tableName: 'task',
            config: { type: 'bool' as const, default: 'false' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      };

      await pushSchemaFromTableDefs(driver, [refTable, taskTable]);

      const info = await driver.query('INFO FOR TABLE task');
      const tableInfo = Array.isArray(info) ? info[0] : info;
      const fields = (tableInfo as Record<string, unknown>).fields as
        | Record<string, unknown>
        | undefined;
      const fieldNames = fields ? Object.keys(fields) : [];
      expect(fieldNames).toContain('title');
      expect(fieldNames).toContain('due_date');
      expect(fieldNames).toContain('assignee');
      expect(fieldNames).toContain('completed');
    });

    it('auto-connects when driver is disconnected', async () => {
      await driver.disconnect();

      const tables = [userTable()];
      const result = await pushSchemaFromTableDefs(driver, tables);

      expect(result.sqlStatements.length).toBeGreaterThan(0);
      expect(driver.isConnected()).toBe(true);
    });
  });

  // ==========================================================================
  // getMigrationStatus
  // ==========================================================================

  describe('getMigrationStatus', () => {
    it('shows pending before apply, applied after', async () => {
      await createMigrationFile(testProject.migrationsDir, 'add_user_table', [
        'DEFINE TABLE user SCHEMAFULL',
      ]);

      const statusBefore = await getMigrationStatus(driver);
      expect(statusBefore.pending).toHaveLength(1);
      expect(statusBefore.applied).toHaveLength(0);

      await migrateToDatabase(driver);

      const statusAfter = await getMigrationStatus(driver);
      expect(statusAfter.applied).toHaveLength(1);
      expect(statusAfter.pending).toHaveLength(0);
    });

    it('returns empty status when no migrations exist', async () => {
      // Use a separate empty config dir with no migrations
      const emptyDir = await createTempDir();
      await fs.mkdir(path.join(emptyDir, 'migrations'), { recursive: true });
      await fs.mkdir(path.join(emptyDir, 'meta'), { recursive: true });
      const configContent = [
        'export default {',
        "  url: 'http://localhost:8000',",
        "  namespace: 'test_ns',",
        "  database: 'test_db',",
        '};',
      ].join('\n');
      await fs.writeFile(path.join(emptyDir, 'dali-orm.config.ts'), configContent, 'utf-8');

      _setTestConfigDir(emptyDir);
      const status = await getMigrationStatus(driver);

      expect(status.applied).toHaveLength(0);
      expect(status.pending).toHaveLength(0);
      expect(status.current).toBeNull();

      _setTestConfigDir(testProject.rootDir);
      await fs.rm(emptyDir, { recursive: true, force: true });
    });

    it('tracks current version correctly', async () => {
      await createMigrationFile(testProject.migrationsDir, 'v1_create', [
        'DEFINE TABLE my_table SCHEMAFULL',
      ]);

      await migrateToDatabase(driver);

      const status = await getMigrationStatus(driver);

      expect(status.current).toBeTruthy();
      expect(typeof status.current).toBe('string');
    });
  });
});
