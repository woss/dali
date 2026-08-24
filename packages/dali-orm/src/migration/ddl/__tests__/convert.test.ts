import { describe, expect, it } from 'vitest';
import type { ColumnDefinition } from '../../../sdk/schema/column/types.js';
import type { IndexDefinition, TableDefinition } from '../../../sdk/table.js';
import {
  fromSurrealAccess,
  fromSurrealColumn,
  fromSurrealEvent,
  fromSurrealFunction,
  fromSurrealTable,
  toSurrealAccess,
  toSurrealColumn,
  toSurrealEvent,
  toSurrealFunction,
  toSurrealTable,
} from '../convert.js';
import type {
  SurrealAccess,
  SurrealColumn,
  SurrealEvent,
  SurrealFunction,
  SurrealTable,
} from '../ddl.js';

// =============================================================================
// toSurrealColumn
// =============================================================================
describe('toSurrealColumn', () => {
  it('converts basic ColumnDefinition to SurrealColumn', () => {
    const def: ColumnDefinition = {
      name: 'email',
      config: { type: 'string' },
      tableName: 'user',
    };

    const result = toSurrealColumn(def, 'user');

    expect(result).toEqual({
      name: 'email',
      kind: 'string',
      table: 'user',
      default: undefined,
      readonly: false,
      optional: false,
      permissions: { select: true, create: true },
      flex: false,
      assert: undefined,
      recordTable: undefined,
      value: undefined,
      computed: undefined,
      reference: undefined,
      comment: undefined,
      default_always: undefined,
    });
  });

  it('includes optional config fields when provided', () => {
    const def: ColumnDefinition = {
      name: 'score',
      config: {
        type: 'int',
        default: '0',
        readonly: true,
        optional: true,
        permissions: 'NONE',
        flexible: true,
        assert: 'math::is::finite($value)',
        recordTable: 'score',
      },
    };

    const result = toSurrealColumn(def, 'game');

    expect(result.name).toBe('score');
    expect(result.kind).toBe('int');
    expect(result.default).toBe('0');
    expect(result.readonly).toBe(true);
    expect(result.optional).toBe(true);
    expect(result.permissions).toEqual({
      select: 'NONE',
      create: 'NONE',
      update: 'NONE',
    });
    expect(result.flex).toBe(true);
    expect(result.assert).toBe('math::is::finite($value)');
    expect(result.recordTable).toBe('score');
    expect(result.table).toBe('game');
  });

  it('sets default permissions when none provided', () => {
    const def: ColumnDefinition = {
      name: 'name',
      config: { type: 'string' },
    };

    const result = toSurrealColumn(def, 'user');

    expect(result.permissions).toEqual({ select: true, create: true });
  });

  it('throws when ColumnDefinition is null', () => {
    expect(() =>
      toSurrealColumn(null as unknown as ColumnDefinition, 't'),
    ).toThrow('ColumnDefinition required');
  });

  it('throws when tableName is empty', () => {
    const def: ColumnDefinition = { name: 'x', config: { type: 'string' } };
    expect(() => toSurrealColumn(def, '')).toThrow(
      'tableName required for SurrealColumn',
    );
  });
});

// =============================================================================
// fromSurrealColumn
// =============================================================================
describe('fromSurrealColumn', () => {
  it('converts SurrealColumn to ColumnDefinition', () => {
    const col: SurrealColumn = {
      name: 'email',
      kind: 'string',
      table: 'user',
      readonly: true,
      optional: true,
      permissions: { select: true, create: true },
      flex: false,
      default: 'admin@test.com',
      assert: 'string::is::email($value)',
      recordTable: undefined,
      value: undefined,
      computed: undefined,
      reference: undefined,
      comment: undefined,
      default_always: undefined,
    };

    const result = fromSurrealColumn(col);

    expect(result).toEqual({
      name: 'email',
      tableName: 'user',
      config: {
        type: 'string',
        default: 'admin@test.com',
        optional: true,
        readonly: true,
        assert: 'string::is::email($value)',
      },
    });
  });

  it('omits undefined optional fields from config', () => {
    const col: SurrealColumn = {
      name: 'name',
      kind: 'string',
      table: 'user',
      readonly: false,
      optional: false,
      permissions: { select: true, create: true },
      flex: false,
    };

    const result = fromSurrealColumn(col);

    expect(result.config).toEqual({ type: 'string' });
  });

  it('throws when SurrealColumn is null', () => {
    expect(() => fromSurrealColumn(null as unknown as SurrealColumn)).toThrow(
      'SurrealColumn required',
    );
  });
});

// =============================================================================
// Column roundtrip
// =============================================================================
describe('column roundtrip', () => {
  it('survives to→from conversion preserving name, type, table', () => {
    const def: ColumnDefinition = {
      name: 'age',
      config: { type: 'int', default: '18', readonly: true, optional: true },
      tableName: 'person',
    };

    const sur = toSurrealColumn(def, 'person');
    const back = fromSurrealColumn(sur);

    expect(back.name).toBe('age');
    expect(back.tableName).toBe('person');
    expect(back.config.type).toBe('int');
    expect(back.config.default).toBe('18');
    expect(back.config.readonly).toBe(true);
    expect(back.config.optional).toBe(true);
  });
});

// =============================================================================
// toSurrealTable
// =============================================================================
describe('toSurrealTable', () => {
  it('converts TableDefinition with columns and indexes to SurrealTable', () => {
    const def: TableDefinition = {
      name: 'user',
      columns: [
        { name: 'id', config: { type: 'string' } },
        { name: 'name', config: { type: 'string', optional: true } },
      ],
      config: {
        schema: 'less',
        type: 'normal',
        permissions: { select: 'FULL' },
        in: undefined,
        out: undefined,
      },
    };

    const result = toSurrealTable(def);

    expect(result.name).toBe('user');
    expect(result.schema).toBe('less');
    expect(result.type).toBe('normal');
    expect(result.columns).toHaveLength(2);
    expect(result.columns[0].name).toBe('id');
    expect(result.columns[0].kind).toBe('string');
    expect(result.columns[1].name).toBe('name');
    expect(result.columns[1].optional).toBe(true);
    expect(result.permissions).toEqual({ select: 'FULL' });
    expect(result.indexes).toEqual([]);
  });

  it('defaults schema to full and type to normal', () => {
    const def: TableDefinition = {
      name: 'item',
      columns: [{ name: 'val', config: { type: 'int' } }],
      config: {},
    };

    const result = toSurrealTable(def);

    expect(result.schema).toBe('full');
    expect(result.type).toBe('normal');
  });

  it('converts indexes from config', () => {
    const idx: IndexDefinition = {
      name: 'user_email_idx',
      fields: ['email'],
      type: 'unique',
    };

    const def: TableDefinition = {
      name: 'user',
      columns: [{ name: 'email', config: { type: 'string' } }],
      config: { indexes: [idx] },
    };

    const result = toSurrealTable(def);

    expect(result.indexes).toHaveLength(1);
    expect(result.indexes[0].name).toBe('user_email_idx');
    expect(result.indexes[0].cols).toEqual(['email']);
    expect(result.indexes[0].index).toBe('unique');
  });

  it('handles table with in/out relation config', () => {
    const def: TableDefinition = {
      name: 'follows',
      columns: [{ name: 'id', config: { type: 'string' } }],
      config: {
        type: 'relation',
        in: 'user',
        out: 'user',
      },
    };

    const result = toSurrealTable(def);

    expect(result.type).toBe('relation');
    expect(result.in).toBe('user');
    expect(result.out).toBe('user');
  });

  it('throws when TableDefinition is null', () => {
    expect(() => toSurrealTable(null as unknown as TableDefinition)).toThrow(
      'TableDefinition required',
    );
  });
});

// =============================================================================
// fromSurrealTable
// =============================================================================
describe('fromSurrealTable', () => {
  it('converts SurrealTable back to TableDefinition', () => {
    const table: SurrealTable = {
      name: 'user',
      schema: 'less',
      type: 'normal',
      columns: [
        {
          name: 'id',
          kind: 'string',
          table: 'user',
          readonly: false,
          optional: false,
          permissions: { select: true, create: true },
          flex: false,
        },
      ],
      indexes: [],
      permissions: { select: 'FULL' },
      in: undefined,
      out: undefined,
    };

    const result = fromSurrealTable(table);

    expect(result.name).toBe('user');
    expect(result.config.schema).toBe('less');
    expect(result.config.permissions).toEqual({ select: 'FULL' });
    expect(result.columns).toHaveLength(1);
    expect(result.columns[0].name).toBe('id');
  });

  it('omits default config values from result', () => {
    const table: SurrealTable = {
      name: 'user',
      schema: 'full',
      type: 'normal',
      columns: [],
      indexes: [],
      permissions: undefined,
      in: undefined,
      out: undefined,
    };

    const result = fromSurrealTable(table);

    expect(result.config.schema).toBeUndefined();
    expect(result.config.type).toBeUndefined();
    expect(result.config.permissions).toBeUndefined();
    expect(result.config.in).toBeUndefined();
    expect(result.config.out).toBeUndefined();
  });

  it('converts indexes back from SurrealIndex', () => {
    const table: SurrealTable = {
      name: 'user',
      schema: 'full',
      type: 'normal',
      columns: [],
      indexes: [
        { name: 'email_idx', table: 'user', cols: ['email'], index: 'unique' },
      ],
      permissions: undefined,
    };

    const result = fromSurrealTable(table);
    const configIndexes = result.config.indexes;

    expect(configIndexes).toHaveLength(1);
    expect(configIndexes?.[0].name).toBe('email_idx');
    expect(configIndexes?.[0].fields).toEqual(['email']);
    expect(configIndexes?.[0].type).toBe('unique');
  });

  it('does not set indexes config when empty', () => {
    const table: SurrealTable = {
      name: 'user',
      schema: 'full',
      type: 'normal',
      columns: [],
      indexes: [],
      permissions: undefined,
    };

    const result = fromSurrealTable(table);

    expect(result.config.indexes).toBeUndefined();
  });

  it('throws when SurrealTable is null', () => {
    expect(() => fromSurrealTable(null as unknown as SurrealTable)).toThrow(
      'SurrealTable required',
    );
  });
});

// =============================================================================
// Table roundtrip
// =============================================================================
describe('table roundtrip', () => {
  it('survives to→from conversion preserving core fields', () => {
    const def: TableDefinition = {
      name: 'product',
      columns: [{ name: 'price', config: { type: 'float', default: '0.0' } }],
      config: {
        schema: 'full',
        permissions: { select: 'WHERE published = true' },
      },
    };

    const sur = toSurrealTable(def);
    const back = fromSurrealTable(sur);

    expect(back.name).toBe('product');
    expect(back.config.schema).toBeUndefined(); // 'full' is default, omitted
    expect(back.config.permissions).toEqual({
      select: 'WHERE published = true',
    });
    expect(back.columns[0].name).toBe('price');
    expect(back.columns[0].config.type).toBe('float');
    expect(back.columns[0].config.default).toBe('0.0');
  });
});

// =============================================================================
// toSurrealAccess
// =============================================================================
describe('toSurrealAccess', () => {
  it('converts record-based access config', () => {
    const config = {
      name: 'account',
      type: 'RECORD',
      table: 'user',
      signup: 'CREATE user SET email = $email',
      signin: 'SELECT * FROM user WHERE email = $email',
    };

    const result = toSurrealAccess(config);

    expect(result.name).toBe('account');
    expect(result.type).toBe('RECORD');
    expect(result.table).toBe('user');
    expect(result.signup).toBe('CREATE user SET email = $email');
    expect(result.signin).toBe('SELECT * FROM user WHERE email = $email');
  });

  it('converts JWT-based access config', () => {
    const config = {
      name: 'api',
      type: 'JWT',
      identifier: 'RS256',
      algorithm: 'RS256',
      key: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0B\n-----END PUBLIC KEY-----',
      issuer: 'https://auth.example.com',
    };

    const result = toSurrealAccess(config);

    expect(result.type).toBe('JWT');
    expect(result.identifier).toBe('RS256');
    expect(result.algorithm).toBe('RS256');
    expect(result.key).toContain('BEGIN PUBLIC KEY');
    expect(result.issuer).toBe('https://auth.example.com');
  });

  it('converts access config with duration', () => {
    const config = {
      name: 'session',
      type: 'RECORD',
      duration: '15m',
      tokenDuration: '30m',
    };

    const result = toSurrealAccess(config);

    expect(result.duration).toBe('15m');
    expect(result.tokenDuration).toBe('30m');
  });

  it('defaults type to RECORD', () => {
    const result = toSurrealAccess({ name: 'default' } as any);
    expect(result.type).toBe('RECORD');
  });

  it('throws when config is null', () => {
    expect(() => toSurrealAccess(null as any)).toThrow('AccessConfig required');
  });

  it('throws when name is missing', () => {
    expect(() => toSurrealAccess({ name: '' } as any)).toThrow(
      'Access name is required',
    );
  });
});

// =============================================================================
// fromSurrealAccess
// =============================================================================
describe('fromSurrealAccess', () => {
  it('converts SurrealAccess back to config object', () => {
    const access: SurrealAccess = {
      name: 'account',
      type: 'RECORD',
      table: 'user',
      signup: 'CREATE user SET email = $email',
      signin: 'SELECT * FROM user WHERE email = $email',
      algorithm: 'RS256',
      key: 'pubkey',
    };

    const result = fromSurrealAccess(access);

    expect(result.name).toBe('account');
    expect(result.type).toBe('RECORD');
    expect(result.table).toBe('user');
    expect(result.signup).toBe('CREATE user SET email = $email');
    expect(result.signin).toBe('SELECT * FROM user WHERE email = $email');
    expect(result.algorithm).toBe('RS256');
    expect(result.key).toBe('pubkey');
  });

  it('includes only defined fields', () => {
    const access: SurrealAccess = {
      name: 'minimal',
      type: 'JWT',
    };

    const result = fromSurrealAccess(access);

    expect(result.name).toBe('minimal');
    expect(result.type).toBe('JWT');
    expect(result.table).toBeUndefined();
    expect(result.signup).toBeUndefined();
    expect(result.signin).toBeUndefined();
    expect(result.identifier).toBeUndefined();
    expect(result.algorithm).toBeUndefined();
    expect(result.key).toBeUndefined();
    expect(result.issuer).toBeUndefined();
    expect(result.duration).toBeUndefined();
    expect(result.tokenDuration).toBeUndefined();
  });

  it('throws when access is null', () => {
    expect(() => fromSurrealAccess(null as unknown as SurrealAccess)).toThrow(
      'SurrealAccess required',
    );
  });

  it('throws when name is missing', () => {
    expect(() => fromSurrealAccess({ name: '' } as SurrealAccess)).toThrow(
      'SurrealAccess.name is required',
    );
  });
});

// =============================================================================
// Access roundtrip
// =============================================================================
describe('access roundtrip', () => {
  it('survives to→from conversion', () => {
    const config = {
      name: 'account',
      type: 'RECORD',
      table: 'user',
      signup: 'CREATE user SET email = $email',
      signin: 'SELECT * FROM user WHERE email = $email',
      duration: '1h',
      tokenDuration: '24h',
    };

    const sur = toSurrealAccess(config);
    const back = fromSurrealAccess(sur);

    expect(back.name).toBe('account');
    expect(back.type).toBe('RECORD');
    expect(back.table).toBe('user');
    expect(back.signup).toBe(config.signup);
    expect(back.signin).toBe(config.signin);
    expect(back.duration).toBe('1h');
    expect(back.tokenDuration).toBe('24h');
  });
});

// =============================================================================
// toSurrealEvent
// =============================================================================
describe('toSurrealEvent', () => {
  it('converts sync event config', () => {
    const config = {
      name: 'on_signup',
      on: 'user',
      when: 'INSERT',
      then: ['CREATE notification SET message = "Welcome"'],
    };

    const result = toSurrealEvent(config);

    expect(result.name).toBe('on_signup');
    expect(result.what).toBe('user');
    expect(result.when).toBe('INSERT');
    expect(result.then).toEqual([
      'CREATE notification SET message = "Welcome"',
    ]);
    expect(result.async).toBeUndefined();
  });

  it('converts async event config', () => {
    const config = {
      name: 'process_order',
      on: 'order',
      when: 'INSERT',
      then: ['UPDATE order SET status = "processing"'],
      async: true,
      retry: 3,
      maxdepth: 5,
    };

    const result = toSurrealEvent(config);

    expect(result.name).toBe('process_order');
    expect(result.async).toBe(true);
    expect(result.retry).toBe(3);
    expect(result.maxdepth).toBe(5);
  });

  it('throws when config is null', () => {
    expect(() => toSurrealEvent(null as any)).toThrow('EventConfig required');
  });

  it('throws when name missing', () => {
    expect(() =>
      toSurrealEvent({ name: '', on: 't', when: 'INSERT', then: [] }),
    ).toThrow('Event name is required');
  });

  it('throws when table missing', () => {
    expect(() =>
      toSurrealEvent({ name: 'e', on: '', when: 'INSERT', then: [] }),
    ).toThrow('Event table (on) is required');
  });

  it('throws when condition missing', () => {
    expect(() =>
      toSurrealEvent({ name: 'e', on: 't', when: '', then: [] }),
    ).toThrow('Event condition (when) is required');
  });
});

// =============================================================================
// fromSurrealEvent
// =============================================================================
describe('fromSurrealEvent', () => {
  it('converts SurrealEvent back to config', () => {
    const event: SurrealEvent = {
      name: 'on_signup',
      what: 'user',
      when: 'INSERT',
      then: ['CREATE notification SET message = "Welcome"'],
      comment: 'Send welcome notification on signup',
      async: true,
      retry: 3,
      maxdepth: 5,
    };

    const result = fromSurrealEvent(event);

    expect(result.name).toBe('on_signup');
    expect(result.on).toBe('user');
    expect(result.when).toBe('INSERT');
    expect(result.then).toEqual([
      'CREATE notification SET message = "Welcome"',
    ]);
    expect(result.comment).toBe('Send welcome notification on signup');
    expect(result.async).toBe(true);
    expect(result.retry).toBe(3);
    expect(result.maxdepth).toBe(5);
  });

  it('defaults then to empty array when event.then is missing', () => {
    const event: SurrealEvent = {
      name: 'no_then',
      what: 't',
      when: 'INSERT',
      then: undefined as unknown as string[],
    };

    const result = fromSurrealEvent(event);

    expect(result.then).toEqual([]);
  });

  it('throws when event is null', () => {
    expect(() => fromSurrealEvent(null as unknown as SurrealEvent)).toThrow(
      'SurrealEvent required',
    );
  });
});

// =============================================================================
// Event roundtrip
// =============================================================================
describe('event roundtrip', () => {
  it('survives to→from conversion', () => {
    const config = {
      name: 'on_update',
      on: 'user',
      when: 'UPDATE',
      then: ['LOG "user updated"'],
      async: true,
      retry: 3,
    };

    const sur = toSurrealEvent(config);
    const back = fromSurrealEvent(sur);

    expect(back.name).toBe('on_update');
    expect(back.on).toBe('user');
    expect(back.when).toBe('UPDATE');
    expect(back.then).toEqual(['LOG "user updated"']);
    expect(back.async).toBe(true);
    expect(back.retry).toBe(3);
  });
});

// =============================================================================
// toSurrealFunction
// =============================================================================
describe('toSurrealFunction', () => {
  it('converts function config with args', () => {
    const config = {
      name: 'fn::greet',
      args: ['$name'],
      body: 'RETURN "Hello " + $name',
    };

    const result = toSurrealFunction(config);

    expect(result.name).toBe('fn::greet');
    expect(result.args).toEqual(['$name']);
    expect(result.body).toBe('RETURN "Hello " + $name');
  });

  it('converts function config without args', () => {
    const config = {
      name: 'fn::pi',
      body: 'RETURN 3.14159',
    };

    const result = toSurrealFunction(config);

    expect(result.name).toBe('fn::pi');
    expect(result.args).toBeUndefined();
    expect(result.body).toBe('RETURN 3.14159');
  });

  it('includes optional comment and permissions', () => {
    const config = {
      name: 'fn::is_adult',
      args: ['$age'],
      body: 'RETURN $age >= 18',
      comment: 'Check if age qualifies as adult',
      permissions: 'FULL',
    };

    const result = toSurrealFunction(config);

    expect(result.comment).toBe('Check if age qualifies as adult');
    expect(result.permissions).toBe('FULL');
  });

  it('throws when config is null', () => {
    expect(() => toSurrealFunction(null as any)).toThrow(
      'FunctionConfig required',
    );
  });

  it('throws when name missing', () => {
    expect(() => toSurrealFunction({ name: '', body: 'RETURN 1' })).toThrow(
      'Function name is required',
    );
  });

  it('throws when body missing', () => {
    expect(() => toSurrealFunction({ name: 'fn::x', body: '' })).toThrow(
      'Function body is required',
    );
  });
});

// =============================================================================
// fromSurrealFunction
// =============================================================================
describe('fromSurrealFunction', () => {
  it('converts SurrealFunction back to config', () => {
    const func: SurrealFunction = {
      name: 'fn::greet',
      args: ['$name'],
      body: 'RETURN "Hello " + $name',
      comment: 'Greeting function',
      permissions: 'FULL',
    };

    const result = fromSurrealFunction(func);

    expect(result.name).toBe('fn::greet');
    expect(result.args).toEqual(['$name']);
    expect(result.body).toBe('RETURN "Hello " + $name');
    expect(result.comment).toBe('Greeting function');
    expect(result.permissions).toBe('FULL');
  });

  it('omits args when empty', () => {
    const func: SurrealFunction = {
      name: 'fn::pi',
      body: 'RETURN 3.14159',
    };

    const result = fromSurrealFunction(func);

    expect(result.args).toBeUndefined();
  });

  it('throws when func is null', () => {
    expect(() =>
      fromSurrealFunction(null as unknown as SurrealFunction),
    ).toThrow('SurrealFunction required');
  });

  it('throws when name is missing', () => {
    expect(() =>
      fromSurrealFunction({ name: '', body: 'x' } as SurrealFunction),
    ).toThrow('SurrealFunction.name is required');
  });
});

// =============================================================================
// Function roundtrip
// =============================================================================
describe('function roundtrip', () => {
  it('survives to→from conversion', () => {
    const config = {
      name: 'fn::multiply',
      args: ['$a', '$b'],
      body: 'RETURN $a * $b',
      comment: 'Multiply two numbers',
    };

    const sur = toSurrealFunction(config);
    const back = fromSurrealFunction(sur);

    expect(back.name).toBe('fn::multiply');
    expect(back.args).toEqual(['$a', '$b']);
    expect(back.body).toBe('RETURN $a * $b');
    expect(back.comment).toBe('Multiply two numbers');
  });
});
