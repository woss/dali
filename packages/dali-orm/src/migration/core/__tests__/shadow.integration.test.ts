/**
 * Integration tests for shadow DB validation
 *
 * Tests validateWithShadow and connectToShadow (guard path only)
 * against a REAL embedded SurrealDB instance (in-memory).
 * Shadow is created as a separate EmbeddedDriver instance.
 */
import * as fs from 'node:fs/promises';
import os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { EmbeddedDriver } from '../../../sdk/driver/embedded-driver.js';
import { connectToShadow, validateWithShadow } from '../shadow.js';

// ============================================================================
// Helpers
// ============================================================================

function createShadowDriver(): EmbeddedDriver {
  return new EmbeddedDriver({
    driver: 'embedded',
    namespace: 'shadow_int_ns',
    database: 'shadow_int_db',
    mode: 'memory',
  });
}

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'shadow-int-'));
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

// ============================================================================
// Tests
// ============================================================================

describe('Shadow DB (integration)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await createTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // connectToShadow
  // ==========================================================================

  describe('connectToShadow guard', () => {
    it('throws when shadow ns/db matches target', async () => {
      const config = {
        url: 'http://localhost:10101',
        namespace: 'prod_ns',
        database: 'prod_db',
        schema: { dir: './schema', pattern: '*.ts' },
      };
      const shadow = { namespace: 'prod_ns', database: 'prod_db' };

      await expect(connectToShadow(config, shadow)).rejects.toThrow('cannot match target');
    });
  });

  // ==========================================================================
  // validateWithShadow
  // ==========================================================================

  describe('validateWithShadow', () => {
    it('passes with valid migration creating a table', async () => {
      const driver = createShadowDriver();
      await driver.connect();

      try {
        await createMigrationFile(tmpDir, 'init', [
          'DEFINE TABLE project SCHEMAFULL',
          'DEFINE FIELD name ON project TYPE string',
          'DEFINE FIELD budget ON project TYPE float',
        ]);

        const result = await validateWithShadow(driver, {
          migrationsDir: tmpDir,
          migrationsTable: '__migrations',
          journalDir: path.join(tmpDir, 'meta'),
        });

        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.appliedCount).toBe(1);
      } finally {
        await driver.disconnect();
      }
    });

    it('catches invalid SQL in migration', async () => {
      const driver = createShadowDriver();
      await driver.connect();

      try {
        await createMigrationFile(tmpDir, 'bad_sql', ['DEFINE TABLE bad ALSO SCHEMAFULL INVALID']);

        const result = await validateWithShadow(driver, {
          migrationsDir: tmpDir,
          migrationsTable: '__migrations',
          journalDir: path.join(tmpDir, 'meta'),
        });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.appliedCount).toBe(0);
      } finally {
        await driver.disconnect();
      }
    });

    it('handles empty migrations directory', async () => {
      const driver = createShadowDriver();
      await driver.connect();

      try {
        const emptyDir = path.join(tmpDir, 'empty');
        await fs.mkdir(emptyDir, { recursive: true });

        const result = await validateWithShadow(driver, {
          migrationsDir: emptyDir,
          migrationsTable: '__migrations',
          journalDir: path.join(tmpDir, 'meta'),
        });

        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.appliedCount).toBe(0);
      } finally {
        await driver.disconnect();
      }
    });

    it('applies multiple migrations in order', async () => {
      const driver = createShadowDriver();
      await driver.connect();

      try {
        await createMigrationFile(tmpDir, 'first', [
          'DEFINE TABLE user SCHEMAFULL',
          'DEFINE FIELD name ON user TYPE string',
        ]);

        await new Promise((r) => setTimeout(r, 10));

        await createMigrationFile(tmpDir, 'second', ['DEFINE FIELD email ON user TYPE string']);

        const result = await validateWithShadow(driver, {
          migrationsDir: tmpDir,
          migrationsTable: '__migrations',
          journalDir: path.join(tmpDir, 'meta'),
        });

        expect(result.success).toBe(true);
        expect(result.appliedCount).toBe(2);
      } finally {
        await driver.disconnect();
      }
    });

    it('fails on second bad migration after first succeeds', async () => {
      const driver = createShadowDriver();
      await driver.connect();

      try {
        await createMigrationFile(tmpDir, 'first_ok', [
          'DEFINE TABLE item SCHEMAFULL',
          'DEFINE FIELD title ON item TYPE string',
        ]);

        await new Promise((r) => setTimeout(r, 10));

        await createMigrationFile(tmpDir, 'second_bad', ['DEFINE FIELD invalid STUFF']);

        const result = await validateWithShadow(driver, {
          migrationsDir: tmpDir,
          migrationsTable: '__migrations',
          journalDir: path.join(tmpDir, 'meta'),
        });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      } finally {
        await driver.disconnect();
      }
    });

    it('initializes migrations table after successful run', async () => {
      const driver = createShadowDriver();
      await driver.connect();

      try {
        await createMigrationFile(tmpDir, 'init', [
          'DEFINE TABLE workspace SCHEMAFULL',
          'DEFINE FIELD name ON workspace TYPE string',
        ]);

        await validateWithShadow(driver, {
          migrationsDir: tmpDir,
          migrationsTable: 'shadow_migrations',
          journalDir: path.join(tmpDir, 'meta'),
        });

        // Verify migration was recorded
        const records = await driver.query<{ name: string }>('SELECT name FROM shadow_migrations');
        expect(records).toHaveLength(1);
        expect(records[0].name).toBe('init');
      } finally {
        await driver.disconnect();
      }
    });

    it('validates migration with multiple column types', async () => {
      const driver = createShadowDriver();
      await driver.connect();

      try {
        await createMigrationFile(tmpDir, 'complex_types', [
          'DEFINE TABLE analytics SCHEMAFULL',
          'DEFINE FIELD event ON analytics TYPE string',
          'DEFINE FIELD count ON analytics TYPE int',
          'DEFINE FIELD ratio ON analytics TYPE float',
          'DEFINE FIELD active ON analytics TYPE bool',
          'DEFINE FIELD recorded_at ON analytics TYPE datetime',
        ]);

        const result = await validateWithShadow(driver, {
          migrationsDir: tmpDir,
          migrationsTable: '__migrations',
          journalDir: path.join(tmpDir, 'meta'),
        });

        expect(result.success).toBe(true);
        expect(result.appliedCount).toBe(1);
      } finally {
        await driver.disconnect();
      }
    });

    it('reapplies cleanly on second run (idempotent)', async () => {
      const driver = createShadowDriver();
      await driver.connect();

      try {
        await createMigrationFile(tmpDir, 'init', [
          'DEFINE TABLE test_table SCHEMAFULL',
          'DEFINE FIELD val ON test_table TYPE string',
        ]);

        const first = await validateWithShadow(driver, {
          migrationsDir: tmpDir,
          migrationsTable: '__migrations',
          journalDir: path.join(tmpDir, 'meta'),
        });
        expect(first.appliedCount).toBe(1);

        const second = await validateWithShadow(driver, {
          migrationsDir: tmpDir,
          migrationsTable: '__migrations',
          journalDir: path.join(tmpDir, 'meta'),
        });
        // Second run on shadow: reapplies from scratch (shadow is fresh each call)
        // Note: validateWithShadow creates its own runner which tracks via migrations table
        // After first run, second run should skip applied migrations
        expect(second.appliedCount).toBe(0);
        expect(second.success).toBe(true);
      } finally {
        await driver.disconnect();
      }
    });
  });
});
