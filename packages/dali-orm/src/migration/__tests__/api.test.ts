import * as fs from 'node:fs/promises';
import os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { EmbeddedDriver } from '../../sdk/driver/embedded-driver.js';
import type { ColumnDefinition, TableDefinition } from '../../sdk/table.js';
import {
  generateAndApplyMigration,
  getMigrationStatus,
  migrateToDatabase,
  pullAndMigrate,
  pushSchemaFromTableDefs,
  _setTestConfigDir,
} from '../api.js';

// ============================================================================
// Helpers
// ============================================================================

function createTestDriver() {
  return new EmbeddedDriver({
    driver: 'embedded',
    namespace: 'test_ns',
    database: 'test_db',
    mode: 'memory',
  });
}

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'migration-test-'));
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
    "  namespace: 'test_ns',",
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

function buildColumnDef(name: string, type: string, optional = false): ColumnDefinition {
  return {
    name,
    tableName: 'user',
    config: { type: type as any, optional },
  };
}

function buildUserTable(): TableDefinition {
  return {
    name: 'user',
    columns: [
      buildColumnDef('name', 'string'),
      buildColumnDef('email', 'string'),
      buildColumnDef('age', 'int', true),
    ],
    config: { schema: 'full', type: 'normal' },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Migration API', () => {
  let driver: EmbeddedDriver;
  let testProject: { rootDir: string; migrationsDir: string; journalDir: string };

  beforeEach(async () => {
    driver = createTestDriver();
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
    it('applies pending migrations from directory', async () => {
      await createMigrationFile(testProject.migrationsDir, 'add_user_table', [
        'DEFINE TABLE user SCHEMAFULL',
        'DEFINE FIELD name ON user TYPE string',
      ]);

      const result = await migrateToDatabase(driver);

      expect(result.applied).toHaveLength(1);
      expect(result.applied[0]).toContain('add_user_table');
      expect(result.skipped).toHaveLength(0);
    });

    it('skips already-applied migrations', async () => {
      await createMigrationFile(testProject.migrationsDir, 'add_user_table', [
        'DEFINE TABLE user SCHEMAFULL',
      ]);

      const first = await migrateToDatabase(driver);
      expect(first.applied).toHaveLength(1);

      const second = await migrateToDatabase(driver);
      expect(second.applied).toHaveLength(0);
    });

    it('handles empty migrations directory', async () => {
      const result = await migrateToDatabase(driver);

      expect(result.applied).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
    });

    it('applies multiple migrations in order', async () => {
      await createMigrationFile(testProject.migrationsDir, '001_create_user', [
        'DEFINE TABLE user SCHEMAFULL',
      ]);

      await new Promise((r) => setTimeout(r, 10));

      await createMigrationFile(testProject.migrationsDir, '002_add_email', [
        'DEFINE FIELD email ON user TYPE string',
      ]);

      const result = await migrateToDatabase(driver);

      expect(result.applied).toHaveLength(2);
    });
  });

  // ==========================================================================
  // getMigrationStatus
  // ==========================================================================

  describe('getMigrationStatus', () => {
    it('returns empty status with no migrations', async () => {
      const status = await getMigrationStatus(driver);

      expect(status.pending).toHaveLength(0);
      expect(status.applied).toHaveLength(0);
    });

    it('shows pending and applied migrations', async () => {
      await createMigrationFile(testProject.migrationsDir, 'add_user_table', [
        'DEFINE TABLE user SCHEMAFULL',
      ]);

      await createMigrationFile(testProject.migrationsDir, 'add_post_table', [
        'DEFINE TABLE post SCHEMAFULL',
      ]);

      await migrateToDatabase(driver);

      // Create another pending migration after applying
      await createMigrationFile(testProject.migrationsDir, 'add_comment_table', [
        'DEFINE TABLE comment SCHEMAFULL',
      ]);

      const status = await getMigrationStatus(driver);

      expect(status.applied).toHaveLength(2);
      expect(status.pending).toHaveLength(1);
    });
  });

  // ==========================================================================
  // generateAndApplyMigration
  // ==========================================================================

  describe('generateAndApplyMigration', () => {
    it('generates and applies migration from table definitions', async () => {
      const userTable = buildUserTable();

      const { outputPath, result } = await generateAndApplyMigration(driver, [userTable], {
        name: 'add_user_table',
        fullMigration: true,
      });

      // Should have written migration file in the project migrations dir
      expect(outputPath).toContain('add_user_table');
      expect(result.applied).toHaveLength(1);
    });

    it('throws with no tables', async () => {
      await expect(
        generateAndApplyMigration(driver, [], { name: 'empty_migration', fullMigration: true }),
      ).rejects.toThrow('No tables provided');
    });

    it('throws with no name', async () => {
      const userTable = buildUserTable();

      await expect(
        generateAndApplyMigration(driver, [userTable], { name: '', fullMigration: true }),
      ).rejects.toThrow('Migration name is required');
    });
  });

  // ==========================================================================
  // pullAndMigrate
  // ==========================================================================

  describe('pullAndMigrate', () => {
    it('pulls schema and generates migration', async () => {
      // Create a table first
      await driver.query('DEFINE TABLE user SCHEMAFULL');
      await driver.query('DEFINE FIELD name ON user TYPE string');

      const { schemaPath, result } = await pullAndMigrate(driver);

      expect(schemaPath).toBeTruthy();
      expect(result.applied).toHaveLength(1);
    });

    it('throws when no tables exist in database', async () => {
      await expect(pullAndMigrate(driver)).rejects.toThrow('No tables found');
    });
  });

  // ==========================================================================
  // pushSchemaFromTableDefs
  // ==========================================================================

  describe('pushSchemaFromTableDefs', () => {
    it('pushes table definitions to database', async () => {
      const userTable = buildUserTable();

      const result = await pushSchemaFromTableDefs(driver, [userTable]);

      expect(result.sqlStatements.length).toBeGreaterThan(0);
    });

    it('throws with no tables', async () => {
      await expect(pushSchemaFromTableDefs(driver, [])).rejects.toThrow('No table definitions');
    });
  });
});
