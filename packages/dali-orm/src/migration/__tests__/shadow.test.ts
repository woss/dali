import * as fs from 'node:fs/promises';
import os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { EmbeddedDriver } from '../../sdk/driver/embedded-driver.js';
import { connectToShadow, validateWithShadow } from '../core/shadow.js';

// ============================================================================
// Helpers
// ============================================================================

function createShadowDriver(): EmbeddedDriver {
  return new EmbeddedDriver({
    driver: 'embedded',
    namespace: 'shadow_ns',
    database: 'shadow_db',
    mode: 'memory',
  });
}

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'shadow-test-'));
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

describe('Shadow DB Validation', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await createTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('guard logic', () => {
    it('throws when shadow ns/db matches target', async () => {
      const config = {
        url: 'http://localhost:10101',
        namespace: 'test_ns',
        database: 'test_db',
        schema: { dir: './schema', pattern: '*.ts' },
      };
      const shadow = { namespace: 'test_ns', database: 'test_db' };

      await expect(connectToShadow(config, shadow)).rejects.toThrow('cannot match target');
    });
  });

  describe('validateWithShadow', () => {
    it('passes with valid migrations', async () => {
      const driver = createShadowDriver();
      await driver.connect();

      try {
        await createMigrationFile(tmpDir, 'init', [
          'DEFINE TABLE user SCHEMAFULL',
          'DEFINE FIELD name ON user TYPE string',
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

    it('returns errors on invalid SQL', async () => {
      const driver = createShadowDriver();
      await driver.connect();

      try {
        await createMigrationFile(tmpDir, 'bad_migration', ['THIS IS NOT VALID SURREALQL']);

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

    it('handles empty migrations dir', async () => {
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

    it('fails if second migration is bad after first succeeds', async () => {
      const driver = createShadowDriver();
      await driver.connect();

      try {
        await createMigrationFile(tmpDir, 'first', [
          'DEFINE TABLE user SCHEMAFULL',
          'DEFINE FIELD name ON user TYPE string',
        ]);

        await new Promise((r) => setTimeout(r, 10));

        await createMigrationFile(tmpDir, 'bad', ['INVALID SQL STATEMENT']);

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

    it('initializes migrations table after successful validation', async () => {
      const driver = createShadowDriver();
      await driver.connect();

      try {
        await createMigrationFile(tmpDir, 'init', ['DEFINE TABLE test SCHEMAFULL']);

        const result = await validateWithShadow(driver, {
          migrationsDir: tmpDir,
          migrationsTable: 'shadow_migrations',
          journalDir: path.join(tmpDir, 'meta'),
        });

        expect(result.success).toBe(true);

        const records = await driver.query<{ name: string }>('SELECT name FROM shadow_migrations');
        expect(records).toHaveLength(1);
        expect(records[0].name).toBe('init');
      } finally {
        await driver.disconnect();
      }
    });
  });
});
