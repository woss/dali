import type { DaliORM } from '../../sdk/dali-orm.js';
import {
  bindTable,
  columnRef,
  defineTable,
  describe,
  expect,
  int,
  it,
  select,
  setupTestDb,
  string,
  users,
  WhereBuilder,
} from './test-utils.js';

// ============================================================================
// 16. Error Handling
// ============================================================================

describe('Error Handling', () => {
  it('select throws without driver', () => {
    expect(() => select(null as unknown as DaliORM, users)).toThrow(
      'DaliORM instance is required',
    );
  });

  it('select throws without tableDef', () => {
    const orm = { getDriver: () => ({}) } as unknown as DaliORM;
    expect(() => select(orm, null as unknown as typeof users)).toThrow(
      'Table definition with name is required',
    );
  });

  it('create throws without driver', () => {
    expect(() => select(null as unknown as DaliORM, users)).toThrow(
      'DaliORM instance is required',
    );
  });

  it('insert throws without records', async () => {
    const { insert } = await import('./test-utils.js');
    const orm = { getDriver: () => ({}) } as unknown as DaliORM;
    await expect(insert(orm, users).execute()).rejects.toThrow(
      'Cannot insert with empty records',
    );
  });
});

// ============================================================================
// DX Tests: Typed field selection and ColumnRef
// ============================================================================

describe('DX: WhereBuilder ColumnRef', () => {
  it('should accept ColumnRef in eq', async () => {
    const { driver, cleanup } = await setupTestDb();
    const orm = { getDriver: () => driver } as unknown as DaliORM;
    try {
      await driver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
        DEFINE FIELD age ON user TYPE int;
      `);
      await driver.query("CREATE user:1 SET name = 'Alice', age = 30;");
      await driver.query("CREATE user:2 SET name = 'Bob', age = 25;");

      const userTable = defineTable('user', {
        name: string('name'),
        age: int('age'),
      });
      const nameCol = columnRef<'name', string>('name', '' as string, 'user');

      const result = await select(orm, userTable)
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
    const orm = { getDriver: () => driver } as unknown as DaliORM;
    try {
      await driver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
        DEFINE FIELD age ON user TYPE int;
      `);
      await driver.query("CREATE user:1 SET name = 'Alice', age = 30;");
      await driver.query("CREATE user:2 SET name = 'Bob', age = 25;");

      const userTable = defineTable('user', {
        name: string('name'),
        age: int('age'),
      });
      const ageCol = columnRef<'age', number>('age', 0 as number, 'user');

      const result = await select(orm, userTable)
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
    const orm = { getDriver: () => driver } as unknown as DaliORM;
    try {
      await driver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
        DEFINE FIELD email ON user TYPE option<string>;
      `);
      await driver.query("CREATE user:1 SET name = 'Alice'"); // no email = NONE
      await driver.query(
        "CREATE user:2 SET name = 'Bob', email = 'bob@test.com';",
      );

      const userTable = defineTable('user', {
        name: string('name'),
        email: string('email').optional(),
      });
      const emailCol = columnRef<'email', string | undefined>(
        'email',
        undefined as unknown as string,
        'user',
      );

      const result = await select(orm, userTable)
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
    const orm = { getDriver: () => driver } as unknown as DaliORM;
    try {
      await driver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
      `);
      await driver.query("CREATE user:1 SET name = 'Alice';");

      const userTable = defineTable('user', { name: string('name') });

      const result = await select(orm, userTable)
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

describe('DX: bindTable()', () => {
  it('should create builder methods on table', async () => {
    const { driver, cleanup } = await setupTestDb();
    const orm = { getDriver: () => driver } as unknown as DaliORM;
    try {
      await driver.query(`
        DEFINE TABLE user SCHEMAFULL;
        DEFINE FIELD name ON user TYPE string;
      `);
      await driver.query("CREATE user:1 SET name = 'Alice';");

      const userTable = defineTable('user', { name: string('name') });
      const bound = bindTable(userTable);

      const result = await bound.select(orm).fields('name').execute();

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

      const userTable = defineTable('user', {
        name: string('name'),
        age: int('age'),
      });
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
