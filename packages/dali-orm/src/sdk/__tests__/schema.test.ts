import { safeParse } from 'valibot';
import { describe, expect, it, vi } from 'vite-plus/test';
import {
  type AccessConfig,
  AccessConfigSchema,
  accessToSQL,
  type EventConfig,
  EventConfigSchema,
  eventToSQL,
  type FunctionConfig,
  FunctionConfigSchema,
  functionToSQL,
  defineNamespace,
  defineDatabase,
  defineSequence,
  generateSigninFromSQL,
  generateSignupFromSQL,
  generateSignupFromTable,
} from '../schema.js';
import type { ColumnDefinition, TableDefinition } from '../table.js';

// =============================================================================
// Helpers
// =============================================================================

function createColumn(name: string, overrides: Partial<ColumnDefinition> = {}): ColumnDefinition {
  return {
    name,
    config: {
      type: 'string',
      optional: false,
      ...overrides.config,
    },
    ...overrides,
  };
}

function createTable(name: string, columns: ColumnDefinition[]): TableDefinition {
  return {
    name,
    columns,
    config: { schema: 'full', type: 'normal' },
  };
}

// =============================================================================
// Mock obug
// =============================================================================

vi.mock('obug', () => ({
  createDebug: vi.fn(() => {
    const fn = vi.fn() as any;
    fn.extend = vi.fn(() => vi.fn());
    return fn;
  }),
}));

// =============================================================================
// accessToSQL
// =============================================================================

describe('accessToSQL', () => {
  it('generates minimal RECORD access', () => {
    const sql = accessToSQL({ name: 'web_access', type: 'RECORD' });
    expect(sql).toBe('DEFINE ACCESS web_access ON DATABASE TYPE RECORD');
  });

  it('generates JWT access', () => {
    const sql = accessToSQL({
      name: 'jwt_access',
      type: 'JWT',
      algorithm: 'HS256',
      key: 'secret',
      issuer: 'dali-orm',
    });
    expect(sql).toBe(
      'DEFINE ACCESS jwt_access ON DATABASE TYPE JWT ALGORITHM HS256 KEY "secret" ISSUER dali-orm',
    );
  });

  it('generates OIDC access', () => {
    const sql = accessToSQL({ name: 'oidc_access', type: 'OIDC' });
    expect(sql).toBe('DEFINE ACCESS oidc_access ON DATABASE TYPE OIDC');
  });

  it('includes signup and signin when provided', () => {
    const sql = accessToSQL({
      name: 'record_access',
      type: 'RECORD',
      signup: 'CREATE user SET email = $email',
      signin: 'SELECT * FROM user WHERE email = $email',
    });
    expect(sql).toContain('SIGNUP (CREATE user SET email = $email)');
    expect(sql).toContain('SIGNIN (SELECT * FROM user WHERE email = $email)');
  });

  it('generates signup/signin from table when table provided', () => {
    const table: TableDefinition = createTable('user', [
      createColumn('email'),
      createColumn('password'),
    ]);
    const sql = accessToSQL(
      { name: 'record_access', type: 'RECORD', table: 'user' },
      { user: table },
    );
    expect(sql).toContain(
      'SIGNUP (CREATE user SET email = $email, password = crypto::argon2::generate($password))',
    );
    expect(sql).toContain(
      'SIGNIN (SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(password, $password))',
    );
  });

  it('prefers explicit signup/signin over table-generated', () => {
    const table: TableDefinition = createTable('user', [
      createColumn('email'),
      createColumn('password'),
    ]);
    const sql = accessToSQL(
      {
        name: 'record_access',
        type: 'RECORD',
        table: 'user',
        signup: 'CREATE user SET email = $email, name = $name',
        signin:
          'SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(password, $password)',
      },
      { user: table },
    );
    expect(sql).toContain('SIGNUP (CREATE user SET email = $email, name = $name)');
  });

  it('includes DURATION with both FOR TOKEN and FOR SESSION', () => {
    const sql = accessToSQL({
      name: 'duration_access',
      type: 'RECORD',
      duration: '7d',
      tokenDuration: '1h',
    });
    expect(sql).toContain('DURATION FOR TOKEN 1h, FOR SESSION 7d');
  });

  it('includes DURATION with only FOR SESSION when no tokenDuration', () => {
    const sql = accessToSQL({
      name: 'session_only',
      type: 'RECORD',
      duration: '30m',
    });
    expect(sql).toContain('DURATION FOR SESSION 30m');
    expect(sql).not.toContain('FOR TOKEN');
  });

  it('includes DURATION with only FOR TOKEN when no duration', () => {
    const sql = accessToSQL({
      name: 'token_only',
      type: 'RECORD',
      tokenDuration: '15m',
    });
    expect(sql).toContain('DURATION FOR TOKEN 15m');
    expect(sql).not.toContain('FOR SESSION');
  });

  it('throws on null config', () => {
    expect(() => accessToSQL(null as unknown as AccessConfig)).toThrow('AccessConfig is required');
  });

  it('throws on undefined config', () => {
    expect(() => accessToSQL(undefined as unknown as AccessConfig)).toThrow(
      'AccessConfig is required',
    );
  });
});

// =============================================================================
// functionToSQL
// =============================================================================

describe('functionToSQL', () => {
  it('generates basic function without args', () => {
    const sql = functionToSQL({ name: 'fn::hello', body: 'RETURN "hello"' });
    expect(sql).toBe('DEFINE FUNCTION IF NOT EXISTS fn::hello { RETURN "hello" }');
  });

  it('generates function with arguments', () => {
    const sql = functionToSQL({
      name: 'fn::greet',
      args: ['$name', '$title'],
      body: 'RETURN $title + " " + $name',
    });
    expect(sql).toContain('($name, $title)');
    expect(sql).toContain('{ RETURN $title + " " + $name }');
  });

  it('includes comment when provided', () => {
    const sql = functionToSQL({
      name: 'fn::add',
      args: ['$a', '$b'],
      body: 'RETURN $a + $b',
      comment: 'Adds two numbers',
    });
    expect(sql).toContain('COMMENT "Adds two numbers"');
  });

  it('includes permissions when provided', () => {
    const sql = functionToSQL({
      name: 'fn::secret',
      body: 'RETURN "secret"',
      permissions: 'FULL',
    });
    expect(sql).toContain('PERMISSIONS FULL');
  });

  it('generates full config with all fields', () => {
    const sql = functionToSQL({
      name: 'fn::full',
      args: ['$x'],
      body: 'RETURN $x * 2',
      comment: 'Doubles input',
      permissions: 'WHERE $auth.admin = true',
    });
    expect(sql).toContain('DEFINE FUNCTION IF NOT EXISTS fn::full ($x)');
    expect(sql).toContain('{ RETURN $x * 2 }');
    expect(sql).toContain('COMMENT "Doubles input"');
    expect(sql).toContain('PERMISSIONS WHERE $auth.admin = true');
  });

  it('throws on null config', () => {
    expect(() => functionToSQL(null as unknown as FunctionConfig)).toThrow(
      'FunctionConfig is required',
    );
  });

  it('throws on empty name', () => {
    expect(() => functionToSQL({ name: '', body: 'RETURN 1' })).toThrow(
      'Function name is required',
    );
  });

  it('throws on empty body', () => {
    expect(() => functionToSQL({ name: 'fn::test', body: '' })).toThrow(
      'Function body is required',
    );
  });

  it('handles empty args array', () => {
    const sql = functionToSQL({ name: 'fn::noargs', args: [], body: 'RETURN true' });
    expect(sql).not.toContain('()');
    expect(sql).toBe('DEFINE FUNCTION IF NOT EXISTS fn::noargs { RETURN true }');
  });
});

// =============================================================================
// eventToSQL
// =============================================================================

describe('eventToSQL', () => {
  it('generates basic event', () => {
    const sql = eventToSQL({
      name: 'on_create',
      on: 'user',
      when: '$before == NONE',
      then: ['CREATE audit SET action = "create"'],
    });
    expect(sql).toContain(
      'DEFINE EVENT IF NOT EXISTS on_create ON TABLE user WHEN ($before == NONE) THEN',
    );
    expect(sql).toContain('{ CREATE audit SET action = "create" }');
  });

  it('generates event with multiple THEN actions', () => {
    const sql = eventToSQL({
      name: 'multi_then',
      on: 'order',
      when: '$before.status != $after.status',
      then: ['CREATE audit SET action = "status_change"', 'UPDATE stats SET count += 1'],
    });
    expect(sql).toContain('CREATE audit SET action = "status_change"');
    expect(sql).toContain('UPDATE stats SET count += 1');
    expect(sql).toMatch(/CREATE audit.*; UPDATE stats/);
  });

  it('includes comment when provided', () => {
    const sql = eventToSQL({
      name: 'commented',
      on: 'user',
      when: 'true',
      then: ['CREATE log SET msg = "triggered"'],
      comment: 'Audits all user changes',
    });
    expect(sql).toContain('COMMENT "Audits all user changes"');
  });

  it('marks async events', () => {
    const sql = eventToSQL({
      name: 'async_event',
      on: 'user',
      when: 'true',
      then: ['CREATE log SET msg = "async"'],
      async: true,
    });
    expect(sql).toContain('ASYNC');
  });

  it('includes retry count', () => {
    const sql = eventToSQL({
      name: 'retry_event',
      on: 'user',
      when: 'true',
      then: ['CREATE log SET msg = "retry"'],
      retry: 3,
    });
    expect(sql).toContain('RETRY 3');
  });

  it('includes maxdepth', () => {
    const sql = eventToSQL({
      name: 'deep_event',
      on: 'user',
      when: 'true',
      then: ['CREATE log SET msg = "deep"'],
      maxdepth: 5,
    });
    expect(sql).toContain('MAXDEPTH 5');
  });

  it('generates full async event with all options', () => {
    const sql = eventToSQL({
      name: 'full_event',
      on: 'user',
      when: '$before.email != $after.email',
      then: ['CREATE audit SET action = "email_change"'],
      comment: 'Tracks email changes',
      async: true,
      retry: 3,
      maxdepth: 10,
    });
    expect(sql).toContain('DEFINE EVENT IF NOT EXISTS full_event ON TABLE user');
    expect(sql).toContain('WHEN ($before.email != $after.email)');
    expect(sql).toContain('THEN { CREATE audit SET action = "email_change" }');
    expect(sql).toContain('COMMENT "Tracks email changes"');
    expect(sql).toContain('ASYNC');
    expect(sql).toContain('RETRY 3');
    expect(sql).toContain('MAXDEPTH 10');
  });

  it('throws on null config', () => {
    expect(() => eventToSQL(null as unknown as EventConfig)).toThrow('EventConfig is required');
  });

  it('throws on empty name', () => {
    expect(() =>
      eventToSQL({ name: '', on: 'user', when: 'true', then: ['CREATE log SET msg = "x"'] }),
    ).toThrow('Event name is required');
  });

  it('throws on empty on (table)', () => {
    expect(() =>
      eventToSQL({ name: 'evt', on: '', when: 'true', then: ['CREATE log SET msg = "x"'] }),
    ).toThrow('Event table (on) is required');
  });

  it('throws on empty when', () => {
    expect(() =>
      eventToSQL({ name: 'evt', on: 'user', when: '', then: ['CREATE log SET msg = "x"'] }),
    ).toThrow('Event condition (when) is required');
  });

  it('throws on empty then', () => {
    expect(() => eventToSQL({ name: 'evt', on: 'user', when: 'true', then: [] })).toThrow(
      'Event action (then) is required',
    );
  });
});

// =============================================================================
// generateSignupFromTable
// =============================================================================

describe('generateSignupFromTable', () => {
  it('maps required columns to SET clause', () => {
    const table = createTable('user', [
      createColumn('email'),
      createColumn('password'),
      createColumn('name'),
    ]);
    const result = generateSignupFromTable(table);
    expect(result).toBe(
      'email = $email, password = crypto::argon2::generate($password), name = $name',
    );
  });

  it('filters out id column', () => {
    const table = createTable('user', [createColumn('id'), createColumn('email')]);
    const result = generateSignupFromTable(table);
    expect(result).not.toContain('id');
    expect(result).toContain('email = $email');
  });

  it('filters out created_at column', () => {
    const table = createTable('user', [createColumn('email'), createColumn('created_at')]);
    const result = generateSignupFromTable(table);
    expect(result).not.toContain('created_at');
    expect(result).toContain('email = $email');
  });

  it('skips optional columns', () => {
    const table = createTable('user', [
      createColumn('email'),
      createColumn('nickname', { config: { type: 'string', optional: true } }),
    ]);
    const result = generateSignupFromTable(table);
    expect(result).toBe('email = $email');
    expect(result).not.toContain('nickname');
  });

  it('throws error when no required columns', () => {
    const table = createTable('user', [createColumn('id')]);
    expect(() => generateSignupFromTable(table)).toThrow(
      "Table 'user' has no required columns for signup",
    );
  });

  it('throws on null table', () => {
    expect(() => generateSignupFromTable(null as unknown as TableDefinition)).toThrow(
      'Table definition is required',
    );
  });
});

// =============================================================================
// generateSignupFromSQL
// =============================================================================

describe('generateSignupFromSQL', () => {
  it('generates CREATE SQL from table definition', () => {
    const table = createTable('user', [createColumn('email'), createColumn('password')]);
    const sql = generateSignupFromSQL('user', table);
    expect(sql).toBe(
      'CREATE user SET email = $email, password = crypto::argon2::generate($password)',
    );
  });

  it('uses custom table name different from TableDefinition name', () => {
    const table = createTable('user', [createColumn('email')]);
    const sql = generateSignupFromSQL('auth_user', table);
    expect(sql).toBe('CREATE auth_user SET email = $email');
  });

  it('propagates error from generateSignupFromTable', () => {
    const table = createTable('user', [createColumn('id')]);
    expect(() => generateSignupFromSQL('user', table)).toThrow(
      "Table 'user' has no required columns for signup",
    );
  });
});

// =============================================================================
// generateSigninFromSQL
// =============================================================================

describe('generateSigninFromSQL', () => {
  it('uses inferred identifier (email) from table columns', () => {
    const table = createTable('user', [createColumn('email'), createColumn('password')]);
    const sql = generateSigninFromSQL('user', table);
    expect(sql).toBe(
      'SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(password, $password)',
    );
  });

  it('uses explicit identifier when provided', () => {
    const table = createTable('user', [createColumn('username'), createColumn('password')]);
    const sql = generateSigninFromSQL('user', table, 'username');
    expect(sql).toBe(
      'SELECT * FROM user WHERE username = $username AND crypto::argon2::compare(password, $password)',
    );
  });

  it('prefers explicit identifier over inferred', () => {
    const table = createTable('user', [createColumn('email'), createColumn('password')]);
    const sql = generateSigninFromSQL('user', table, 'phone');
    expect(sql).toContain('phone = $phone');
    expect(sql).not.toContain('email = $email');
  });

  it('falls back to first column when no identifier column found', () => {
    const table = createTable('user', [createColumn('login'), createColumn('password')]);
    const sql = generateSigninFromSQL('user', table);
    expect(sql).toContain('login = $login');
  });

  it('throws on null table', () => {
    expect(() => generateSigninFromSQL('user', null as unknown as TableDefinition)).toThrow(
      'Table definition is required',
    );
  });

  it('falls back to "identifier" when columns array is empty', () => {
    const table = createTable('user', []);
    const sql = generateSigninFromSQL('user', table);
    expect(sql).toContain('identifier = $identifier');
  });
});

// =============================================================================
// Schema Validation (valibot)
// =============================================================================

describe('AccessConfigSchema validation', () => {
  it('accepts minimal valid config', () => {
    const result = safeParse(AccessConfigSchema, { name: 'test', type: 'RECORD' });
    expect(result.success).toBe(true);
  });

  it('accepts full config', () => {
    const result = safeParse(AccessConfigSchema, {
      name: 'test',
      type: 'JWT',
      table: 'users',
      signup: 'CREATE ...',
      signin: 'SELECT ...',
      algorithm: 'HS256',
      key: 'mykey',
      issuer: 'dali-orm',
      duration: '7d',
      tokenDuration: '1h',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid type', () => {
    const result = safeParse(AccessConfigSchema, { name: 'test', type: 'INVALID' });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = safeParse(AccessConfigSchema, { type: 'RECORD' });
    expect(result.success).toBe(false);
  });

  it('rejects number as name', () => {
    const result = safeParse(AccessConfigSchema, { name: 123, type: 'RECORD' });
    expect(result.success).toBe(false);
  });
});

describe('FunctionConfigSchema validation', () => {
  it('accepts minimal valid config', () => {
    const result = safeParse(FunctionConfigSchema, {
      name: 'fn::hello',
      body: 'RETURN true',
    });
    expect(result.success).toBe(true);
  });

  it('accepts full config', () => {
    const result = safeParse(FunctionConfigSchema, {
      name: 'fn::greet',
      args: ['$name'],
      body: 'RETURN $name',
      comment: 'Greets',
      permissions: 'FULL',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing body', () => {
    const result = safeParse(FunctionConfigSchema, { name: 'fn::test' });
    expect(result.success).toBe(false);
  });

  it('rejects non-string args', () => {
    const result = safeParse(FunctionConfigSchema, {
      name: 'fn::test',
      args: [123],
      body: 'RETURN true',
    });
    expect(result.success).toBe(false);
  });
});

describe('EventConfigSchema validation', () => {
  it('accepts valid config', () => {
    const result = safeParse(EventConfigSchema, {
      name: 'on_create',
      on: 'user',
      when: '$before == NONE',
      then: ['CREATE audit SET action = "create"'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts full config with all fields', () => {
    const result = safeParse(EventConfigSchema, {
      name: 'full',
      on: 'user',
      when: 'true',
      then: ['CREATE log SET msg = "test"'],
      comment: 'Test event',
      async: true,
      retry: 3,
      maxdepth: 10,
    });
    expect(result.success).toBe(true);
  });

  it('rejects string for then (must be array)', () => {
    const result = safeParse(EventConfigSchema, {
      name: 'evt',
      on: 'user',
      when: 'true',
      then: 'CREATE log SET msg = "test"',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing then', () => {
    const result = safeParse(EventConfigSchema, {
      name: 'evt',
      on: 'user',
      when: 'true',
    });
    expect(result.success).toBe(false);
  });

  it('accepts negative retry (valibot number() has no min constraint by default)', () => {
    const result = safeParse(EventConfigSchema, {
      name: 'evt',
      on: 'user',
      when: 'true',
      then: ['CREATE log'],
      retry: -1,
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// defineNamespace builder
// =============================================================================

describe('defineNamespace builder', () => {
  it('returns name from builder', () => {
    const ns = defineNamespace('production');
    expect(ns.name).toBe('production');
  });

  it('throws for empty name', () => {
    expect(() => defineNamespace('')).toThrow('Namespace name is required');
  });

  it('generates basic SQL via toSQL()', () => {
    const sql = defineNamespace('production').toSQL();
    expect(sql).toBe('DEFINE NAMESPACE production');
  });

  it('chains .comment()', () => {
    const sql = defineNamespace('staging').comment('Staging env').toSQL();
    expect(sql).toBe('DEFINE NAMESPACE staging COMMENT "Staging env"');
  });

  it('chains .ifNotExists()', () => {
    const sql = defineNamespace('dev').ifNotExists().toSQL();
    expect(sql).toBe('DEFINE NAMESPACE IF NOT EXISTS dev');
  });

  it('chains all options together', () => {
    const sql = defineNamespace('test').ifNotExists().comment('Test env').toSQL();
    expect(sql).toBe('DEFINE NAMESPACE IF NOT EXISTS test COMMENT "Test env"');
  });

  it('returns config via build()', () => {
    const config = defineNamespace('prod').comment('Prod').ifNotExists().build();
    expect(config).toEqual({ name: 'prod', comment: 'Prod', ifNotExists: true });
  });

  it('build() without options returns minimal config', () => {
    const config = defineNamespace('basic').build();
    expect(config).toEqual({ name: 'basic' });
  });
});

// =============================================================================
// DATABASE BUILDER
// =============================================================================

describe('defineDatabase', () => {
  it('throws on empty name', () => {
    expect(() => defineDatabase('')).toThrow('Database name is required');
  });

  it('name getter returns the database name', () => {
    expect(defineDatabase('mydb').name).toBe('mydb');
  });

  it('toSQL() generates basic DEFINE DATABASE', () => {
    expect(defineDatabase('testdb').toSQL()).toBe('DEFINE DATABASE testdb');
  });

  it('toSQL() with comment', () => {
    expect(defineDatabase('testdb').comment('Test database').toSQL()).toBe(
      'DEFINE DATABASE testdb COMMENT "Test database"',
    );
  });

  it('toSQL() with ifNotExists', () => {
    expect(defineDatabase('testdb').ifNotExists().toSQL()).toBe(
      'DEFINE DATABASE IF NOT EXISTS testdb',
    );
  });

  it('toSQL() with all options', () => {
    expect(defineDatabase('testdb').comment('Test').ifNotExists().toSQL()).toBe(
      'DEFINE DATABASE IF NOT EXISTS testdb COMMENT "Test"',
    );
  });

  it('build() returns config object', () => {
    const config = defineDatabase('mydb').comment('My DB').ifNotExists().build();
    expect(config).toEqual({ name: 'mydb', comment: 'My DB', ifNotExists: true });
  });

  it('build() without options returns minimal config', () => {
    const config = defineDatabase('basic').build();
    expect(config).toEqual({ name: 'basic' });
  });
});

// ===========================================================================
// defineSequence
// ===========================================================================
describe('defineSequence', () => {
  it('throws for empty name', () => {
    expect(() => defineSequence('')).toThrow('Sequence name is required');
  });

  it('toSQL() returns basic DEFINE SEQUENCE', () => {
    expect(defineSequence('my_seq').toSQL()).toBe('DEFINE SEQUENCE IF NOT EXISTS my_seq');
  });

  it('toSQL() with start and increment', () => {
    expect(defineSequence('my_seq').start(1).increment(2).toSQL()).toBe(
      'DEFINE SEQUENCE IF NOT EXISTS my_seq START 1 INCREMENT 2',
    );
  });

  it('toSQL() with min and max', () => {
    expect(defineSequence('seq1').min(0).max(1000).toSQL()).toBe(
      'DEFINE SEQUENCE IF NOT EXISTS seq1 MIN 0 MAX 1000',
    );
  });

  it('toSQL() with cache and cycle', () => {
    expect(defineSequence('seq1').cache(10).cycle().toSQL()).toBe(
      'DEFINE SEQUENCE IF NOT EXISTS seq1 CACHE 10 CYCLE',
    );
  });

  it('toSQL() with comment', () => {
    expect(defineSequence('seq1').comment('my sequence').toSQL()).toBe(
      'DEFINE SEQUENCE IF NOT EXISTS seq1 COMMENT "my sequence"',
    );
  });

  it('toSQL() with all options', () => {
    expect(
      defineSequence('full_seq')
        .start(1)
        .increment(5)
        .min(0)
        .max(99999)
        .cache(100)
        .cycle()
        .comment('full sequence')
        .toSQL(),
    ).toBe(
      'DEFINE SEQUENCE IF NOT EXISTS full_seq START 1 INCREMENT 5 MIN 0 MAX 99999 CACHE 100 CYCLE COMMENT "full sequence"',
    );
  });

  it('build() returns config object', () => {
    const config = defineSequence('my_seq').start(1).increment(2).cycle().build();
    expect(config).toEqual({
      name: 'my_seq',
      start: 1,
      increment: 2,
      cycle: true,
    });
  });

  it('chain returns this for method chaining', () => {
    const builder = defineSequence('test');
    expect(builder.start(1)).toBe(builder);
    expect(builder.increment(1)).toBe(builder);
    expect(builder.min(0)).toBe(builder);
    expect(builder.max(100)).toBe(builder);
    expect(builder.cache(10)).toBe(builder);
    expect(builder.cycle()).toBe(builder);
    expect(builder.comment('c')).toBe(builder);
  });

  it('name property returns sequence name', () => {
    expect(defineSequence('xyz').name).toBe('xyz');
  });
});
