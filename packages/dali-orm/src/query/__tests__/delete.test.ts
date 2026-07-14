import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  createTestDriver,
  users,
  defineTables,
  select,
  delete_,
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
// 12. DeleteBuilder
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
