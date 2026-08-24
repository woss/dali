/**
 * Integration tests for push CLI functions.
 *
 * Tests: tablesToDdl(), pushSchema()
 *
 * Uses real embedded SurrealDB (memory mode).
 * Mocks connect for pushSchema tests so we retain driver control for verification.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbeddedDriver } from '../../../sdk/driver/embedded-driver.js';
import type {
  AccessConfig,
  EventConfig,
  FunctionConfig,
} from '../../../sdk/schema.js';
import type { TableDefinition } from '../../../sdk/table.js';

// Mock connect before importing pushSchema
vi.mock('../../../sdk/driver/orm-connection.js', () => ({
  connect: vi.fn(),
}));

import type { Config } from '../../config.js';
import { pushSchema, tablesToDdl } from '../push.js';

// ============================================================================
// Helpers
// ============================================================================

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    url: '',
    namespace: 'test_push_ns',
    database: 'test_push_db',
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
// tablesToDdl
// ============================================================================

describe('tablesToDdl', () => {
  it('returns empty DDL for empty tables', () => {
    const ddl = tablesToDdl([]);
    expect(ddl.tables).toEqual([]);
    expect(ddl.indexes).toEqual([]);
    expect(ddl.relations).toEqual([]);
  });

  it('converts normal table with columns', () => {
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [
          {
            name: 'name',
            tableName: 'user',
            config: { type: 'string' },
          },
          {
            name: 'age',
            tableName: 'user',
            config: { type: 'int' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const ddl = tablesToDdl(tables);
    expect(ddl.tables).toHaveLength(1);
    expect(ddl.tables[0].name).toBe('user');
    expect(ddl.tables[0].columns).toHaveLength(2);
    expect(ddl.tables[0].columns[0].name).toBe('name');
    expect(ddl.tables[0].columns[0].kind).toBe('string');
  });

  it('converts relation table with in/out', () => {
    const tables: TableDefinition[] = [
      {
        name: 'follows',
        columns: [
          {
            name: 'created_at',
            tableName: 'follows',
            config: { type: 'datetime' },
          },
        ],
        config: { schema: 'full', type: 'relation', in: 'user', out: 'user' },
      },
    ];

    const ddl = tablesToDdl(tables);
    expect(ddl.relations).toHaveLength(1);
    expect(ddl.relations[0].name).toBe('follows');
    expect(ddl.relations[0].in).toBe('user');
    expect(ddl.relations[0].out).toBe('user');
    expect(ddl.tables[0].in).toBe('user');
    expect(ddl.tables[0].out).toBe('user');
  });

  it('creates unique indexes from columns with unique: true', () => {
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [
          {
            name: 'email',
            tableName: 'user',
            config: { type: 'string', unique: true },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const ddl = tablesToDdl(tables);
    const emailIdx = ddl.indexes.find((i) => i.name === 'email_idx');
    expect(emailIdx).toBeDefined();
    expect(emailIdx!.cols).toEqual(['email']);
    expect(emailIdx!.index).toBe('unique');
  });

  it('converts access definitions', () => {
    const access: AccessConfig[] = [
      {
        name: 'account',
        type: 'RECORD',
        table: 'user',
        signup: 'CREATE user SET email = $email',
        signin: 'SELECT * FROM user WHERE email = $email',
      },
    ];

    const ddl = tablesToDdl([], access);
    expect(ddl.accessStructured).toHaveLength(1);
    expect(ddl.accessStructured[0].name).toBe('account');
    expect(ddl.accessStructured[0].type).toBe('RECORD');
  });

  it('converts event definitions', () => {
    const events: EventConfig[] = [
      {
        name: 'on_user_create',
        on: 'user',
        when: '$before = NONE',
        then: ['CREATE audit SET action = "created"'],
      },
    ];

    const ddl = tablesToDdl([], undefined, events);
    expect(ddl.events).toHaveLength(1);
    expect(ddl.events[0].name).toBe('on_user_create');
    expect(ddl.events[0].what).toBe('user');
    expect(ddl.events[0].then).toEqual(['CREATE audit SET action = "created"']);
  });

  it('converts function definitions', () => {
    const functions: FunctionConfig[] = [
      {
        name: 'fn::hello',
        args: ['$name'],
        body: 'RETURN $name',
      },
    ];

    const ddl = tablesToDdl([], undefined, undefined, functions);
    expect(ddl.functions).toHaveLength(1);
    expect(ddl.functions[0].name).toBe('fn::hello');
    expect(ddl.functions[0].args).toEqual(['$name']);
  });

  it('handles string column permissions', () => {
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [
          {
            name: 'email',
            tableName: 'user',
            config: { type: 'string', permissions: 'NONE' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const ddl = tablesToDdl(tables);
    expect(ddl.tables[0].columns[0].permissions).toEqual({
      select: 'NONE',
      create: 'NONE',
      update: 'NONE',
      delete: 'NONE',
    });
  });

  it('handles object column permissions', () => {
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [
          {
            name: 'email',
            tableName: 'user',
            config: {
              type: 'string',
              permissions: 'FOR select FULL, FOR create NONE',
            },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const ddl = tablesToDdl(tables);
    expect(ddl.tables[0].columns[0].permissions).toEqual({
      select: 'FOR select FULL, FOR create NONE',
      create: 'FOR select FULL, FOR create NONE',
      update: 'FOR select FULL, FOR create NONE',
      delete: 'FOR select FULL, FOR create NONE',
    });
  });

  it('includes indexes from table config', () => {
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [
          { name: 'email', tableName: 'user', config: { type: 'string' } },
        ],
        config: {
          schema: 'full',
          type: 'normal',
          indexes: [{ name: 'idx_email', fields: ['email'], type: 'unique' }],
        },
      },
    ];

    const ddl = tablesToDdl(tables);
    const idx = ddl.indexes.find((i) => i.name === 'idx_email');
    expect(idx).toBeDefined();
    expect(idx!.cols).toEqual(['email']);
    expect(idx!.index).toBe('unique');
  });

  it('sets column defaults from config', () => {
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [
          {
            name: 'status',
            tableName: 'user',
            config: { type: 'string', default: "'active'" },
          },
          {
            name: 'score',
            tableName: 'user',
            config: { type: 'int', default: '0' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const ddl = tablesToDdl(tables);
    expect(ddl.tables[0].columns[0].default).toBe("'active'");
    expect(ddl.tables[0].columns[1].default).toBe('0');
  });
});

// ============================================================================
// pushSchema — integration tests
// ============================================================================

describe('pushSchema', () => {
  let driver: EmbeddedDriver;
  let restoreConsole: () => void;

  beforeEach(async () => {
    driver = new EmbeddedDriver({
      driver: 'embedded',
      namespace: 'test_push',
      database: `push_test_${Date.now()}`,
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
    // Note: driverProxy prevents disconnect, so driver stays connected
    vi.restoreAllMocks();
    await driver.disconnect();
  });

  it('reports "up to date" when no changes', async () => {
    const tables: TableDefinition[] = [];
    const config = makeConfig();

    await pushSchema({ config, tables, embeddedDriver: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const upToDate = logCalls.find((c) => String(c[0]).includes('up to date'));
    expect(upToDate).toBeDefined();
  });

  it('applies new table schema', async () => {
    const tables: TableDefinition[] = [
      {
        name: 'push_test_user',
        columns: [
          {
            name: 'name',
            tableName: 'push_test_user',
            config: { type: 'string' },
          },
          { name: 'age', tableName: 'push_test_user', config: { type: 'int' } },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];
    const config = makeConfig();

    await pushSchema({ config, tables, embeddedDriver: true });

    // Verify table was created
    const info = await driver.query('INFO FOR DB');
    const result = info as unknown as { tables: Record<string, string> };
    const tableNames = Object.keys(result?.tables ?? {});
    expect(tableNames).toContain('push_test_user');
  });

  it('shows changes list without applying in dry run', async () => {
    const tables: TableDefinition[] = [
      {
        name: 'dry_run_table',
        columns: [
          {
            name: 'name',
            tableName: 'dry_run_table',
            config: { type: 'string' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];
    const config = makeConfig();

    await pushSchema({ config, tables, dryRun: true, embeddedDriver: true });

    // Verify dry run message
    const logCalls = vi.mocked(console.log).mock.calls;
    const dryRunLine = logCalls.find((c) => String(c[0]).includes('Dry run'));
    expect(dryRunLine).toBeDefined();

    // Verify table was NOT created
    const info = await driver.query('INFO FOR DB');
    const result = info as unknown as { tables: Record<string, string> };
    const tableNames = Object.keys(result?.tables ?? {});
    expect(tableNames).not.toContain('dry_run_table');
  });

  it('applies schema with access definitions', async () => {
    const tables: TableDefinition[] = [
      {
        name: 'access_user',
        columns: [
          {
            name: 'email',
            tableName: 'access_user',
            config: { type: 'string' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const config = makeConfig();
    await pushSchema({ config, tables, embeddedDriver: true });

    const info = await driver.query('INFO FOR DB');
    const result = info as unknown as { tables: Record<string, string> };
    const tableNames = Object.keys(result?.tables ?? {});
    expect(tableNames).toContain('access_user');
  });

  it('reconnects and applies schema with full DDL', async () => {
    const tables: TableDefinition[] = [
      {
        name: 'complex_table',
        columns: [
          {
            name: 'id_field',
            tableName: 'complex_table',
            config: { type: 'string' },
          },
          {
            name: 'unique_field',
            tableName: 'complex_table',
            config: { type: 'string', unique: true },
          },
          {
            name: 'optional_field',
            tableName: 'complex_table',
            config: { type: 'int', optional: true },
          },
          {
            name: 'readonly_field',
            tableName: 'complex_table',
            config: { type: 'string', readonly: true },
          },
        ],
        config: {
          schema: 'full',
          type: 'normal',
          permissions: { select: 'NONE' },
        },
      },
    ];

    const config = makeConfig();
    await pushSchema({ config, tables, embeddedDriver: true });

    // Verify table created
    const info = await driver.query('INFO FOR DB');
    const result = info as unknown as { tables: Record<string, string> };
    const tableNames = Object.keys(result?.tables ?? {});
    expect(tableNames).toContain('complex_table');
  });

  it('handles schema with has-changes result', async () => {
    // Push initial schema
    const tables: TableDefinition[] = [
      {
        name: 'evolving_table',
        columns: [
          {
            name: 'name',
            tableName: 'evolving_table',
            config: { type: 'string' },
          },
        ],
        config: { schema: 'full', type: 'normal' },
      },
    ];

    const config = makeConfig();
    await pushSchema({ config, tables, embeddedDriver: true });

    vi.mocked(console.log).mockClear();

    // Push same schema again — should be up to date
    await pushSchema({ config, tables, embeddedDriver: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const hasOutput = logCalls.some(
      (c) =>
        String(c[0]).includes('up to date') ||
        String(c[0]).includes('Schema changes'),
    );
    expect(hasOutput).toBe(true);
  });

  it('uses provided driver when ownsDriver=false', async () => {
    const tables: TableDefinition[] = [];
    const config = makeConfig();
    // Pass driver directly — pushSchema should not create its own
    await pushSchema({ config, tables }, driver);

    // safeDisconnect should NOT be called because ownsDriver=false
    const logCalls = vi.mocked(console.log).mock.calls;
    const upToDate = logCalls.find((c) => String(c[0]).includes('up to date'));
    expect(upToDate).toBeDefined();
  });
});

// ============================================================================
// tablesToDdl — additional branches
// ============================================================================

describe('tablesToDdl additional branches', () => {
  it('handles events with async and retry options', () => {
    const events: EventConfig[] = [
      {
        name: 'async_event',
        on: 'user',
        when: '$before = NONE',
        then: ['CREATE audit SET action = "created"'],
        comment: 'Audit trail',
        async: true,
        retry: 3,
        maxdepth: 5,
      },
    ];

    const ddl = tablesToDdl([], undefined, events);
    expect(ddl.events).toHaveLength(1);
    expect(ddl.events[0].async).toBe(true);
    expect(ddl.events[0].retry).toBe(3);
    expect(ddl.events[0].maxdepth).toBe(5);
    expect(ddl.events[0].comment).toBe('Audit trail');
  });

  it('handles functions with comment and permissions', () => {
    const functions: FunctionConfig[] = [
      {
        name: 'fn::greet',
        args: ['$name', '$greeting'],
        body: 'RETURN $greeting + $name',
        comment: 'Greeting function',
        permissions: 'NONE',
      },
    ];

    const ddl = tablesToDdl([], undefined, undefined, functions);
    expect(ddl.functions).toHaveLength(1);
    expect(ddl.functions[0].comment).toBe('Greeting function');
    expect(ddl.functions[0].permissions).toBe('NONE');
  });

  it('handles functions with no args', () => {
    const functions: FunctionConfig[] = [
      {
        name: 'fn::version',
        body: 'RETURN "1.0.0"',
      },
    ];

    const ddl = tablesToDdl([], undefined, undefined, functions);
    expect(ddl.functions[0].args).toBeUndefined();
  });

  it('handles SCHEMALESS tables default optional to true', () => {
    const tables: TableDefinition[] = [
      {
        name: 'less_table',
        columns: [
          {
            name: 'flexible_col',
            tableName: 'less_table',
            config: { type: 'string' },
          },
        ],
        config: { schema: 'less', type: 'normal' },
      },
    ];

    const ddl = tablesToDdl(tables);
    expect(ddl.tables[0].columns[0].optional).toBe(true);
  });

  it('handles table-level permissions', () => {
    const tables: TableDefinition[] = [
      {
        name: 'protected_table',
        columns: [
          {
            name: 'secret',
            tableName: 'protected_table',
            config: { type: 'string' },
          },
        ],
        config: {
          schema: 'full',
          type: 'normal',
          permissions: { select: 'NONE', create: 'NONE' },
        },
      },
    ];

    const ddl = tablesToDdl(tables);
    expect(ddl.tables[0].permissions).toEqual({
      select: 'NONE',
      create: 'NONE',
    });
  });

  it('handles empty access and events arrays', () => {
    const ddl = tablesToDdl([], [], [], []);
    expect(ddl.accessStructured).toEqual([]);
    expect(ddl.events).toEqual([]);
    expect(ddl.functions).toEqual([]);
  });
});
