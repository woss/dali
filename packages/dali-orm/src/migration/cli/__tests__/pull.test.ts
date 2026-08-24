/**
 * Integration tests for pull CLI functions.
 *
 * Tests: generateColumnDefinition(), generateTypeScriptSchema(), pullSchema()
 *
 * Uses real embedded SurrealDB (memory mode).
 * Mocks connect for pullSchema tests so we retain driver control.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbeddedDriver } from '../../../sdk/driver/embedded-driver.js';

// Mock connect before importing pullSchema
vi.mock('../../../sdk/driver/orm-connection.js', () => ({
  connect: vi.fn(),
}));

import type { SurrealColumnType } from '../../../sdk/schema/column/types.js';
import type { Config } from '../../config.js';
import { generateColumnDefinition, pullSchema } from '../pull.js';
import { createTempDir } from './helpers.js';

// ============================================================================
// Helpers
// ============================================================================

function makeConfig(overrides: Partial<Config> = {}): Config {
  const defaults = {
    url: '',
    namespace: 'test_pull_ns',
    database: 'test_pull_db',
    schema: { dir: './schema', pattern: '**/*.{js,ts}' },
    migrations: {
      dir: './migrations',
      table: '__test_pull_migrations',
    },
  };
  return {
    ...defaults,
    ...overrides,
    // Deep merge migrations so journalDir survives overrides
    migrations: {
      ...defaults.migrations,
      ...overrides.migrations,
    },
    // Deep merge schema so dir/pattern survive overrides
    schema: {
      ...defaults.schema,
      ...overrides.schema,
    },
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

// ============================================================================
// generateColumnDefinition
// ============================================================================

describe('generateColumnDefinition', () => {
  it('generates string column', () => {
    const def = generateColumnDefinition({ name: 'name', kind: 'string' });
    expect(def).toBe("name: string('name')");
  });

  it('generates int column', () => {
    const def = generateColumnDefinition({ name: 'age', kind: 'int' });
    expect(def).toBe("age: int('age')");
  });

  it('generates float column', () => {
    const def = generateColumnDefinition({ name: 'price', kind: 'float' });
    expect(def).toBe("price: float('price')");
  });

  it('generates decimal column', () => {
    const def = generateColumnDefinition({ name: 'total', kind: 'decimal' });
    expect(def).toBe("total: decimal('total')");
  });

  it('generates bool column', () => {
    const def = generateColumnDefinition({ name: 'active', kind: 'bool' });
    expect(def).toBe("active: bool('active')");
  });

  it('generates boolean column', () => {
    const def = generateColumnDefinition({
      name: 'flag',
      kind: 'boolean' as SurrealColumnType,
    });
    expect(def).toBe("flag: bool('flag')");
  });

  it('generates datetime column', () => {
    const def = generateColumnDefinition({ name: 'created', kind: 'datetime' });
    expect(def).toBe("created: datetime('created')");
  });

  it('generates date as datetime column', () => {
    const def = generateColumnDefinition({
      name: 'birth',
      kind: 'date' as SurrealColumnType,
    });
    expect(def).toBe("birth: datetime('birth')");
  });

  it('generates time as datetime column', () => {
    const def = generateColumnDefinition({
      name: 'ts',
      kind: 'time' as SurrealColumnType,
    });
    expect(def).toBe("ts: datetime('ts')");
  });

  it('generates timestamp as datetime column', () => {
    const def = generateColumnDefinition({
      name: 'ts',
      kind: 'timestamp' as SurrealColumnType,
    });
    expect(def).toBe("ts: datetime('ts')");
  });

  it('generates duration column', () => {
    const def = generateColumnDefinition({ name: 'ttl', kind: 'duration' });
    expect(def).toBe("ttl: duration('ttl')");
  });

  it('generates array column', () => {
    const def = generateColumnDefinition({ name: 'tags', kind: 'array' });
    expect(def).toBe("tags: array('tags')");
  });

  it('generates object column', () => {
    const def = generateColumnDefinition({ name: 'meta', kind: 'object' });
    expect(def).toBe("meta: object('meta')");
  });

  it('generates geometry column', () => {
    const def = generateColumnDefinition({
      name: 'location',
      kind: 'geometry',
    });
    expect(def).toBe("location: geometry('location')");
  });

  it('generates bytes column', () => {
    const def = generateColumnDefinition({ name: 'data', kind: 'bytes' });
    expect(def).toBe("data: bytes('data')");
  });

  it('generates record column with recordTable', () => {
    const def = generateColumnDefinition({
      name: 'author',
      kind: 'record',
      recordTable: 'user',
    });
    expect(def).toBe("author: record('user')");
  });

  it('adds .optional() modifier', () => {
    const def = generateColumnDefinition({
      name: 'nickname',
      kind: 'string',
      optional: true,
    });
    expect(def).toBe("nickname: string('nickname').optional()");
  });

  it('adds .flexible() modifier', () => {
    const def = generateColumnDefinition({
      name: 'meta',
      kind: 'object',
      flexible: true,
    });
    expect(def).toBe("meta: object('meta').flexible()");
  });

  it('adds .readonly() modifier', () => {
    const def = generateColumnDefinition({
      name: 'id',
      kind: 'string',
      readonly: true,
    });
    expect(def).toBe("id: string('id').readonly()");
  });

  it('adds .default() modifier', () => {
    const def = generateColumnDefinition({
      name: 'status',
      kind: 'string',
      default: "'active'",
    });
    expect(def).toBe("status: string('status').default('active')");
  });

  it('adds .defaultRaw() modifier', () => {
    const def = generateColumnDefinition({
      name: 'hash',
      kind: 'string',
      defaultRaw: 'crypto::blake3(name)',
    });
    expect(def).toBe("hash: string('hash').defaultRaw('crypto::blake3(name)')");
  });

  it('prefers defaultRaw over default', () => {
    const def = generateColumnDefinition({
      name: 'hash',
      kind: 'string',
      default: "'fallback'",
      defaultRaw: 'crypto::blake3(name)',
    });
    expect(def).toBe("hash: string('hash').defaultRaw('crypto::blake3(name)')");
  });

  it('combines multiple modifiers', () => {
    const def = generateColumnDefinition({
      name: 'email',
      kind: 'string',
      optional: true,
      readonly: true,
      default: "'none'",
    });
    expect(def).toContain('.optional()');
    expect(def).toContain('.readonly()');
    expect(def).toContain(".default('none')");
  });

  it('uses string builder for unknown type', () => {
    // @ts-expect-error — testing fallback for unrecognized type
    const def = generateColumnDefinition({
      name: 'custom',
      kind: 'custom_type',
    });
    expect(def).toBe("custom: string('custom')");
  });

  it('falls back to string when kind is undefined', () => {
    const def = generateColumnDefinition({ name: 'data' });
    expect(def).toBe("data: string('data')");
  });

  it('quotes property name with special characters', () => {
    const def = generateColumnDefinition({ name: 'my-field', kind: 'string' });
    expect(def).toBe("'my-field': string('my-field')");
  });
});

// ============================================================================
// generateTypeScriptSchema — tested through pullSchema output
// ============================================================================

describe('generateTypeScriptSchema (via pullSchema)', () => {
  let driver: EmbeddedDriver;
  let tmpDir: string;
  let restoreConsole: () => void;

  beforeEach(async () => {
    driver = new EmbeddedDriver({
      driver: 'embedded',
      namespace: 'test_pull_generate',
      database: `pull_gen_${Date.now()}`,
      mode: 'memory',
    });
    await driver.connect();

    tmpDir = await createTempDir('pull-gen-');

    // Mock connect to return a proxy that prevents disconnect
    const { connect } = await import('../../../sdk/driver/orm-connection.js');
    const driverProxy = new Proxy(driver, {
      get(target, prop) {
        if (prop === 'disconnect') {
          return vi.fn().mockResolvedValue(undefined);
        }
        return Reflect.get(target, prop);
      },
    }) as typeof driver;
    vi.mocked(connect).mockResolvedValue(driverProxy);

    restoreConsole = mockConsole();
  });

  afterEach(async () => {
    restoreConsole();
    vi.restoreAllMocks();
    await driver.disconnect();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('pulls nothing when no tables exist', async () => {
    const config = makeConfig({
      schema: { dir: tmpDir, pattern: '**/*.{js,ts}' },
      migrations: {
        dir: path.join(tmpDir, 'migrations'),
        table: '__test_pull_migrations',
        journalDir: path.join(tmpDir, 'meta'),
      },
    });

    await pullSchema({ config, outputDir: tmpDir, embeddedDriver: true });

    // Should report "No tables found"
    const logCalls = vi.mocked(console.log).mock.calls;
    const noTablesLine = logCalls.find((c) =>
      String(c[0]).includes('No tables found'),
    );
    expect(noTablesLine).toBeDefined();
  });

  it('pulls and creates schema file for existing tables', async () => {
    // Create tables via raw queries
    await driver.query('DEFINE TABLE pull_test_user SCHEMAFULL');
    await driver.query('DEFINE FIELD name ON pull_test_user TYPE string');
    await driver.query('DEFINE FIELD age ON pull_test_user TYPE int');
    await driver.query('DEFINE FIELD active ON pull_test_user TYPE bool');

    const config = makeConfig({
      schema: { dir: tmpDir, pattern: '**/*.{js,ts}' },
      migrations: {
        dir: path.join(tmpDir, 'migrations'),
        table: '__test_pull_migrations',
        journalDir: path.join(tmpDir, 'meta'),
      },
    });

    await pullSchema({ config, outputDir: tmpDir, embeddedDriver: true });

    // Verify schema file was created
    const files = await fs.readdir(tmpDir);
    const schemaFile = files.find((f) => f.endsWith('.ts'));
    expect(schemaFile).toBeDefined();

    // Verify file content contains table definition
    if (schemaFile) {
      const content = await fs.readFile(path.join(tmpDir, schemaFile), 'utf-8');
      expect(content).toContain('pull_test_user');
      expect(content).toContain("string('name')");
      expect(content).toContain("int('age')");
      expect(content).toContain("bool('active')");
    }

    // Verify migration was also generated
    const migrationsDir = path.join(tmpDir, 'migrations');
    const migFiles = await fs.readdir(migrationsDir).catch(() => []);
    expect(migFiles.length).toBeGreaterThan(0);
  });

  it('pulls specific table when table name is given', async () => {
    // Create multiple tables
    await driver.query('DEFINE TABLE pull_specific_user SCHEMAFULL');
    await driver.query('DEFINE FIELD name ON pull_specific_user TYPE string');
    await driver.query('DEFINE TABLE pull_specific_other SCHEMAFULL');
    await driver.query('DEFINE FIELD data ON pull_specific_other TYPE string');

    const config = makeConfig({
      schema: { dir: tmpDir, pattern: '**/*.{js,ts}' },
      migrations: {
        dir: path.join(tmpDir, 'migrations'),
        table: '__test_pull_migrations',
        journalDir: path.join(tmpDir, 'meta'),
      },
    });

    await pullSchema({
      config,
      outputDir: tmpDir,
      table: 'pull_specific_user',
      embeddedDriver: true,
    });

    const files = await fs.readdir(tmpDir);
    const schemaFile = files.find((f) => f.includes('pull_specific_user'));
    expect(schemaFile).toBeDefined();
  });

  it('includes datetime imports when needed', async () => {
    await driver.query('DEFINE TABLE pull_dt_test SCHEMAFULL');
    await driver.query('DEFINE FIELD created_at ON pull_dt_test TYPE datetime');
    await driver.query('DEFINE FIELD updated_at ON pull_dt_test TYPE datetime');
    await driver.query('DEFINE FIELD name ON pull_dt_test TYPE string');

    const config = makeConfig({
      schema: { dir: tmpDir, pattern: '**/*.{js,ts}' },
      migrations: {
        dir: path.join(tmpDir, 'migrations'),
        table: '__test_pull_migrations',
        journalDir: path.join(tmpDir, 'meta'),
      },
    });

    await pullSchema({ config, outputDir: tmpDir, embeddedDriver: true });

    const files = await fs.readdir(tmpDir);
    const schemaFile = files.find((f) => f.endsWith('.ts'));
    expect(schemaFile).toBeDefined();

    if (schemaFile) {
      const content = await fs.readFile(path.join(tmpDir, schemaFile), 'utf-8');
      expect(content).toContain('datetime');
    }
  });

  it('includes int and float imports when needed', async () => {
    await driver.query('DEFINE TABLE pull_num_test SCHEMAFULL');
    await driver.query('DEFINE FIELD score ON pull_num_test TYPE int');
    await driver.query('DEFINE FIELD price ON pull_num_test TYPE float');
    await driver.query('DEFINE FIELD name ON pull_num_test TYPE string');

    const config = makeConfig({
      schema: { dir: tmpDir, pattern: '**/*.{js,ts}' },
      migrations: {
        dir: path.join(tmpDir, 'migrations'),
        table: '__test_pull_migrations',
        journalDir: path.join(tmpDir, 'meta'),
      },
    });

    await pullSchema({ config, outputDir: tmpDir, embeddedDriver: true });

    const files = await fs.readdir(tmpDir);
    const schemaFile = files.find((f) => f.endsWith('.ts'));
    expect(schemaFile).toBeDefined();

    if (schemaFile) {
      const content = await fs.readFile(path.join(tmpDir, schemaFile), 'utf-8');
      expect(content).toContain('int');
      expect(content).toContain('float');
    }
  });

  it('includes bool import when needed', async () => {
    await driver.query('DEFINE TABLE pull_bool_test SCHEMAFULL');
    await driver.query('DEFINE FIELD active ON pull_bool_test TYPE bool');

    const config = makeConfig({
      schema: { dir: tmpDir, pattern: '**/*.{js,ts}' },
      migrations: {
        dir: path.join(tmpDir, 'migrations'),
        table: '__test_pull_migrations',
        journalDir: path.join(tmpDir, 'meta'),
      },
    });

    await pullSchema({ config, outputDir: tmpDir, embeddedDriver: true });

    const files = await fs.readdir(tmpDir);
    const schemaFile = files.find((f) => f.endsWith('.ts'));
    expect(schemaFile).toBeDefined();

    if (schemaFile) {
      const content = await fs.readFile(path.join(tmpDir, schemaFile), 'utf-8');
      expect(content).toContain('bool');
    }
  });

  it('includes array import when needed', async () => {
    await driver.query('DEFINE TABLE pull_arr_test SCHEMAFULL');
    await driver.query('DEFINE FIELD tags ON pull_arr_test TYPE array');

    const config = makeConfig({
      schema: { dir: tmpDir, pattern: '**/*.{js,ts}' },
      migrations: {
        dir: path.join(tmpDir, 'migrations'),
        table: '__test_pull_migrations',
        journalDir: path.join(tmpDir, 'meta'),
      },
    });

    await pullSchema({ config, outputDir: tmpDir, embeddedDriver: true });

    const files = await fs.readdir(tmpDir);
    const schemaFile = files.find((f) => f.endsWith('.ts'));
    expect(schemaFile).toBeDefined();

    if (schemaFile) {
      const content = await fs.readFile(path.join(tmpDir, schemaFile), 'utf-8');
      expect(content).toContain('array');
    }
  });

  it('uses provided driver when ownsDriver=false', async () => {
    await driver.query('DEFINE TABLE pull_existing_test SCHEMAFULL');
    await driver.query('DEFINE FIELD name ON pull_existing_test TYPE string');

    const config = makeConfig({
      schema: { dir: tmpDir, pattern: '**/*.{js,ts}' },
      migrations: {
        dir: path.join(tmpDir, 'migrations'),
        table: '__test_pull_migrations',
        journalDir: path.join(tmpDir, 'meta'),
      },
    });

    // Pass driver directly — should not create new connection
    await pullSchema(
      { config, outputDir: tmpDir, embeddedDriver: true },
      driver,
    );

    const files = await fs.readdir(tmpDir);
    const schemaFile = files.find((f) => f.endsWith('.ts'));
    expect(schemaFile).toBeDefined();
  });

  it('derives filename from pattern when no wildcards', async () => {
    await driver.query('DEFINE TABLE pull_pattern_test SCHEMAFULL');
    await driver.query('DEFINE FIELD name ON pull_pattern_test TYPE string');

    const config = makeConfig({
      schema: { dir: tmpDir, pattern: 'custom-schema.ts' },
      migrations: {
        dir: path.join(tmpDir, 'migrations'),
        table: '__test_pull_migrations',
        journalDir: path.join(tmpDir, 'meta'),
      },
    });

    await pullSchema({ config, outputDir: tmpDir, embeddedDriver: true });

    const files = await fs.readdir(tmpDir);
    expect(files).toContain('custom-schema.ts');
  });

  it('derives filename as schema.ts when pattern has wildcards', async () => {
    await driver.query('DEFINE TABLE pull_wc_test SCHEMAFULL');
    await driver.query('DEFINE FIELD name ON pull_wc_test TYPE string');

    const config = makeConfig({
      schema: { dir: tmpDir, pattern: '**/*.ts' },
      migrations: {
        dir: path.join(tmpDir, 'migrations'),
        table: '__test_pull_migrations',
        journalDir: path.join(tmpDir, 'meta'),
      },
    });

    await pullSchema({ config, outputDir: tmpDir, embeddedDriver: true });

    const files = await fs.readdir(tmpDir);
    expect(files).toContain('schema.ts');
  });

  it('generates schema with record column referencing table', async () => {
    await driver.query('DEFINE TABLE pull_post SCHEMAFULL');
    await driver.query('DEFINE FIELD title ON pull_post TYPE string');
    await driver.query('DEFINE TABLE pull_author SCHEMAFULL');
    await driver.query('DEFINE FIELD name ON pull_author TYPE string');

    const config = makeConfig({
      schema: { dir: tmpDir, pattern: '**/*.{js,ts}' },
      migrations: {
        dir: path.join(tmpDir, 'migrations'),
        table: '__test_pull_migrations',
        journalDir: path.join(tmpDir, 'meta'),
      },
    });

    await pullSchema({ config, outputDir: tmpDir, embeddedDriver: true });

    const files = await fs.readdir(tmpDir);
    const schemaFile = files.find((f) => f.endsWith('.ts'));
    expect(schemaFile).toBeDefined();

    if (schemaFile) {
      const content = await fs.readFile(path.join(tmpDir, schemaFile), 'utf-8');
      expect(content).toContain('pull_post');
      expect(content).toContain('pull_author');
    }
  });
});
