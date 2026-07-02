/**
 * Integration tests for typed CRUD methods on DaliORM
 *
 * Tests selectFrom, insertInto, updateTable, and deleteFrom
 * against a REAL embedded SurrealDB instance (in-memory).
 * Each test gets a fresh in-memory database for isolation.
 *
 * Notes:
 * - SurrealDB embedded returns RecordId objects for `id` fields, not plain strings
 * - Operations on non-existent tables throw; tables are auto-created on first INSERT
 */
import { afterEach, beforeEach, describe, expect, it, expectTypeOf } from 'vite-plus/test';
import { DaliORM } from '../dali-orm.js';
import { defineTable } from '../table.js';
import { string, int, bool, datetime, record } from '../schema/column/index.js';
import type { InferSelectResult, InferInsertData, InferUpdateData } from '../infer-types.js';

// =============================================================================
// Test table definition
// =============================================================================

const users = defineTable('user', {
  name: string('name'),
  email: string('email'),
  age: int('age'),
  active: bool('active'),
});

// =============================================================================
// Helpers
// =============================================================================

let counter = 0;

async function createOrm(): Promise<DaliORM> {
  counter++;
  return DaliORM.connect({
    embeddedDriver: {
      driver: 'embedded',
      namespace: 'integ_test_ns',
      database: `integ_test_db_${Date.now()}_${counter}`,
      mode: 'memory',
    },
  });
}

/**
 * Ensure a table exists by inserting then deleting a seed record.
 *
 * SurrealDB embedded throws on select/update/delete from non-existent tables.
 * A table must have been created (via INSERT or DEFINE TABLE) before you
 * can select/update/delete from it, even when empty.
 */
async function ensureTableExists(orm: DaliORM): Promise<void> {
  const inserted = await orm.insertInto(users, [
    { name: '__seed__', email: 'seed@test.com', age: 0, active: false },
  ]);
  if (inserted.length > 0 && inserted[0].id) {
    await orm.deleteFrom(users);
  }
}

// =============================================================================
// insertInto — typed insert
// =============================================================================

describe('insertInto', () => {
  let orm: DaliORM;

  beforeEach(async () => {
    orm = await createOrm();
  });

  afterEach(async () => {
    await orm.disconnect();
  });

  it('inserts a single record and returns typed result with id', async () => {
    const result = await orm.insertInto(users, [
      { name: 'Alice', email: 'alice@test.com', age: 30, active: true },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('id');
    expect(result[0].id).toBeTruthy();
    expect(String(result[0].id)).toMatch(/^user:/);
    expect(result[0].name).toBe('Alice');
    expect(result[0].email).toBe('alice@test.com');
    expect(result[0].age).toBe(30);
    expect(result[0].active).toBe(true);
  });

  it('inserts multiple records at once', async () => {
    const result = await orm.insertInto(users, [
      { name: 'Alice', email: 'alice@test.com', age: 30, active: true },
      { name: 'Bob', email: 'bob@test.com', age: 25, active: false },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Alice');
    expect(result[1].name).toBe('Bob');
  });

  it('inserted data persists and can be retrieved with selectFrom', async () => {
    await orm.insertInto(users, [
      { name: 'Charlie', email: 'charlie@test.com', age: 35, active: true },
    ]);

    const records = await orm.selectFrom(users);
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('Charlie');
    expect(records[0].email).toBe('charlie@test.com');
    expect(records[0].age).toBe(35);
    expect(records[0].active).toBe(true);
  });
});

// =============================================================================
// selectFrom — typed select
// =============================================================================

describe('selectFrom', () => {
  let orm: DaliORM;

  beforeEach(async () => {
    orm = await createOrm();
  });

  afterEach(async () => {
    await orm.disconnect();
  });

  it('returns empty array for a table that exists but has no records', async () => {
    await ensureTableExists(orm);
    const result = await orm.selectFrom(users);
    expect(result).toEqual([]);
  });

  it('returns all records from a table with correct shape', async () => {
    await orm.insertInto(users, [
      { name: 'Alice', email: 'alice@test.com', age: 30, active: true },
    ]);

    const result = await orm.selectFrom(users);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('id');
    expect(result[0].id).toBeTruthy();
    expect(result[0]).toEqual(
      expect.objectContaining({
        name: 'Alice',
        email: 'alice@test.com',
        age: 30,
        active: true,
      }),
    );
  });

  it('returns multiple records', async () => {
    await orm.insertInto(users, [
      { name: 'Alice', email: 'alice@test.com', age: 30, active: true },
      { name: 'Bob', email: 'bob@test.com', age: 25, active: false },
      { name: 'Charlie', email: 'charlie@test.com', age: 35, active: true },
    ]);

    const result = await orm.selectFrom(users);
    expect(result).toHaveLength(3);
  });

  it('returns typed results with exact field values', async () => {
    await orm.insertInto(users, [
      { name: 'Alice', email: 'alice@test.com', age: 30, active: true },
    ]);

    const record = (await orm.selectFrom(users))[0];

    // Exact value assertions (not toBeTruthy/toBeDefined)
    expect(record.name).toBe('Alice');
    expect(record.email).toBe('alice@test.com');
    expect(record.age).toBe(30);
    expect(record.active).toBe(true);
    expect(record.id).toBeTruthy();
    expect(String(record.id)).toContain('user:');
  });
});

// =============================================================================
// updateTable — typed update (all fields optional via Partial)
// =============================================================================

describe('updateTable', () => {
  let orm: DaliORM;

  beforeEach(async () => {
    orm = await createOrm();
  });

  afterEach(async () => {
    await orm.disconnect();
  });

  it('updates all records in a table and returns typed result', async () => {
    await orm.insertInto(users, [
      { name: 'Alice', email: 'alice@test.com', age: 30, active: true },
    ]);

    const updated = await orm.updateTable(users, { age: 31 });
    expect(updated).toHaveLength(1);
    expect(updated[0].age).toBe(31);

    // Verify update persisted via separate query
    const records = await orm.selectFrom(users);
    expect(records[0].age).toBe(31);
    // Non-updated fields remain unchanged
    expect(records[0].name).toBe('Alice');
    expect(records[0].email).toBe('alice@test.com');
    expect(records[0].active).toBe(true);
  });

  it('supports partial update with only some fields', async () => {
    await orm.insertInto(users, [
      { name: 'Alice', email: 'alice@test.com', age: 30, active: true },
    ]);

    const updated = await orm.updateTable(users, { active: false });
    expect(updated).toHaveLength(1);
    expect(updated[0].active).toBe(false);

    // Verify only the specified fields changed
    const records = await orm.selectFrom(users);
    expect(records[0].active).toBe(false);
    expect(records[0].name).toBe('Alice');
    expect(records[0].age).toBe(30);
  });

  it('returns empty array when table has no records', async () => {
    // Create the table first so update doesn't throw "table does not exist"
    await ensureTableExists(orm);
    const result = await orm.updateTable(users, { name: 'Nobody' });
    expect(result).toEqual([]);
  });
});

// =============================================================================
// deleteFrom — typed delete
// =============================================================================

describe('deleteFrom', () => {
  let orm: DaliORM;

  beforeEach(async () => {
    orm = await createOrm();
  });

  afterEach(async () => {
    await orm.disconnect();
  });

  it('deletes all records and returns them', async () => {
    await orm.insertInto(users, [
      { name: 'Alice', email: 'alice@test.com', age: 30, active: true },
    ]);

    const deleted = await orm.deleteFrom(users);
    expect(deleted).toHaveLength(1);
    expect(deleted[0].name).toBe('Alice');

    // Verify table is now empty
    const records = await orm.selectFrom(users);
    expect(records).toEqual([]);
  });

  it('deletes multiple records', async () => {
    await orm.insertInto(users, [
      { name: 'Alice', email: 'alice@test.com', age: 30, active: true },
      { name: 'Bob', email: 'bob@test.com', age: 25, active: false },
    ]);

    const deleted = await orm.deleteFrom(users);
    expect(deleted).toHaveLength(2);

    const records = await orm.selectFrom(users);
    expect(records).toEqual([]);
  });

  it('returns empty array when table has no records', async () => {
    // Create the table first so delete doesn't throw "table does not exist"
    await ensureTableExists(orm);
    const result = await orm.deleteFrom(users);
    expect(result).toEqual([]);
  });
});

// =============================================================================
// Full CRUD lifecycle
// =============================================================================

describe('CRUD lifecycle', () => {
  let orm: DaliORM;

  beforeEach(async () => {
    orm = await createOrm();
  });

  afterEach(async () => {
    await orm.disconnect();
  });

  it('performs full insert → select → update → delete cycle', async () => {
    // Insert
    const inserted = await orm.insertInto(users, [
      { name: 'Alice', email: 'alice@test.com', age: 30, active: true },
    ]);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].name).toBe('Alice');

    // Select
    const selected = await orm.selectFrom(users);
    expect(selected).toHaveLength(1);
    expect(selected[0].name).toBe('Alice');

    // Update
    const updated = await orm.updateTable(users, { age: 31 });
    expect(updated[0].age).toBe(31);
    const afterUpdate = await orm.selectFrom(users);
    expect(afterUpdate[0].age).toBe(31);
    expect(afterUpdate[0].name).toBe('Alice');

    // Delete
    const deleted = await orm.deleteFrom(users);
    expect(deleted).toHaveLength(1);
    const afterDelete = await orm.selectFrom(users);
    expect(afterDelete).toEqual([]);
  });
});

// =============================================================================
// Type safety verification (compile-time assertions)
// =============================================================================

describe('type safety', () => {
  it('InferSelectResult includes id:string plus typed columns', () => {
    type UserSelect = InferSelectResult<typeof users>;
    expectTypeOf<UserSelect>().toHaveProperty('id');
    expectTypeOf<UserSelect['id']>().toEqualTypeOf<string>();
    expectTypeOf<UserSelect['name']>().toEqualTypeOf<string>();
    expectTypeOf<UserSelect['email']>().toEqualTypeOf<string>();
    expectTypeOf<UserSelect['age']>().toEqualTypeOf<number>();
    expectTypeOf<UserSelect['active']>().toEqualTypeOf<boolean>();
  });

  it('InferInsertData excludes id and includes field types', () => {
    type UserInsert = InferInsertData<typeof users>;
    // id should NOT be present in insert data (auto-generated)
    expectTypeOf<{
      name: string;
      email: string;
      age: number;
      active: boolean;
    }>().toMatchTypeOf<UserInsert>();
  });

  it('InferUpdateData makes all fields optional (Partial)', () => {
    type UserUpdate = InferUpdateData<typeof users>;
    type UserSelect = InferSelectResult<typeof users>;

    // Update is Partial of Select
    expectTypeOf<UserUpdate>().toEqualTypeOf<Partial<UserSelect>>();
  });

  it('updateTable accepts Partial update data', () => {
    // Verify Partial nature — all fields optional
    type UserUpdate = InferUpdateData<typeof users>;
    expectTypeOf<UserUpdate['age']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<UserUpdate['name']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<UserUpdate['active']>().toEqualTypeOf<boolean | undefined>();
  });
});
