/**
 * Integration tests for diff CLI functions.
 *
 * Tests: diffSchema()
 *
 * Uses real embedded SurrealDB (memory mode).
 * Mocks connect since diffSchema only supports nodeDriver.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbeddedDriver } from '../../../sdk/driver/embedded-driver.js';
import type { TableDefinition } from '../../../sdk/table.js';

// Mock connect before importing diffSchema
vi.mock('../../../sdk/driver/orm-connection.js', () => ({
  connect: vi.fn(),
}));

import type { Config } from '../../config.js';
import { diffSchema } from '../diff.js';

// ============================================================================
// Helpers
// ============================================================================

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    url: 'http://localhost:10101', // dummy URL since connect is mocked
    namespace: 'test_diff_ns',
    database: 'test_diff_db',
    schema: { dir: './schema', pattern: '**/*.{js,ts}' },
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

// ============================================================================
// diffSchema
// ============================================================================

describe('diffSchema', () => {
  let driver: EmbeddedDriver;
  let restoreConsole: () => void;

  beforeEach(async () => {
    driver = new EmbeddedDriver({
      driver: 'embedded',
      namespace: 'test_diff',
      database: `diff_test_${Date.now()}`,
      mode: 'memory',
    });
    await driver.connect();

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
  });

  it('reports "No schema tables found" when tables array is empty', async () => {
    const config = makeConfig();
    await diffSchema({ config, tables: [] });

    const logCalls = vi.mocked(console.log).mock.calls;
    const noTablesLine = logCalls.find((c) =>
      String(c[0]).includes('No schema tables found'),
    );
    expect(noTablesLine).toBeDefined();
  });

  it('shows new tables as additions', async () => {
    // Pre-create some tables in DB
    await driver.query('DEFINE TABLE diff_existing SCHEMAFULL');
    await driver.query('DEFINE FIELD name ON diff_existing TYPE string');

    // Schema defines a DIFFERENT set of tables
    const tables: TableDefinition[] = [
      {
        name: 'diff_new',
        columns: [
          { name: 'title', tableName: 'diff_new', config: { type: 'string' } },
          {
            name: 'content',
            tableName: 'diff_new',
            config: { type: 'string' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const config = makeConfig();
    await diffSchema({ config, tables, verbose: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const allOutput = logCalls.map((c) => String(c[0])).join('\n');

    // Should mention the new table
    expect(allOutput).toContain('Added tables');
    expect(allOutput).toContain('diff_new');

    // Should mention the removed table (exists in DB but not in schema)
    expect(allOutput).toContain('Removed tables');

    // Should not say "up to date"
    expect(allOutput).not.toContain('up to date');
  });

  it('reports "Schema is up to date" when no diff', async () => {
    // Create matching tables in DB
    await driver.query('DEFINE TABLE diff_matched SCHEMAFULL');
    await driver.query('DEFINE FIELD name ON diff_matched TYPE string');

    // Create matching table definition
    const tables: TableDefinition[] = [
      {
        name: 'diff_matched',
        columns: [
          {
            name: 'name',
            tableName: 'diff_matched',
            config: { type: 'string' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const config = makeConfig();
    await diffSchema({ config, tables });

    const logCalls = vi.mocked(console.log).mock.calls;
    const upToDateLine = logCalls.find((c) =>
      String(c[0]).includes('Schema is up to date'),
    );
    expect(upToDateLine).toBeDefined();
  });

  it('handles disconnect even when connect fails', async () => {
    // Make connect throw
    const { connect } = await import('../../../sdk/driver/orm-connection.js');
    vi.mocked(connect).mockRejectedValue(new Error('Connection refused'));

    const tables: TableDefinition[] = [
      {
        name: 'test',
        columns: [
          { name: 'id', tableName: 'test', config: { type: 'string' } },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const config = makeConfig();
    // Should propagate the error since diffSchema doesn't catch connect errors
    await expect(diffSchema({ config, tables })).rejects.toThrow(
      'Connection refused',
    );
  });

  it('shows added indexes', async () => {
    // Create table without index
    await driver.query('DEFINE TABLE diff_idx SCHEMAFULL');
    await driver.query('DEFINE FIELD email ON diff_idx TYPE string');

    // Schema defines an index
    const tables: TableDefinition[] = [
      {
        name: 'diff_idx',
        columns: [
          { name: 'email', tableName: 'diff_idx', config: { type: 'string' } },
        ],
        config: {
          schema: 'full',
          type: 'normal',
          indexes: [{ name: 'idx_email', fields: ['email'], type: 'unique' }],
        },
      },
    ];

    const config = makeConfig();
    await diffSchema({ config, tables, verbose: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const allOutput = logCalls.map((c) => String(c[0])).join('\n');
    expect(allOutput).toContain('Added indexes');
    expect(allOutput).toContain('idx_email');
  });

  it('shows field-level changes when columns differ', async () => {
    // Create table with different column type
    await driver.query('DEFINE TABLE diff_field SCHEMAFULL');
    await driver.query('DEFINE FIELD count ON diff_field TYPE int');

    // Schema defines different type
    const tables: TableDefinition[] = [
      {
        name: 'diff_field',
        columns: [
          {
            name: 'count',
            tableName: 'diff_field',
            config: { type: 'string' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const config = makeConfig();
    await diffSchema({ config, tables, verbose: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const allOutput = logCalls.map((c) => String(c[0])).join('\n');
    expect(allOutput).toContain('Changed tables');
    expect(allOutput).toContain('count');
  });

  it('shows removed tables explicitly', async () => {
    // Create table in DB that is NOT in schema
    await driver.query('DEFINE TABLE diff_to_remove SCHEMAFULL');
    await driver.query('DEFINE FIELD data ON diff_to_remove TYPE string');

    // Schema defines a DIFFERENT table so diffSchema proceeds past the empty guard
    const tables: TableDefinition[] = [
      {
        name: 'diff_keep',
        columns: [
          { name: 'label', tableName: 'diff_keep', config: { type: 'string' } },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const config = makeConfig();
    await diffSchema({ config, tables, verbose: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const allOutput = logCalls.map((c) => String(c[0])).join('\n');
    expect(allOutput).toContain('Removed tables');
    expect(allOutput).toContain('diff_to_remove');
  });

  it('outputs total change count', async () => {
    // No pre-existing tables, schema defines one
    const tables: TableDefinition[] = [
      {
        name: 'diff_total_test',
        columns: [
          {
            name: 'name',
            tableName: 'diff_total_test',
            config: { type: 'string' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const config = makeConfig();
    await diffSchema({ config, tables });

    const logCalls = vi.mocked(console.log).mock.calls;
    const allOutput = logCalls.map((c) => String(c[0])).join('\n');
    expect(allOutput).toContain('Total:');
  });

  it('includes warnings when verbose and there are breaking changes', async () => {
    // Create table in DB
    await driver.query('DEFINE TABLE diff_warn SCHEMAFULL');
    await driver.query('DEFINE FIELD old_field ON diff_warn TYPE string');

    // Schema defines table with removed column
    const tables: TableDefinition[] = [
      {
        name: 'diff_warn',
        columns: [
          {
            name: 'new_field',
            tableName: 'diff_warn',
            config: { type: 'string' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const config = makeConfig();
    await diffSchema({ config, tables, verbose: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const allOutput = logCalls.map((c) => String(c[0])).join('\n');
    // Should show field additions and removals
    expect(allOutput).toContain('old_field');
    expect(allOutput).toContain('new_field');
  });

  it('shows removed indexes when DB has more indexes than schema', async () => {
    // Create table with index in DB
    await driver.query('DEFINE TABLE diff_rm_idx SCHEMAFULL');
    await driver.query('DEFINE FIELD email ON diff_rm_idx TYPE string');
    await driver.query(
      'DEFINE INDEX idx_email ON diff_rm_idx COLUMNS email UNIQUE',
    );

    // Schema without indexes
    const tables: TableDefinition[] = [
      {
        name: 'diff_rm_idx',
        columns: [
          {
            name: 'email',
            tableName: 'diff_rm_idx',
            config: { type: 'string' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const config = makeConfig();
    await diffSchema({ config, tables, verbose: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const allOutput = logCalls.map((c) => String(c[0])).join('\n');
    expect(allOutput).toContain('Removed indexes');
  });

  it('detects field default value changes', async () => {
    // Create table with default value
    await driver.query('DEFINE TABLE diff_def SCHEMAFULL');
    await driver.query(
      'DEFINE FIELD status ON diff_def TYPE string DEFAULT "inactive"',
    );

    // Schema defines different default
    const tables: TableDefinition[] = [
      {
        name: 'diff_def',
        columns: [
          {
            name: 'status',
            tableName: 'diff_def',
            config: { type: 'string', default: 'active' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const config = makeConfig();
    await diffSchema({ config, tables, verbose: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const allOutput = logCalls.map((c) => String(c[0])).join('\n');
    expect(allOutput).toContain('Changed tables');
    expect(allOutput).toContain('status');
    expect(allOutput).toContain('default');
  });

  it('detects field type changes', async () => {
    // Create table with int type
    await driver.query('DEFINE TABLE diff_type SCHEMAFULL');
    await driver.query('DEFINE FIELD count ON diff_type TYPE int');

    // Schema defines different type
    const tables: TableDefinition[] = [
      {
        name: 'diff_type',
        columns: [
          { name: 'count', tableName: 'diff_type', config: { type: 'number' } },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const config = makeConfig();
    await diffSchema({ config, tables, verbose: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const allOutput = logCalls.map((c) => String(c[0])).join('\n');
    expect(allOutput).toContain('count');
  });

  it('shows added + removed + changed in a single diff', async () => {
    // Create a table that will be removed
    await driver.query('DEFINE TABLE diff_multi_remove SCHEMAFULL');
    await driver.query('DEFINE FIELD data ON diff_multi_remove TYPE string');

    // Schema: remove one, add one
    const tables: TableDefinition[] = [
      {
        name: 'diff_multi_added',
        columns: [
          {
            name: 'label',
            tableName: 'diff_multi_added',
            config: { type: 'string' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const config = makeConfig();
    await diffSchema({ config, tables, verbose: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const allOutput = logCalls.map((c) => String(c[0])).join('\n');
    expect(allOutput).toContain('Added tables');
    expect(allOutput).toContain('diff_multi_added');
    expect(allOutput).toContain('Removed tables');
    expect(allOutput).toContain('diff_multi_remove');
  });

  it('detects readonly field changes', async () => {
    // Create table with non-readonly field
    await driver.query('DEFINE TABLE diff_ro SCHEMAFULL');
    await driver.query('DEFINE FIELD ro_field ON diff_ro TYPE string');

    // Schema defines readonly field
    const tables: TableDefinition[] = [
      {
        name: 'diff_ro',
        columns: [
          {
            name: 'ro_field',
            tableName: 'diff_ro',
            config: { type: 'string', readonly: true },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const config = makeConfig();
    await diffSchema({ config, tables, verbose: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const allOutput = logCalls.map((c) => String(c[0])).join('\n');
    expect(allOutput).toContain('diff_ro');
    expect(allOutput).toContain('ro_field');
  });

  it('handles relation tables with in/out configuration', async () => {
    // Create relation table in DB (TYPE RELATION auto-creates in/out fields)
    await driver.query(
      'DEFINE TABLE diff_rel SCHEMAFULL TYPE RELATION IN user OUT post',
    );

    // Schema defines relation table with in/out and a custom field
    const tables: TableDefinition[] = [
      {
        name: 'diff_rel',
        columns: [
          { name: 'weight', tableName: 'diff_rel', config: { type: 'int' } },
        ],
        config: { schema: 'full', type: 'relation', in: 'user', out: 'post' },
      },
    ];

    const config = makeConfig();
    await diffSchema({ config, tables, verbose: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const allOutput = logCalls.map((c) => String(c[0])).join('\n');
    // Should show changes for the relation table
    expect(allOutput).toContain('diff_rel');
  });

  it('handles unique index extraction from column config', async () => {
    // Create table with unique column in DB
    await driver.query('DEFINE TABLE diff_unique SCHEMAFULL');
    await driver.query('DEFINE FIELD email ON diff_unique TYPE string');

    // Schema defines unique column
    const tables: TableDefinition[] = [
      {
        name: 'diff_unique',
        columns: [
          {
            name: 'email',
            tableName: 'diff_unique',
            config: { type: 'string', unique: true },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const config = makeConfig();
    await diffSchema({ config, tables, verbose: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const allOutput = logCalls.map((c) => String(c[0])).join('\n');
    // Should show the unique index as added (column unique: true generates an index)
    expect(allOutput).toContain('Added indexes');
    expect(allOutput).toContain('email_idx');
  });

  it('removes a field from an existing table', async () => {
    // Create table in DB with two fields
    await driver.query('DEFINE TABLE diff_rmfield SCHEMAFULL');
    await driver.query('DEFINE FIELD keep ON diff_rmfield TYPE string');
    await driver.query('DEFINE FIELD remove_me ON diff_rmfield TYPE string');

    // Schema defines only one field (removing the other)
    const tables: TableDefinition[] = [
      {
        name: 'diff_rmfield',
        columns: [
          {
            name: 'keep',
            tableName: 'diff_rmfield',
            config: { type: 'string' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const config = makeConfig();
    await diffSchema({ config, tables, verbose: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const allOutput = logCalls.map((c) => String(c[0])).join('\n');
    expect(allOutput).toContain('Removed tables');
    expect(allOutput).toContain('diff_rmfield');
  });
});
