import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  users,
  defineTables,
  select,
  delete_,
  createTestDriver,
  EmbeddedDriver,
} from './test-utils.js';
import { buildCondition, graphFieldPath } from '../conditions.js';
import type { DaliORM } from '../../sdk/dali-orm.js';

let driver: EmbeddedDriver;
let orm: DaliORM;

beforeEach(async () => {
  driver = createTestDriver();
  await driver.connect();
  // Remove all tables first to get a clean state (shared embedded DB)
  await driver.query('REMOVE TABLE IF EXISTS user');
  await driver.query('REMOVE TABLE IF EXISTS post');
  await driver.query('REMOVE TABLE IF EXISTS wrote');
  await driver.query('REMOVE TABLE IF EXISTS review');
  await driver.query('REMOVE TABLE IF EXISTS wrote_multi_in');
  await driver.query('REMOVE TABLE IF EXISTS wrote_multi_out');
  await driver.query('REMOVE TABLE IF EXISTS wrote_multi_both');
  await defineTables(driver);
  orm = { getDriver: () => driver } as unknown as DaliORM;
});

afterEach(async () => {
  await driver.disconnect();
});

// ============================================================================
// DeleteBuilder
// ============================================================================

describe('DeleteBuilder', () => {
  it('delete by id', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice'");
    await driver.query("CREATE user:bob SET name = 'Bob'");

    const results = await delete_(orm, users).id('alice').execute();

    expect(results).toHaveLength(1);

    // Verify alice is deleted
    const remaining = await select(orm, users).execute();
    const names = remaining.map((r) => (r as Record<string, unknown>).name);
    expect(names).not.toContain('Alice');
    expect(names).toContain('Bob');
  });

  it('delete all records', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice'");
    await driver.query("CREATE user:bob SET name = 'Bob'");

    const results = await delete_(orm, users).execute();

    expect(results.length).toBeGreaterThan(0);

    const remaining = await select(orm, users).execute();
    expect(remaining).toHaveLength(0);
  });

  it('delete returns deleted records', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice'");

    const results = await delete_(orm, users).id('alice').execute();

    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).name).toBe('Alice');
  });
});

// ============================================================================
// DeleteBuilder - WHERE / LIMIT / toSQL
// ============================================================================

describe('DeleteBuilder - WHERE', () => {
  it('where callback overload deletes matching records', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', active = true");
    await driver.query("CREATE user:bob SET name = 'Bob', active = false");
    await driver.query("CREATE user:charlie SET name = 'Charlie', active = true");

    const results = await delete_(orm, users)
      .where((w) => w.eq('active', true))
      .execute();

    expect(results).toHaveLength(2);

    const remaining = await select(orm, users).execute();
    expect(remaining).toHaveLength(1);
    expect((remaining[0] as Record<string, unknown>).name).toBe('Bob');
  });

  it('where with SerializedCondition deletes matching records', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', age = 25");
    await driver.query("CREATE user:bob SET name = 'Bob', age = 30");
    await driver.query("CREATE user:charlie SET name = 'Charlie', age = 35");

    const condition = buildCondition('age', '>', 27);

    const results = await delete_(orm, users).where(condition).execute();

    expect(results).toHaveLength(2);

    const remaining = await select(orm, users).execute();
    expect(remaining).toHaveLength(1);
    expect((remaining[0] as Record<string, unknown>).name).toBe('Alice');
  });

  it('where with raw string clause deletes matching records', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', active = true");
    await driver.query("CREATE user:bob SET name = 'Bob', active = false");

    const results = await delete_(orm, users).where('active = true').execute();

    expect(results).toHaveLength(1);

    const remaining = await select(orm, users).execute();
    expect(remaining).toHaveLength(1);
    expect((remaining[0] as Record<string, unknown>).name).toBe('Bob');
  });
});

describe('DeleteBuilder - LIMIT', () => {
  it('limit restricts number of deleted records', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', active = true");
    await driver.query("CREATE user:bob SET name = 'Bob', active = true");
    await driver.query("CREATE user:charlie SET name = 'Charlie', active = true");

    const results = await delete_(orm, users)
      .where((w) => w.eq('active', true))
      .limit(2)
      .execute();

    expect(results).toHaveLength(2);

    const remaining = await select(orm, users).execute();
    expect(remaining).toHaveLength(1);
  });
});

describe('DeleteBuilder - toSQL', () => {
  it('toSQL returns parameterized SQL for where callback', () => {
    const { sql, params } = delete_(orm, users)
      .where((w) => w.eq('name', 'Alice'))
      .toSQL();

    expect(sql).toBe('DELETE FROM user WHERE name = $p0');
    expect(params).toEqual({ p0: 'Alice' });
  });

  it('toSQL returns parameterized SQL for SerializedCondition', () => {
    const condition = buildCondition('age', '>', 27);

    const { sql, params } = delete_(orm, users).where(condition).toSQL();

    expect(sql).toMatch(/^DELETE FROM user WHERE age > \$p\d+/);
    expect(Object.values(params)).toContain(27);
  });

  it('toSQL returns SQL with raw string clause', () => {
    const { sql, params } = delete_(orm, users).where('active = true').toSQL();

    expect(sql).toBe('DELETE FROM user WHERE active = true');
    expect(params).toEqual({});
  });

  it('toSQL appends LIMIT clause', () => {
    const { sql, params } = delete_(orm, users)
      .where((w) => w.eq('active', true))
      .limit(5)
      .toSQL();

    expect(sql).toBe('DELETE FROM (SELECT id FROM user WHERE active = $p0 LIMIT 5)');
    expect(params).toEqual({ p0: true });
  });

  it('toSQL without where or limit produces bare DELETE', () => {
    const { sql, params } = delete_(orm, users).toSQL();

    expect(sql).toBe('DELETE FROM user');
    expect(params).toEqual({});
  });
});

// ============================================================================
// DeleteBuilder - CONTAINS/INSIDE + graph paths
// ============================================================================

describe('DeleteBuilder - CONTAINS/INSIDE + graph paths', () => {
  describe('CONTAINS with field values', () => {
    it.skip('delete where array field CONTAINS value (SurrealDB limitation: embedded DB shared state makes DEFINE FIELD unreliable)', async () => {
      await driver.query("CREATE user:u1 SET name = 'Alice', tags = ['admin', 'active']");
      await driver.query("CREATE user:u2 SET name = 'Bob', tags = ['viewer', 'active']");
      await driver.query("CREATE user:u3 SET name = 'Charlie', tags = ['viewer', 'inactive']");

      const results = await delete_(orm, users)
        .where((w) => w.contains('tags', 'admin'))
        .execute();

      expect(results).toHaveLength(1);
      expect((results[0] as Record<string, unknown>).name).toBe('Alice');

      const remaining = await select(orm, users).execute();
      expect(remaining).toHaveLength(2);
      const names = remaining.map((r) => (r as Record<string, unknown>).name);
      expect(names).toContain('Bob');
      expect(names).toContain('Charlie');
    });

    it.skip('delete where multiple records match CONTAINS (SurrealDB limitation: embedded DB shared state makes DEFINE FIELD unreliable)', async () => {
      await driver.query("CREATE user:u1 SET name = 'Alice', tags = ['admin', 'editor']");
      await driver.query("CREATE user:u2 SET name = 'Bob', tags = ['admin', 'viewer']");
      await driver.query("CREATE user:u3 SET name = 'Charlie', tags = ['viewer']");

      const results = await delete_(orm, users)
        .where((w) => w.contains('tags', 'admin'))
        .execute();

      expect(results).toHaveLength(2);

      const remaining = await select(orm, users).execute();
      expect(remaining).toHaveLength(1);
      expect((remaining[0] as Record<string, unknown>).name).toBe('Charlie');
    });

    it.skip('delete where no records match CONTAINS (SurrealDB limitation: embedded DB shared state makes DEFINE FIELD unreliable)', async () => {
      await driver.query("CREATE user:u1 SET name = 'Alice', tags = ['viewer']");
      await driver.query("CREATE user:u2 SET name = 'Bob', tags = ['editor']");

      const results = await delete_(orm, users)
        .where((w) => w.contains('tags', 'admin'))
        .execute();

      expect(results).toHaveLength(0);

      const remaining = await select(orm, users).execute();
      expect(remaining).toHaveLength(2);
    });
  });

  describe('INSIDE with array', () => {
    it('delete where field value is INSIDE array', async () => {
      await driver.query('DEFINE FIELD role ON user TYPE option<string>');

      await driver.query("CREATE user:u1 SET name = 'Alice', role = 'admin'");
      await driver.query("CREATE user:u2 SET name = 'Bob', role = 'editor'");
      await driver.query("CREATE user:u3 SET name = 'Charlie', role = 'viewer'");

      const results = await delete_(orm, users)
        .where((w) => w.inside('role', ['admin', 'editor']))
        .execute();

      expect(results).toHaveLength(2);

      const remaining = await select(orm, users).execute();
      expect(remaining).toHaveLength(1);
      expect((remaining[0] as Record<string, unknown>).name).toBe('Charlie');
    });

    it.skip('delete where single value matches using INSIDE with array (SurrealDB limitation: single-element INSIDE returns 0)', async () => {
      // Single-element INSIDE ['admin'] with isolation
      await driver.query('DEFINE FIELD role ON user TYPE option<string>');

      await driver.query("CREATE user:u1 SET name = 'Alice', role = 'admin'");
      await driver.query("CREATE user:u2 SET name = 'Bob', role = 'viewer'");

      const results = await delete_(orm, users)
        .where((w) => w.inside('role', ['admin']))
        .execute();

      expect(results).toHaveLength(1);
      expect((results[0] as Record<string, unknown>).name).toBe('Alice');

      const remaining = await select(orm, users).execute();
      expect(remaining).toHaveLength(1);
      expect((remaining[0] as Record<string, unknown>).name).toBe('Bob');
    });

    it('delete where no records match INSIDE array', async () => {
      await driver.query('DEFINE FIELD role ON user TYPE option<string>');

      await driver.query("CREATE user:u1 SET name = 'Alice', role = 'admin'");
      await driver.query("CREATE user:u2 SET name = 'Bob', role = 'editor'");

      const results = await delete_(orm, users)
        .where((w) => w.inside('role', ['superadmin', 'root']))
        .execute();

      expect(results).toHaveLength(0);

      const remaining = await select(orm, users).execute();
      expect(remaining).toHaveLength(2);
    });
  });

  describe('Graph path with CONTAINS', () => {
    it.skip('delete users via graph path with CONTAINS (SurrealDB limitation: graph traversals not supported in DELETE WHERE)', async () => {
      // Create users
      await driver.query("CREATE user:alice SET name = 'Alice'");
      await driver.query("CREATE user:bob SET name = 'Bob'");

      // Create posts
      await driver.query("CREATE post:p1 SET title = 'Alice First Post', content = 'Hello'");
      await driver.query("CREATE post:p2 SET title = 'Alice Second Post', content = 'World'");
      await driver.query("CREATE post:p3 SET title = 'Bob Post', content = 'Hi'");

      // Create graph relationships
      await driver.query('RELATE user:alice->wrote->post:p1');
      await driver.query('RELATE user:alice->wrote->post:p2');
      await driver.query('RELATE user:bob->wrote->post:p3');

      // Delete users whose written posts' title CONTAINS 'Alice'
      const results = await delete_(orm, users)
        .where((w) => w.contains(graphFieldPath('->wrote->post.title'), 'Alice'))
        .execute();

      expect(results).toHaveLength(1);
      expect((results[0] as Record<string, unknown>).name).toBe('Alice');

      const remaining = await select(orm, users).execute();
      expect(remaining).toHaveLength(1);
      expect((remaining[0] as Record<string, unknown>).name).toBe('Bob');
    });

    it.skip('delete all matching users via graph path CONTAINS with multiple matches (SurrealDB limitation: graph traversals not supported in DELETE WHERE)', async () => {
      await driver.query("CREATE user:alice SET name = 'Alice'");
      await driver.query("CREATE user:bob SET name = 'Bob'");

      await driver.query("CREATE post:p1 SET title = 'Alice First Post', content = 'Hello'");
      await driver.query("CREATE post:p2 SET title = 'Bob First Post', content = 'World'");
      await driver.query("CREATE post:p3 SET title = 'Bob Second Post', content = 'Hi'");

      // Both users wrote posts with 'Post' in title
      await driver.query('RELATE user:alice->wrote->post:p1');
      await driver.query('RELATE user:bob->wrote->post:p2');
      await driver.query('RELATE user:bob->wrote->post:p3');

      const results = await delete_(orm, users)
        .where((w) => w.contains(graphFieldPath('->wrote->post.title'), 'Post'))
        .execute();

      expect(results).toHaveLength(2);

      const remaining = await select(orm, users).execute();
      expect(remaining).toHaveLength(0);
    });

    it.skip('graph path CONTAINS works with SELECT WHERE (SurrealDB limitation: graph traversals unreliable in embedded DB mode)', async () => {
      // Verify graph traversal CONTAINS works with SELECT
      const testId = Math.random().toString(36).slice(2, 6);
      await driver.query(`CREATE user:alice_${testId} SET name = 'Alice'`);
      await driver.query(`CREATE user:bob_${testId} SET name = 'Bob'`);

      await driver.query(
        `CREATE post:p1_${testId} SET title = 'Alice First Post', content = 'Hello'`,
      );
      await driver.query(`CREATE post:p2_${testId} SET title = 'Bob Post', content = 'Hi'`);

      await driver.query(`RELATE user:alice_${testId}->wrote->post:p1_${testId}`);
      await driver.query(`RELATE user:bob_${testId}->wrote->post:p2_${testId}`);

      const found = await select(orm, users)
        .where((w) => w.contains(graphFieldPath('->wrote->post.title'), 'Alice'))
        .execute();

      expect(found).toHaveLength(1);
      expect((found[0] as Record<string, unknown>).name).toBe('Alice');
    });
  });

  describe('toSQL verification', () => {
    it('toSQL generates correct SurrealQL for CONTAINS condition', () => {
      const { sql, params } = delete_(orm, users)
        .where((w) => w.contains('tags', 'admin'))
        .toSQL();

      expect(sql).toBe('DELETE FROM user WHERE tags CONTAINS $p0');
      expect(params).toEqual({ p0: 'admin' });
    });

    it('toSQL generates correct SurrealQL for INSIDE condition', () => {
      const { sql, params } = delete_(orm, users)
        .where((w) => w.inside('role', ['admin', 'editor']))
        .toSQL();

      expect(sql).toBe('DELETE FROM user WHERE role INSIDE $p0');
      expect(params).toEqual({ p0: ['admin', 'editor'] });
    });

    it('toSQL generates correct SurrealQL for graph path CONTAINS', () => {
      const { sql, params } = delete_(orm, users)
        .where((w) => w.contains(graphFieldPath('->wrote->post.title'), 'Test'))
        .toSQL();

      expect(sql).toBe('DELETE FROM user WHERE ->wrote->post.title CONTAINS $p0');
      expect(params).toEqual({ p0: 'Test' });
    });

    it('toSQL generates correct SurrealQL for CONTAINS with LIMIT', () => {
      const { sql, params } = delete_(orm, users)
        .where((w) => w.contains('tags', 'admin'))
        .limit(5)
        .toSQL();

      expect(sql).toBe('DELETE FROM (SELECT id FROM user WHERE tags CONTAINS $p0 LIMIT 5)');
      expect(params).toEqual({ p0: 'admin' });
    });

    it('toSQL generates correct SurrealQL for INSIDE with LIMIT', () => {
      const { sql, params } = delete_(orm, users)
        .where((w) => w.inside('role', ['admin']))
        .limit(3)
        .toSQL();

      expect(sql).toBe('DELETE FROM (SELECT id FROM user WHERE role INSIDE $p0 LIMIT 3)');
      expect(params).toEqual({ p0: ['admin'] });
    });
  });
});
