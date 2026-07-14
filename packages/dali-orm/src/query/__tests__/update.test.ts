import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  createTestDriver,
  users,
  defineTables,
  update,
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
// 11. UpdateBuilder
// ============================================================================

describe('UpdateBuilder', () => {
  it('update by id', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', email = 'alice@test.com', age = 25");

    const results = await update(orm, users).id('alice').data({ name: 'Alice Updated' }).execute();

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.name).toBe('Alice Updated');
  });

  it('update all records', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', active = true");
    await driver.query("CREATE user:bob SET name = 'Bob', active = true");

    const results = await update(orm, users).data({ active: false }).execute();

    expect(results.length).toBeGreaterThan(0);
    for (const record of results) {
      expect((record as Record<string, unknown>).active).toBe(false);
    }
  });

  it('update returns updated records', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', age = 25");

    const results = await update(orm, users).id('alice').data({ age: 26 }).execute();

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.age).toBe(26);
  });

  it('update throws on empty data', async () => {
    await expect(update(orm, users).execute()).rejects.toThrow('Cannot update with empty data');
  });

  it('update throws on null id', async () => {
    expect(() => update(orm, users).id('')).toThrow('Record ID is required');
  });

  it('update with set() method works', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', age = 25");
    const results = await update(orm, users).id('alice').set('age', 30).execute();
    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).age).toBe(30);
  });

  it('update throws on null field name for set', async () => {
    expect(() => update(orm, users).set('', 'value')).toThrow('Field name is required');
  });

  it('update throws on null data object', async () => {
    expect(() => update(orm, users).data(null as any)).toThrow('Data object is required');
  });
});
