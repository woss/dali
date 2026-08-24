import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createSchemaBuilder } from '../schema-builder.js';

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
// 1. Empty / boundary inputs
// =============================================================================

describe('SchemaBuilder adversarial — empty inputs', () => {
  it('defineTable with empty string name produces SQL with empty name', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder.defineTable('').toSQL();
    expect(sql).toEqual(['DEFINE TABLE IF NOT EXISTS  SCHEMAFULL']);
  });

  it('defineField with empty string table name throws', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    builder.defineField('', 'name', { type: 'string' });
    // The generator throws when tableName is empty
    expect(() => builder.toSQL()).toThrow('missing tableName');
  });

  it('defineField with empty string field name produces SQL with empty name', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder.defineField('user', '', { type: 'string' }).toSQL();
    expect(sql).toEqual(['DEFINE FIELD IF NOT EXISTS  ON TABLE user TYPE string']);
  });

  it('removeTable with empty string throws', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    // removeTable enqueues at call time; the generator.generateRemoveTable throws immediately
    expect(() => builder.removeTable('')).toThrow('Table name is required for REMOVE TABLE');
  });

  it('removeField with empty table throws', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    expect(() => builder.removeField('', 'field')).toThrow(
      'Table name is required for REMOVE FIELD',
    );
  });

  it('removeField with empty field name throws', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    expect(() => builder.removeField('user', '')).toThrow(
      'Field name is required for REMOVE FIELD',
    );
  });

  it('removeIndex with empty index name throws', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    expect(() => builder.removeIndex('', 'user')).toThrow(
      'Index name is required for REMOVE INDEX',
    );
  });

  it('removeIndex with empty table throws', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    expect(() => builder.removeIndex('idx', '')).toThrow('Table name is required for REMOVE INDEX');
  });
});

// =============================================================================
// 2. SQL injection via raw()
// =============================================================================

describe('SchemaBuilder adversarial — SQL injection via raw()', () => {
  it('raw() passes SQL injection string verbatim', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const injection = "'; DROP TABLE user; --";
    const sql = builder.raw(injection).toSQL();
    expect(sql).toEqual([injection]);
  });

  it('raw() with multiple injection attempts', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const payloads = [
      '1; DROP TABLE users; --',
      "' OR '1'='1",
      'UNION SELECT * FROM secrets--',
      '${process.env.SECRET}',
      '`rm -rf /`',
    ];

    let builderRef = builder;
    for (const payload of payloads) {
      builderRef = builderRef.raw(payload);
    }

    const sql = builderRef.toSQL();
    expect(sql).toEqual(payloads);
  });

  it('raw() executes injection strings via queryFn without escaping', async () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const injection = "'; DELETE FROM user WHERE 1=1; --";
    await builder.raw(injection).execute();
    expect(query).toHaveBeenCalledWith(injection);
  });
});

// =============================================================================
// 3. toSQL() idempotency and ordering
// =============================================================================

describe('SchemaBuilder adversarial — toSQL() behavior', () => {
  it('toSQL() returns same results when called twice', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    builder.defineTable('user').defineField('user', 'name', { type: 'string' });

    const sql1 = builder.toSQL();
    const sql2 = builder.toSQL();
    expect(sql1).toEqual(sql2);
  });

  it('toSQL() after execute() returns same results', async () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    builder.defineTable('user').defineField('user', 'name', { type: 'string' });

    const sqlBefore = builder.toSQL();
    await builder.execute();
    const sqlAfter = builder.toSQL();

    expect(sqlBefore).toEqual(sqlAfter);
  });

  it('toSQL() accumulates operations across multiple calls', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    builder.defineTable('user');
    const sql1 = builder.toSQL();
    expect(sql1).toHaveLength(1);

    builder.defineField('user', 'name', { type: 'string' });
    const sql2 = builder.toSQL();
    expect(sql2).toHaveLength(2);

    builder.defineTable('post');
    const sql3 = builder.toSQL();
    expect(sql3).toHaveLength(3);
  });

  it('defineField for "id" field produces empty toSQL but does not corrupt other operations', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    builder
      .defineTable('user')
      .defineField('user', 'id', { type: 'string' }) // skipped
      .defineField('user', 'name', { type: 'string' }); // included

    const sql = builder.toSQL();
    expect(sql).toHaveLength(2);
    expect(sql[0]).toBe('DEFINE TABLE IF NOT EXISTS user SCHEMAFULL');
    expect(sql[1]).toBe('DEFINE FIELD IF NOT EXISTS name ON TABLE user TYPE string');
  });
});

// =============================================================================
// 4. Multiple execute() calls
// =============================================================================

describe('SchemaBuilder adversarial — multiple execute()', () => {
  it('calling execute() twice re-executes all statements', async () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    builder.defineTable('user').defineField('user', 'name', { type: 'string' });

    await builder.execute();
    expect(query).toHaveBeenCalledTimes(2);

    await builder.execute();
    // 2 more calls = 4 total
    expect(query).toHaveBeenCalledTimes(4);
  });

  it('execute() after adding more operations executes all including new', async () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    builder.defineTable('user');
    await builder.execute();
    expect(query).toHaveBeenCalledTimes(1);

    builder.defineField('user', 'name', { type: 'string' });
    await builder.execute();
    // 1 from first execute + 2 from second (table + field)
    expect(query).toHaveBeenCalledTimes(3);
  });
});

// =============================================================================
// 5. execute() with queryFn failure
// =============================================================================

describe('SchemaBuilder adversarial — execute() with queryFn errors', () => {
  it('propagates queryFn rejection', async () => {
    const query = createMockQuery();
    query.mockRejectedValueOnce(new Error('connection lost'));
    const builder = createSchemaBuilder(query);

    builder.defineTable('user').defineField('user', 'name', { type: 'string' });

    await expect(builder.execute()).rejects.toThrow('connection lost');
    // Only first statement was attempted
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('stops at first failure and does not execute remaining statements', async () => {
    const query = createMockQuery();
    query.mockRejectedValueOnce(new Error('DB error'));
    const builder = createSchemaBuilder(query);

    builder.defineTable('user').defineField('user', 'name', { type: 'string' }).defineTable('post');

    await expect(builder.execute()).rejects.toThrow('DB error');
    // Failed on first, so only 1 call
    expect(query).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// 6. Unicode and special characters
// =============================================================================

describe('SchemaBuilder adversarial — unicode and special characters', () => {
  it('defineTable with unicode name', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder.defineTable('用户').toSQL();
    expect(sql).toEqual(['DEFINE TABLE IF NOT EXISTS 用户 SCHEMAFULL']);
  });

  it('defineField with unicode name', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder.defineField('user', '名前', { type: 'string' }).toSQL();
    expect(sql).toEqual(['DEFINE FIELD IF NOT EXISTS 名前 ON TABLE user TYPE string']);
  });

  it('defineField with emoji in default value', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder.defineField('user', 'avatar', { type: 'string', default: '🎨' }).toSQL();
    expect(sql).toEqual([
      "DEFINE FIELD IF NOT EXISTS avatar ON TABLE user TYPE string DEFAULT '🎨'",
    ]);
  });

  it('raw() with unicode SQL', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder.raw('DEFINE FUNCTION über::func() { RETURN true; }').toSQL();
    expect(sql).toEqual(['DEFINE FUNCTION über::func() { RETURN true; }']);
  });
});

// =============================================================================
// 7. Large-scale / stress
// =============================================================================

describe('SchemaBuilder adversarial — scale', () => {
  it('handles 100 chained operations', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    let ref = builder;
    for (let i = 0; i < 50; i++) {
      ref = ref.defineTable(`table_${i}`);
      ref = ref.defineField(`table_${i}`, `field_${i}`, { type: 'string' });
    }

    const sql = ref.toSQL();
    expect(sql).toHaveLength(100);
    expect(sql[0]).toBe('DEFINE TABLE IF NOT EXISTS table_0 SCHEMAFULL');
    expect(sql[1]).toBe('DEFINE FIELD IF NOT EXISTS field_0 ON TABLE table_0 TYPE string');
    expect(sql[98]).toBe('DEFINE TABLE IF NOT EXISTS table_49 SCHEMAFULL');
    expect(sql[99]).toBe('DEFINE FIELD IF NOT EXISTS field_49 ON TABLE table_49 TYPE string');
  });

  it('handles 100 raw statements', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    let ref = builder;
    for (let i = 0; i < 100; i++) {
      ref = ref.raw(`SELECT ${i}`);
    }

    const sql = ref.toSQL();
    expect(sql).toHaveLength(100);
    expect(sql[0]).toBe('SELECT 0');
    expect(sql[99]).toBe('SELECT 99');
  });
});

// =============================================================================
// 8. defineIndex edge cases
// =============================================================================

describe('SchemaBuilder adversarial — defineIndex edge cases', () => {
  it('defineIndex with single-element fields array', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder.defineIndex('idx', { table: 'user', fields: ['email'] }).toSQL();
    expect(sql).toEqual(['DEFINE INDEX idx ON TABLE user COLUMNS email']);
  });

  it('defineIndex with many fields', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder
      .defineIndex('idx', {
        table: 'user',
        fields: ['a', 'b', 'c', 'd', 'e'],
      })
      .toSQL();
    expect(sql).toEqual(['DEFINE INDEX idx ON TABLE user COLUMNS a, b, c, d, e']);
  });
});

// =============================================================================
// 9. execute() ordering verification
// =============================================================================

describe('SchemaBuilder adversarial — execute() order matches toSQL()', () => {
  it('queryFn receives statements in exact toSQL() order', async () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);

    builder
      .defineTable('a')
      .raw('DEFINE ANALYZER test')
      .defineTable('b')
      .defineField('b', 'x', { type: 'string' })
      .removeTable('c');

    const expectedSql = builder.toSQL();
    await builder.execute();

    expect(query).toHaveBeenCalledTimes(expectedSql.length);
    for (let i = 0; i < expectedSql.length; i++) {
      expect(query).toHaveBeenNthCalledWith(i + 1, expectedSql[i]);
    }
  });
});

// =============================================================================
// 10. defineTable config edge cases
// =============================================================================

describe('SchemaBuilder adversarial — defineTable config edge cases', () => {
  it('defineTable with no config defaults to SCHEMAFULL', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder.defineTable('t').toSQL();
    expect(sql).toEqual(['DEFINE TABLE IF NOT EXISTS t SCHEMAFULL']);
  });

  it('defineTable with schema: "full" explicitly', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder.defineTable('t', { schema: 'full' }).toSQL();
    expect(sql).toEqual(['DEFINE TABLE IF NOT EXISTS t SCHEMAFULL']);
  });

  it('defineTable with only type set preserves default schema', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder
      .defineTable('e', {
        type: 'relation',
        in: 'a',
        out: 'b',
      })
      .toSQL();
    expect(sql).toEqual(['DEFINE TABLE IF NOT EXISTS e SCHEMAFULL TYPE RELATION IN a OUT b']);
  });
});

// =============================================================================
// 11. Query function isolation — each builder independent
// =============================================================================

describe('SchemaBuilder adversarial — builder isolation', () => {
  it('two builders do not share operations', () => {
    const query = createMockQuery();
    const builder1 = createSchemaBuilder(query);
    const builder2 = createSchemaBuilder(query);

    builder1.defineTable('user');
    builder2.defineTable('post');

    expect(builder1.toSQL()).toEqual(['DEFINE TABLE IF NOT EXISTS user SCHEMAFULL']);
    expect(builder2.toSQL()).toEqual(['DEFINE TABLE IF NOT EXISTS post SCHEMAFULL']);
  });

  it('two builders with separate query functions', async () => {
    const query1 = createMockQuery();
    const query2 = createMockQuery();
    const builder1 = createSchemaBuilder(query1);
    const builder2 = createSchemaBuilder(query2);

    builder1.defineTable('user');
    builder2.defineTable('post');

    await builder1.execute();
    await builder2.execute();

    expect(query1).toHaveBeenCalledTimes(1);
    expect(query1).toHaveBeenCalledWith('DEFINE TABLE IF NOT EXISTS user SCHEMAFULL');
    expect(query2).toHaveBeenCalledTimes(1);
    expect(query2).toHaveBeenCalledWith('DEFINE TABLE IF NOT EXISTS post SCHEMAFULL');
  });
});

// =============================================================================
// 12. defineField type variants
// =============================================================================

describe('SchemaBuilder adversarial — defineField exotic types', () => {
  it('array type', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder.defineField('user', 'tags', { type: 'array' }).toSQL();
    expect(sql).toEqual(['DEFINE FIELD IF NOT EXISTS tags ON TABLE user TYPE array']);
  });

  it('bool type', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder.defineField('user', 'active', { type: 'bool' }).toSQL();
    expect(sql).toEqual(['DEFINE FIELD IF NOT EXISTS active ON TABLE user TYPE bool']);
  });

  it('decimal type', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder.defineField('user', 'balance', { type: 'decimal' }).toSQL();
    expect(sql).toEqual(['DEFINE FIELD IF NOT EXISTS balance ON TABLE user TYPE decimal']);
  });

  it('duration type', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder.defineField('event', 'ttl', { type: 'duration' }).toSQL();
    expect(sql).toEqual(['DEFINE FIELD IF NOT EXISTS ttl ON TABLE event TYPE duration']);
  });

  it('bytes type', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder.defineField('blob', 'data', { type: 'bytes' }).toSQL();
    expect(sql).toEqual(['DEFINE FIELD IF NOT EXISTS data ON TABLE blob TYPE bytes']);
  });

  it('uuid type', () => {
    const query = createMockQuery();
    const builder = createSchemaBuilder(query);
    const sql = builder.defineField('user', 'uid', { type: 'uuid' }).toSQL();
    expect(sql).toEqual(['DEFINE FIELD IF NOT EXISTS uid ON TABLE user TYPE uuid']);
  });
});
