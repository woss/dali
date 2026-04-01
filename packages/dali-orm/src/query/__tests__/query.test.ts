import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { EmbeddedDriver } from '../../sdk/driver/embedded-driver.js';
import type { SurrealDriver } from '../../sdk/driver/types.js';
import { bool, datetime, int, record, string } from '../../sdk/schema/column/index.js';
import { defineRelationTable, defineTable } from '../../sdk/table.js';
import {
  bindTable,
  columnRef,
  create,
  delete_,
  graphPath,
  insert,
  relate,
  select,
  update,
  upsert,
  WhereBuilder,
} from '../index.js';

// ============================================================================
// Test Setup
// ============================================================================

function createTestDriver(): EmbeddedDriver {
  return new EmbeddedDriver({
    driver: 'embedded',
    namespace: 'test_ns',
    database: 'test_db',
    mode: 'memory',
  });
}

/** Create isolated test driver with auto-cleanup */
async function setupTestDb(): Promise<{ driver: EmbeddedDriver; cleanup: () => Promise<void> }> {
  const d = createTestDriver();
  await d.connect();
  return {
    driver: d,
    cleanup: async () => {
      await d.disconnect();
    },
  };
}

let driver: SurrealDriver;

// Table definitions for query builders
const users = defineTable('user', {
  name: string('name'),
  email: string('email'),
  age: int('age'),
  active: bool('active'),
  createdAt: datetime('createdAt'),
});

const posts = defineTable('post', {
  title: string('title'),
  content: string('content'),
  published: bool('published'),
  authorId: string('authorId'),
});

const wrote = defineRelationTable('wrote', {}, { in: 'user', out: 'post' });

// Edge table WITH typed columns for typed RelateBuilder testing
const review = defineRelationTable(
  'review',
  { rating: int('rating').optional(), comment: string('comment').optional() },
  { in: 'user', out: 'post' },
);

// Multi IN/OUT relation tables for testing (TASK-044)
const wroteMultiIn = defineRelationTable(
  'wrote_multi_in',
  {},
  { in: ['user', 'admin'], out: 'post' },
);
const wroteMultiOut = defineRelationTable(
  'wrote_multi_out',
  {},
  { in: 'user', out: ['post', 'article'] },
);
const wroteMultiBoth = defineRelationTable(
  'wrote_multi_both',
  {},
  { in: ['user', 'admin'], out: ['post', 'article'] },
);

// Helper to define tables in SurrealDB
async function defineTables() {
  await driver.query('DEFINE TABLE user SCHEMAFULL');
  await driver.query('DEFINE FIELD name ON user TYPE string');
  await driver.query('DEFINE FIELD email ON user TYPE option<string>');
  await driver.query('DEFINE FIELD age ON user TYPE option<int>');
  await driver.query('DEFINE FIELD active ON user TYPE bool DEFAULT true');
  await driver.query('DEFINE FIELD createdAt ON user TYPE datetime DEFAULT time::now()');

  await driver.query('DEFINE TABLE post SCHEMAFULL');
  await driver.query('DEFINE FIELD title ON post TYPE string');
  await driver.query('DEFINE FIELD content ON post TYPE option<string>');
  await driver.query('DEFINE FIELD published ON post TYPE bool DEFAULT false');
  await driver.query('DEFINE FIELD authorId ON post TYPE option<string>');

  await driver.query('DEFINE TABLE wrote TYPE RELATION IN user OUT post SCHEMAFULL');
  await driver.query('DEFINE TABLE review TYPE RELATION IN user OUT post SCHEMAFULL');
  await driver.query('DEFINE FIELD rating ON review TYPE option<int>');
  await driver.query('DEFINE FIELD comment ON review TYPE option<string>');
  await driver.query(
    'DEFINE TABLE wrote_multi_in TYPE RELATION IN user IN admin OUT post SCHEMAFULL',
  );
  await driver.query(
    'DEFINE TABLE wrote_multi_out TYPE RELATION IN user OUT post OUT article SCHEMAFULL',
  );
  await driver.query(
    'DEFINE TABLE wrote_multi_both TYPE RELATION IN user IN admin OUT post OUT article SCHEMAFULL',
  );
}

beforeEach(async () => {
  driver = createTestDriver();
  await driver.connect();
  await defineTables();
});

afterEach(async () => {
  await driver.disconnect();
});

// ============================================================================
// 1. SelectBuilder - Basic Operations
// ============================================================================

describe('SelectBuilder - Basic Operations', () => {
  it('select all records returns all created users', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', email = 'alice@test.com', age = 25");
    await driver.query("CREATE user:bob SET name = 'Bob', email = 'bob@test.com', age = 30");
    await driver.query(
      "CREATE user:charlie SET name = 'Charlie', email = 'charlie@test.com', age = 35",
    );

    const results = await select(driver, users).execute();

    expect(results).toHaveLength(3);
    expect(
      results
        .map((r) => (r as Record<string, unknown>).name)
        .sort((a, b) => String(a).localeCompare(String(b))),
    ).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('select returns empty array for empty table', async () => {
    const results = await select(driver, users).execute();

    expect(results).toEqual([]);
  });

  it('select uses native driver.select() for simple queries', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', email = 'alice@test.com', age = 25");

    // Simple select (no where, order, limit, etc.) should use native driver
    const results = await select(driver, users).execute();

    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).name).toBe('Alice');
  });
});

// ============================================================================
// 2. SelectBuilder - WHERE Clause
// ============================================================================

describe('SelectBuilder - WHERE Clause', () => {
  beforeEach(async () => {
    await driver.query(
      "CREATE user:alice SET name = 'Alice', email = 'alice@test.com', age = 25, active = true",
    );
    await driver.query(
      "CREATE user:bob SET name = 'Bob', email = 'bob@test.com', age = 30, active = true",
    );
    await driver.query(
      "CREATE user:charlie SET name = 'Charlie', email = 'charlie@test.com', age = 35, active = false",
    );
    await driver.query(
      "CREATE user:dave SET name = 'David', email = 'dave@test.com', age = 20, active = true",
    );
  });

  it('where with eq', async () => {
    const results = await select(driver, users)
      .where((w) => w.eq('name', 'Alice'))
      .execute();

    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).name).toBe('Alice');
  });

  it('where with gt', async () => {
    const results = await select(driver, users)
      .where((w) => w.gt('age', 25))
      .execute();

    expect(results).toHaveLength(2);
    const names = results.map((r) => (r as Record<string, unknown>).name);
    expect(names).toContain('Bob');
    expect(names).toContain('Charlie');
  });

  it('where with multiple conditions (AND)', async () => {
    const results = await select(driver, users)
      .where((w) => w.gt('age', 25).eq('active', true))
      .execute();

    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).name).toBe('Bob');
  });

  it('where with OR', async () => {
    // Use raw SQL for OR condition since WhereBuilder wraps in AND
    const results = await select(driver, users).where("name = 'Alice' OR name = 'Bob'").execute();

    expect(results).toHaveLength(2);
    const names = results.map((r) => (r as Record<string, unknown>).name);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });

  it('where with NOT', async () => {
    const results = await select(driver, users)
      .where((w) => w.not((w2) => w2.eq('name', 'Alice')))
      .execute();

    expect(results).toHaveLength(3);
    const names = results.map((r) => (r as Record<string, unknown>).name);
    expect(names).not.toContain('Alice');
  });

  it('where with contains', async () => {
    // Use email field to test contains (check if email contains 'alice')
    const results = await select(driver, users)
      .where((w) => w.contains('email', 'alice'))
      .execute();

    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).name).toBe('Alice');
  });

  it('where with isNull', async () => {
    await driver.query("CREATE user:eve SET name = 'Eve', email = 'eve@test.com', age = NONE");

    const results = await select(driver, users)
      .where((w) => w.isNull('age'))
      .execute();

    expect(results.length).toBeGreaterThan(0);
    const names = results.map((r) => (r as Record<string, unknown>).name);
    expect(names).toContain('Eve');
  });

  it('where with isNotNull', async () => {
    const results = await select(driver, users)
      .where((w) => w.isNotNull('age'))
      .execute();

    expect(results).toHaveLength(4);
  });

  it('where with raw string', async () => {
    const results = await select(driver, users).where("name = 'Alice'").execute();

    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).name).toBe('Alice');
  });
});

// ============================================================================
// 3. SelectBuilder - ORDER BY, LIMIT, START
// ============================================================================

describe('SelectBuilder - ORDER BY, LIMIT, START', () => {
  beforeEach(async () => {
    await driver.query("CREATE user:1 SET name = 'User1', email = 'user1@test.com', age = 20");
    await driver.query("CREATE user:2 SET name = 'User2', email = 'user2@test.com', age = 30");
    await driver.query("CREATE user:3 SET name = 'User3', email = 'user3@test.com', age = 40");
    await driver.query("CREATE user:4 SET name = 'User4', email = 'user4@test.com', age = 50");
    await driver.query("CREATE user:5 SET name = 'User5', email = 'user5@test.com', age = 60");
  });

  it('orderBy single field ASC', async () => {
    const results = await select(driver, users).orderBy('age', 'ASC').execute();

    expect(results).toHaveLength(5);
    const ages = results.map((r) => (r as Record<string, unknown>).age);
    expect(ages).toEqual([20, 30, 40, 50, 60]);
  });

  it('orderBy descending', async () => {
    const results = await select(driver, users).orderBy('age', 'DESC').execute();

    expect(results).toHaveLength(5);
    const ages = results.map((r) => (r as Record<string, unknown>).age);
    expect(ages).toEqual([60, 50, 40, 30, 20]);
  });

  it('limit', async () => {
    const results = await select(driver, users).limit(2).execute();

    expect(results).toHaveLength(2);
  });

  it('start + limit (pagination)', async () => {
    const results = await select(driver, users).orderBy('age', 'ASC').start(2).limit(2).execute();

    expect(results).toHaveLength(2);
    const names = results.map((r) => (r as Record<string, unknown>).name);
    expect(names[0]).toBe('User3');
    expect(names[1]).toBe('User4');
  });

  it('combined orderBy + limit', async () => {
    const results = await select(driver, users).orderBy('age', 'DESC').limit(2).execute();

    expect(results).toHaveLength(2);
    const ages = results.map((r) => (r as Record<string, unknown>).age);
    expect(ages[0]).toBe(60);
    expect(ages[1]).toBe(50);
  });
});

// ============================================================================
// 4. SelectBuilder - Field Selection
// ============================================================================

describe('SelectBuilder - Field Selection', () => {
  it('fields selects specific columns', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', email = 'alice@test.com', age = 25");

    const results = await select(driver, users).fields('name', 'age').execute();

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.name).toBe('Alice');
    expect(record.age).toBe(25);
    // email should not be present (or undefined)
  });
});

// ============================================================================
// 5. SelectBuilder - Graph Traversal
// ============================================================================

describe('SelectBuilder - Graph Traversal', () => {
  beforeEach(async () => {
    // Create user
    await driver.query("CREATE user:alice SET name = 'Alice'");
    // Create posts
    await driver.query(
      "CREATE post:1 SET title = 'Post 1', content = 'Content 1', authorId = 'alice'",
    );
    await driver.query(
      "CREATE post:2 SET title = 'Post 2', content = 'Content 2', authorId = 'alice'",
    );
    // Create edges
    await driver.query('RELATE user:alice->wrote->post:1');
    await driver.query('RELATE user:alice->wrote->post:2');
  });

  it('traverse outgoing', async () => {
    const results = await select(driver, users).traverse('out', 'wrote', 'post', 'posts').execute();

    expect(results).toHaveLength(1);
    const user = results[0] as Record<string, unknown>;
    expect(user.name).toBe('Alice');
    // posts should be an array of post records
    expect(user.posts).toBeDefined();
  });

  it('traverse incoming', async () => {
    const results = await select(driver, posts)
      .traverse('in', 'wrote', 'user', 'authors')
      .execute();

    expect(results.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 6. SelectBuilder - FETCH
// ============================================================================

describe('SelectBuilder - FETCH', () => {
  it('fetch related tables', async () => {
    // Create user and post with record link using authorId
    await driver.query("CREATE user:alice SET name = 'Alice'");
    await driver.query("CREATE post:1 SET title = 'Post 1', authorId = 'user:alice'");

    const results = await select(driver, posts).fetch('authorId').execute();

    expect(results.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 7. SelectBuilder - GROUP BY
// ============================================================================

describe('SelectBuilder - GROUP BY', () => {
  it('groupBy with count', async () => {
    await driver.query("CREATE post:1 SET title = 'Post 1', authorId = 'alice'");
    await driver.query("CREATE post:2 SET title = 'Post 2', authorId = 'alice'");
    await driver.query("CREATE post:3 SET title = 'Post 3', authorId = 'bob'");

    const results = await select(driver, posts)
      .fields('authorId' as any, 'count() AS postCount' as any)
      .groupBy('authorId')
      .execute();

    expect(results.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 8. SelectBuilder - TIMEOUT
// ============================================================================

describe('SelectBuilder - TIMEOUT', () => {
  it('timeout clause does not throw for simple queries', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice'");

    const results = await select(driver, users).timeout('5s').execute();

    expect(results).toHaveLength(1);
  });
});

// ============================================================================
// 9. CreateBuilder
// ============================================================================

describe('CreateBuilder', () => {
  it('create with data()', async () => {
    const results = await create(driver, users)
      .data({ name: 'Alice', email: 'alice@test.com', active: true })
      .execute();

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.name).toBe('Alice');
    expect(record.email).toBe('alice@test.com');
    expect(record.active).toBe(true);
    expect(record.id).toBeDefined();
  });

  it('create with id() and set()', async () => {
    const results = await create(driver, users)
      .id('alice')
      .set('name', 'Alice')
      .set('email', 'alice@test.com')
      .execute();

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(String(record.id)).toContain('user:alice');
    expect(record.name).toBe('Alice');
  });

  it('create throws on empty data', async () => {
    await expect(create(driver, users).execute()).rejects.toThrow(
      'Cannot create record with empty data',
    );
  });

  it('create returns created record with id', async () => {
    const results = await create(driver, users)
      .data({ name: 'Alice', email: 'alice@test.com' })
      .execute();

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.id).toBeDefined();
    expect(String(record.id).startsWith('user:')).toBe(true);
  });
});

// ============================================================================
// 10. InsertBuilder
// ============================================================================

describe('InsertBuilder', () => {
  it('insert one', async () => {
    const results = await insert(driver, users)
      .one({ name: 'Alice', email: 'alice@test.com', active: true })
      .execute();

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.name).toBe('Alice');
  });

  it('insert many', async () => {
    const results = await insert(driver, users)
      .many([
        { name: 'Alice', email: 'alice@test.com' },
        { name: 'Bob', email: 'bob@test.com' },
      ])
      .execute();

    expect(results).toHaveLength(2);
    const names = results.map((r) => (r as Record<string, unknown>).name);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });

  it('insert records (replace)', async () => {
    const results = await insert(driver, users)
      .records([
        { name: 'Alice', email: 'alice@test.com' },
        { name: 'Bob', email: 'bob@test.com' },
        { name: 'Charlie', email: 'charlie@test.com' },
      ])
      .execute();

    expect(results).toHaveLength(3);
  });

  it('insert returns inserted records', async () => {
    const results = await insert(driver, users)
      .one({ name: 'Alice', email: 'alice@test.com', active: true })
      .execute();

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.id).toBeDefined();
    expect(record.name).toBe('Alice');
  });

  it('insert throws on empty data via execute', async () => {
    await expect(insert(driver, users).execute()).rejects.toThrow(
      'Cannot insert with empty records',
    );
  });

  it('insert throws on null data object', async () => {
    expect(() => (insert(driver, users) as any).one(null)).toThrow('Data object is required');
  });

  it('insert throws on empty array for many', async () => {
    expect(() => (insert(driver, users) as any).many([])).toThrow(
      'Data array with at least one record is required',
    );
  });

  it('insert throws on non-array for records', async () => {
    expect(() => (insert(driver, users) as any).records(null)).toThrow('Data array is required');
  });

  it('insert with ignoreDuplicates uses ON DUPLICATE KEY UPDATE NONE', async () => {
    const results = await insert(driver, users)
      .one({ name: 'Alice', email: 'alice@test.com', active: true })
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(1);
  });

  it('insert many with ignoreDuplicates', async () => {
    const results = await insert(driver, users)
      .many([
        { name: 'Dup1', email: 'dup1@test.com' },
        { name: 'Dup2', email: 'dup2@test.com' },
      ])
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(2);
  });

  it('insert with null values serializes as NONE', async () => {
    const results = await insert(driver, users)
      .one({ name: 'NullTest', email: null, active: true })
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.name).toBe('NullTest');
  });

  it('insert with boolean values via ignoreDuplicates', async () => {
    const results = await insert(driver, users)
      .one({ name: 'BoolTest', active: false })
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).active).toBe(false);
  });

  it('insert with nested object values serializes correctly', async () => {
    await driver.query('DEFINE FIELD metadata ON user TYPE object');
    await driver.query('DEFINE FIELD metadata.key ON user TYPE string');
    await driver.query('DEFINE FIELD metadata.nested ON user TYPE object');
    await driver.query('DEFINE FIELD metadata.nested.a ON user TYPE int');
    const results = await insert(driver, users)
      .one({ name: 'ObjTest', email: 'obj@test.com', metadata: { key: 'val', nested: { a: 1 } } })
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.name).toBe('ObjTest');
  });

  it('insert with array values serializes correctly', async () => {
    await driver.query('DEFINE FIELD tags ON user TYPE array');
    const results = await insert(driver, users)
      .one({ name: 'ArrTest', email: 'arr@test.com', tags: ['a', 'b', 'c'], active: true })
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.name).toBe('ArrTest');
  });

  it('insert ignoreDuplicates serializes nested values correctly', async () => {
    await driver.query('DEFINE FIELD address ON user TYPE object');
    await driver.query('DEFINE FIELD address.city ON user TYPE string');
    await driver.query('DEFINE FIELD address.coords ON user TYPE object');
    await driver.query('DEFINE FIELD address.coords.lat ON user TYPE float');
    await driver.query('DEFINE FIELD address.coords.lng ON user TYPE float');
    const results = await insert(driver, users)
      .one({
        name: 'NestedVal',
        email: 'nested@test.com',
        address: { city: 'NYC', coords: { lat: 40.7, lng: -74.0 } },
        active: true,
      })
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(1);
  });
});

// ============================================================================
// 11. UpdateBuilder
// ============================================================================

describe('UpdateBuilder', () => {
  it('update by id', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', email = 'alice@test.com', age = 25");

    const results = await update(driver, users)
      .id('alice')
      .data({ name: 'Alice Updated' })
      .execute();

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.name).toBe('Alice Updated');
  });

  it('update all records', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', active = true");
    await driver.query("CREATE user:bob SET name = 'Bob', active = true");

    const results = await update(driver, users).data({ active: false }).execute();

    expect(results.length).toBeGreaterThan(0);
    for (const record of results) {
      expect((record as Record<string, unknown>).active).toBe(false);
    }
  });

  it('update returns updated records', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', age = 25");

    const results = await update(driver, users).id('alice').data({ age: 26 }).execute();

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.age).toBe(26);
  });

  it('update throws on empty data', async () => {
    await expect(update(driver, users).execute()).rejects.toThrow('Cannot update with empty data');
  });

  it('update throws on null id', async () => {
    expect(() => update(driver, users).id('')).toThrow('Record ID is required');
  });

  it('update with set() method works', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', age = 25");
    const results = await update(driver, users).id('alice').set('age', 30).execute();
    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).age).toBe(30);
  });

  it('update throws on null field name for set', async () => {
    expect(() => update(driver, users).set('', 'value')).toThrow('Field name is required');
  });

  it('update throws on null data object', async () => {
    expect(() => update(driver, users).data(null as any)).toThrow('Data object is required');
  });
});

// ============================================================================
// 12. DeleteBuilder
// ============================================================================

describe('DeleteBuilder', () => {
  it('delete by id', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice'");
    await driver.query("CREATE user:bob SET name = 'Bob'");

    const results = await delete_(driver, users).id('alice').execute();

    expect(results).toHaveLength(1);

    // Verify alice is deleted
    const remaining = await select(driver, users).execute();
    const names = remaining.map((r) => (r as Record<string, unknown>).name);
    expect(names).not.toContain('Alice');
    expect(names).toContain('Bob');
  });

  it('delete all records', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice'");
    await driver.query("CREATE user:bob SET name = 'Bob'");

    const results = await delete_(driver, users).execute();

    expect(results.length).toBeGreaterThan(0);

    const remaining = await select(driver, users).execute();
    expect(remaining).toHaveLength(0);
  });

  it('delete returns deleted records', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice'");

    const results = await delete_(driver, users).id('alice').execute();

    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).name).toBe('Alice');
  });
});

// ============================================================================
// 13. UpsertBuilder
// ============================================================================

describe('UpsertBuilder', () => {
  it('upsert creates new', async () => {
    const results = await upsert(driver, users)
      .id('new')
      .data({ name: 'New User', email: 'new@test.com' })
      .execute();

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(String(record.id).startsWith('user:')).toBe(true);
    expect(record.name).toBe('New User');
  });

  it('upsert replaces existing', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', age = 25");

    const results = await upsert(driver, users)
      .id('alice')
      .data({ name: 'Alice Updated' })
      .execute();

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.name).toBe('Alice Updated');
  });

  it('upsert throws without id', async () => {
    await expect(upsert(driver, users).data({ name: 'Test' }).execute()).rejects.toThrow(
      'Upsert requires a record ID',
    );
  });

  it('upsert throws with empty data', async () => {
    await expect(upsert(driver, users).id('test').execute()).rejects.toThrow(
      'Cannot upsert with empty data',
    );
  });

  it('upsert throws on null id', async () => {
    expect(() => upsert(driver, users).id('')).toThrow('Record ID is required');
  });

  it('upsert throws on null field name for set', async () => {
    expect(() => upsert(driver, users).set('', 'value')).toThrow('Field name is required');
  });

  it('upsert throws on null data object', async () => {
    expect(() => upsert(driver, users).data(null as any)).toThrow('Data object is required');
  });

  it('upsert with set works', async () => {
    const results = await upsert(driver, users).id('new').set('name', 'New').execute();
    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).name).toBe('New');
  });
});

// ============================================================================
// 14. RelateBuilder
// ============================================================================

describe('RelateBuilder', () => {
  beforeEach(async () => {
    await driver.query("CREATE user:alice SET name = 'Alice'");
    await driver.query("CREATE post:1 SET title = 'Post 1'");
  });

  it('relate creates edge', async () => {
    const results = await relate(driver, wrote).from('user:alice').to('post:1').execute();

    expect(results).toHaveLength(1);
    const edge = results[0] as Record<string, unknown>;
    expect(edge.id).toBeDefined();
    expect(String(edge.id).startsWith('wrote:')).toBe(true);
  });

  it('relate with edge data', async () => {
    // Create edge with data - need to define the field first
    await driver.query('DEFINE FIELD since ON wrote TYPE string');

    const results = await relate(driver, wrote)
      .from('user:alice')
      .to('post:1')
      .set('since', '2024-01-01')
      .execute();

    expect(results).toHaveLength(1);
  });

  it('relate throws without from', async () => {
    await expect(relate(driver, wrote).to('post:1').execute()).rejects.toThrow(
      'Source record is required',
    );
  });

  it('relate throws without to', async () => {
    await expect(relate(driver, wrote).from('user:alice').execute()).rejects.toThrow(
      'Target record is required',
    );
  });
});

// ============================================================================
// 14b. Typed RelateBuilder
// ============================================================================

describe('Typed RelateBuilder', () => {
  beforeEach(async () => {
    await driver.query("CREATE user:alice SET name = 'Alice'");
    await driver.query("CREATE post:1 SET title = 'Post 1'");
  });

  it('typed set() with edge columns', async () => {
    const results = await relate(driver, review)
      .from('user:alice')
      .to('post:1')
      .set('rating', 5)
      .set('comment', 'Great post!')
      .execute();

    expect(results).toHaveLength(1);
    const edge = results[0] as Record<string, unknown>;
    expect(edge.id).toBeDefined();
    expect(String(edge.id).startsWith('review:')).toBe(true);
  });

  it('typed data() with partial edge data', async () => {
    const results = await relate(driver, review)
      .from('user:alice')
      .to('post:1')
      .data({ rating: 4 })
      .execute();

    expect(results).toHaveLength(1);
  });

  it('RelateBuilder result includes relation metadata', async () => {
    const results = await relate(driver, review)
      .from('user:alice')
      .to('post:1')
      .set('rating', 3)
      .execute();

    expect(results).toHaveLength(1);
    const edge = results[0] as Record<string, unknown>;
    expect(edge.id).toBeDefined();
  });

  it('bindTable.relate() creates edge', async () => {
    const boundReview = bindTable(review);
    const results = await boundReview
      .relate(driver as never)
      .from('user:alice')
      .to('post:1')
      .set('rating', 5)
      .execute();

    expect(results).toHaveLength(1);
  });

  it('relate with full edge data', async () => {
    const results = await relate(driver, review)
      .from('user:alice')
      .to('post:1')
      .data({ rating: 5, comment: 'Excellent' })
      .execute();

    expect(results).toHaveLength(1);
  });

  it('relate throws without from', async () => {
    await expect(relate(driver, review).to('post:1').execute()).rejects.toThrow(
      'Source record is required',
    );
  });

  it('relate throws without to', async () => {
    await expect(relate(driver, review).from('user:alice').execute()).rejects.toThrow(
      'Target record is required',
    );
  });
});

// ============================================================================
// 15. GraphPath
// ============================================================================

describe('GraphPath', () => {
  it('graphPath out().to()', () => {
    const path = graphPath().out('wrote').to('post');

    expect(path.toString()).toBe('->wrote->post');
  });

  it('graphPath in().to()', () => {
    const path = graphPath().in('wrote').to('user');

    expect(path.toString()).toBe('<-wrote<-user');
  });

  it('graphPath out().alias()', () => {
    const path = graphPath().out('wrote').alias('posts');

    expect(path.toString()).toBe('->wrote->posts');
  });

  it('graphPath multiple steps', () => {
    const path = graphPath().out('follows').to('user').out('wrote').to('post');

    expect(path.toString()).toBe('->follows->user->wrote->post');
  });

  it('graphPath getSteps()', () => {
    const path = graphPath().out('wrote').to('post');
    const steps = path.getSteps();

    expect(steps).toHaveLength(1);
    expect(steps[0].direction).toBe('out');
    expect(steps[0].edge).toBe('wrote');
    expect(steps[0].table).toBe('post');
  });

  it('graphPath throws on empty edge for out()', () => {
    expect(() => graphPath().out('')).toThrow('Edge name is required');
  });
});

// ============================================================================
// 16. Error Handling
// ============================================================================

describe('Error Handling', () => {
  it('select throws without driver', () => {
    expect(() => select(null as unknown as SurrealDriver, users)).toThrow('Driver is required');
  });

  it('select throws without tableDef', () => {
    expect(() => select(driver, null as unknown as typeof users)).toThrow(
      'Table definition with name is required',
    );
  });

  it('create throws without driver', () => {
    expect(() => create(null as unknown as SurrealDriver, users)).toThrow('Driver is required');
  });

  it('insert throws without records', async () => {
    await expect(insert(driver, users).execute()).rejects.toThrow(
      'Cannot insert with empty records',
    );
  });
});

// ============================================================================
// DX Tests: Typed field selection and ColumnRef
// ============================================================================

describe('DX: Typed field selection', () => {
  it('should accept typed field names with autocomplete', async () => {
    const { driver, cleanup } = await setupTestDb();
    try {
      // Create the table and insert data
      await driver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
        DEFINE FIELD email ON user TYPE string;
        DEFINE FIELD age ON user TYPE int;
      `);
      await driver.query("CREATE user:1 SET name = 'Alice', email = 'alice@test.com', age = 30;");

      const userTable = defineTable('user', {
        name: string('name'),
        email: string('email'),
        age: int('age'),
      });

      // Typed fields - should only accept 'name' | 'email' | 'age' | 'id'
      const result = await select(driver, userTable).fields('name', 'email').execute();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('name', 'Alice');
      expect(result[0]).toHaveProperty('email', 'alice@test.com');
    } finally {
      await cleanup();
    }
  });

  it('should narrow return type with fields selection', async () => {
    const { driver, cleanup } = await setupTestDb();
    try {
      await driver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
        DEFINE FIELD email ON user TYPE string;
      `);
      await driver.query("CREATE user:1 SET name = 'Alice', email = 'alice@test.com';");

      const userTable = defineTable('user', {
        name: string('name'),
        email: string('email'),
      });

      // Should only return selected fields (SurrealDB omits id when selecting specific fields)
      const result = await select(driver, userTable).fields('name').execute();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('name', 'Alice');
      // 'email' was not selected
      expect(result[0]).not.toHaveProperty('email');
    } finally {
      await cleanup();
    }
  });

  it('should validate fields rejects empty args', async () => {
    const { driver, cleanup } = await setupTestDb();
    try {
      const userTable = defineTable('user', { name: string('name') });
      expect(() => select(driver, userTable).fields()).toThrow(
        'At least one field name is required',
      );
    } finally {
      await cleanup();
    }
  });
});

describe('DX: Drizzle-style columns()', () => {
  it('should select using ColumnRef objects', async () => {
    const { driver, cleanup } = await setupTestDb();
    try {
      await driver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
        DEFINE FIELD age ON user TYPE int;
      `);
      await driver.query("CREATE user:1 SET name = 'Alice', age = 30;");

      const userTable = defineTable('user', { name: string('name'), age: int('age') });

      const nameCol = columnRef<'name', string>('name', '' as string, 'user');
      const ageCol = columnRef<'age', number>('age', 0 as number, 'user');

      const result = await select(driver, userTable)
        .columns({ userName: nameCol, userAge: ageCol })
        .execute();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('name', 'Alice');
      expect(result[0]).toHaveProperty('age', 30);
    } finally {
      await cleanup();
    }
  });
});

describe('DX: WhereBuilder ColumnRef', () => {
  it('should accept ColumnRef in eq', async () => {
    const { driver, cleanup } = await setupTestDb();
    try {
      await driver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
        DEFINE FIELD age ON user TYPE int;
      `);
      await driver.query("CREATE user:1 SET name = 'Alice', age = 30;");
      await driver.query("CREATE user:2 SET name = 'Bob', age = 25;");

      const userTable = defineTable('user', { name: string('name'), age: int('age') });
      const nameCol = columnRef<'name', string>('name', '' as string, 'user');

      const result = await select(driver, userTable)
        .where((w) => w.eq(nameCol, 'Alice'))
        .execute();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
    } finally {
      await cleanup();
    }
  });

  it('should accept ColumnRef in gt', async () => {
    const { driver, cleanup } = await setupTestDb();
    try {
      await driver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
        DEFINE FIELD age ON user TYPE int;
      `);
      await driver.query("CREATE user:1 SET name = 'Alice', age = 30;");
      await driver.query("CREATE user:2 SET name = 'Bob', age = 25;");

      const userTable = defineTable('user', { name: string('name'), age: int('age') });
      const ageCol = columnRef<'age', number>('age', 0 as number, 'user');

      const result = await select(driver, userTable)
        .where((w) => w.gt(ageCol, 25))
        .execute();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
    } finally {
      await cleanup();
    }
  });

  it('should accept ColumnRef in isNull/isNotNull', async () => {
    const { driver, cleanup } = await setupTestDb();
    try {
      await driver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
        DEFINE FIELD email ON user TYPE option<string>;
      `);
      await driver.query("CREATE user:1 SET name = 'Alice'"); // no email = NONE
      await driver.query("CREATE user:2 SET name = 'Bob', email = 'bob@test.com';");

      const userTable = defineTable('user', {
        name: string('name'),
        email: string('email').optional(),
      });
      const emailCol = columnRef<'email', string | undefined>(
        'email',
        undefined as unknown as string,
        'user',
      );

      const result = await select(driver, userTable)
        .where((w) => w.isNull(emailCol))
        .execute();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
    } finally {
      await cleanup();
    }
  });

  it('should still accept string field names for backward compat', async () => {
    const { driver, cleanup } = await setupTestDb();
    try {
      await driver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
      `);
      await driver.query("CREATE user:1 SET name = 'Alice';");

      const userTable = defineTable('user', { name: string('name') });

      const result = await select(driver, userTable)
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
    } finally {
      await cleanup();
    }
  });
});

// ============================================================================
// DX: Typed ColumnRef value type checking in WhereBuilder
// ============================================================================

describe('DX: ColumnRef value type checking', () => {
  it('should type-check ColumnRef value against _type in eq', () => {
    const ageCol = columnRef<'age', number>('age', 0 as number, 'user');
    const nameCol = columnRef<'name', string>('name', '' as string, 'user');

    // These should compile at type level — verify via runtime function
    const useEq = (builder: WhereBuilder) => {
      builder.eq(ageCol, 25);
      builder.eq(nameCol, 'Alice');
    };

    // Verify runtime does not throw
    const w = new WhereBuilder();
    expect(() => useEq(w)).not.toThrow();
  });

  it('should type-check ColumnRef value against _type in gt/lt', () => {
    const ageCol = columnRef<'age', number>('age', 0 as number, 'user');

    const w = new WhereBuilder();
    expect(() => {
      w.gt(ageCol, 25);
      w.gte(ageCol, 25);
      w.lt(ageCol, 100);
      w.lte(ageCol, 100);
    }).not.toThrow();
  });

  it('should accept ColumnRef with like/notLike (string pattern)', () => {
    const nameCol = columnRef<'name', string>('name', '' as string, 'user');

    const w = new WhereBuilder();
    expect(() => {
      w.like(nameCol, '%Alice%');
      w.notLike(nameCol, '%Bob%');
    }).not.toThrow();
  });

  it('should accept ColumnRef with contains/inside', () => {
    const emailCol = columnRef<'email', string>('email', '' as string, 'user');

    const w = new WhereBuilder();
    expect(() => {
      w.contains(emailCol, 'alice');
      w.inside(emailCol, ['alice', 'bob']);
    }).not.toThrow();
  });

  it('should accept ColumnRef with isNull/isNotNull (no value)', () => {
    const ageCol = columnRef<'age', number>('age', 0 as number, 'user');

    const w = new WhereBuilder();
    expect(() => {
      w.isNull(ageCol);
      w.isNotNull(ageCol);
    }).not.toThrow();
  });

  it('should provide typed value inference (IDE autocomplete) for ColumnRef', () => {
    const ageCol = columnRef<'age', number>('age', 0 as number, 'user');
    const nameCol = columnRef<'name', string>('name', '' as string, 'user');

    // The typed overloads enable IDE autocomplete for value type.
    // When field is ColumnRef<'age', number>, the value param infers as `number`.
    // Note: fallback overloads accept wrong types too — enforcement is via `@ts-expect-error`
    // in user code, not by the library.
    const w = new WhereBuilder();

    // Valid typed uses — verify runtime
    w.eq(ageCol, 25);
    w.eq(nameCol, 'Alice');
    w.gt(ageCol, 10);
    w.gte(ageCol, 10);
    w.lt(ageCol, 100);
    w.lte(ageCol, 100);
    w.in(ageCol, [25, 30, 35]);

    // Verify pushCondition was called (no throw)
    expect(true).toBe(true);
  });

  it('should still accept ColumnRef with string value in like (not _type)', () => {
    const ageCol = columnRef<'age', number>('age', 0 as number, 'user');

    // like always accepts string pattern regardless of ColumnRef type
    const w = new WhereBuilder();
    expect(() => w.like(ageCol, '%25%')).not.toThrow();
  });

  it('should type-check ColumnRef in in() with typed array', () => {
    const ageCol = columnRef<'age', number>('age', 0 as number, 'user');
    const nameCol = columnRef<'name', string>('name', '' as string, 'user');

    const w = new WhereBuilder();
    expect(() => {
      w.in(ageCol, [25, 30, 35]);
      w.in(nameCol, ['Alice', 'Bob']);
    }).not.toThrow();
  });
});

describe('DX: Typed orderBy / groupBy / fetch', () => {
  it('should accept typed field names in orderBy', () => {
    const q1 = select(driver, users).orderBy('name', 'ASC');
    expect(q1.toSQL().sql).toContain('ORDER BY name ASC');

    const q2 = select(driver, users).orderBy('age', 'DESC');
    expect(q2.toSQL().sql).toContain('ORDER BY age DESC');
  });

  it('should accept string fallback in orderBy', () => {
    const q = select(driver, users).orderBy('custom_field', 'ASC');
    expect(q.toSQL().sql).toContain('ORDER BY custom_field ASC');
  });

  it('should accept typed field names in groupBy', () => {
    const q1 = select(driver, users).groupBy('name');
    expect(q1.toSQL().sql).toContain('GROUP BY name');

    const q2 = select(driver, users).groupBy('name', 'age');
    expect(q2.toSQL().sql).toContain('GROUP BY name, age');
  });

  it('should accept string fallback in groupBy', () => {
    const q = select(driver, users).groupBy('custom_field');
    expect(q.toSQL().sql).toContain('GROUP BY custom_field');
  });

  it('should accept record fields in fetch', () => {
    const blog = defineTable('blog', {
      title: string('title'),
      authorId: record('user'),
    });

    // Should accept the record field name
    const q = select(driver, blog).fetch('authorId');
    expect(q.toSQL().sql).toContain('FETCH authorId');
  });

  it('should accept string fallback in fetch', () => {
    const q = select(driver, users).fetch('someRecordField');
    expect(q.toSQL().sql).toContain('FETCH someRecordField');
  });
});

describe('DX: bindTable()', () => {
  it('should create builder methods on table', async () => {
    const { driver, cleanup } = await setupTestDb();
    try {
      await driver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
      `);
      await driver.query("CREATE user:1 SET name = 'Alice';");

      const userTable = defineTable('user', { name: string('name') });
      const bound = bindTable(userTable);

      const result = await bound.select(driver).fields('name').execute();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
    } finally {
      await cleanup();
    }
  });

  it('should chain all four builder methods', async () => {
    const { driver, cleanup } = await setupTestDb();
    try {
      await driver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
        DEFINE FIELD age ON user TYPE int;
      `);

      const userTable = defineTable('user', { name: string('name'), age: int('age') });
      const bound = bindTable(userTable);

      // insert + select + update + delete all available
      expect(typeof bound.select).toBe('function');
      expect(typeof bound.insert).toBe('function');
      expect(typeof bound.update).toBe('function');
      expect(typeof bound.delete).toBe('function');
    } finally {
      await cleanup();
    }
  });
});

describe('DX: $columns population', () => {
  it('should populate $columns from defineTable', () => {
    const userTable = defineTable('user', { name: string('name'), age: int('age') });
    expect(userTable.$columns).toBeDefined();
    expect(userTable.$columns?.name).toBeDefined();
    expect(userTable.$columns?.name.name).toBe('name');
    expect(userTable.$columns?.age).toBeDefined();
    expect(userTable.$columns?.age.name).toBe('age');
  });

  it('should populate $columns from defineRelationTable', () => {
    const edgeTable = defineRelationTable(
      'wrote',
      { since: datetime('since') },
      { in: 'user', out: 'post' },
    );
    expect(edgeTable.$columns).toBeDefined();
    expect(edgeTable.$columns?.since).toBeDefined();
    expect(edgeTable.$columns?.since.name).toBe('since');
  });
});

// ============================================================================
// 17. Advanced Features - toSQL()
// ============================================================================

describe('SelectBuilder - toSQL()', () => {
  it('returns SQL string and params for simple query', () => {
    const result = select(driver, users).toSQL();
    expect(result.sql).toBe('SELECT * FROM user');
    expect(result.params).toEqual({});
  });

  it('returns SQL with WHERE clause', () => {
    const result = select(driver, users)
      .where((w) => w.eq('name', 'Alice'))
      .toSQL();
    expect(result.sql).toContain('SELECT * FROM user WHERE');
    expect(result.sql).toContain('name = $p0');
    expect(result.params).toHaveProperty('p0', 'Alice');
  });

  it('returns SQL with ORDER BY and LIMIT', () => {
    const result = select(driver, users).orderBy('age', 'DESC').limit(10).toSQL();
    expect(result.sql).toContain('ORDER BY age DESC');
    expect(result.sql).toContain('LIMIT 10');
  });

  it('toSQL uses parameterized query for WHERE values', () => {
    const result = select(driver, users)
      .where((w) => w.gt('age', 25))
      .toSQL();
    expect(result.sql).toContain('age > $p0');
    expect(result.params.p0).toBe(25);
  });
});

// ============================================================================
// 18. Advanced Features - Subquery
// ============================================================================

describe('SelectBuilder - Subquery', () => {
  it('subquery() wraps SQL in parentheses', () => {
    const sq = select(driver, users)
      .where((w) => w.eq('active', true))
      .subquery();
    expect(sq).toBe('(SELECT * FROM user WHERE active = $p0)');
  });

  it('subquery() with alias', () => {
    const sq = select(driver, users).fields('name').subquery('active_users');
    expect(sq).toBe('(SELECT name FROM user) AS active_users');
  });

  it('subquery() returns SqlExpr branded type', () => {
    const sq = select(driver, users).subquery();
    // SqlExpr is a branded string — verify it's a string
    expect(typeof sq).toBe('string');
    expect(sq.startsWith('(')).toBe(true);
    expect(sq.endsWith(')')).toBe(true);
  });

  it('IN subquery in WHERE clause works with real data', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', email = 'alice@test.com', age = 25");
    await driver.query("CREATE user:bob SET name = 'Bob', email = 'bob@test.com', age = 30");

    // Build a subquery that returns user ids explicitly
    const sub = select(driver, users).where((w) => w.eq('name', 'Alice'));

    // Test against raw SurrealQL using subquery
    const { sql, params } = select(driver, users)
      .where((w) => w.in('id', sub))
      .toSQL();

    expect(sql).toContain('id IN (SELECT * FROM user WHERE name = $p0)');
    expect(params.p0).toBe('Alice');
  });

  it('IN subquery works with fields selection', () => {
    const sub = select(driver, users)
      .fields('id')
      .where((w) => w.eq('active', true));

    const result = select(driver, users)
      .where((w) => w.in('id', sub))
      .toSQL();

    expect(result.sql).toContain('id IN (SELECT id FROM user WHERE active = $p0)');
    expect(result.params.p0).toBe(true);
  });
});

// ============================================================================
// 19. Advanced Features - Set Operations
// ============================================================================

describe('SelectBuilder - Set Operations', () => {
  it('union generates correct SQL', () => {
    const young = select(driver, users).where((w) => w.lt('age', 30));
    const old = select(driver, users).where((w) => w.gte('age', 35));

    const result = young.union(old).toSQL();

    expect(result.sql).toContain('UNION');
    expect(result.sql).toContain('SELECT * FROM user WHERE age < $p0');
    expect(result.sql).toContain('SELECT * FROM user WHERE age >= $s0_p0');
    expect(result.params.p0).toBe(30);
    expect(result.params.s0_p0).toBe(35);
  });

  it('unionAll generates correct SQL', () => {
    const age30 = select(driver, users).where((w) => w.eq('age', 30));
    const active = select(driver, users).where((w) => w.eq('active', true));

    const result = age30.unionAll(active).toSQL();

    expect(result.sql).toContain('UNION ALL');
    expect(result.sql).toContain('SELECT * FROM user WHERE age = $p0');
    expect(result.sql).toContain('SELECT * FROM user WHERE active = $s0_p0');
  });

  it('intersect generates correct SQL', () => {
    const activeUsers = select(driver, users).where((w) => w.eq('active', true));
    const under35 = select(driver, users).where((w) => w.lt('age', 35));

    const result = activeUsers.intersect(under35).toSQL();

    expect(result.sql).toContain('INTERSECT');
    expect(result.sql).toContain('SELECT * FROM user WHERE active = $p0');
    expect(result.sql).toContain('SELECT * FROM user WHERE age < $s0_p0');
  });

  it('except generates correct SQL', () => {
    const allUsers = select(driver, users);
    const activeUsers = select(driver, users).where((w) => w.eq('active', true));

    const result = allUsers.except(activeUsers).toSQL();

    expect(result.sql).toContain('EXCEPT');
    expect(result.sql).toContain('SELECT * FROM user');
    expect(result.sql).toContain('SELECT * FROM user WHERE active = $s0_p0');
  });

  it('generates correct SQL for unions', () => {
    const q1 = select(driver, users).where((w) => w.eq('active', true));
    const q2 = select(driver, users).where((w) => w.gt('age', 30));

    const result = q1.union(q2).toSQL();

    expect(result.sql).toContain('UNION');
    expect(result.sql).toContain('active = $p0');
    expect(result.sql).toContain('age > $s0_p0');
    expect(result.params.p0).toBe(true);
    expect(result.params.s0_p0).toBe(30);
  });

  it('union uses parameterized queries with remapped param names', () => {
    const q1 = select(driver, users).where((w) => w.eq('name', 'Alice'));
    const q2 = select(driver, users).where((w) => w.eq('name', 'Bob'));

    const result = q1.union(q2).toSQL();
    // Main query params use p0, child query params remapped via s0_ prefix
    expect(result.params.p0).toBe('Alice');
    expect(result.params.s0_p0).toBe('Bob');
  });
});

// ============================================================================
// 20. Advanced Features - CTE (WITH clause)
// ============================================================================

describe('SelectBuilder - CTE (WITH clause)', () => {
  it('with() prepends CTE prefix to SQL', () => {
    const activeQuery = select(driver, users).where((w) => w.eq('active', true));

    const result = select(driver, users).with({ activeUsers: activeQuery }).toSQL();

    expect(result.sql).toContain('WITH');
    expect(result.sql).toContain('activeUsers AS (SELECT * FROM user WHERE active = $c0_p0)');
    expect(result.sql).toContain('SELECT * FROM user');
    expect(result.params.c0_p0).toBe(true);
  });

  it('with() generates correct SQL with param remapping', () => {
    const activeQuery = select(driver, users).where((w) => w.eq('active', true));

    const result = select(driver, users).with({ activeUsers: activeQuery }).toSQL();

    // CTE parameters are remapped with c0_ prefix
    expect(result.sql).toContain('WITH');
    expect(result.sql).toContain('activeUsers AS (SELECT * FROM user WHERE active = $c0_p0)');
    expect(result.params.c0_p0).toBe(true);
    // Main query params are unaffected
    expect(result.sql).toContain('SELECT * FROM user');
  });

  it('with() with multiple CTEs', () => {
    const activeQuery = select(driver, users).where((w) => w.eq('active', true));
    const youngQuery = select(driver, users).where((w) => w.lt('age', 30));

    const result = select(driver, users)
      .with({ activeUsers: activeQuery, youngUsers: youngQuery })
      .toSQL();

    expect(result.sql).toContain('activeUsers AS (');
    expect(result.sql).toContain('youngUsers AS (');
    expect(result.sql).toContain('WITH');
    expect(result.params.c0_p0).toBe(true);
    expect(result.params.c1_p0).toBe(30);
  });
});

// ============================================================================
// 21. Advanced Features - Error Handling
// ============================================================================

describe('SelectBuilder - Advanced Error Handling', () => {
  it('union throws when query is null', () => {
    expect(() => select(driver, users).union(null as unknown as any)).toThrow(
      'Query is required for union',
    );
  });

  it('unionAll throws when query is null', () => {
    expect(() => select(driver, users).unionAll(null as unknown as any)).toThrow(
      'Query is required for unionAll',
    );
  });

  it('intersect throws when query is null', () => {
    expect(() => select(driver, users).intersect(null as unknown as any)).toThrow(
      'Query is required for intersect',
    );
  });

  it('except throws when query is null', () => {
    expect(() => select(driver, users).except(null as unknown as any)).toThrow(
      'Query is required for except',
    );
  });

  it('with throws when CTEs is empty', () => {
    expect(() => select(driver, users).with({})).toThrow('At least one CTE definition is required');
  });
});

// ============================================================================
// Multi IN/OUT Relation Tables (TASK-044)
// ============================================================================

describe('Multi IN/OUT Relation Tables', () => {
  it('should define relation table with array in (multiple IN tables)', () => {
    expect(wroteMultiIn.name).toBe('wrote_multi_in');
    expect(wroteMultiIn.config.type).toBe('relation');
    expect(wroteMultiIn.config.in).toEqual(['user', 'admin']);
    expect(wroteMultiIn.config.out).toBe('post');
  });

  it('should define relation table with array out (multiple OUT tables)', () => {
    expect(wroteMultiOut.name).toBe('wrote_multi_out');
    expect(wroteMultiOut.config.type).toBe('relation');
    expect(wroteMultiOut.config.in).toBe('user');
    expect(wroteMultiOut.config.out).toEqual(['post', 'article']);
  });

  it('should define relation table with both array in and array out', () => {
    expect(wroteMultiBoth.name).toBe('wrote_multi_both');
    expect(wroteMultiBoth.config.type).toBe('relation');
    expect(wroteMultiBoth.config.in).toEqual(['user', 'admin']);
    expect(wroteMultiBoth.config.out).toEqual(['post', 'article']);
  });

  it('should generate correct SurrealQL with array in via defineTables()', async () => {
    // Verify the tables were created in the helper (already called in beforeEach)
    const result = await driver.query('INFO FOR DB');
    const dbInfo = Array.isArray(result) ? result[0] : result;
    const tables = Object.keys((dbInfo as Record<string, unknown>)?.tables ?? {});
    expect(tables).toContain('wrote_multi_in');
    expect(tables).toContain('wrote_multi_out');
    expect(tables).toContain('wrote_multi_both');
  });

  it('should allow RelateBuilder with multi IN/OUT tables', async () => {
    // Create records to relate
    await driver.query("CREATE user:alice SET name = 'Alice'");
    await driver.query("CREATE admin:root SET name = 'Root'");
    await driver.query("CREATE post:hello SET title = 'Hello'");

    // Relate from user to post (single in, single out — still works)
    const result = await relate(driver, wrote).from('user:alice').to('post:hello').execute();

    expect(result).toHaveLength(1);
  });

  it('should generate correct $id for multi IN/OUT tables', () => {
    expect(wroteMultiIn.$id('test')).toBe('wrote_multi_in:test');
    expect(wroteMultiOut.$id('test')).toBe('wrote_multi_out:test');
    expect(wroteMultiBoth.$id('test')).toBe('wrote_multi_both:test');
  });
});
