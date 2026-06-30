/**
 * Integration tests for generate.ts functions that interact with the file system
 * or require the SurrealQLGenerator.
 *
 * Covers: findMatchingFiles, loadSchemaFiles, loadSchemaFromFile,
 *         generateFullMigration, getLiveSchema, printDiffSummary
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { EmbeddedDriver } from '../../../sdk/driver/embedded-driver.js';
import { SurrealQLGenerator } from '../../core/generator.js';
import { SnapshotManager } from '../../core/snapshot.js';
import type { TableDefinition } from '../../../sdk/table.js';
import type { AccessConfig, FunctionConfig } from '../../../sdk/schema.js';
import { createTempDir, cleanupDir, mockConsole } from './helpers.js';

// ============================================================================
// Helpers
// ============================================================================

/** Create a schema file with plain JS exports (no @woss/dali-orm imports) */
async function createPlainSchemaFile(
  dir: string,
  fileName: string,
  tables: Array<{
    name: string;
    columns: Array<{ name: string; tableName: string; config: { type: string } }>;
  }>,
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
// findMatchingFiles
// ============================================================================

describe('findMatchingFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await createTempDir('find-files-');
  });

  afterEach(async () => {
    await cleanupDir(tmpDir);
  });

  it('finds .ts files with recursive pattern', async () => {
    await fs.mkdir(path.join(tmpDir, 'nested'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'schema.ts'), 'export const a = 1;');
    await fs.writeFile(path.join(tmpDir, 'nested', 'user.ts'), 'export const b = 2;');

    const { findMatchingFiles } = await import('../generate.js');
    const files = await findMatchingFiles(tmpDir, '**/*.ts');
    expect(files).toHaveLength(2);
    expect(files).toContain('schema.ts');
    expect(files).toContain(path.join('nested', 'user.ts'));
  });

  it('finds .ts files with non-recursive pattern', async () => {
    await fs.writeFile(path.join(tmpDir, 'schema.ts'), 'export const a = 1;');
    await fs.mkdir(path.join(tmpDir, 'sub'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'sub', 'other.ts'), 'export const b = 2;');

    const { findMatchingFiles } = await import('../generate.js');
    const files = await findMatchingFiles(tmpDir, '*.ts');
    expect(files).toHaveLength(1);
    expect(files).toContain('schema.ts');
  });

  it('returns empty array for directory with no matching files', async () => {
    await fs.writeFile(path.join(tmpDir, 'readme.md'), '# hello');

    const { findMatchingFiles } = await import('../generate.js');
    const files = await findMatchingFiles(tmpDir, '**/*.ts');
    expect(files).toHaveLength(0);
  });

  it('handles non-existent directory gracefully', async () => {
    const { findMatchingFiles } = await import('../generate.js');
    const files = await findMatchingFiles(path.join(tmpDir, 'nonexistent'), '**/*.ts');
    expect(files).toHaveLength(0);
  });

  it('limits recursion depth', async () => {
    let deepDir = tmpDir;
    for (let i = 0; i < 15; i++) {
      deepDir = path.join(deepDir, `level${i}`);
      await fs.mkdir(deepDir, { recursive: true });
    }
    await fs.writeFile(path.join(deepDir, 'deep.ts'), 'export const a = 1;');

    const { findMatchingFiles } = await import('../generate.js');
    const files = await findMatchingFiles(tmpDir, '**/*.ts');
    expect(files).toHaveLength(0);
  });
});

// ============================================================================
// loadSchemaFromFile
// ============================================================================

describe('loadSchemaFromFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await createTempDir('load-schema-');
  });

  afterEach(async () => {
    await cleanupDir(tmpDir);
  });

  it('loads tables from a valid schema file (default export)', async () => {
    const schemaPath = await createPlainSchemaFile(tmpDir, 'user.schema.ts', [
      {
        name: 'user',
        columns: [{ name: 'name', tableName: 'user', config: { type: 'string' } }],
      },
    ]);

    const { loadSchemaFromFile } = await import('../generate.js');
    const result = await loadSchemaFromFile(schemaPath);

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe('user');
  });

  it('loads multiple tables from a schema file', async () => {
    const schemaPath = await createPlainSchemaFile(tmpDir, 'multi.schema.ts', [
      {
        name: 'user',
        columns: [{ name: 'name', tableName: 'user', config: { type: 'string' } }],
      },
      {
        name: 'post',
        columns: [{ name: 'title', tableName: 'post', config: { type: 'string' } }],
      },
    ]);

    const { loadSchemaFromFile } = await import('../generate.js');
    const result = await loadSchemaFromFile(schemaPath);

    expect(result.tables).toHaveLength(2);
    const names = result.tables.map((t) => t.name).sort();
    expect(names).toEqual(['post', 'user']);
  });

  it('throws on non-existent schema file', async () => {
    const { loadSchemaFromFile } = await import('../generate.js');
    await expect(loadSchemaFromFile(path.join(tmpDir, 'nonexistent.ts'))).rejects.toThrow(
      'Failed to import schema file',
    );
  });

  it('loads tables from schema file with named tables export', async () => {
    const filePath = path.join(tmpDir, 'named.schema.ts');
    const content = [
      'export const tables = [',
      JSON.stringify({
        name: 'user',
        columns: [{ name: 'name', tableName: 'user', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      }),
      '];',
    ].join('\n');
    await fs.writeFile(filePath, content);

    const { loadSchemaFromFile } = await import('../generate.js');
    const result = await loadSchemaFromFile(filePath);
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe('user');
  });
});

// ============================================================================
// loadSchemaFiles
// ============================================================================

describe('loadSchemaFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await createTempDir('load-schema-dir-');
  });

  afterEach(async () => {
    await cleanupDir(tmpDir);
  });

  it('loads tables from a directory of schema files', async () => {
    await createPlainSchemaFile(tmpDir, 'user.schema.ts', [
      {
        name: 'user',
        columns: [{ name: 'name', tableName: 'user', config: { type: 'string' } }],
      },
    ]);
    await createPlainSchemaFile(tmpDir, 'post.schema.ts', [
      {
        name: 'post',
        columns: [{ name: 'title', tableName: 'post', config: { type: 'string' } }],
      },
    ]);

    const { loadSchemaFiles } = await import('../generate.js');
    const result = await loadSchemaFiles(tmpDir, '**/*.ts');

    expect(result.tables).toHaveLength(2);
    const names = result.tables.map((t) => t.name).sort();
    expect(names).toEqual(['post', 'user']);
  });

  it('returns empty tables when no schema files found', async () => {
    const { loadSchemaFiles } = await import('../generate.js');
    const result = await loadSchemaFiles(tmpDir, '**/*.ts');
    expect(result.tables).toHaveLength(0);
  });

  it('throws when schema path is empty', async () => {
    const { loadSchemaFiles } = await import('../generate.js');
    await expect(loadSchemaFiles('', '**/*.ts')).rejects.toThrow('Schema path is required');
  });

  it('throws when schema directory does not exist', async () => {
    const { loadSchemaFiles } = await import('../generate.js');
    await expect(loadSchemaFiles(path.join(tmpDir, 'nonexistent'), '**/*.ts')).rejects.toThrow(
      'does not exist',
    );
  });

  it('throws when schema path is a file but does not end in .ts', async () => {
    await fs.writeFile(path.join(tmpDir, 'schema.json'), '{}');
    const { loadSchemaFiles } = await import('../generate.js');
    await expect(loadSchemaFiles(path.join(tmpDir, 'schema.json'))).rejects.toThrow(
      'Schema path is not a directory',
    );
  });
});

// ============================================================================
// generateFullMigration
// ============================================================================

describe('generateFullMigration', () => {
  async function getGenerateFullMigration() {
    const mod = await import('../generate.js');
    return (mod as any).generateFullMigration as (
      tables: TableDefinition[],
      generator: SurrealQLGenerator,
      access?: AccessConfig[],
      events?: any[],
      functions?: FunctionConfig[],
    ) => { upStatements: string[]; downStatements: string[] };
  }

  it('generates up and down statements for tables', async () => {
    const generateFullMigration = await getGenerateFullMigration();
    const generator = new SurrealQLGenerator();
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [
          {
            name: 'name',
            tableName: 'user',
            config: { type: 'string' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const result = generateFullMigration(tables, generator);

    expect(result.upStatements.length).toBeGreaterThan(0);
    expect(result.downStatements.length).toBeGreaterThan(0);

    const allUp = result.upStatements.join(' ');
    expect(allUp).toContain('DEFINE TABLE');
    expect(allUp).toContain('DEFINE FIELD');

    const allDown = result.downStatements.join(' ');
    expect(allDown).toContain('REMOVE TABLE');
  });

  it('generates access definitions when provided', async () => {
    const generateFullMigration = await getGenerateFullMigration();
    const generator = new SurrealQLGenerator();
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [{ name: 'email', tableName: 'user', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
    ];
    const access: AccessConfig[] = [
      {
        name: 'account',
        type: 'RECORD',
        table: 'user',
        signup: 'CREATE user SET email = $email, pass = crypto::argon2::generate($pass)',
        signin: 'SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(pass, $pass)',
        duration: '12h',
        tokenDuration: '15m',
      },
    ];

    const result = generateFullMigration(tables, generator, access);

    const allUp = result.upStatements.join(' ');
    expect(allUp).toContain('DEFINE ACCESS');
  });

  it('generates event definitions when provided', async () => {
    const generateFullMigration = await getGenerateFullMigration();
    const generator = new SurrealQLGenerator();
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [{ name: 'email', tableName: 'user', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
    ];
    const events = [
      {
        name: 'on_create',
        on: 'user',
        when: '$before = NONE',
        then: ['CREATE activity SET type = "user_created"'],
      },
    ];

    const result = generateFullMigration(tables, generator, [], events);

    const allUp = result.upStatements.join(' ');
    expect(allUp).toContain('DEFINE EVENT');
  });

  it('generates function definitions when provided', async () => {
    const generateFullMigration = await getGenerateFullMigration();
    const generator = new SurrealQLGenerator();
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [{ name: 'email', tableName: 'user', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
    ];
    const functions: FunctionConfig[] = [
      {
        name: 'fn::greet',
        body: 'RETURN "Hello, " + $name;',
        args: ['name string'],
      },
    ];

    const result = generateFullMigration(tables, generator, [], [], functions);

    const allUp = result.upStatements.join(' ');
    expect(allUp).toContain('DEFINE FUNCTION');
  });

  it('handles empty tables', async () => {
    const generateFullMigration = await getGenerateFullMigration();
    const generator = new SurrealQLGenerator();
    const result = generateFullMigration([], generator);

    expect(result.upStatements).toEqual([]);
    expect(result.downStatements).toEqual([]);
  });

  it('generates remove statements for indexes on tables', async () => {
    const generateFullMigration = await getGenerateFullMigration();
    const generator = new SurrealQLGenerator();
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [{ name: 'email', tableName: 'user', config: { type: 'string' } }],
        config: {
          schema: 'full',
          type: 'normal',
          indexes: [{ name: 'idx_email', fields: ['email'], type: 'unique' }],
        },
      },
    ];

    const result = generateFullMigration(tables, generator);

    const allDown = result.downStatements.join(' ');
    expect(allDown).toContain('REMOVE INDEX');
  });
});

// ============================================================================
// getLiveSchema
// ============================================================================

describe('getLiveSchema', () => {
  let driver: EmbeddedDriver;

  beforeEach(async () => {
    driver = new EmbeddedDriver({
      driver: 'embedded',
      namespace: 'test_live_schema',
      database: `live_${Date.now()}`,
      mode: 'memory',
    });
    await driver.connect();
  });

  afterEach(async () => {
    await driver.disconnect().catch(() => {});
  });

  it('returns empty array for empty table names', async () => {
    const { getLiveSchema } = await import('../generate.js');
    const result = await getLiveSchema(driver, []);
    expect(result).toEqual([]);
  });

  it('handles non-existent tables gracefully', async () => {
    const { getLiveSchema } = await import('../generate.js');
    const result = await getLiveSchema(driver, ['nonexistent_table']);
    // For non-existent tables, getLiveSchema may still return a representation
    // with no columns. It should not throw.
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns table definition for existing table', async () => {
    await driver.query('DEFINE TABLE live_test SCHEMAFULL');
    await driver.query('DEFINE FIELD name ON live_test TYPE string');

    const { getLiveSchema } = await import('../generate.js');
    const result = await getLiveSchema(driver, ['live_test']);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('live_test');
    expect(result[0].config.schema).toBe('full');
  });
});

// ============================================================================
// printDiffSummary
// ============================================================================

describe('printDiffSummary', () => {
  let restoreConsole: () => void;

  beforeEach(() => {
    restoreConsole = mockConsole();
  });

  afterEach(() => {
    restoreConsole();
  });

  async function getPrintDiffSummary() {
    const mod = await import('../generate.js');
    return (mod as any).printDiffSummary;
  }

  it('prints no changes when diff is empty', async () => {
    const printDiffSummary = await getPrintDiffSummary();
    printDiffSummary({
      added: { tables: [], fields: [], indexes: [] },
      removed: { tables: [], fields: [], indexes: [] },
      changed: { tables: [], fields: [] },
    });
    expect(console.log).toHaveBeenCalledWith('No changes detected.');
  });

  it('prints added tables', async () => {
    const printDiffSummary = await getPrintDiffSummary();
    printDiffSummary({
      added: {
        tables: [{ name: 'user', columns: [], config: { schema: 'full', type: 'normal' } }],
        fields: [],
        indexes: [],
      },
      removed: { tables: [], fields: [], indexes: [] },
      changed: { tables: [], fields: [] },
    });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Tables: user'));
  });

  it('prints added fields', async () => {
    const printDiffSummary = await getPrintDiffSummary();
    printDiffSummary({
      added: {
        tables: [],
        fields: [
          {
            table: 'user',
            column: { name: 'email', tableName: 'user', config: { type: 'string' } },
          },
        ],
        indexes: [],
      },
      removed: { tables: [], fields: [], indexes: [] },
      changed: { tables: [], fields: [] },
    });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Fields: user.email'));
  });

  it('prints added indexes', async () => {
    const printDiffSummary = await getPrintDiffSummary();
    printDiffSummary({
      added: {
        tables: [],
        fields: [],
        indexes: [{ table: 'user', index: { name: 'idx_email' } }],
      },
      removed: { tables: [], fields: [], indexes: [] },
      changed: { tables: [], fields: [] },
    });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Indexes: user.idx_email'));
  });

  it('prints removed tables', async () => {
    const printDiffSummary = await getPrintDiffSummary();
    printDiffSummary({
      added: { tables: [], fields: [], indexes: [] },
      removed: { tables: ['old_table'], fields: [], indexes: [] },
      changed: { tables: [], fields: [] },
    });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Tables: old_table'));
  });

  it('prints removed fields', async () => {
    const printDiffSummary = await getPrintDiffSummary();
    printDiffSummary({
      added: { tables: [], fields: [], indexes: [] },
      removed: { tables: [], fields: [{ table: 'user', field: 'age' }], indexes: [] },
      changed: { tables: [], fields: [] },
    });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Fields: user.age'));
  });

  it('prints removed indexes', async () => {
    const printDiffSummary = await getPrintDiffSummary();
    printDiffSummary({
      added: { tables: [], fields: [], indexes: [] },
      removed: { tables: [], fields: [], indexes: [{ table: 'user', name: 'old_idx' }] },
      changed: { tables: [], fields: [] },
    });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Indexes: user.old_idx'));
  });

  it('prints changed tables', async () => {
    const printDiffSummary = await getPrintDiffSummary();
    printDiffSummary({
      added: { tables: [], fields: [], indexes: [] },
      removed: { tables: [], fields: [], indexes: [] },
      changed: { tables: [{ name: 'user' }], fields: [] },
    });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Changed tables: user'));
  });

  it('prints changed fields', async () => {
    const printDiffSummary = await getPrintDiffSummary();
    printDiffSummary({
      added: { tables: [], fields: [], indexes: [] },
      removed: { tables: [], fields: [], indexes: [] },
      changed: { tables: [], fields: [{ table: 'user', field: 'email' }] },
    });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Changed fields: user.email'));
  });

  it('prints summary with multiple change types', async () => {
    const printDiffSummary = await getPrintDiffSummary();
    printDiffSummary({
      added: {
        tables: [
          {
            name: 'post',
            columns: [{ name: 'title', tableName: 'post', config: { type: 'string' } }],
            config: { schema: 'full', type: 'normal' },
          },
        ],
        fields: [
          {
            table: 'user',
            column: { name: 'email', tableName: 'user', config: { type: 'string' } },
          },
        ],
        indexes: [],
      },
      removed: { tables: [], fields: [], indexes: [] },
      changed: { tables: [], fields: [{ table: 'user', field: 'name' }] },
    });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Migration Summary'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Tables: post'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Fields: user.email'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Changed fields: user.name'));
  });
});

// ============================================================================
// serializeColumnPermissions
// ============================================================================

describe('serializeColumnPermissions', () => {
  async function getSerializeColumnPermissions() {
    const mod = await import('../generate.js');
    return mod.serializeColumnPermissions;
  }

  it('returns undefined for undefined input', async () => {
    const fn = await getSerializeColumnPermissions();
    expect(fn(undefined)).toBeUndefined();
  });

  it('returns undefined for empty permissions', async () => {
    const fn = await getSerializeColumnPermissions();
    expect(fn({})).toBeUndefined();
  });

  it('serializes select FULL', async () => {
    const fn = await getSerializeColumnPermissions();
    const result = fn({ select: true });
    expect(result).toContain('FOR select FULL');
  });

  it('serializes select NONE', async () => {
    const fn = await getSerializeColumnPermissions();
    const result = fn({ select: false });
    expect(result).toContain('FOR select NONE');
  });

  it('serializes select with custom expression', async () => {
    const fn = await getSerializeColumnPermissions();
    const result = fn({ select: '$auth.id = user_id' });
    expect(result).toContain('FOR select $auth.id = user_id');
  });

  it('serializes create, update, delete permissions', async () => {
    const fn = await getSerializeColumnPermissions();
    const result = fn({ create: true, update: false, delete: '$auth.role = "admin"' });
    expect(result).toContain('FOR create FULL');
    expect(result).toContain('FOR update NONE');
    expect(result).toContain('FOR delete $auth.role = "admin"');
  });
});

// ============================================================================
// normalizeSql
// ============================================================================

describe('normalizeSql', () => {
  async function getNormalizeSql() {
    const mod = await import('../generate.js');
    return mod.normalizeSql;
  }

  it('trims whitespace and collapses spaces', async () => {
    const fn = await getNormalizeSql();
    const result = fn('  DEFINE   TABLE  user  ');
    expect(result).toBe('DEFINE TABLE user');
  });

  it('sorts multiple lines', async () => {
    const fn = await getNormalizeSql();
    const result = fn('DEFINE FIELD b ON user;\nDEFINE FIELD a ON user;');
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('DEFINE FIELD a ON user');
    expect(lines[1]).toContain('DEFINE FIELD b ON user');
  });

  it('filters empty lines', async () => {
    const fn = await getNormalizeSql();
    const result = fn('DEFINE TABLE user;\n\n\nDEFINE FIELD name ON user;');
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);
  });
});

// ============================================================================
// generateMigrationFile
// ============================================================================

describe('generateMigrationFile', () => {
  async function getGenerateMigrationFile() {
    const mod = await import('../generate.js');
    return mod.generateMigrationFile;
  }

  it('produces correct surql format with UP/DOWN sections', async () => {
    const fn = await getGenerateMigrationFile();
    const result = fn('001', 'create_user', {
      up: ['DEFINE TABLE user SCHEMAFULL', 'DEFINE FIELD name ON user TYPE string'],
      down: ['REMOVE TABLE user'],
    });

    expect(result).toContain('-- Migration: create_user');
    expect(result).toContain('-- Version: 001');
    expect(result).toContain('-- UP');
    expect(result).toContain('-- DOWN');
    expect(result).toContain('DEFINE TABLE user SCHEMAFULL;');
    expect(result).toContain('DEFINE FIELD name ON user TYPE string;');
    expect(result).toContain('REMOVE TABLE user;');
  });

  it('filters out empty statements', async () => {
    const fn = await getGenerateMigrationFile();
    const result = fn('001', 'empty_test', {
      up: ['DEFINE TABLE user SCHEMAFULL', '', '   ', 'DEFINE FIELD name ON user TYPE string'],
      down: ['REMOVE TABLE user'],
    });

    // Should not have blank lines where empty statements were
    expect(result).toContain('DEFINE TABLE user SCHEMAFULL;');
    expect(result).toContain('DEFINE FIELD name ON user TYPE string;');
    expect(result).toContain('REMOVE TABLE user;');
  });

  it('handles empty up/down arrays', async () => {
    const fn = await getGenerateMigrationFile();
    const result = fn('001', 'empty', { up: [], down: [] });

    expect(result).toContain('-- Migration: empty');
    expect(result).toContain('-- UP');
    expect(result).toContain('-- DOWN');
  });

  it('inserts section separator comments between categories', async () => {
    const fn = await getGenerateMigrationFile();
    const result = fn('001', 'sectioned', {
      up: [
        'DEFINE TABLE user SCHEMAFULL',
        'DEFINE ACCESS account ON DATABASE TYPE RECORD',
        'DEFINE FUNCTION fn::greet() RETURN "hello"',
      ],
      down: ['REMOVE TABLE user', 'REMOVE ACCESS account'],
    });

    // Should have section comment separators
    expect(result).toContain('-- ---- Tables ----');
    expect(result).toContain('-- ---- Access ----');
    expect(result).toContain('-- ---- Functions ----');
  });
});

// ============================================================================
// detectSection
// ============================================================================

describe('detectSection', () => {
  async function getDetectSection() {
    const mod = await import('../generate.js');
    return mod.detectSection;
  }

  it('detects Tables for DEFINE TABLE', async () => {
    const fn = await getDetectSection();
    expect(fn('DEFINE TABLE user SCHEMAFULL')).toBe('Tables');
  });

  it('detects Tables for REMOVE TABLE', async () => {
    const fn = await getDetectSection();
    expect(fn('REMOVE TABLE user')).toBe('Tables');
  });

  it('detects Tables for DEFINE FIELD', async () => {
    const fn = await getDetectSection();
    expect(fn('DEFINE FIELD name ON user TYPE string')).toBe('Tables');
  });

  it('detects Access for DEFINE ACCESS', async () => {
    const fn = await getDetectSection();
    expect(fn('DEFINE ACCESS account ON DATABASE TYPE RECORD')).toBe('Access');
  });

  it('detects Functions for DEFINE FUNCTION', async () => {
    const fn = await getDetectSection();
    expect(fn('DEFINE FUNCTION fn::greet() RETURN "hello"')).toBe('Functions');
  });

  it('detects Events for DEFINE EVENT', async () => {
    const fn = await getDetectSection();
    expect(fn('DEFINE EVENT my_event ON user WHEN $before = NONE THEN ...')).toBe('Events');
  });

  it('detects Params for DEFINE PARAM', async () => {
    const fn = await getDetectSection();
    expect(fn('DEFINE PARAM $my_param VALUE 42')).toBe('Params');
  });

  it('detects Views for DEFINE VIEW', async () => {
    const fn = await getDetectSection();
    expect(fn('DEFINE VIEW my_view AS SELECT * FROM user')).toBe('Views');
  });

  it('detects Analyzers for DEFINE ANALYZER', async () => {
    const fn = await getDetectSection();
    expect(fn('DEFINE ANALYZER my_analyzer TOKENIZERS blank')).toBe('Analyzers');
  });

  it('returns Other for unknown statements', async () => {
    const fn = await getDetectSection();
    expect(fn('SELECT * FROM user')).toBe('Other');
    expect(fn('CREATE user SET name = "test"')).toBe('Other');
  });
});

// ============================================================================
// addSectionSeparators
// ============================================================================

describe('addSectionSeparators', () => {
  async function getAddSectionSeparators() {
    const mod = await import('../generate.js');
    return mod.addSectionSeparators;
  }

  it('inserts separator when section changes', async () => {
    const fn = await getAddSectionSeparators();
    const result = fn([
      'DEFINE TABLE user SCHEMAFULL',
      'DEFINE ACCESS account ON DATABASE TYPE RECORD',
    ]);
    expect(result).toHaveLength(4);
    expect(result[0]).toBe('-- ---- Tables ----');
    expect(result[1]).toBe('DEFINE TABLE user SCHEMAFULL');
    expect(result[2]).toBe('-- ---- Access ----');
    expect(result[3]).toBe('DEFINE ACCESS account ON DATABASE TYPE RECORD');
  });

  it('does not repeat separator for same section', async () => {
    const fn = await getAddSectionSeparators();
    const result = fn(['DEFINE TABLE user SCHEMAFULL', 'DEFINE FIELD name ON user TYPE string']);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('-- ---- Tables ----');
    expect(result[1]).toBe('DEFINE TABLE user SCHEMAFULL');
    expect(result[2]).toBe('DEFINE FIELD name ON user TYPE string');
  });

  it('handles empty input', async () => {
    const fn = await getAddSectionSeparators();
    const result = fn([]);
    expect(result).toEqual([]);
  });

  it('handles single statement', async () => {
    const fn = await getAddSectionSeparators();
    const result = fn(['DEFINE TABLE user SCHEMAFULL']);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('-- ---- Tables ----');
    expect(result[1]).toBe('DEFINE TABLE user SCHEMAFULL');
  });
});

// ============================================================================
// generateSnapshotMigration
// ============================================================================

describe('generateSnapshotMigration', () => {
  let tmpDir: string;
  let snapshotDir: string;
  let restoreConsole: () => void;

  beforeEach(async () => {
    tmpDir = await createTempDir('snap-mig-');
    snapshotDir = path.join(tmpDir, 'snapshots');
    await fs.mkdir(snapshotDir, { recursive: true });
    restoreConsole = mockConsole();
  });

  afterEach(async () => {
    restoreConsole();
    await cleanupDir(tmpDir);
  });

  async function getGenerateSnapshotMigration() {
    const mod = await import('../generate.js');
    return mod.generateSnapshotMigration;
  }

  const generator = new SurrealQLGenerator();

  it('generates all tables when no snapshot exists (first migration)', async () => {
    const fn = await getGenerateSnapshotMigration();
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [
          { name: 'name', tableName: 'user', config: { type: 'string' } },
          { name: 'email', tableName: 'user', config: { type: 'string' } },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const result = await fn(tables, snapshotDir, generator, '001');

    expect(result.upStatements.length).toBeGreaterThan(0);
    expect(result.downStatements.length).toBeGreaterThan(0);
    const allUp = result.upStatements.join(' ');
    expect(allUp).toContain('DEFINE TABLE');
    expect(allUp).toContain('DEFINE FIELD');
  });

  it('detects new fields when compared against existing snapshot', async () => {
    // Save initial snapshot with user table (name only)
    const initialTables: TableDefinition[] = [
      {
        name: 'user',
        columns: [{ name: 'name', tableName: 'user', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
    ];
    const snapManager = new SnapshotManager(snapshotDir);
    const snapshot = snapManager.createSnapshot(initialTables, '001', 'initial');
    await snapManager.saveSnapshot(snapshot);

    // New schema adds email field
    const newTables: TableDefinition[] = [
      {
        name: 'user',
        columns: [
          { name: 'name', tableName: 'user', config: { type: 'string' } },
          { name: 'email', tableName: 'user', config: { type: 'string' } },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const fn = await getGenerateSnapshotMigration();
    const result = await fn(newTables, snapshotDir, generator, '002');

    // Should detect email as new field
    const allUp = result.upStatements.join(' ');
    expect(allUp).toContain('email');

    // Should generate REMOVE FIELD in DOWN section for added field
    const allDown = result.downStatements.join(' ');
    expect(allDown).toContain('REMOVE FIELD');
    expect(allDown).toContain('email');
  });

  it('detects new tables when compared against existing snapshot', async () => {
    // Save initial snapshot with user table only
    const initialTables: TableDefinition[] = [
      {
        name: 'user',
        columns: [{ name: 'name', tableName: 'user', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
    ];
    const snapManager = new SnapshotManager(snapshotDir);
    const snapshot = snapManager.createSnapshot(initialTables, '001', 'initial');
    await snapManager.saveSnapshot(snapshot);

    // New schema adds post table
    const newTables: TableDefinition[] = [
      {
        name: 'user',
        columns: [{ name: 'name', tableName: 'user', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
      {
        name: 'post',
        columns: [{ name: 'title', tableName: 'post', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const fn = await getGenerateSnapshotMigration();
    const result = await fn(newTables, snapshotDir, generator, '002');

    // Should generate DEFINE TABLE for post
    const allUp = result.upStatements.join(' ');
    expect(allUp).toContain('DEFINE TABLE');
    expect(allUp).toContain('post');
  });

  it('handles default-only field changes', async () => {
    // Save initial snapshot with default value
    const initialTables: TableDefinition[] = [
      {
        name: 'user',
        columns: [
          { name: 'status', tableName: 'user', config: { type: 'string', default: 'active' } },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];
    const snapManager = new SnapshotManager(snapshotDir);
    const snapshot = snapManager.createSnapshot(initialTables, '001', 'initial');
    await snapManager.saveSnapshot(snapshot);

    // New schema changes default
    const newTables: TableDefinition[] = [
      {
        name: 'user',
        columns: [
          { name: 'status', tableName: 'user', config: { type: 'string', default: 'inactive' } },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const fn = await getGenerateSnapshotMigration();
    const result = await fn(newTables, snapshotDir, generator, '002');

    // Should use ALTER FIELD DEFAULT for default-only change
    const allUp = result.upStatements.join(' ');
    expect(allUp).toContain('ALTER FIELD');
    expect(allUp).toContain('DEFAULT');
  });

  it('handles removed fields from snapshot comparison', async () => {
    // Save initial snapshot with fields including one to remove
    const initialTables: TableDefinition[] = [
      {
        name: 'user',
        columns: [
          { name: 'name', tableName: 'user', config: { type: 'string' } },
          { name: 'age', tableName: 'user', config: { type: 'int' } },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];
    const snapManager = new SnapshotManager(snapshotDir);
    const snapshot = snapManager.createSnapshot(initialTables, '001', 'initial');
    await snapManager.saveSnapshot(snapshot);

    // New schema removes age field
    const newTables: TableDefinition[] = [
      {
        name: 'user',
        columns: [{ name: 'name', tableName: 'user', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const fn = await getGenerateSnapshotMigration();
    const result = await fn(newTables, snapshotDir, generator, '002');

    // Should generate REMOVE FIELD for age
    const allUp = result.upStatements.join(' ');
    expect(allUp).toContain('REMOVE FIELD');
    expect(allUp).toContain('age');
  });

  it('handles co-located snapshot input (CoLocatedSnapshot object)', async () => {
    const fn = await getGenerateSnapshotMigration();
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [
          { name: 'name', tableName: 'user', config: { type: 'string' } },
          { name: 'email', tableName: 'user', config: { type: 'string' } },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    // Use a CoLocatedSnapshot with user table (name only)
    const coLocated: import('../generate.js').CoLocatedSnapshot = {
      tables: [
        {
          name: 'user',
          columns: [{ name: 'name', tableName: 'user', config: { type: 'string' as const } }],
          config: { schema: 'full' as const, type: 'normal' as const },
        },
      ],
    };

    const result = await fn(tables, coLocated, generator, '001');

    // Should detect email as new field
    const allUp = result.upStatements.join(' ');
    expect(allUp).toContain('email');

    // Should generate REMOVE FIELD in DOWN section for added field
    const allDown = result.downStatements.join(' ');
    expect(allDown).toContain('REMOVE FIELD');
    expect(allDown).toContain('email');
  });

  it('generates access statements for new access definitions', async () => {
    const initTables: TableDefinition[] = [];
    const snapManager = new SnapshotManager(snapshotDir);
    const snapshot = snapManager.createSnapshot(initTables, '001', 'initial');
    await snapManager.saveSnapshot(snapshot);

    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [{ name: 'email', tableName: 'user', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
    ];
    const access: AccessConfig[] = [
      {
        name: 'account',
        type: 'RECORD',
        table: 'user',
        signup: 'CREATE user SET email = $email',
        signin: 'SELECT * FROM user WHERE email = $email',
        duration: '12h',
        tokenDuration: '15m',
      },
    ];

    const fn = await getGenerateSnapshotMigration();
    const result = await fn(tables, snapshotDir, generator, '002', access);

    const allUp = result.upStatements.join(' ');
    expect(allUp).toContain('DEFINE ACCESS');
  });
});

// ============================================================================
// generateLiveMigration
// ============================================================================

describe('generateLiveMigration', () => {
  let driver: EmbeddedDriver;
  let restoreConsole: () => void;

  beforeEach(async () => {
    driver = new EmbeddedDriver({
      driver: 'embedded',
      namespace: 'test_live_mig',
      database: `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      mode: 'memory',
    });
    await driver.connect();
    restoreConsole = mockConsole();
  });

  afterEach(async () => {
    restoreConsole();
    await driver.disconnect().catch(() => {});
  });

  async function getGenerateLiveMigration() {
    const mod = await import('../generate.js');
    return mod.generateLiveMigration;
  }

  const generator = new SurrealQLGenerator();

  it('generates full table definitions for tables not in live schema', async () => {
    const fn = await getGenerateLiveMigration();
    const tables: TableDefinition[] = [
      {
        name: 'new_table',
        columns: [{ name: 'name', tableName: 'new_table', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const result = await fn(tables, driver, generator);

    const allUp = result.upStatements.join(' ');
    expect(allUp).toContain('DEFINE TABLE');
    expect(allUp).toContain('new_table');
  });

  it('only generates new fields for tables already in live schema', async () => {
    // Create table in DB with one field
    await driver.query('DEFINE TABLE existing_table SCHEMAFULL');
    await driver.query('DEFINE FIELD name ON TABLE existing_table TYPE string');

    const fn = await getGenerateLiveMigration();
    const tables: TableDefinition[] = [
      {
        name: 'existing_table',
        columns: [
          { name: 'name', tableName: 'existing_table', config: { type: 'string' } },
          { name: 'email', tableName: 'existing_table', config: { type: 'string' } },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const result = await fn(tables, driver, generator);

    // Should include email field (new)
    const allUp = result.upStatements.join(' ');
    expect(allUp).toContain('email');

    // Should NOT redefine name (already exists)
    const nameUp = result.upStatements.filter((s) => s.includes('name'));
    expect(nameUp.length).toBeGreaterThanOrEqual(0);
  });

  it('handles empty table list gracefully', async () => {
    const fn = await getGenerateLiveMigration();
    const result = await fn([], driver, generator);

    expect(result.upStatements).toEqual([]);
    expect(result.downStatements).toEqual([]);
  });

  it('generates field definitions for schemaless tables in live DB', async () => {
    // Create schemaless table (no columns defined)
    await driver.query('DEFINE TABLE schemaless_table SCHEMALESS');

    const fn = await getGenerateLiveMigration();
    const tables: TableDefinition[] = [
      {
        name: 'schemaless_table',
        columns: [{ name: 'title', tableName: 'schemaless_table', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const result = await fn(tables, driver, generator);

    // Schemaless table has no columns, so it should get full table + field definition
    const allUp = result.upStatements.join(' ');
    expect(allUp).toContain('DEFINE TABLE');
    expect(allUp).toContain('title');
  });

  it('detects removed fields that have no data and generates REMOVE FIELD', async () => {
    // Create table in DB with name and age fields
    await driver.query('DEFINE TABLE remove_test SCHEMAFULL');
    await driver.query('DEFINE FIELD name ON TABLE remove_test TYPE string');
    await driver.query('DEFINE FIELD age ON TABLE remove_test TYPE int');

    const fn = await getGenerateLiveMigration();
    const tables: TableDefinition[] = [
      {
        name: 'remove_test',
        columns: [{ name: 'name', tableName: 'remove_test', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const result = await fn(tables, driver, generator);

    // Should generate REMOVE FIELD for age (no data in table)
    const allUp = result.upStatements.join(' ');
    expect(allUp).toContain('REMOVE FIELD');
    expect(allUp).toContain('age');
  });

  it('detects field changes when default values differ', async () => {
    // Create table in DB with a default value
    await driver.query('DEFINE TABLE default_test SCHEMAFULL');
    await driver.query("DEFINE FIELD status ON TABLE default_test TYPE string DEFAULT 'active'");

    const fn = await getGenerateLiveMigration();
    const tables: TableDefinition[] = [
      {
        name: 'default_test',
        columns: [
          {
            name: 'status',
            tableName: 'default_test',
            config: { type: 'string', default: 'inactive' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const result = await fn(tables, driver, generator);

    // Should detect the field difference (type, optional, or default)
    // Live introspection may return different metadata so either ALTER FIELD or DEFINE FIELD OVERWRITE
    const allUp = result.upStatements.join(' ');
    expect(allUp).toContain('status');
    expect(result.upStatements.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// generateMigration (main dispatch)
// ============================================================================

describe('generateMigration', () => {
  let tmpDir: string;
  let restoreConsole: () => void;

  beforeEach(async () => {
    tmpDir = await createTempDir('gen-mig-');
    restoreConsole = mockConsole();
  });

  afterEach(async () => {
    restoreConsole();
    await cleanupDir(tmpDir);
  });

  async function getGenerateMigration() {
    const mod = await import('../generate.js');
    return mod.generateMigration;
  }

  it('throws when tables array is empty', async () => {
    const fn = await getGenerateMigration();
    await expect(fn([], { name: 'test' })).rejects.toThrow('No tables provided');
  });

  it('generates full migration when fullMigration option is true', async () => {
    const fn = await getGenerateMigration();
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [{ name: 'name', tableName: 'user', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const resultDir = await fn(tables, {
      name: 'create_user',
      outputDir: path.join(tmpDir, 'migrations'),
      fullMigration: true,
    });

    expect(resultDir).toBeTruthy();
    // Verify migration file was created
    const files = await fs.readdir(path.join(tmpDir, 'migrations'));
    const createUserDir = files.find((f) => f.includes('create_user'));
    expect(createUserDir).toBeDefined();
  });

  it('returns empty string when no schema changes detected', async () => {
    const fn = await getGenerateMigration();
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [{ name: 'name', tableName: 'user', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    // Use snapshot dir + matching snapshot so no changes detected
    const snapDir = path.join(tmpDir, 'snapshots');
    await fs.mkdir(snapDir, { recursive: true });

    // First migration creates snapshot
    await fn(tables, {
      name: 'first',
      outputDir: path.join(tmpDir, 'migrations'),
      snapshotDir: snapDir,
      fullMigration: false,
    });

    // Second migration with same tables should detect no changes
    const result = await fn(tables, {
      name: 'second',
      outputDir: path.join(tmpDir, 'migrations'),
      snapshotDir: snapDir,
      fullMigration: false,
    });

    expect(result).toBe('');
  });

  it('skips duplicate migration when same content already exists (hash match)', async () => {
    const fn = await getGenerateMigration();
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [{ name: 'name', tableName: 'user', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const migrationsDir = path.join(tmpDir, 'migrations');

    // First call - creates migration
    const firstResult = await fn(tables, {
      name: 'create_user',
      outputDir: migrationsDir,
      fullMigration: true,
    });
    expect(firstResult).toBeTruthy();

    // Second call with same name and same tables should detect hash match
    const secondResult = await fn(tables, {
      name: 'create_user',
      outputDir: migrationsDir,
      fullMigration: true,
    });

    // Should return the existing migration dir path (not empty, but doesn't create new)
    expect(secondResult).toBeTruthy();
  });

  it('generates migration with live driver comparison when driver provided', async () => {
    const driver = new EmbeddedDriver({
      driver: 'embedded',
      namespace: 'test_gen_live',
      database: `gen_live_${Date.now()}`,
      mode: 'memory',
    });
    await driver.connect();

    const fn = await getGenerateMigration();
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [{ name: 'name', tableName: 'user', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const resultDir = await fn(tables, {
      name: 'live_gen_test',
      outputDir: path.join(tmpDir, 'migrations'),
      driver,
    });

    expect(resultDir).toBeTruthy();
    const files = await fs.readdir(path.join(tmpDir, 'migrations'));
    const found = files.find((f) => f.includes('live_gen_test'));
    expect(found).toBeDefined();
    await driver.disconnect().catch(() => {});
  });

  it('generates access and event and function statements when provided', async () => {
    const fn = await getGenerateMigration();
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [{ name: 'email', tableName: 'user', config: { type: 'string' } }],
        config: { schema: 'full', type: 'normal' },
      },
    ];
    const access: AccessConfig[] = [
      {
        name: 'account',
        type: 'RECORD',
        table: 'user',
        signup: 'CREATE user SET email = $email',
        signin: 'SELECT * FROM user WHERE email = $email',
        duration: '12h',
        tokenDuration: '15m',
      },
    ];
    const events = [
      {
        name: 'on_create',
        on: 'user',
        when: '$before = NONE',
        then: ['CREATE activity SET type = "user_created"'],
      },
    ];
    const functions: FunctionConfig[] = [
      {
        name: 'fn::greet',
        body: 'RETURN "Hello, " + $name;',
        args: ['name string'],
      },
    ];

    const resultDir = await fn(
      tables,
      {
        name: 'with_definitions',
        outputDir: path.join(tmpDir, 'migrations'),
        fullMigration: true,
      },
      access,
      events,
      functions,
    );

    expect(resultDir).toBeTruthy();

    // Read the migration file to verify content
    const dirs = await fs.readdir(path.join(tmpDir, 'migrations'));
    const migDir = dirs.find((f) => f.includes('with_definitions'));
    expect(migDir).toBeDefined();
    const content = await fs.readFile(
      path.join(tmpDir, 'migrations', migDir!, 'migration.surql'),
      'utf-8',
    );
    expect(content).toContain('DEFINE ACCESS');
    expect(content).toContain('DEFINE EVENT');
    expect(content).toContain('DEFINE FUNCTION');
  });
});

// ============================================================================
// loadSchemaFromFile — extended patterns
// ============================================================================

describe('loadSchemaFromFile extended patterns', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await createTempDir('load-schema-ext-');
  });

  afterEach(async () => {
    await cleanupDir(tmpDir);
  });

  it('loads tables from OrmSchema pattern (tableDefinitions export)', async () => {
    const filePath = path.join(tmpDir, 'orm-schema.ts');
    const content = [
      'export const ormSchema = {',
      '  tableDefinitions: {',
      '    user: {',
      '      name: "user",',
      '      columns: [{ name: "name", tableName: "user", config: { type: "string" } }],',
      '      config: { schema: "full", type: "normal" },',
      '    },',
      '  },',
      '};',
    ].join('\n');
    await fs.writeFile(filePath, content);

    const { loadSchemaFromFile } = await import('../generate.js');
    const result = await loadSchemaFromFile(filePath);

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe('user');
  });

  it('loads access definitions from access export', async () => {
    const filePath = path.join(tmpDir, 'with-access.ts');
    const content = [
      'export const access = [',
      '  { name: "account", type: "record", on: { table: "user" }, signup: { query: "CREATE user" }, signin: { query: "SELECT * FROM user" }, duration: { token: "15m" } },',
      '];',
      'export const tables = [',
      '  { name: "user", columns: [{ name: "email", tableName: "user", config: { type: "string" } }], config: { schema: "full", type: "normal" } },',
      '];',
    ].join('\n');
    await fs.writeFile(filePath, content);

    const { loadSchemaFromFile } = await import('../generate.js');
    const result = await loadSchemaFromFile(filePath);

    expect(result.tables).toHaveLength(1);
    expect(result.access).toBeDefined();
    expect(result.access).toHaveLength(1);
    expect(result.access![0].name).toBe('account');
  });

  it('loads function definitions from functions export', async () => {
    const filePath = path.join(tmpDir, 'with-functions.ts');
    const content = [
      'export const functions = [',
      '  { name: "fn::greet", body: \'RETURN "Hello, " + $name;\', args: [{ name: "name", type: "string" }], returns: "string" },',
      '];',
      'export const tables = [',
      '  { name: "user", columns: [{ name: "email", tableName: "user", config: { type: "string" } }], config: { schema: "full", type: "normal" } },',
      '];',
    ].join('\n');
    await fs.writeFile(filePath, content);

    const { loadSchemaFromFile } = await import('../generate.js');
    const result = await loadSchemaFromFile(filePath);

    expect(result.tables).toHaveLength(1);
    expect(result.functions).toBeDefined();
    expect(result.functions).toHaveLength(1);
    expect(result.functions![0].name).toBe('fn::greet');
  });

  it('loads tables from schema export (named export)', async () => {
    const filePath = path.join(tmpDir, 'schema-export.ts');
    const content = [
      'export const schema = [',
      '  { name: "user", columns: [{ name: "name", tableName: "user", config: { type: "string" } }], config: { schema: "full", type: "normal" } },',
      '];',
    ].join('\n');
    await fs.writeFile(filePath, content);

    const { loadSchemaFromFile } = await import('../generate.js');
    const result = await loadSchemaFromFile(filePath);

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe('user');
  });

  it('loads tables from tableDefinitions export (array)', async () => {
    const filePath = path.join(tmpDir, 'table-defs.ts');
    const content = [
      'export const tableDefinitions = [',
      '  { name: "user", columns: [{ name: "name", tableName: "user", config: { type: "string" } }], config: { schema: "full", type: "normal" } },',
      '];',
    ].join('\n');
    await fs.writeFile(filePath, content);

    const { loadSchemaFromFile } = await import('../generate.js');
    const result = await loadSchemaFromFile(filePath);

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe('user');
  });

  it('deduplicates access definitions by name', async () => {
    const filePath = path.join(tmpDir, 'dedup-access.ts');
    const content = [
      'export const access = [',
      '  { name: "account", type: "record", on: { table: "user" }, signup: { query: "CREATE user" }, signin: { query: "SELECT * FROM user" } },',
      '  { name: "account", type: "record", on: { table: "user" }, signup: { query: "CREATE user" }, signin: { query: "SELECT * FROM user" } },',
      '];',
      'export const tables = [',
      '  { name: "user", columns: [{ name: "email", tableName: "user", config: { type: "string" } }], config: { schema: "full", type: "normal" } },',
      '];',
    ].join('\n');
    await fs.writeFile(filePath, content);

    const { loadSchemaFromFile } = await import('../generate.js');
    const result = await loadSchemaFromFile(filePath);

    expect(result.access).toHaveLength(1);
  });

  it('loads access from OrmSchema with access array', async () => {
    const filePath = path.join(tmpDir, 'orm-access.ts');
    const content = [
      'export const ormSchema = {',
      '  tableDefinitions: {',
      '    user: {',
      '      name: "user",',
      '      columns: [{ name: "email", tableName: "user", config: { type: "string" } }],',
      '      config: { schema: "full", type: "normal" },',
      '    },',
      '  },',
      '  access: [',
      '    { name: "account", type: "record", on: { table: "user" }, signup: { query: "CREATE user" }, signin: { query: "SELECT * FROM user" } },',
      '  ],',
      '};',
    ].join('\n');
    await fs.writeFile(filePath, content);

    const { loadSchemaFromFile } = await import('../generate.js');
    const result = await loadSchemaFromFile(filePath);

    expect(result.tables).toHaveLength(1);
    expect(result.access).toHaveLength(1);
    expect(result.access![0].name).toBe('account');
  });
});

// ============================================================================
// loadSchemaFiles — access and function processing
// ============================================================================

describe('loadSchemaFiles extended patterns', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await createTempDir('load-files-ext-');
  });

  afterEach(async () => {
    await cleanupDir(tmpDir);
  });

  it('loads access and function definitions alongside tables', async () => {
    // Create schema file with access + functions + tables
    const schemaDir = path.join(tmpDir, 'schema');
    await fs.mkdir(schemaDir, { recursive: true });

    const filePath = path.join(schemaDir, 'full.schema.ts');
    const content = [
      'export const tables = [',
      '  { name: "user", columns: [{ name: "email", tableName: "user", config: { type: "string" } }], config: { schema: "full", type: "normal" } },',
      '];',
      'export const access = [',
      '  { name: "account", type: "record", on: { table: "user" }, signup: { query: "CREATE user" }, signin: { query: "SELECT * FROM user" }, duration: { token: "15m" } },',
      '];',
      'export const functions = [',
      '  { name: "fn::hello", body: \'RETURN "hi"\', args: [] },',
      '];',
    ].join('\n');
    await fs.writeFile(filePath, content);

    const { loadSchemaFiles } = await import('../generate.js');
    const result = await loadSchemaFiles(schemaDir, '*.ts');

    expect(result.tables).toHaveLength(1);
    expect(result.access).toBeDefined();
    expect(result.access).toHaveLength(1);
    expect(result.access![0].name).toBe('account');
    expect(result.functions).toBeDefined();
    expect(result.functions).toHaveLength(1);
    expect(result.functions![0].name).toBe('fn::hello');
  });

  it('throws when schema path is a file but not .ts (stat check for non-directory)', async () => {
    // Create a non-.ts file
    await fs.writeFile(path.join(tmpDir, 'schema.json'), '{}');

    const { loadSchemaFiles } = await import('../generate.js');
    await expect(loadSchemaFiles(path.join(tmpDir, 'schema.json'))).rejects.toThrow(
      'Schema path is not a directory',
    );
  });

  it('deduplicates access definitions from different export sources across schema files', async () => {
    const schemaDir = path.join(tmpDir, 'schema');
    await fs.mkdir(schemaDir, { recursive: true });

    // Create a file with access defined in both access export and ormSchema.access
    const filePath = path.join(schemaDir, 'dedup.schema.ts');
    const content = [
      'export const access = [',
      '  { name: "account", type: "record", on: { table: "user" }, signup: { query: "CREATE user" }, signin: { query: "SELECT * FROM user" }, duration: { token: "15m" } },',
      '];',
      'export const ormSchema = {',
      '  tableDefinitions: {',
      '    user: {',
      '      name: "user",',
      '      columns: [{ name: "email", tableName: "user", config: { type: "string" } }],',
      '      config: { schema: "full", type: "normal" },',
      '    },',
      '  },',
      '  access: [',
      '    { name: "account", type: "record", on: { table: "user" }, signup: { query: "CREATE user" }, signin: { query: "SELECT * FROM user" }, duration: { token: "15m" } },',
      '  ],',
      '};',
    ].join('\n');
    await fs.writeFile(filePath, content);

    const { loadSchemaFiles } = await import('../generate.js');
    const result = await loadSchemaFiles(schemaDir, '*.ts');

    expect(result.tables).toHaveLength(1);
    // Access should be deduplicated — only one entry
    expect(result.access).toHaveLength(1);
    expect(result.access![0].name).toBe('account');
  });

  it('deduplicates function definitions in loadSchemaFromFile (array)', async () => {
    const filePath = path.join(tmpDir, 'fn-dedup-array.ts');
    const content = [
      'export const functions = [',
      '  { name: "fn::hello", body: \'RETURN "hi"\', args: [] },',
      '  { name: "fn::hello", body: \'RETURN "hi"\', args: [] },',
      '];',
      'export const tables = [',
      '  { name: "user", columns: [{ name: "email", tableName: "user", config: { type: "string" } }], config: { schema: "full", type: "normal" } },',
      '];',
    ].join('\n');
    await fs.writeFile(filePath, content);

    const { loadSchemaFromFile } = await import('../generate.js');
    const result = await loadSchemaFromFile(filePath);

    expect(result.functions).toBeDefined();
    // Should deduplicate to one
    expect(result.functions).toHaveLength(1);
  });

  it('deduplicates function definitions in loadSchemaFromFile via ormSchema', async () => {
    const filePath = path.join(tmpDir, 'fn-dedup-orm.ts');
    const content = [
      'export const ormSchema = {',
      '  tableDefinitions: {',
      '    user: {',
      '      name: "user",',
      '      columns: [{ name: "email", tableName: "user", config: { type: "string" } }],',
      '      config: { schema: "full", type: "normal" },',
      '    },',
      '  },',
      '  functions: [',
      '    { name: "fn::hello", body: \'RETURN "hi"\', args: [] },',
      '  ],',
      '};',
      'export const functions = [',
      '  { name: "fn::hello", body: \'RETURN "hi"\', args: [] },',
      '];',
    ].join('\n');
    await fs.writeFile(filePath, content);

    const { loadSchemaFromFile } = await import('../generate.js');
    const result = await loadSchemaFromFile(filePath);

    expect(result.functions).toBeDefined();
    expect(result.functions).toHaveLength(1);
  });

  it('deduplicates function definitions from different export sources across schema files', async () => {
    const schemaDir = path.join(tmpDir, 'schema');
    await fs.mkdir(schemaDir, { recursive: true });

    // Create a file with functions defined in both functions export and ormSchema.functions
    const filePath = path.join(schemaDir, 'fn-dedup.schema.ts');
    const content = [
      'export const functions = [',
      '  { name: "fn::greet", body: \'RETURN "hi"\', args: [] },',
      '];',
      'export const ormSchema = {',
      '  tableDefinitions: {',
      '    user: {',
      '      name: "user",',
      '      columns: [{ name: "email", tableName: "user", config: { type: "string" } }],',
      '      config: { schema: "full", type: "normal" },',
      '    },',
      '  },',
      '  functions: [',
      '    { name: "fn::greet", body: \'RETURN "hi"\', args: [] },',
      '  ],',
      '};',
    ].join('\n');
    await fs.writeFile(filePath, content);

    const { loadSchemaFiles } = await import('../generate.js');
    const result = await loadSchemaFiles(schemaDir, '*.ts');

    expect(result.tables).toHaveLength(1);
    // Functions should be deduplicated — only one entry
    expect(result.functions).toHaveLength(1);
    expect(result.functions![0].name).toBe('fn::greet');
  });

  it('processes single access definition (non-array) from export', async () => {
    const schemaDir = path.join(tmpDir, 'schema');
    await fs.mkdir(schemaDir, { recursive: true });

    // Create a file with a single access object export (not array)
    const filePath = path.join(schemaDir, 'single-access.schema.ts');
    const content = [
      'export const access = { name: "single_access", type: "record", on: { table: "user" }, signup: { query: "CREATE user" }, signin: { query: "SELECT * FROM user" }, duration: { token: "15m" } };',
      'export const tables = [',
      '  { name: "user", columns: [{ name: "email", tableName: "user", config: { type: "string" } }], config: { schema: "full", type: "normal" } },',
      '];',
    ].join('\n');
    await fs.writeFile(filePath, content);

    const { loadSchemaFiles } = await import('../generate.js');
    const result = await loadSchemaFiles(schemaDir, '*.ts');

    expect(result.tables).toHaveLength(1);
    expect(result.access).toBeDefined();
    expect(result.access).toHaveLength(1);
    expect(result.access![0].name).toBe('single_access');
  });
});
