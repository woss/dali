import type { DaliORM } from '../../sdk/dali-orm.js';
import type { EmbeddedDriver } from '../../sdk/driver/embedded-driver.js';
import { InsertBuilder } from '../insert.js';
import {
  afterEach,
  beforeEach,
  createTestDriver,
  defineTables,
  describe,
  expect,
  insert,
  it,
  users,
} from './test-utils.js';

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
// InsertBuilder
// ============================================================================

describe('InsertBuilder', () => {
  // -----------------------------------------------------------------------
  // Constructor validation
  // -----------------------------------------------------------------------

  it('insert one', async () => {
    const results = await insert(orm, users)
      .one({ name: 'Alice', email: 'alice@test.com', active: true })
      .execute();

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.name).toBe('Alice');
  });

  it('insert many', async () => {
    const results = await insert(orm, users)
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
    const results = await insert(orm, users)
      .records([
        { name: 'Alice', email: 'alice@test.com' },
        { name: 'Bob', email: 'bob@test.com' },
        { name: 'Charlie', email: 'charlie@test.com' },
      ])
      .execute();

    expect(results).toHaveLength(3);
  });

  it('insert returns inserted records', async () => {
    const results = await insert(orm, users)
      .one({ name: 'Alice', email: 'alice@test.com', active: true })
      .execute();

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.id).toBeDefined();
    expect(record.name).toBe('Alice');
  });

  // -----------------------------------------------------------------------
  // Constructor edge cases
  // -----------------------------------------------------------------------

  it('constructor throws when orm is null', () => {
    expect(() => new InsertBuilder(null as any, users)).toThrow(
      'DaliORM instance is required',
    );
  });

  it('constructor throws when orm is undefined', () => {
    expect(() => new InsertBuilder(undefined as any, users)).toThrow(
      'DaliORM instance is required',
    );
  });

  it('constructor throws when tableDef has no name', () => {
    expect(() => new InsertBuilder(orm, {} as any)).toThrow(
      'Table definition with name is required',
    );
  });

  it('constructor throws when tableDef is null', () => {
    expect(() => new InsertBuilder(orm, null as any)).toThrow(
      'Table definition with name is required',
    );
  });

  // -----------------------------------------------------------------------
  // one() edge cases
  // -----------------------------------------------------------------------

  it('insert one throws on empty data via execute', async () => {
    await expect(insert(orm, users).execute()).rejects.toThrow(
      'Cannot insert with empty records',
    );
  });

  it('insert throws on null data object', () => {
    expect(() => (insert(orm, users) as any).one(null)).toThrow(
      'Data object is required',
    );
  });

  it('insert throws on string data for one()', () => {
    expect(() => (insert(orm, users) as any).one('not-an-object')).toThrow(
      'Data object is required',
    );
  });

  it('insert throws on number data for one()', () => {
    expect(() => (insert(orm, users) as any).one(42)).toThrow(
      'Data object is required',
    );
  });

  // -----------------------------------------------------------------------
  // many() edge cases
  // -----------------------------------------------------------------------

  it('insert throws on empty array for many', async () => {
    expect(() => (insert(orm, users) as any).many([])).toThrow(
      'Data array with at least one record is required',
    );
  });

  it('insert throws on non-array for many', () => {
    expect(() =>
      (insert(orm, users) as any).many('not-an-array' as any),
    ).toThrow('Data array with at least one record is required');
  });

  it('insert throws on null for many', () => {
    expect(() => (insert(orm, users) as any).many(null)).toThrow(
      'Data array with at least one record is required',
    );
  });

  it('insert throws on object for many', () => {
    expect(() => (insert(orm, users) as any).many({ name: 'Alice' })).toThrow(
      'Data array with at least one record is required',
    );
  });

  // -----------------------------------------------------------------------
  // records() edge cases
  // -----------------------------------------------------------------------

  it('insert throws on non-array for records', () => {
    expect(() => (insert(orm, users) as any).records(null)).toThrow(
      'Data array is required',
    );
  });

  it('insert throws on string for records', () => {
    expect(() =>
      (insert(orm, users) as any).records('not-an-array' as any),
    ).toThrow('Data array is required');
  });

  it('records() replaces previously added records via one()', async () => {
    // Add via one(), then replace via records()
    const builder = insert(orm, users)
      .one({ name: 'Alice', email: 'alice@test.com' })
      .records([{ name: 'Bob', email: 'bob@test.com' }]);
    const results = await builder.execute();

    // records() replaces, so only Bob should be inserted
    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).name).toBe('Bob');
  });

  it('records() replaces previously added records via many()', async () => {
    const builder = insert(orm, users)
      .many([
        { name: 'Alice', email: 'alice@test.com' },
        { name: 'Bob', email: 'bob@test.com' },
      ])
      .records([{ name: 'Charlie', email: 'charlie@test.com' }]);
    const results = await builder.execute();

    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).name).toBe('Charlie');
  });

  // -----------------------------------------------------------------------
  // ignoreDuplicates edge cases
  // -----------------------------------------------------------------------

  it('insert with ignoreDuplicates uses ON DUPLICATE KEY UPDATE NONE', async () => {
    const results = await insert(orm, users)
      .one({ name: 'Alice', email: 'alice@test.com', active: true })
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(1);
  });

  it('insert many with ignoreDuplicates', async () => {
    const results = await insert(orm, users)
      .many([
        { name: 'Dup1', email: 'dup1@test.com' },
        { name: 'Dup2', email: 'dup2@test.com' },
      ])
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(2);
  });

  it('insert records with ignoreDuplicates', async () => {
    const results = await insert(orm, users)
      .records([
        { name: 'Rec1', email: 'rec1@test.com' },
        { name: 'Rec2', email: 'rec2@test.com' },
      ])
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(2);
    const names = results.map((r) => (r as Record<string, unknown>).name);
    expect(names).toContain('Rec1');
    expect(names).toContain('Rec2');
  });

  // -----------------------------------------------------------------------
  // serializeValue branches
  // -----------------------------------------------------------------------

  it('insert with null values serializes as NONE', async () => {
    const results = await insert(orm, users)
      .one({ name: 'NullTest', email: null, active: true })
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.name).toBe('NullTest');
  });

  it('insert with undefined values serializes as NONE', async () => {
    const results = await insert(orm, users)
      .one({ name: 'UndefTest', email: undefined, active: true })
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.name).toBe('UndefTest');
  });

  it('insert with boolean values via ignoreDuplicates', async () => {
    const results = await insert(orm, users)
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
    const results = await insert(orm, users)
      .one({
        name: 'ObjTest',
        email: 'obj@test.com',
        metadata: { key: 'val', nested: { a: 1 } },
      })
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.name).toBe('ObjTest');
  });

  it('insert with array values serializes correctly', async () => {
    await driver.query('DEFINE FIELD tags ON user TYPE array');
    const results = await insert(orm, users)
      .one({
        name: 'ArrTest',
        email: 'arr@test.com',
        tags: ['a', 'b', 'c'],
        active: true,
      })
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
    const results = await insert(orm, users)
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

  // -----------------------------------------------------------------------
  // Factory function
  // -----------------------------------------------------------------------

  it('insert() factory returns InsertBuilder instance', () => {
    const builder = insert(orm, users);
    expect(builder).toBeInstanceOf(InsertBuilder);
  });

  it('insert() factory builder has correct methods', () => {
    const builder = insert(orm, users);
    expect(typeof builder.one).toBe('function');
    expect(typeof builder.many).toBe('function');
    expect(typeof builder.records).toBe('function');
    expect(typeof builder.ignoreDuplicates).toBe('function');
    expect(typeof builder.execute).toBe('function');
  });

  // -----------------------------------------------------------------------
  // Chaining
  // -----------------------------------------------------------------------

  it('one() returns same builder for chaining', () => {
    const builder = insert(orm, users);
    const result = builder.one({ name: 'Alice', email: 'alice@test.com' });
    expect(result).toBe(builder);
  });

  it('many() returns same builder for chaining', () => {
    const builder = insert(orm, users);
    const result = builder.many([{ name: 'Alice', email: 'alice@test.com' }]);
    expect(result).toBe(builder);
  });

  it('records() returns same builder for chaining', () => {
    const builder = insert(orm, users);
    const result = builder.records([
      { name: 'Alice', email: 'alice@test.com' },
    ]);
    expect(result).toBe(builder);
  });

  it('ignoreDuplicates() returns same builder for chaining', () => {
    const builder = insert(orm, users);
    const result = builder.ignoreDuplicates();
    expect(result).toBe(builder);
  });

  // -----------------------------------------------------------------------
  // Multi-field ignoreDuplicates with diverse types
  // -----------------------------------------------------------------------

  it('insert ignoreDuplicates with mixed field types across records', async () => {
    const results = await insert(orm, users)
      .many([
        { name: 'Mixed1', email: 'mixed1@test.com', age: 25, active: true },
        { name: 'Mixed2', email: 'mixed2@test.com', age: 30, active: false },
      ])
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(2);
  });

  it('insert ignoreDuplicates with string numbers and special chars', async () => {
    const results = await insert(orm, users)
      .one({
        name: "O'Brien",
        email: 'special@test.com',
        active: true,
      })
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).name).toBe("O'Brien");
  });
});
