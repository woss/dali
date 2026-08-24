/**
 * Comprehensive tests for SurrealQLGenerator
 *
 * Covers all public methods including table/field/index/access/event/function
 * definitions, remove statements, alter statements, and migration generation.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { ColumnDefinition } from '../../../sdk/schema/column/types.js';
import type { AnalyzerDefinition, IndexDefinition, TableDefinition } from '../../../sdk/table.js';
import type { SurrealEvent, SurrealFunction, SurrealSequence } from '../../ddl/ddl.js';
import { SurrealQLGenerator } from '../generator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function col(
  overrides: Partial<ColumnDefinition> & { name: string; config: { type: string } },
): ColumnDefinition {
  return {
    tableName: 'test_table',
    ...overrides,
  } as ColumnDefinition;
}

function index(
  overrides: Partial<IndexDefinition> & { name: string; fields: string[] },
): IndexDefinition {
  return {
    ...overrides,
  } as IndexDefinition;
}

function tableDef(overrides: Partial<TableDefinition> & { name: string }): TableDefinition {
  return {
    name: overrides.name,
    columns: overrides.columns ?? [],
    config: overrides.config ?? { schema: 'full' },
  } as TableDefinition;
}

let gen: SurrealQLGenerator;

beforeEach(() => {
  gen = new SurrealQLGenerator();
});

// ===========================================================================
// generateTableDefinition
// ===========================================================================
describe('generateTableDefinition', () => {
  it('generates DEFINE TABLE IF NOT EXISTS with SCHEMAFULL by default', () => {
    const sql = gen.generateTableDefinition(tableDef({ name: 'user', config: { schema: 'full' } }));
    expect(sql).toBe('DEFINE TABLE IF NOT EXISTS user SCHEMAFULL');
  });

  it('generates SCHEMALESS for schema-less tables', () => {
    const sql = gen.generateTableDefinition(
      tableDef({ name: 'event', config: { schema: 'less' } }),
    );
    expect(sql).toBe('DEFINE TABLE IF NOT EXISTS event SCHEMALESS');
  });

  it('generates TYPE RELATION with IN and OUT', () => {
    const sql = gen.generateTableDefinition(
      tableDef({ name: 'follows', config: { type: 'relation', in: 'user', out: 'user' } }),
    );
    expect(sql).toBe(
      'DEFINE TABLE IF NOT EXISTS follows SCHEMAFULL TYPE RELATION IN user OUT user',
    );
  });

  it('generates TYPE RELATION without IN when not set', () => {
    const sql = gen.generateTableDefinition(
      tableDef({ name: 'edge', config: { type: 'relation', out: 'post' } }),
    );
    expect(sql).toBe('DEFINE TABLE IF NOT EXISTS edge SCHEMAFULL TYPE RELATION OUT post');
  });

  it('generates TYPE RELATION without OUT when not set', () => {
    const sql = gen.generateTableDefinition(
      tableDef({ name: 'edge', config: { type: 'relation', in: 'user' } }),
    );
    expect(sql).toBe('DEFINE TABLE IF NOT EXISTS edge SCHEMAFULL TYPE RELATION IN user');
  });

  it('includes PERMISSIONS clause', () => {
    const sql = gen.generateTableDefinition(
      tableDef({
        name: 'secret',
        config: {
          permissions: { select: 'WHERE published = true', create: 'NONE' },
        },
      }),
    );
    expect(sql).toBe(
      'DEFINE TABLE IF NOT EXISTS secret SCHEMAFULL PERMISSIONS FOR select WHERE published = true FOR create NONE',
    );
  });

  it('includes CHANGEFEED clause', () => {
    const sql = gen.generateTableDefinition(
      tableDef({ name: 'log', config: { changefeed: '7d' } }),
    );
    expect(sql).toBe('DEFINE TABLE IF NOT EXISTS log SCHEMAFULL CHANGEFEED 7d');
  });

  it('throws for invalid changefeed format', () => {
    expect(() =>
      gen.generateTableDefinition(tableDef({ name: 'bad', config: { changefeed: 'abc' } })),
    ).toThrow(/invalid changefeed duration/i);
  });

  it('combines all table options', () => {
    const sql = gen.generateTableDefinition(
      tableDef({
        name: 'edge',
        config: {
          schema: 'less',
          type: 'relation',
          in: 'user',
          out: 'post',
          permissions: { select: 'FULL' },
          changefeed: '24h',
        },
      }),
    );
    expect(sql).toBe(
      'DEFINE TABLE IF NOT EXISTS edge SCHEMALESS TYPE RELATION IN user OUT post PERMISSIONS FOR select FULL CHANGEFEED 24h',
    );
  });
});

// ===========================================================================
// generateFieldDefinition
// ===========================================================================
describe('generateFieldDefinition', () => {
  it('returns empty string for id field', () => {
    expect(gen.generateFieldDefinition(col({ name: 'id', config: { type: 'string' } }))).toBe('');
  });

  it('throws when tableName is missing', () => {
    expect(() =>
      gen.generateFieldDefinition(
        col({ name: 'email', config: { type: 'string' }, tableName: undefined }),
      ),
    ).toThrow('Column email is missing tableName');
  });

  it('generates basic string field', () => {
    const sql = gen.generateFieldDefinition(col({ name: 'email', config: { type: 'string' } }));
    expect(sql).toBe('DEFINE FIELD IF NOT EXISTS email ON TABLE test_table TYPE string');
  });

  it('wraps type in option<> when optional', () => {
    const sql = gen.generateFieldDefinition(
      col({ name: 'bio', config: { type: 'string', optional: true } }),
    );
    expect(sql).toBe('DEFINE FIELD IF NOT EXISTS bio ON TABLE test_table TYPE option<string>');
  });

  it('generates record type with linked table', () => {
    const sql = gen.generateFieldDefinition(
      col({ name: 'author', config: { type: 'record', recordTable: 'user' } }),
    );
    expect(sql).toBe('DEFINE FIELD IF NOT EXISTS author ON TABLE test_table TYPE record<user>');
  });

  it('uses linksTo as fallback for record table', () => {
    const sql = gen.generateFieldDefinition(
      col({ name: 'author', config: { type: 'record', linksTo: 'user' } }),
    );
    expect(sql).toBe('DEFINE FIELD IF NOT EXISTS author ON TABLE test_table TYPE record<user>');
  });

  it('uses recordTable over linksTo when both provided', () => {
    const sql = gen.generateFieldDefinition(
      col({ name: 'author', config: { type: 'record', recordTable: 'person', linksTo: 'user' } }),
    );
    expect(sql).toBe('DEFINE FIELD IF NOT EXISTS author ON TABLE test_table TYPE record<person>');
  });

  it('adds FLEXIBLE when configured', () => {
    const sql = gen.generateFieldDefinition(
      col({ name: 'metadata', config: { type: 'object', flexible: true } }),
    );
    expect(sql).toContain('FLEXIBLE');
  });

  it('adds READONLY when configured', () => {
    const sql = gen.generateFieldDefinition(
      col({ name: 'created_at', config: { type: 'datetime', readonly: true } }),
    );
    expect(sql).toContain('READONLY');
  });

  it('adds DEFAULT with formatted value', () => {
    const sql = gen.generateFieldDefinition(
      col({ name: 'role', config: { type: 'string', default: 'viewer' } }),
    );
    expect(sql).toBe(
      "DEFINE FIELD IF NOT EXISTS role ON TABLE test_table TYPE string DEFAULT 'viewer'",
    );
  });

  it('converts now() default to time::now()', () => {
    const sql = gen.generateFieldDefinition(
      col({ name: 'created_at', config: { type: 'datetime', default: 'now' } }),
    );
    expect(sql).toBe(
      'DEFINE FIELD IF NOT EXISTS created_at ON TABLE test_table TYPE datetime DEFAULT time::now()',
    );
  });

  it('adds ASSERT when configured', () => {
    const sql = gen.generateFieldDefinition(
      col({
        name: 'age',
        config: { type: 'int', assert: '$value > 0' },
      }),
    );
    expect(sql).toBe(
      'DEFINE FIELD IF NOT EXISTS age ON TABLE test_table TYPE int ASSERT $value > 0',
    );
  });

  it('adds PERMISSIONS when configured', () => {
    const sql = gen.generateFieldDefinition(
      col({
        name: 'ssn',
        config: { type: 'string', permissions: 'FOR select NONE' },
      }),
    );
    expect(sql).toBe(
      'DEFINE FIELD IF NOT EXISTS ssn ON TABLE test_table TYPE string PERMISSIONS FOR select NONE',
    );
  });

  it('generates tuple field with element sub-fields', () => {
    const sql = gen.generateFieldDefinition(
      col({
        name: 'coordinates',
        config: {
          type: 'tuple',
          size: 2,
          elements: [{ type: 'float' }, { type: 'float' }],
        },
      }),
    );
    expect(sql).toBe(
      'DEFINE FIELD IF NOT EXISTS coordinates ON TABLE test_table TYPE array<float, 2>; ' +
        'DEFINE FIELD IF NOT EXISTS coordinates[0] ON TABLE test_table TYPE float; ' +
        'DEFINE FIELD IF NOT EXISTS coordinates[1] ON TABLE test_table TYPE float',
    );
  });

  it('generates tuple field with array-level assertion', () => {
    const sql = gen.generateFieldDefinition(
      col({
        name: 'tags',
        config: {
          type: 'tuple',
          size: 5,
          elements: [{ type: 'string' }],
          arrayAssert: { type: 'all', expression: '> 0' },
        },
      }),
    );
    expect(sql).toContain('ASSERT $value.all(|$value| > 0)');
  });

  it('generates tuple field with DEFAULT', () => {
    const sql = gen.generateFieldDefinition(
      col({
        name: 'dims',
        config: {
          type: 'tuple',
          size: 3,
          elements: [{ type: 'int' }, { type: 'int' }, { type: 'int' }],
          default: '[0, 0, 0]',
        },
      }),
    );
    expect(sql).toContain("DEFAULT '[0, 0, 0]'");
  });
});

// ===========================================================================
// generateFieldRedefine
// ===========================================================================
describe('generateFieldRedefine', () => {
  it('returns empty string for id field', () => {
    expect(gen.generateFieldRedefine(col({ name: 'id', config: { type: 'string' } }))).toBe('');
  });

  it('throws when tableName is missing', () => {
    expect(() =>
      gen.generateFieldRedefine(
        col({ name: 'email', config: { type: 'string' }, tableName: undefined }),
      ),
    ).toThrow('Column email is missing tableName');
  });

  it('uses OVERWRITE instead of IF NOT EXISTS', () => {
    const sql = gen.generateFieldRedefine(col({ name: 'email', config: { type: 'string' } }));
    expect(sql).toBe('DEFINE FIELD OVERWRITE email ON TABLE test_table TYPE string');
  });

  it('generates tuple redefine correctly', () => {
    const sql = gen.generateFieldRedefine(
      col({
        name: 'coords',
        config: {
          type: 'tuple',
          size: 2,
          elements: [{ type: 'float' }, { type: 'float' }],
        },
      }),
    );
    // Tuple redefine delegates to generateTupleFieldDefinition which uses IF NOT EXISTS
    expect(sql).toContain(
      'DEFINE FIELD IF NOT EXISTS coords ON TABLE test_table TYPE array<float, 2>',
    );
  });

  it('handles ALL field properties in redefine', () => {
    const sql = gen.generateFieldRedefine(
      col({
        name: 'email',
        config: {
          type: 'string',
          optional: true,
          flexible: true,
          readonly: true,
          default: 'none',
          assert: '$value CONTAINS "@"',
          permissions: 'FOR select FULL',
        },
      }),
    );
    expect(sql).toContain(
      'DEFINE FIELD OVERWRITE email ON TABLE test_table TYPE option<string> FLEXIBLE',
    );
    expect(sql).toContain('FLEXIBLE');
    expect(sql).toContain('READONLY');
    expect(sql).toContain("DEFAULT 'none'");
    expect(sql).toContain('ASSERT $value CONTAINS "@"');
    expect(sql).toContain('PERMISSIONS FOR select FULL');
  });

  it('uses linksTo for record type in redefine', () => {
    const sql = gen.generateFieldRedefine(
      col({ name: 'author', config: { type: 'record', linksTo: 'user' } }),
    );
    expect(sql).toBe('DEFINE FIELD OVERWRITE author ON TABLE test_table TYPE record<user>');
  });
});

// ===========================================================================
// generateFieldDefinitions (array returning)
// ===========================================================================
describe('generateFieldDefinitions', () => {
  it('returns [""] for id field', () => {
    const result = gen.generateFieldDefinitions(col({ name: 'id', config: { type: 'string' } }));
    expect(result).toEqual(['']);
  });

  it('returns array with single statement for normal field', () => {
    const result = gen.generateFieldDefinitions(col({ name: 'name', config: { type: 'string' } }));
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('DEFINE FIELD IF NOT EXISTS name ON TABLE test_table');
  });

  it('throws when tableName is missing', () => {
    expect(() =>
      gen.generateFieldDefinitions(
        col({ name: 'x', config: { type: 'string' }, tableName: undefined }),
      ),
    ).toThrow('Column x is missing tableName');
  });

  it('returns multiple statements for tuple field', () => {
    const result = gen.generateFieldDefinitions(
      col({
        name: 'coords',
        config: {
          type: 'tuple',
          size: 2,
          elements: [{ type: 'float' }, { type: 'float' }],
        },
      }),
    );
    expect(result).toHaveLength(3);
    expect(result[0]).toContain(
      'DEFINE FIELD IF NOT EXISTS coords ON TABLE test_table TYPE array<float, 2>',
    );
    expect(result[1]).toContain('coords[0]');
    expect(result[2]).toContain('coords[1]');
  });
});

// ===========================================================================
// generateIndexDefinition
// ===========================================================================
describe('generateIndexDefinition', () => {
  const tableName = 'user';

  it('throws when tableName is missing', () => {
    expect(() => gen.generateIndexDefinition(index({ name: 'idx', fields: ['name'] }), '')).toThrow(
      'Table name is required for index definition',
    );
  });

  it('throws when index name is missing', () => {
    expect(() =>
      gen.generateIndexDefinition(index({ name: '', fields: ['name'] }), tableName),
    ).toThrow('Index name is required');
  });

  it('throws when no fields defined', () => {
    expect(() =>
      gen.generateIndexDefinition(index({ name: 'idx', fields: [] }), tableName),
    ).toThrow('Index idx must have at least one field');
  });

  it('generates basic index (no type = default)', () => {
    const sql = gen.generateIndexDefinition(
      index({ name: 'idx_name', fields: ['name'] }),
      tableName,
    );
    expect(sql).toBe('DEFINE INDEX idx_name ON TABLE user COLUMNS name');
  });

  it('generates UNIQUE index', () => {
    const sql = gen.generateIndexDefinition(
      index({ name: 'idx_email', fields: ['email'], type: 'unique' }),
      tableName,
    );
    expect(sql).toBe('DEFINE INDEX idx_email ON TABLE user COLUMNS email UNIQUE');
  });

  it('generates FULLTEXT index with analyzer', () => {
    const sql = gen.generateIndexDefinition(
      index({
        name: 'idx_bio',
        fields: ['bio'],
        type: 'fulltext',
        analyzer: 'english',
      }),
      tableName,
    );
    expect(sql).toBe('DEFINE INDEX idx_bio ON TABLE user COLUMNS bio FULLTEXT ANALYZER english');
  });

  it('generates FULLTEXT index without analyzer', () => {
    const sql = gen.generateIndexDefinition(
      index({ name: 'idx_bio', fields: ['bio'], type: 'fulltext' }),
      tableName,
    );
    expect(sql).toBe('DEFINE INDEX idx_bio ON TABLE user COLUMNS bio FULLTEXT');
  });

  it('generates HNSW index with all params', () => {
    const sql = gen.generateIndexDefinition(
      index({
        name: 'idx_vec',
        fields: ['vector'],
        type: 'hnsw',
        dimension: 128,
        vectorType: 'float32',
        distance: 'COSINE',
      }),
      tableName,
    );
    expect(sql).toBe(
      'DEFINE INDEX idx_vec ON TABLE user COLUMNS vector HNSW DIMENSION 128 TYPE F32 DIST COSINE',
    );
  });

  it('generates HNSW index with minimal params', () => {
    const sql = gen.generateIndexDefinition(
      index({
        name: 'idx_vec',
        fields: ['vector'],
        type: 'hnsw',
        dimension: 64,
      }),
      tableName,
    );
    expect(sql).toBe('DEFINE INDEX idx_vec ON TABLE user COLUMNS vector HNSW DIMENSION 64');
  });

  it('generates composite column index', () => {
    const sql = gen.generateIndexDefinition(
      index({ name: 'idx_full', fields: ['last_name', 'first_name'] }),
      tableName,
    );
    expect(sql).toBe('DEFINE INDEX idx_full ON TABLE user COLUMNS last_name, first_name');
  });
});

// ===========================================================================
// Remove statements
// ===========================================================================
describe('generateRemoveTable', () => {
  it('generates REMOVE TABLE', () => {
    expect(gen.generateRemoveTable('user')).toBe('REMOVE TABLE user');
  });

  it('throws when tableName is empty', () => {
    expect(() => gen.generateRemoveTable('')).toThrow('Table name is required for REMOVE TABLE');
  });
});

describe('generateRemoveField', () => {
  it('generates REMOVE FIELD', () => {
    expect(gen.generateRemoveField('user', 'email')).toBe('REMOVE FIELD email ON TABLE user');
  });

  it('throws when tableName is empty', () => {
    expect(() => gen.generateRemoveField('', 'email')).toThrow(
      'Table name is required for REMOVE FIELD',
    );
  });

  it('throws when fieldName is empty', () => {
    expect(() => gen.generateRemoveField('user', '')).toThrow(
      'Field name is required for REMOVE FIELD',
    );
  });
});

describe('generateRemoveIndex', () => {
  it('generates REMOVE INDEX', () => {
    expect(gen.generateRemoveIndex('idx_email', 'user')).toBe(
      'REMOVE INDEX idx_email ON TABLE user',
    );
  });

  it('throws when indexName is empty', () => {
    expect(() => gen.generateRemoveIndex('', 'user')).toThrow(
      'Index name is required for REMOVE INDEX',
    );
  });

  it('throws when tableName is empty', () => {
    expect(() => gen.generateRemoveIndex('idx', '')).toThrow(
      'Table name is required for REMOVE INDEX',
    );
  });
});

describe('generateRemoveAccess', () => {
  it('generates REMOVE ACCESS IF EXISTS', () => {
    expect(gen.generateRemoveAccess('my_access')).toBe(
      'REMOVE ACCESS IF EXISTS my_access ON DATABASE',
    );
  });

  it('throws when access name is empty', () => {
    expect(() => gen.generateRemoveAccess('')).toThrow('Access name is required for REMOVE ACCESS');
  });
});

describe('generateRemoveEvent', () => {
  it('generates REMOVE EVENT IF EXISTS', () => {
    expect(gen.generateRemoveEvent('evt', 'user')).toBe('REMOVE EVENT IF EXISTS evt ON TABLE user');
  });

  it('throws when eventName is empty', () => {
    expect(() => gen.generateRemoveEvent('', 'user')).toThrow(
      'Event name is required for REMOVE EVENT',
    );
  });

  it('throws when tableName is empty', () => {
    expect(() => gen.generateRemoveEvent('evt', '')).toThrow(
      'Table name is required for REMOVE EVENT',
    );
  });
});

describe('generateRemoveFunction', () => {
  it('generates REMOVE FUNCTION IF EXISTS', () => {
    expect(gen.generateRemoveFunction('fn::my_func')).toBe('REMOVE FUNCTION IF EXISTS fn::my_func');
  });

  it('throws when function name is empty', () => {
    expect(() => gen.generateRemoveFunction('')).toThrow(
      'Function name is required for REMOVE FUNCTION',
    );
  });
});

// ===========================================================================
// generateAccessDefinition
// ===========================================================================
describe('generateAccessDefinition', () => {
  it('generates basic DEFINE ACCESS with type', () => {
    const sql = gen.generateAccessDefinition({
      name: 'my_access',
      type: 'RECORD',
    });
    expect(sql).toBe('DEFINE ACCESS my_access ON DATABASE TYPE RECORD');
  });

  it('uses DATABASE level by default', () => {
    const sql = gen.generateAccessDefinition({
      name: 'web',
      type: 'JWT',
    });
    expect(sql).toBe('DEFINE ACCESS web ON DATABASE TYPE JWT');
  });

  it('supports custom level', () => {
    const sql = gen.generateAccessDefinition({
      name: 'root_access',
      type: 'JWT',
      level: 'ROOT',
    });
    expect(sql).toBe('DEFINE ACCESS root_access ON ROOT TYPE JWT');
  });

  it('includes SIGNUP and SIGNIN', () => {
    const sql = gen.generateAccessDefinition({
      name: 'account',
      type: 'RECORD',
      signup: 'CREATE user SET email = $email, pass = crypto::argon2::generate($pass)',
      signin: 'SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(pass, $pass)',
    });
    expect(sql).toBe(
      'DEFINE ACCESS account ON DATABASE TYPE RECORD ' +
        'SIGNUP (CREATE user SET email = $email, pass = crypto::argon2::generate($pass)) ' +
        'SIGNIN (SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(pass, $pass))',
    );
  });

  it('includes ALGORITHM and KEY', () => {
    const sql = gen.generateAccessDefinition({
      name: 'jwt_access',
      type: 'JWT',
      algorithm: 'RS256',
      key: '-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----',
    });
    expect(sql).toBe(
      'DEFINE ACCESS jwt_access ON DATABASE TYPE JWT ALGORITHM RS256 KEY "-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----"',
    );
  });

  it('includes ISSUER', () => {
    const sql = gen.generateAccessDefinition({
      name: 'oidc',
      type: 'JWT',
      issuer: 'https://accounts.example.com',
    });
    expect(sql).toBe('DEFINE ACCESS oidc ON DATABASE TYPE JWT ISSUER https://accounts.example.com');
  });

  it('includes DURATION with TOKEN and SESSION', () => {
    const sql = gen.generateAccessDefinition({
      name: 'api',
      type: 'RECORD',
      tokenDuration: '15m',
      duration: '12h',
    });
    expect(sql).toBe(
      'DEFINE ACCESS api ON DATABASE TYPE RECORD DURATION FOR TOKEN 15m, FOR SESSION 12h',
    );
  });

  it('includes DURATION with only SESSION', () => {
    const sql = gen.generateAccessDefinition({
      name: 'api',
      type: 'RECORD',
      duration: '24h',
    });
    expect(sql).toBe('DEFINE ACCESS api ON DATABASE TYPE RECORD DURATION FOR SESSION 24h');
  });

  it('includes DURATION with only TOKEN', () => {
    const sql = gen.generateAccessDefinition({
      name: 'api',
      type: 'JWT',
      tokenDuration: '1h',
    });
    expect(sql).toBe('DEFINE ACCESS api ON DATABASE TYPE JWT DURATION FOR TOKEN 1h');
  });

  it('throws when name is missing', () => {
    expect(() => gen.generateAccessDefinition({ name: '', type: 'RECORD' })).toThrow(
      'Access name is required for DEFINE ACCESS',
    );
  });

  it('throws when type is missing', () => {
    expect(() => gen.generateAccessDefinition({ name: 'x', type: '' })).toThrow(
      'Access type is required for DEFINE ACCESS',
    );
  });
});

// ===========================================================================
// generateAccessMigration
// ===========================================================================
describe('generateAccessMigration', () => {
  it('generates DEFINE ACCESS for up direction', () => {
    const sql = gen.generateAccessMigration({ name: 'web', type: 'JWT' });
    expect(sql).toContain('DEFINE ACCESS web');
  });

  it('throws when name is missing', () => {
    expect(() => gen.generateAccessMigration({ name: '', type: 'JWT' })).toThrow(
      'Access name is required for migration',
    );
  });
});

// ===========================================================================
// generateEventDefinition
// ===========================================================================
describe('generateEventDefinition', () => {
  it('generates basic DEFINE EVENT', () => {
    const sql = gen.generateEventDefinition({
      name: 'on_create',
      what: 'user',
      when: '$event = "CREATE"',
      then: ['INSERT INTO audit SET action = $event'],
    });
    expect(sql).toBe(
      'DEFINE EVENT IF NOT EXISTS on_create ON TABLE user WHEN ($event = "CREATE") THEN { INSERT INTO audit SET action = $event }',
    );
  });

  it('includes COMMENT', () => {
    const sql = gen.generateEventDefinition({
      name: 'evt',
      what: 'user',
      when: 'true',
      then: ['INSERT INTO log SET msg = "triggered"'],
      comment: 'Logs all user changes',
    });
    expect(sql).toContain('COMMENT "Logs all user changes"');
  });

  it('adds ASYNC', () => {
    const sql = gen.generateEventDefinition({
      name: 'evt',
      what: 'user',
      when: 'true',
      then: ['SELECT * FROM user'],
      async: true,
    });
    expect(sql).toContain('ASYNC');
  });

  it('adds RETRY', () => {
    const sql = gen.generateEventDefinition({
      name: 'evt',
      what: 'user',
      when: 'true',
      then: ['SELECT * FROM user'],
      retry: 3,
    });
    expect(sql).toContain('RETRY 3');
  });

  it('adds MAXDEPTH', () => {
    const sql = gen.generateEventDefinition({
      name: 'evt',
      what: 'user',
      when: 'true',
      then: ['SELECT * FROM user'],
      maxdepth: 5,
    });
    expect(sql).toContain('MAXDEPTH 5');
  });

  it('combines ASYNC, RETRY, MAXDEPTH', () => {
    const sql = gen.generateEventDefinition({
      name: 'evt',
      what: 'user',
      when: '$event = "UPDATE"',
      then: ['INSERT INTO audit SET action = $event'],
      async: true,
      retry: 3,
      maxdepth: 10,
    });
    expect(sql).toContain('ASYNC');
    expect(sql).toContain('RETRY 3');
    expect(sql).toContain('MAXDEPTH 10');
  });

  it('throws when name is missing', () => {
    expect(() =>
      gen.generateEventDefinition({ name: '', what: 'user', when: 'true', then: ['SELECT 1'] }),
    ).toThrow('Event name is required for DEFINE EVENT');
  });

  it('throws when what (table) is missing', () => {
    expect(() =>
      gen.generateEventDefinition({ name: 'evt', what: '', when: 'true', then: ['SELECT 1'] }),
    ).toThrow('Event table (what) is required for DEFINE EVENT');
  });

  it('throws when when (condition) is missing', () => {
    expect(() =>
      gen.generateEventDefinition({ name: 'evt', what: 'user', when: '', then: ['SELECT 1'] }),
    ).toThrow('Event condition (when) is required for DEFINE EVENT');
  });

  it('throws when then (action) is empty', () => {
    expect(() =>
      gen.generateEventDefinition({ name: 'evt', what: 'user', when: 'true', then: [] }),
    ).toThrow('Event action (then) is required for DEFINE EVENT');
  });
});

// ===========================================================================
// generateEventMigration
// ===========================================================================
describe('generateEventMigration', () => {
  const evt: SurrealEvent = {
    name: 'on_create',
    what: 'user',
    when: '$event = "CREATE"',
    then: ['SELECT * FROM user'],
  };

  it('generates DEFINE EVENT for up direction', () => {
    const sql = gen.generateEventMigration(evt);
    expect(sql).toContain('DEFINE EVENT IF NOT EXISTS on_create');
  });

  it('throws when name is missing', () => {
    expect(() =>
      gen.generateEventMigration({ name: '', what: 'user', when: 'true', then: ['SELECT 1'] }),
    ).toThrow('Event name is required for migration');
  });
});

// ===========================================================================
// generateFunctionDefinition
// ===========================================================================
describe('generateFunctionDefinition', () => {
  it('generates DEFINE FUNCTION with name and body', () => {
    const sql = gen.generateFunctionDefinition({
      name: 'fn::add',
      body: 'RETURN $a + $b',
    });
    expect(sql).toBe('DEFINE FUNCTION IF NOT EXISTS fn::add { RETURN $a + $b }');
  });

  it('includes arguments', () => {
    const sql = gen.generateFunctionDefinition({
      name: 'fn::greet',
      args: ['$name'],
      body: 'RETURN "Hello, " + $name',
    });
    expect(sql).toBe(
      'DEFINE FUNCTION IF NOT EXISTS fn::greet ($name) { RETURN "Hello, " + $name }',
    );
  });

  it('includes multiple arguments', () => {
    const sql = gen.generateFunctionDefinition({
      name: 'fn::add',
      args: ['$a', '$b'],
      body: 'RETURN $a + $b',
    });
    expect(sql).toBe('DEFINE FUNCTION IF NOT EXISTS fn::add ($a, $b) { RETURN $a + $b }');
  });

  it('includes COMMENT', () => {
    const sql = gen.generateFunctionDefinition({
      name: 'fn::add',
      body: 'RETURN $a + $b',
      comment: 'Adds two numbers',
    });
    expect(sql).toContain('COMMENT "Adds two numbers"');
  });

  it('includes PERMISSIONS', () => {
    const sql = gen.generateFunctionDefinition({
      name: 'fn::admin_only',
      body: 'RETURN true',
      permissions: 'FOR select WHERE $auth.role = "admin"',
    });
    expect(sql).toContain('PERMISSIONS FOR select WHERE $auth.role = "admin"');
  });

  it('throws when name is missing', () => {
    expect(() => gen.generateFunctionDefinition({ name: '', body: 'RETURN 1' })).toThrow(
      'Function name is required for DEFINE FUNCTION',
    );
  });

  it('throws when body is missing', () => {
    expect(() => gen.generateFunctionDefinition({ name: 'fn::x', body: '' })).toThrow(
      'Function body is required for DEFINE FUNCTION',
    );
  });
});

// ===========================================================================
// generateFunctionMigration
// ===========================================================================
describe('generateFunctionMigration', () => {
  const fn: SurrealFunction = {
    name: 'fn::add',
    body: 'RETURN $a + $b',
  };

  it('generates DEFINE FUNCTION for up direction', () => {
    const sql = gen.generateFunctionMigration(fn);
    expect(sql).toContain('DEFINE FUNCTION IF NOT EXISTS fn::add');
  });

  it('throws when name is missing', () => {
    expect(() => gen.generateFunctionMigration({ name: '', body: 'RETURN 1' })).toThrow(
      'Function name is required for migration',
    );
  });
});

// ===========================================================================
// Alter statements
// ===========================================================================
describe('generateAlterFieldType', () => {
  it('generates ALTER FIELD TYPE', () => {
    const sql = gen.generateAlterFieldType('user', 'email', 'string');
    expect(sql).toBe('ALTER FIELD email ON TABLE user TYPE string');
  });

  it('maps type aliases', () => {
    const sql = gen.generateAlterFieldType('user', 'active', 'boolean');
    expect(sql).toBe('ALTER FIELD active ON TABLE user TYPE bool');
  });

  it('throws when tableName is empty', () => {
    expect(() => gen.generateAlterFieldType('', 'email', 'string')).toThrow(
      'Table name is required for ALTER FIELD TYPE',
    );
  });

  it('throws when fieldName is empty', () => {
    expect(() => gen.generateAlterFieldType('user', '', 'string')).toThrow(
      'Field name is required for ALTER FIELD TYPE',
    );
  });
});

describe('generateAlterTablePermissions', () => {
  it('generates ALTER TABLE PERMISSIONS for select', () => {
    const sql = gen.generateAlterTablePermissions('user', {
      select: 'WHERE published = true',
    });
    expect(sql).toBe('ALTER TABLE user PERMISSIONS FOR select WHERE published = true');
  });

  it('generates ALTER TABLE PERMISSIONS for all four actions', () => {
    const sql = gen.generateAlterTablePermissions('user', {
      select: 'FULL',
      create: 'WHERE $auth.role = "admin"',
      update: 'WHERE $auth.id = $record.id',
      delete: 'NONE',
    });
    expect(sql).toBe(
      'ALTER TABLE user PERMISSIONS FOR select FULL FOR create WHERE $auth.role = "admin" FOR update WHERE $auth.id = $record.id FOR delete NONE',
    );
  });

  it('returns empty string when no permissions', () => {
    expect(gen.generateAlterTablePermissions('user', undefined)).toBe('');
  });

  it('returns empty string when all permission fields empty', () => {
    expect(gen.generateAlterTablePermissions('user', {})).toBe('');
  });

  it('throws when tableName is empty', () => {
    expect(() => gen.generateAlterTablePermissions('', { select: 'FULL' })).toThrow(
      'Table name is required for ALTER TABLE PERMISSIONS',
    );
  });
});

describe('generateAlterFieldPermissions', () => {
  it('generates ALTER FIELD PERMISSIONS', () => {
    const sql = gen.generateAlterFieldPermissions('user', 'email', 'FOR select NONE');
    expect(sql).toBe('ALTER FIELD email ON TABLE user PERMISSIONS FOR select NONE');
  });

  it('returns empty string when no permissions', () => {
    expect(gen.generateAlterFieldPermissions('user', 'email', '')).toBe('');
  });

  it('throws when tableName is empty', () => {
    expect(() => gen.generateAlterFieldPermissions('', 'email', 'FOR select NONE')).toThrow(
      'Table name is required for ALTER FIELD PERMISSIONS',
    );
  });

  it('throws when fieldName is empty', () => {
    expect(() => gen.generateAlterFieldPermissions('user', '', 'FOR select NONE')).toThrow(
      'Field name is required for ALTER FIELD PERMISSIONS',
    );
  });
});

describe('generateAlterFieldDefault', () => {
  it('generates ALTER FIELD DEFAULT with string value', () => {
    const sql = gen.generateAlterFieldDefault('user', 'role', 'viewer');
    expect(sql).toBe("ALTER FIELD role ON TABLE user DEFAULT 'viewer'");
  });

  it('generates ALTER FIELD DEFAULT with number', () => {
    const sql = gen.generateAlterFieldDefault('user', 'count', 0);
    expect(sql).toBe('ALTER FIELD count ON TABLE user DEFAULT 0');
  });

  it('generates ALTER FIELD DEFAULT with boolean', () => {
    const sql = gen.generateAlterFieldDefault('user', 'active', true);
    expect(sql).toBe('ALTER FIELD active ON TABLE user DEFAULT true');
  });

  it('converts now() default to time::now()', () => {
    const sql = gen.generateAlterFieldDefault('user', 'created_at', 'now');
    expect(sql).toBe('ALTER FIELD created_at ON TABLE user DEFAULT time::now()');
  });

  it('returns empty string when defaultValue is undefined', () => {
    expect(gen.generateAlterFieldDefault('user', 'email', undefined)).toBe('');
  });

  it('throws when tableName is empty', () => {
    expect(() => gen.generateAlterFieldDefault('', 'email', 'x')).toThrow(
      'Table name is required for ALTER FIELD DEFAULT',
    );
  });

  it('throws when fieldName is empty', () => {
    expect(() => gen.generateAlterFieldDefault('user', '', 'x')).toThrow(
      'Field name is required for ALTER FIELD DEFAULT',
    );
  });
});

// ===========================================================================
// generateTableMigration
// ===========================================================================
describe('generateTableMigration', () => {
  it('generates table + fields for up direction', () => {
    const sql = gen.generateTableMigration(
      tableDef({
        name: 'user',
        columns: [
          col({ name: 'name', config: { type: 'string' } }),
          col({ name: 'email', config: { type: 'string' } }),
        ],
      }),
    );
    expect(sql).toHaveLength(3); // table + 2 fields
    expect(sql[0]).toBe('DEFINE TABLE IF NOT EXISTS user SCHEMAFULL');
    expect(sql[1]).toContain('DEFINE FIELD IF NOT EXISTS name');
    expect(sql[2]).toContain('DEFINE FIELD IF NOT EXISTS email');
  });

  it('includes index definitions when present', () => {
    const sql = gen.generateTableMigration(
      tableDef({
        name: 'user',
        columns: [col({ name: 'email', config: { type: 'string' } })],
        config: {
          indexes: [index({ name: 'idx_email', fields: ['email'], type: 'unique' })],
        },
      }),
    );
    expect(sql).toHaveLength(3); // table + field + index
    expect(sql[2]).toContain('DEFINE INDEX idx_email');
  });

  it('filters out empty statements from id field', () => {
    const sql = gen.generateTableMigration(
      tableDef({
        name: 'user',
        columns: [col({ name: 'id', config: { type: 'string' } })],
      }),
    );
    // id field returns empty string, filtered out
    expect(sql).toHaveLength(1);
    expect(sql[0]).toContain('DEFINE TABLE');
  });
});

// ===========================================================================
// generateMigration (multiple tables)
// ===========================================================================
describe('generateMigration', () => {
  it('generates statements for multiple tables', () => {
    const sql = gen.generateMigration([
      tableDef({
        name: 'user',
        columns: [col({ name: 'name', config: { type: 'string' } })],
      }),
      tableDef({
        name: 'post',
        columns: [col({ name: 'title', config: { type: 'string' } })],
      }),
    ]);
    expect(sql.length).toBeGreaterThanOrEqual(4); // 2 tables + 2 fields
    expect(sql.filter((s) => s.includes('DEFINE TABLE'))).toHaveLength(2);
  });

  it('filters out empty statements', () => {
    const sql = gen.generateMigration([
      tableDef({
        name: 'user',
        columns: [col({ name: 'id', config: { type: 'string' } })],
      }),
    ]);
    // Only the table definition (id field filtered out)
    expect(sql).toHaveLength(1);
  });
});

// ===========================================================================
// generateMigrationFile
// ===========================================================================
describe('generateMigrationFile', () => {
  it('returns up array', () => {
    const result = gen.generateMigrationFile(
      [tableDef({ name: 'user', columns: [col({ name: 'name', config: { type: 'string' } })] })],
      '1',
      'create_user',
    );
    expect(result).toHaveProperty('up');
    expect(Array.isArray(result.up)).toBe(true);
  });

  it('up contains DEFINE statements', () => {
    const result = gen.generateMigrationFile(
      [tableDef({ name: 'user', columns: [col({ name: 'name', config: { type: 'string' } })] })],
      '1',
      'create_user',
    );
    expect(result.up[0]).toContain('DEFINE TABLE IF NOT EXISTS user');
  });

  it('filters empty statements from up array', () => {
    const result = gen.generateMigrationFile(
      [
        tableDef({
          name: 'user',
          columns: [col({ name: 'id', config: { type: 'string' } })],
        }),
      ],
      '1',
      'migration',
    );
    // up: only table def (id field returns empty)
    expect(result.up.filter((s) => s.trim() !== '')).toEqual(result.up);
  });
});

// ===========================================================================
// generateAnalyzerDefinition
// ===========================================================================
describe('generateAnalyzerDefinition', () => {
  it('generates with array tokenizers and filters', () => {
    const analyzer: AnalyzerDefinition = {
      name: 'fts_ascii',
      tokenizers: ['class'],
      filters: ['ascii', 'lowercase'],
    };
    const sql = gen.generateAnalyzerDefinition(analyzer);
    expect(sql).toBe(
      'DEFINE ANALYZER IF NOT EXISTS fts_ascii TOKENIZERS class FILTERS ascii, lowercase',
    );
  });

  it('generates with string tokenizers and string filters', () => {
    const analyzer: AnalyzerDefinition = {
      name: 'simple',
      tokenizers: 'class',
      filters: 'lowercase',
    };
    const sql = gen.generateAnalyzerDefinition(analyzer);
    expect(sql).toBe('DEFINE ANALYZER IF NOT EXISTS simple TOKENIZERS class FILTERS lowercase');
  });

  it('generates without filters when filters is undefined', () => {
    const analyzer: AnalyzerDefinition = {
      name: 'basic',
      tokenizers: 'class',
    };
    const sql = gen.generateAnalyzerDefinition(analyzer);
    expect(sql).toBe('DEFINE ANALYZER IF NOT EXISTS basic TOKENIZERS class');
  });

  it('omits TOKENIZERS clause when tokenizers is empty string', () => {
    const analyzer: AnalyzerDefinition = {
      name: 'empty',
      tokenizers: '',
    };
    const sql = gen.generateAnalyzerDefinition(analyzer);
    expect(sql).toBe('DEFINE ANALYZER IF NOT EXISTS empty');
  });

  it('generates with multiple tokenizers and filters', () => {
    const analyzer: AnalyzerDefinition = {
      name: 'multi',
      tokenizers: ['blank', 'class', 'punctuation'],
      filters: ['lowercase', 'snowball'],
    };
    const sql = gen.generateAnalyzerDefinition(analyzer);
    expect(sql).toBe(
      'DEFINE ANALYZER IF NOT EXISTS multi TOKENIZERS blank, class, punctuation FILTERS lowercase, snowball',
    );
  });
});

// ===========================================================================
// generateRemoveAnalyzer
// ===========================================================================
describe('generateRemoveAnalyzer', () => {
  it('generates REMOVE ANALYZER for a named analyzer', () => {
    const sql = gen.generateRemoveAnalyzer('fts_ascii');
    expect(sql).toBe('REMOVE ANALYZER IF EXISTS fts_ascii');
  });

  it('throws for empty name', () => {
    expect(() => gen.generateRemoveAnalyzer('')).toThrow(
      'Analyzer name is required for REMOVE ANALYZER',
    );
  });
});

// ===========================================================================
// Edge cases and error handling across all public methods
// ===========================================================================
describe('error handling edge cases', () => {
  it('generateFieldDefinition - throws for missing tableName', () => {
    expect(() =>
      gen.generateFieldDefinition(
        col({ name: 'x', config: { type: 'string' }, tableName: undefined }),
      ),
    ).toThrow('Column x is missing tableName');
  });

  it('generateFieldRedefine - throws for missing tableName', () => {
    expect(() =>
      gen.generateFieldRedefine(
        col({ name: 'x', config: { type: 'string' }, tableName: undefined }),
      ),
    ).toThrow('Column x is missing tableName');
  });

  it('generateFieldDefinitions - throws for missing tableName', () => {
    expect(() =>
      gen.generateFieldDefinitions(
        col({ name: 'x', config: { type: 'string' }, tableName: undefined }),
      ),
    ).toThrow('Column x is missing tableName');
  });
});

describe('field type variations', () => {
  it('handles all common field types', () => {
    const types = ['string', 'int', 'float', 'bool', 'datetime', 'decimal', 'bytes', 'uuid', 'any'];
    for (const t of types) {
      const sql = gen.generateFieldDefinition(
        col({ name: 'f', config: { type: t as ColumnDefinition['config']['type'] } }),
      );
      expect(sql).toBe(`DEFINE FIELD IF NOT EXISTS f ON TABLE test_table TYPE ${t}`);
    }
  });

  it('handles optional with record type', () => {
    const sql = gen.generateFieldDefinition(
      col({
        name: 'author',
        config: { type: 'record', recordTable: 'user', optional: true },
      }),
    );
    expect(sql).toBe(
      'DEFINE FIELD IF NOT EXISTS author ON TABLE test_table TYPE option<record<user>>',
    );
  });

  it('handles all field properties together', () => {
    const sql = gen.generateFieldDefinition(
      col({
        name: 'email',
        config: {
          type: 'string',
          optional: true,
          readonly: true,
          flexible: true,
          default: 'NONE',
          assert: '$value CONTAINS "@"',
          permissions: 'FOR select FULL',
        },
      }),
    );
    expect(sql).toBe(
      'DEFINE FIELD IF NOT EXISTS email ON TABLE test_table TYPE option<string> FLEXIBLE READONLY DEFAULT \'NONE\' ASSERT $value CONTAINS "@" PERMISSIONS FOR select FULL',
    );
  });
});

describe('tuple field variations', () => {
  it('generates single element tuple', () => {
    const sql = gen.generateFieldDefinition(
      col({
        name: 'point',
        config: { type: 'tuple', size: 1, elements: [{ type: 'float' }] },
      }),
    );
    expect(sql).toContain(
      'DEFINE FIELD IF NOT EXISTS point ON TABLE test_table TYPE array<float, 1>',
    );
    expect(sql).toContain('DEFINE FIELD IF NOT EXISTS point[0] ON TABLE test_table TYPE float');
  });

  it('generates tuple with element assertions', () => {
    const sql = gen.generateFieldDefinition(
      col({
        name: 'positive',
        config: {
          type: 'tuple',
          size: 2,
          elements: [
            { type: 'int', assert: '$value > 0' },
            { type: 'int', assert: '$value > 0' },
          ],
        },
      }),
    );
    expect(sql).toContain('positive[0]');
    expect(sql).toContain('ASSERT $value > 0');
    expect(sql).toContain('positive[1]');
  });
});

describe('index variations', () => {
  it('generates HNSW with MANHATTAN distance', () => {
    const sql = gen.generateIndexDefinition(
      index({
        name: 'idx_vec',
        fields: ['vec'],
        type: 'hnsw',
        dimension: 256,
        vectorType: 'float64',
        distance: 'MANHATTAN',
      }),
      'items',
    );
    expect(sql).toBe(
      'DEFINE INDEX idx_vec ON TABLE items COLUMNS vec HNSW DIMENSION 256 TYPE F64 DIST MANHATTAN',
    );
  });

  it('generates HNSW with EUCLIDEAN distance', () => {
    const sql = gen.generateIndexDefinition(
      index({
        name: 'idx_vec',
        fields: ['vec'],
        type: 'hnsw',
        dimension: 64,
        distance: 'EUCLIDEAN',
      }),
      'items',
    );
    expect(sql).toContain('DIST EUCLIDEAN');
  });
});

describe('empty and boundary states', () => {
  it('generateRemoveField - does not throw for whitespace-only name (only checks truthiness)', () => {
    expect(() => gen.generateRemoveField('user', '  ')).not.toThrow();
  });

  it('generateRemoveIndex - does not throw for whitespace-only name (only checks truthiness)', () => {
    expect(() => gen.generateRemoveIndex('  ', 'user')).not.toThrow();
  });

  it('generateTableMigration with no columns', () => {
    const sql = gen.generateTableMigration(tableDef({ name: 'empty', columns: [] }));
    expect(sql).toEqual(['DEFINE TABLE IF NOT EXISTS empty SCHEMAFULL']);
  });

  it('generateMigration with empty tables array', () => {
    const sql = gen.generateMigration([]);
    expect(sql).toEqual([]);
  });

  it('generateMigrationFile with empty tables', () => {
    const result = gen.generateMigrationFile([], '1', 'empty');
    expect(result).toEqual({ up: [] });
  });
});

// ===========================================================================
// generateNamespaceDefinition
// ===========================================================================
describe('generateNamespaceDefinition', () => {
  const gen = new SurrealQLGenerator();

  it('generates basic namespace', () => {
    const sql = gen.generateNamespaceDefinition('production');
    expect(sql).toBe('DEFINE NAMESPACE production');
  });

  it('throws for empty name', () => {
    expect(() => gen.generateNamespaceDefinition('')).toThrow(
      'Namespace name is required for DEFINE NAMESPACE',
    );
  });

  it('generates with comment', () => {
    const sql = gen.generateNamespaceDefinition('staging', {
      comment: 'Staging environment',
    });
    expect(sql).toBe('DEFINE NAMESPACE staging COMMENT "Staging environment"');
  });

  it('generates with IF NOT EXISTS', () => {
    const sql = gen.generateNamespaceDefinition('dev', { ifNotExists: true });
    expect(sql).toBe('DEFINE NAMESPACE IF NOT EXISTS dev');
  });

  it('generates with all options', () => {
    const sql = gen.generateNamespaceDefinition('test', {
      ifNotExists: true,
      comment: 'Test env',
    });
    expect(sql).toBe('DEFINE NAMESPACE IF NOT EXISTS test COMMENT "Test env"');
  });
});

// ===========================================================================
// generateRemoveNamespace
// ===========================================================================
describe('generateRemoveNamespace', () => {
  const gen = new SurrealQLGenerator();

  it('generates basic remove', () => {
    expect(gen.generateRemoveNamespace('production')).toBe('REMOVE NAMESPACE production');
  });

  it('generates with IF EXISTS', () => {
    expect(gen.generateRemoveNamespace('dev', true)).toBe('REMOVE NAMESPACE IF EXISTS dev');
  });

  it('throws for empty name', () => {
    expect(() => gen.generateRemoveNamespace('')).toThrow(
      'Namespace name is required for REMOVE NAMESPACE',
    );
  });
});

// ---------------------------------------------------------------------------
// DATABASE definitions
// ---------------------------------------------------------------------------

describe('generateDatabaseDefinition', () => {
  const gen = new SurrealQLGenerator();

  it('generates basic DEFINE DATABASE', () => {
    expect(gen.generateDatabaseDefinition('testdb')).toBe('DEFINE DATABASE testdb');
  });

  it('generates with IF NOT EXISTS', () => {
    expect(gen.generateDatabaseDefinition('testdb', { ifNotExists: true })).toBe(
      'DEFINE DATABASE IF NOT EXISTS testdb',
    );
  });

  it('generates with COMMENT', () => {
    expect(gen.generateDatabaseDefinition('testdb', { comment: 'Test database' })).toBe(
      'DEFINE DATABASE testdb COMMENT "Test database"',
    );
  });

  it('generates with IF NOT EXISTS and COMMENT', () => {
    expect(gen.generateDatabaseDefinition('testdb', { ifNotExists: true, comment: 'Test' })).toBe(
      'DEFINE DATABASE IF NOT EXISTS testdb COMMENT "Test"',
    );
  });

  it('escapes reserved words with backticks', () => {
    expect(gen.generateDatabaseDefinition('use')).toBe('DEFINE DATABASE use');
  });

  it('throws for empty name', () => {
    expect(() => gen.generateDatabaseDefinition('')).toThrow(
      'Database name is required for DEFINE DATABASE',
    );
  });
});

describe('generateRemoveDatabase', () => {
  const gen = new SurrealQLGenerator();

  it('generates basic REMOVE DATABASE', () => {
    expect(gen.generateRemoveDatabase('testdb')).toBe('REMOVE DATABASE testdb');
  });

  it('generates with IF EXISTS', () => {
    expect(gen.generateRemoveDatabase('testdb', true)).toBe('REMOVE DATABASE IF EXISTS testdb');
  });

  it('escapes reserved words with backticks', () => {
    expect(gen.generateRemoveDatabase('use')).toBe('REMOVE DATABASE use');
  });

  it('throws for empty name', () => {
    expect(() => gen.generateRemoveDatabase('')).toThrow(
      'Database name is required for REMOVE DATABASE',
    );
  });
});

// ===========================================================================
// generateSequenceDefinition
// ===========================================================================
describe('generateSequenceDefinition', () => {
  const gen = new SurrealQLGenerator();

  it('generates basic DEFINE SEQUENCE', () => {
    const seq: SurrealSequence = { name: 'my_seq' };
    expect(gen.generateSequenceDefinition(seq)).toBe('DEFINE SEQUENCE IF NOT EXISTS my_seq');
  });

  it('includes START and INCREMENT', () => {
    const seq: SurrealSequence = { name: 'my_seq', start: 1, increment: 2 };
    expect(gen.generateSequenceDefinition(seq)).toBe(
      'DEFINE SEQUENCE IF NOT EXISTS my_seq START 1 INCREMENT 2',
    );
  });

  it('includes MIN and MAX', () => {
    const seq: SurrealSequence = { name: 'seq1', min: 0, max: 1000 };
    expect(gen.generateSequenceDefinition(seq)).toBe(
      'DEFINE SEQUENCE IF NOT EXISTS seq1 MIN 0 MAX 1000',
    );
  });

  it('includes CACHE and CYCLE', () => {
    const seq: SurrealSequence = { name: 'seq1', cache: 10, cycle: true };
    expect(gen.generateSequenceDefinition(seq)).toBe(
      'DEFINE SEQUENCE IF NOT EXISTS seq1 CACHE 10 CYCLE',
    );
  });

  it('includes COMMENT', () => {
    const seq: SurrealSequence = { name: 'seq1', comment: 'my sequence' };
    expect(gen.generateSequenceDefinition(seq)).toBe(
      'DEFINE SEQUENCE IF NOT EXISTS seq1 COMMENT "my sequence"',
    );
  });

  it('includes all options', () => {
    const seq: SurrealSequence = {
      name: 'full_seq',
      start: 1,
      increment: 5,
      min: 0,
      max: 99999,
      cache: 100,
      cycle: true,
      comment: 'full sequence',
    };
    expect(gen.generateSequenceDefinition(seq)).toBe(
      'DEFINE SEQUENCE IF NOT EXISTS full_seq START 1 INCREMENT 5 MIN 0 MAX 99999 CACHE 100 CYCLE COMMENT "full sequence"',
    );
  });

  it('escapes special characters in names', () => {
    const seq: SurrealSequence = { name: 'my-seq' };
    expect(gen.generateSequenceDefinition(seq)).toBe('DEFINE SEQUENCE IF NOT EXISTS `my-seq`');
  });

  it('throws for empty name', () => {
    expect(() => gen.generateSequenceDefinition({ name: '' })).toThrow(
      'Sequence name is required for DEFINE SEQUENCE',
    );
  });
});

// ===========================================================================
// generateRemoveSequence
// ===========================================================================
describe('generateRemoveSequence', () => {
  const gen = new SurrealQLGenerator();

  it('generates basic REMOVE SEQUENCE', () => {
    expect(gen.generateRemoveSequence('my_seq')).toBe('REMOVE SEQUENCE my_seq');
  });

  it('generates with IF EXISTS', () => {
    expect(gen.generateRemoveSequence('my_seq', true)).toBe('REMOVE SEQUENCE IF EXISTS my_seq');
  });

  it('escapes special characters in names', () => {
    expect(gen.generateRemoveSequence('my-seq')).toBe('REMOVE SEQUENCE `my-seq`');
  });

  it('throws for empty name', () => {
    expect(() => gen.generateRemoveSequence('')).toThrow(
      'Sequence name is required for REMOVE SEQUENCE',
    );
  });
});
