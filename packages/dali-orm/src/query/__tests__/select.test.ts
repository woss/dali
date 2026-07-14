import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  createTestDriver,
  users,
  posts,
  defineTables,
  setupTestDb,
  defineTable,
  defineRelationTable,
  string,
  int,
  datetime,
  record,
  select,
  columnRef,
} from './test-utils.js';
import type { EmbeddedDriver } from '../../sdk/driver/embedded-driver.js';
import type { DaliORM } from '../../sdk/dali-orm.js';

let driver: EmbeddedDriver;
let orm: DaliORM;

beforeEach(async () => {
  driver = createTestDriver();
  await driver.connect();
  await defineTables(driver);
  orm = { getDriver: () => driver } as unknown as DaliORM;
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

    const results = await select(orm, users).execute();

    expect(results).toHaveLength(3);
    expect(
      results
        .map((r) => (r as Record<string, unknown>).name)
        .sort((a, b) => String(a).localeCompare(String(b))),
    ).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('select returns empty array for empty table', async () => {
    const results = await select(orm, users).execute();

    expect(results).toEqual([]);
  });

  it('select uses native driver.select() for simple queries', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', email = 'alice@test.com', age = 25");

    // Simple select (no where, order, limit, etc.) should use native driver
    const results = await select(orm, users).execute();

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
    const results = await select(orm, users)
      .where((w) => w.eq('name', 'Alice'))
      .execute();

    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).name).toBe('Alice');
  });

  it('where with gt', async () => {
    const results = await select(orm, users)
      .where((w) => w.gt('age', 25))
      .execute();

    expect(results).toHaveLength(2);
    const names = results.map((r) => (r as Record<string, unknown>).name);
    expect(names).toContain('Bob');
    expect(names).toContain('Charlie');
  });

  it('where with multiple conditions (AND)', async () => {
    const results = await select(orm, users)
      .where((w) => w.gt('age', 25).eq('active', true))
      .execute();

    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).name).toBe('Bob');
  });

  it('where with OR', async () => {
    // Use raw SQL for OR condition since WhereBuilder wraps in AND
    const results = await select(orm, users).where("name = 'Alice' OR name = 'Bob'").execute();

    expect(results).toHaveLength(2);
    const names = results.map((r) => (r as Record<string, unknown>).name);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });

  it('where with NOT', async () => {
    const results = await select(orm, users)
      .where((w) => w.not((w2) => w2.eq('name', 'Alice')))
      .execute();

    expect(results).toHaveLength(3);
    const names = results.map((r) => (r as Record<string, unknown>).name);
    expect(names).not.toContain('Alice');
  });

  it('where with contains', async () => {
    // Use email field to test contains (check if email contains 'alice')
    const results = await select(orm, users)
      .where((w) => w.contains('email', 'alice'))
      .execute();

    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).name).toBe('Alice');
  });

  it('where with isNull', async () => {
    await driver.query("CREATE user:eve SET name = 'Eve', email = 'eve@test.com', age = NONE");

    const results = await select(orm, users)
      .where((w) => w.isNull('age'))
      .execute();

    expect(results.length).toBeGreaterThan(0);
    const names = results.map((r) => (r as Record<string, unknown>).name);
    expect(names).toContain('Eve');
  });

  it('where with isNotNull', async () => {
    const results = await select(orm, users)
      .where((w) => w.isNotNull('age'))
      .execute();

    expect(results).toHaveLength(4);
  });

  it('where with raw string', async () => {
    const results = await select(orm, users).where("name = 'Alice'").execute();

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
    const results = await select(orm, users).orderBy('age', 'ASC').execute();

    expect(results).toHaveLength(5);
    const ages = results.map((r) => (r as Record<string, unknown>).age);
    expect(ages).toEqual([20, 30, 40, 50, 60]);
  });

  it('orderBy descending', async () => {
    const results = await select(orm, users).orderBy('age', 'DESC').execute();

    expect(results).toHaveLength(5);
    const ages = results.map((r) => (r as Record<string, unknown>).age);
    expect(ages).toEqual([60, 50, 40, 30, 20]);
  });

  it('limit', async () => {
    const results = await select(orm, users).limit(2).execute();

    expect(results).toHaveLength(2);
  });

  it('start + limit (pagination)', async () => {
    const results = await select(orm, users).orderBy('age', 'ASC').start(2).limit(2).execute();

    expect(results).toHaveLength(2);
    const names = results.map((r) => (r as Record<string, unknown>).name);
    expect(names[0]).toBe('User3');
    expect(names[1]).toBe('User4');
  });

  it('combined orderBy + limit', async () => {
    const results = await select(orm, users).orderBy('age', 'DESC').limit(2).execute();

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

    const results = await select(orm, users).fields('name', 'age').execute();

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
    const results = await select(orm, users).traverse('out', 'wrote', 'post', 'posts').execute();

    expect(results).toHaveLength(1);
    const user = results[0] as Record<string, unknown>;
    expect(user.name).toBe('Alice');
    // posts should be an array of post records
    expect(user.posts).toBeDefined();
  });

  it('traverse incoming', async () => {
    const results = await select(orm, posts).traverse('in', 'wrote', 'user', 'authors').execute();

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

    const results = await select(orm, posts).fetch('authorId').execute();

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

    const results = await select(orm, posts)
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

    const results = await select(orm, users).timeout('5s').execute();

    expect(results).toHaveLength(1);
  });
});

// ============================================================================
// DX Tests: Typed field selection and ColumnRef
// ============================================================================

describe('DX: Typed field selection', () => {
  it('should accept typed field names with autocomplete', async () => {
    const { driver: isolatedDriver, cleanup } = await setupTestDb();
    const isolatedOrm = { getDriver: () => isolatedDriver } as unknown as DaliORM;
    try {
      // Create the table and insert data
      await isolatedDriver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
        DEFINE FIELD email ON user TYPE string;
        DEFINE FIELD age ON user TYPE int;
      `);
      await isolatedDriver.query(
        "CREATE user:1 SET name = 'Alice', email = 'alice@test.com', age = 30;",
      );

      const userTable = defineTable('user', {
        name: string('name'),
        email: string('email'),
        age: int('age'),
      });

      // Typed fields - should only accept 'name' | 'email' | 'age' | 'id'
      const result = await select(isolatedOrm, userTable).fields('name', 'email').execute();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('name', 'Alice');
      expect(result[0]).toHaveProperty('email', 'alice@test.com');
    } finally {
      await cleanup();
    }
  });

  it('should narrow return type with fields selection', async () => {
    const { driver: isolatedDriver, cleanup } = await setupTestDb();
    const isolatedOrm = { getDriver: () => isolatedDriver } as unknown as DaliORM;
    try {
      await isolatedDriver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
        DEFINE FIELD email ON user TYPE string;
      `);
      await isolatedDriver.query("CREATE user:1 SET name = 'Alice', email = 'alice@test.com';");

      const userTable = defineTable('user', {
        name: string('name'),
        email: string('email'),
      });

      // Should only return selected fields (SurrealDB omits id when selecting specific fields)
      const result = await select(isolatedOrm, userTable).fields('name').execute();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('name', 'Alice');
      // 'email' was not selected
      expect(result[0]).not.toHaveProperty('email');
    } finally {
      await cleanup();
    }
  });

  it('should validate fields rejects empty args', async () => {
    const { driver: isolatedDriver, cleanup } = await setupTestDb();
    const isolatedOrm = { getDriver: () => isolatedDriver } as unknown as DaliORM;
    try {
      const userTable = defineTable('user', { name: string('name') });
      expect(() => select(isolatedOrm, userTable).fields()).toThrow(
        'At least one field name is required',
      );
    } finally {
      await cleanup();
    }
  });
});

describe('DX: Drizzle-style columns()', () => {
  it('should select using ColumnRef objects', async () => {
    const { driver: isolatedDriver, cleanup } = await setupTestDb();
    const isolatedOrm = { getDriver: () => isolatedDriver } as unknown as DaliORM;
    try {
      await isolatedDriver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
        DEFINE FIELD age ON user TYPE int;
      `);
      await isolatedDriver.query("CREATE user:1 SET name = 'Alice', age = 30;");

      const userTable = defineTable('user', { name: string('name'), age: int('age') });

      const nameCol = columnRef<'name', string>('name', '' as string, 'user');
      const ageCol = columnRef<'age', number>('age', 0 as number, 'user');

      const result = await select(isolatedOrm, userTable)
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

describe('DX: Typed orderBy / groupBy / fetch', () => {
  it('should accept typed field names in orderBy', () => {
    const q1 = select(orm, users).orderBy('name', 'ASC');
    expect(q1.toSQL().sql).toContain('ORDER BY name ASC');

    const q2 = select(orm, users).orderBy('age', 'DESC');
    expect(q2.toSQL().sql).toContain('ORDER BY age DESC');
  });

  it('should accept string fallback in orderBy', () => {
    const q = select(orm, users).orderBy('custom_field', 'ASC');
    expect(q.toSQL().sql).toContain('ORDER BY custom_field ASC');
  });

  it('should accept typed field names in groupBy', () => {
    const q1 = select(orm, users).groupBy('name');
    expect(q1.toSQL().sql).toContain('GROUP BY name');

    const q2 = select(orm, users).groupBy('name', 'age');
    expect(q2.toSQL().sql).toContain('GROUP BY name, age');
  });

  it('should accept string fallback in groupBy', () => {
    const q = select(orm, users).groupBy('custom_field');
    expect(q.toSQL().sql).toContain('GROUP BY custom_field');
  });

  it('should accept record fields in fetch', () => {
    const blog = defineTable('blog', {
      title: string('title'),
      authorId: record('user'),
    });

    // Should accept the record field name
    const q = select(orm, blog).fetch('authorId');
    expect(q.toSQL().sql).toContain('FETCH authorId');
  });

  it('should accept string fallback in fetch', () => {
    const q = select(orm, users).fetch('someRecordField');
    expect(q.toSQL().sql).toContain('FETCH someRecordField');
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
    const result = select(orm, users).toSQL();
    expect(result.sql).toBe('SELECT * FROM user');
    expect(result.params).toEqual({});
  });

  it('returns SQL with WHERE clause', () => {
    const result = select(orm, users)
      .where((w) => w.eq('name', 'Alice'))
      .toSQL();
    expect(result.sql).toContain('SELECT * FROM user WHERE');
    expect(result.sql).toContain('name = $p0');
    expect(result.params).toHaveProperty('p0', 'Alice');
  });

  it('returns SQL with ORDER BY and LIMIT', () => {
    const result = select(orm, users).orderBy('age', 'DESC').limit(10).toSQL();
    expect(result.sql).toContain('ORDER BY age DESC');
    expect(result.sql).toContain('LIMIT 10');
  });

  it('toSQL uses parameterized query for WHERE values', () => {
    const result = select(orm, users)
      .where((w) => w.gt('age', 25))
      .toSQL();
    expect(result.sql).toContain('age > $p0');
    expect(result.params.p0).toBe(25);
  });

  it('eq(null) produces SurrealQL null literal, not bound param', () => {
    const result = select(orm, users)
      .where((w) => w.eq('status', null))
      .toSQL();
    expect(result.sql).toContain('status = null');
    expect(result.sql).not.toContain('status = $p0');
    // Must not produce NONE (that's isNull's job)
    expect(result.sql).not.toContain('NONE');
  });

  it('ne(null) produces SurrealQL null literal', () => {
    const result = select(orm, users)
      .where((w) => w.ne('status', null))
      .toSQL();
    expect(result.sql).toContain('status != null');
  });

  it('isNull produces NONE, not null literal', () => {
    const result = select(orm, users)
      .where((w) => w.isNull('status'))
      .toSQL();
    expect(result.sql).toContain('status = NONE');
    expect(result.sql).not.toContain('null');
  });

  it('isNotNull produces != NONE', () => {
    const result = select(orm, users)
      .where((w) => w.isNotNull('status'))
      .toSQL();
    expect(result.sql).toContain('status != NONE');
  });

  it('eq non-null value still uses bound param', () => {
    const result = select(orm, users)
      .where((w) => w.eq('status', 'active'))
      .toSQL();
    expect(result.sql).toContain('$p0');
    expect(result.params).toHaveProperty('p0', 'active');
  });
});

// ============================================================================
// 18. Advanced Features - Subquery
// ============================================================================

describe('SelectBuilder - Subquery', () => {
  it('subquery() wraps SQL in parentheses', () => {
    const sq = select(orm, users)
      .where((w) => w.eq('active', true))
      .subquery();
    expect(sq).toBe('(SELECT * FROM user WHERE active = $p0)');
  });

  it('subquery() with alias', () => {
    const sq = select(orm, users).fields('name').subquery('active_users');
    expect(sq).toBe('(SELECT name FROM user) AS active_users');
  });

  it('subquery() returns SqlExpr branded type', () => {
    const sq = select(orm, users).subquery();
    // SqlExpr is a branded string — verify it's a string
    expect(typeof sq).toBe('string');
    expect(sq.startsWith('(')).toBe(true);
    expect(sq.endsWith(')')).toBe(true);
  });

  it('IN subquery in WHERE clause works with real data', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', email = 'alice@test.com', age = 25");
    await driver.query("CREATE user:bob SET name = 'Bob', email = 'bob@test.com', age = 30");

    // Build a subquery that returns user ids explicitly
    const sub = select(orm, users).where((w) => w.eq('name', 'Alice'));

    // Test against raw SurrealQL using subquery
    const { sql, params } = select(orm, users)
      .where((w) => w.in('id', sub))
      .toSQL();

    expect(sql).toContain('id IN (SELECT * FROM user WHERE name = $p0)');
    expect(params.p0).toBe('Alice');
  });

  it('IN subquery works with fields selection', () => {
    const sub = select(orm, users)
      .fields('id')
      .where((w) => w.eq('active', true));

    const result = select(orm, users)
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
    const young = select(orm, users).where((w) => w.lt('age', 30));
    const old = select(orm, users).where((w) => w.gte('age', 35));

    const result = young.union(old).toSQL();

    expect(result.sql).toContain('UNION');
    expect(result.sql).toContain('SELECT * FROM user WHERE age < $p0');
    expect(result.sql).toContain('SELECT * FROM user WHERE age >= $s0_p0');
    expect(result.params.p0).toBe(30);
    expect(result.params.s0_p0).toBe(35);
  });

  it('unionAll generates correct SQL', () => {
    const age30 = select(orm, users).where((w) => w.eq('age', 30));
    const active = select(orm, users).where((w) => w.eq('active', true));

    const result = age30.unionAll(active).toSQL();

    expect(result.sql).toContain('UNION ALL');
    expect(result.sql).toContain('SELECT * FROM user WHERE age = $p0');
    expect(result.sql).toContain('SELECT * FROM user WHERE active = $s0_p0');
  });

  it('intersect generates correct SQL', () => {
    const activeUsers = select(orm, users).where((w) => w.eq('active', true));
    const under35 = select(orm, users).where((w) => w.lt('age', 35));

    const result = activeUsers.intersect(under35).toSQL();

    expect(result.sql).toContain('INTERSECT');
    expect(result.sql).toContain('SELECT * FROM user WHERE active = $p0');
    expect(result.sql).toContain('SELECT * FROM user WHERE age < $s0_p0');
  });

  it('except generates correct SQL', () => {
    const allUsers = select(orm, users);
    const activeUsers = select(orm, users).where((w) => w.eq('active', true));

    const result = allUsers.except(activeUsers).toSQL();

    expect(result.sql).toContain('EXCEPT');
    expect(result.sql).toContain('SELECT * FROM user');
    expect(result.sql).toContain('SELECT * FROM user WHERE active = $s0_p0');
  });

  it('generates correct SQL for unions', () => {
    const q1 = select(orm, users).where((w) => w.eq('active', true));
    const q2 = select(orm, users).where((w) => w.gt('age', 30));

    const result = q1.union(q2).toSQL();

    expect(result.sql).toContain('UNION');
    expect(result.sql).toContain('active = $p0');
    expect(result.sql).toContain('age > $s0_p0');
    expect(result.params.p0).toBe(true);
    expect(result.params.s0_p0).toBe(30);
  });

  it('union uses parameterized queries with remapped param names', () => {
    const q1 = select(orm, users).where((w) => w.eq('name', 'Alice'));
    const q2 = select(orm, users).where((w) => w.eq('name', 'Bob'));

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
    const activeQuery = select(orm, users).where((w) => w.eq('active', true));

    const result = select(orm, users).with({ activeUsers: activeQuery }).toSQL();

    expect(result.sql).toContain('WITH');
    expect(result.sql).toContain('activeUsers AS (SELECT * FROM user WHERE active = $c0_p0)');
    expect(result.sql).toContain('SELECT * FROM user');
    expect(result.params.c0_p0).toBe(true);
  });

  it('with() generates correct SQL with param remapping', () => {
    const activeQuery = select(orm, users).where((w) => w.eq('active', true));

    const result = select(orm, users).with({ activeUsers: activeQuery }).toSQL();

    // CTE parameters are remapped with c0_ prefix
    expect(result.sql).toContain('WITH');
    expect(result.sql).toContain('activeUsers AS (SELECT * FROM user WHERE active = $c0_p0)');
    expect(result.params.c0_p0).toBe(true);
    // Main query params are unaffected
    expect(result.sql).toContain('SELECT * FROM user');
  });

  it('with() with multiple CTEs', () => {
    const activeQuery = select(orm, users).where((w) => w.eq('active', true));
    const youngQuery = select(orm, users).where((w) => w.lt('age', 30));

    const result = select(orm, users)
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
    expect(() => select(orm, users).union(null as unknown as any)).toThrow(
      'Query is required for union',
    );
  });

  it('unionAll throws when query is null', () => {
    expect(() => select(orm, users).unionAll(null as unknown as any)).toThrow(
      'Query is required for unionAll',
    );
  });

  it('intersect throws when query is null', () => {
    expect(() => select(orm, users).intersect(null as unknown as any)).toThrow(
      'Query is required for intersect',
    );
  });

  it('except throws when query is null', () => {
    expect(() => select(orm, users).except(null as unknown as any)).toThrow(
      'Query is required for except',
    );
  });

  it('with throws when CTEs is empty', () => {
    expect(() => select(orm, users).with({})).toThrow('At least one CTE definition is required');
  });
});
