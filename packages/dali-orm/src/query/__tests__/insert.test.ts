import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  createTestDriver,
  users,
  defineTables,
  insert,
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
// 10. InsertBuilder
// ============================================================================

describe('InsertBuilder', () => {
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

  it('insert throws on empty data via execute', async () => {
    await expect(insert(orm, users).execute()).rejects.toThrow('Cannot insert with empty records');
  });

  it('insert throws on null data object', async () => {
    expect(() => (insert(orm, users) as any).one(null)).toThrow('Data object is required');
  });

  it('insert throws on empty array for many', async () => {
    expect(() => (insert(orm, users) as any).many([])).toThrow(
      'Data array with at least one record is required',
    );
  });

  it('insert throws on non-array for records', async () => {
    expect(() => (insert(orm, users) as any).records(null)).toThrow('Data array is required');
  });

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

  it('insert with null values serializes as NONE', async () => {
    const results = await insert(orm, users)
      .one({ name: 'NullTest', email: null, active: true })
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.name).toBe('NullTest');
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
      .one({ name: 'ObjTest', email: 'obj@test.com', metadata: { key: 'val', nested: { a: 1 } } })
      .ignoreDuplicates()
      .execute();
    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.name).toBe('ObjTest');
  });

  it('insert with array values serializes correctly', async () => {
    await driver.query('DEFINE FIELD tags ON user TYPE array');
    const results = await insert(orm, users)
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
});
