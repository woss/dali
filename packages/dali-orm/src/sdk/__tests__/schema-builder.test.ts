import { describe, expect, it, vi } from 'vite-plus/test';
import { createSchemaBuilder } from '../schema-builder.js';
import type { ColumnConfig } from '../schema/column/types.js';

// =============================================================================
// Mock obug (required by generator internals)
// =============================================================================

vi.mock('obug', () => ({
  createDebug: vi.fn(() => {
    const fn = vi.fn() as any;
    fn.extend = vi.fn(() => vi.fn());
    return fn;
  }),
}));

// =============================================================================
// Helpers
// =============================================================================

function createMockQuery() {
  return vi.fn(async () => []);
}

// =============================================================================
// defineTable
// =============================================================================

describe('SchemaBuilder defineTable', () => {
  it('generates valid DEFINE TABLE SQL', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder.defineTable('user').toSQL();
    expect(sql).toEqual(['DEFINE TABLE IF NOT EXISTS user SCHEMAFULL']);
  });

  it('generates SCHEMALESS when schema is less', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder.defineTable('config', { schema: 'less' }).toSQL();
    expect(sql).toEqual(['DEFINE TABLE IF NOT EXISTS config SCHEMALESS']);
  });

  it('generates TYPE RELATION IN/OUT for relation tables', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineTable('follows', {
        type: 'relation',
        in: 'user',
        out: 'user',
      })
      .toSQL();

    expect(sql).toEqual([
      'DEFINE TABLE IF NOT EXISTS follows SCHEMAFULL TYPE RELATION IN user OUT user',
    ]);
  });

  it('generates relation with array in/out', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineTable('connects', {
        type: 'relation',
        in: ['user', 'org'],
        out: ['post', 'comment'],
      })
      .toSQL();

    expect(sql).toEqual([
      'DEFINE TABLE IF NOT EXISTS connects SCHEMAFULL TYPE RELATION IN user, org OUT post, comment',
    ]);
  });

  it('includes CHANGEFEED when specified', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder.defineTable('events', { changefeed: '7d' }).toSQL();
    expect(sql).toEqual(['DEFINE TABLE IF NOT EXISTS events SCHEMAFULL CHANGEFEED 7d']);
  });

  it('includes PERMISSIONS when specified', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineTable('secret', {
        permissions: { select: 'WHERE $auth.admin = true' },
      })
      .toSQL();

    expect(sql).toEqual([
      'DEFINE TABLE IF NOT EXISTS secret SCHEMAFULL PERMISSIONS FOR select WHERE $auth.admin = true',
    ]);
  });
});

// =============================================================================
// defineField
// =============================================================================

describe('SchemaBuilder defineField', () => {
  it('generates valid DEFINE FIELD SQL', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder.defineField('user', 'name', { type: 'string' }).toSQL();
    expect(sql).toEqual(['DEFINE FIELD IF NOT EXISTS name ON TABLE user TYPE string']);
  });

  it('generates optional field as option<T>', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineField('user', 'nickname', {
        type: 'string',
        optional: true,
      })
      .toSQL();

    expect(sql).toEqual(['DEFINE FIELD IF NOT EXISTS nickname ON TABLE user TYPE option<string>']);
  });

  it('generates readonly field', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineField('user', 'created_at', {
        type: 'datetime',
        readonly: true,
      })
      .toSQL();

    expect(sql).toEqual([
      'DEFINE FIELD IF NOT EXISTS created_at ON TABLE user TYPE datetime READONLY',
    ]);
  });

  it('generates field with default value', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineField('user', 'status', {
        type: 'string',
        default: 'active',
      })
      .toSQL();

    expect(sql).toEqual([
      "DEFINE FIELD IF NOT EXISTS status ON TABLE user TYPE string DEFAULT 'active'",
    ]);
  });

  it('generates field with raw default expression', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineField('user', 'hash', {
        type: 'string',
        defaultRaw: 'crypto::blake3(content)',
      })
      .toSQL();

    expect(sql).toEqual([
      'DEFINE FIELD IF NOT EXISTS hash ON TABLE user TYPE string DEFAULT crypto::blake3(content)',
    ]);
  });

  it('generates optional + readonly + default combined', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineField('user', 'score', {
        type: 'int',
        optional: true,
        readonly: true,
        default: '0',
      })
      .toSQL();

    expect(sql).toEqual([
      "DEFINE FIELD IF NOT EXISTS score ON TABLE user TYPE option<int> READONLY DEFAULT '0'",
    ]);
  });

  it('generates record<T> field with recordTable', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineField('post', 'author', {
        type: 'record',
        recordTable: 'user',
      })
      .toSQL();

    expect(sql).toEqual(['DEFINE FIELD IF NOT EXISTS author ON TABLE post TYPE record<user>']);
  });

  it('generates FLEXIBLE field', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineField('user', 'metadata', {
        type: 'object',
        flexible: true,
      })
      .toSQL();

    expect(sql).toEqual(['DEFINE FIELD IF NOT EXISTS metadata ON TABLE user TYPE object FLEXIBLE']);
  });

  it('skips empty string from generator (id field)', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    // The generator returns '' for id fields — builder should skip it
    const sql = builder.defineField('user', 'id', { type: 'string' }).toSQL();
    expect(sql).toEqual([]);
  });
});

// =============================================================================
// defineIndex
// =============================================================================

describe('SchemaBuilder defineIndex', () => {
  it('generates valid DEFINE INDEX SQL', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineIndex('user_name_idx', {
        table: 'user',
        fields: ['name'],
      })
      .toSQL();

    expect(sql).toEqual(['DEFINE INDEX user_name_idx ON TABLE user COLUMNS name']);
  });

  it('generates unique index', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineIndex('user_email_unique', {
        table: 'user',
        fields: ['email'],
        type: 'unique',
      })
      .toSQL();

    expect(sql).toEqual(['DEFINE INDEX user_email_unique ON TABLE user COLUMNS email UNIQUE']);
  });

  it('generates fulltext index', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineIndex('post_search', {
        table: 'post',
        fields: ['title', 'body'],
        type: 'fulltext',
        analyzer: 'snowball',
      })
      .toSQL();

    expect(sql).toEqual([
      'DEFINE INDEX post_search ON TABLE post COLUMNS title, body FULLTEXT ANALYZER snowball',
    ]);
  });

  it('generates multi-column index', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineIndex('复合索引', {
        table: 'user',
        fields: ['name', 'email'],
      })
      .toSQL();

    expect(sql).toEqual(['DEFINE INDEX 复合索引 ON TABLE user COLUMNS name, email']);
  });
});

// =============================================================================
// removeTable
// =============================================================================

describe('SchemaBuilder removeTable', () => {
  it('generates REMOVE TABLE', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder.removeTable('old_table').toSQL();
    expect(sql).toEqual(['REMOVE TABLE old_table']);
  });
});

// =============================================================================
// removeField
// =============================================================================

describe('SchemaBuilder removeField', () => {
  it('generates REMOVE FIELD', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder.removeField('user', 'old_field').toSQL();
    expect(sql).toEqual(['REMOVE FIELD old_field ON TABLE user']);
  });
});

// =============================================================================
// removeIndex
// =============================================================================

describe('SchemaBuilder removeIndex', () => {
  it('generates REMOVE INDEX', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder.removeIndex('old_idx', 'user').toSQL();
    expect(sql).toEqual(['REMOVE INDEX old_idx ON TABLE user']);
  });
});

// =============================================================================
// raw
// =============================================================================

describe('SchemaBuilder raw', () => {
  it('adds arbitrary SQL', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .raw('DEFINE ANALYZER my_analyzer TOKENIZERS blank FILTERS lowercase')
      .toSQL();
    expect(sql).toEqual(['DEFINE ANALYZER my_analyzer TOKENIZERS blank FILTERS lowercase']);
  });

  it('preserves order with other statements', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineTable('user')
      .raw('DEFINE ANALYZER my_analyzer TOKENIZERS blank')
      .defineField('user', 'name', { type: 'string' })
      .toSQL();

    expect(sql).toEqual([
      'DEFINE TABLE IF NOT EXISTS user SCHEMAFULL',
      'DEFINE ANALYZER my_analyzer TOKENIZERS blank',
      'DEFINE FIELD IF NOT EXISTS name ON TABLE user TYPE string',
    ]);
  });
});

// =============================================================================
// Chaining (returns this)
// =============================================================================

describe('SchemaBuilder chaining', () => {
  it('all methods return this for chaining', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const result1 = builder.defineTable('user');
    expect(result1).toBe(builder);

    const result2 = builder.defineField('user', 'name', { type: 'string' });
    expect(result2).toBe(builder);

    const result3 = builder.defineIndex('idx', { table: 'user', fields: ['name'] });
    expect(result3).toBe(builder);

    const result4 = builder.removeTable('old');
    expect(result4).toBe(builder);

    const result5 = builder.removeField('user', 'old');
    expect(result5).toBe(builder);

    const result6 = builder.removeIndex('old', 'user');
    expect(result6).toBe(builder);

    const result7 = builder.raw('SELECT 1');
    expect(result7).toBe(builder);
  });
});

// =============================================================================
// toSQL() returns array of all statements in order
// =============================================================================

describe('SchemaBuilder toSQL ordering', () => {
  it('returns all statements in insertion order', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineTable('user')
      .defineField('user', 'name', { type: 'string' })
      .defineField('user', 'email', { type: 'string' })
      .defineIndex('user_email_idx', { table: 'user', fields: ['email'], type: 'unique' })
      .removeTable('legacy')
      .removeField('user', 'deprecated')
      .removeIndex('old_idx', 'user')
      .raw('DEFINE ANALYZER test TOKENIZERS blank')
      .toSQL();

    expect(sql).toHaveLength(8);
    expect(sql[0]).toBe('DEFINE TABLE IF NOT EXISTS user SCHEMAFULL');
    expect(sql[1]).toBe('DEFINE FIELD IF NOT EXISTS name ON TABLE user TYPE string');
    expect(sql[2]).toBe('DEFINE FIELD IF NOT EXISTS email ON TABLE user TYPE string');
    expect(sql[3]).toBe('DEFINE INDEX user_email_idx ON TABLE user COLUMNS email UNIQUE');
    expect(sql[4]).toBe('REMOVE TABLE legacy');
    expect(sql[5]).toBe('REMOVE FIELD deprecated ON TABLE user');
    expect(sql[6]).toBe('REMOVE INDEX old_idx ON TABLE user');
    expect(sql[7]).toBe('DEFINE ANALYZER test TOKENIZERS blank');
  });

  it('handles multiple fields and tables', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    const sql = builder
      .defineTable('user')
      .defineField('user', 'name', { type: 'string' })
      .defineTable('post')
      .defineField('post', 'title', { type: 'string' })
      .defineField('post', 'body', { type: 'string' })
      .toSQL();

    expect(sql).toHaveLength(5);
    expect(sql[0]).toContain('user');
    expect(sql[1]).toContain('ON TABLE user');
    expect(sql[2]).toContain('post');
    expect(sql[3]).toContain('ON TABLE post');
    expect(sql[4]).toContain('ON TABLE post');
  });
});

// =============================================================================
// execute() runs all statements via queryFn
// =============================================================================

describe('SchemaBuilder execute', () => {
  it('calls queryFn for each SQL statement', async () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    await builder.defineTable('user').defineField('user', 'name', { type: 'string' }).execute();

    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenNthCalledWith(1, 'DEFINE TABLE IF NOT EXISTS user SCHEMAFULL');
    expect(query).toHaveBeenNthCalledWith(
      2,
      'DEFINE FIELD IF NOT EXISTS name ON TABLE user TYPE string',
    );
  });

  it('does nothing when no operations queued', async () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    await builder.execute();
    expect(query).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Empty builder
// =============================================================================

describe('SchemaBuilder empty', () => {
  it('toSQL() returns empty array', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    expect(builder.toSQL()).toEqual([]);
  });
});
