import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  createTestDriver,
  users,
  defineTables,
  upsert,
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
// 13. UpsertBuilder
// ============================================================================

describe('UpsertBuilder', () => {
  it('upsert creates new', async () => {
    const results = await upsert(orm, users)
      .data({ name: 'New User', email: 'new@test.com' })
      .execute('new');

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(String(record.id).startsWith('user:')).toBe(true);
    expect(record.name).toBe('New User');
  });

  it('upsert replaces existing', async () => {
    await driver.query("CREATE user:alice SET name = 'Alice', age = 25");

    const results = await upsert(orm, users).data({ name: 'Alice Updated' }).execute('alice');

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.name).toBe('Alice Updated');
  });

  it('upsert throws with empty data', async () => {
    await expect(upsert(orm, users).execute('test')).rejects.toThrow(
      'Cannot upsert with empty data',
    );
  });

  it('upsert throws on empty id', async () => {
    await expect(upsert(orm, users).data({ name: 'Test' }).execute('')).rejects.toThrow();
  });

  it('upsert throws on null field name for set', async () => {
    expect(() => upsert(orm, users).set('', 'value')).toThrow('Field name is required');
  });

  it('upsert throws on null data object', async () => {
    expect(() => upsert(orm, users).data(null as any)).toThrow('Data object is required');
  });

  it('upsert with set works', async () => {
    const results = await upsert(orm, users).set('name', 'New').execute('new');
    expect(results).toHaveLength(1);
    expect((results[0] as Record<string, unknown>).name).toBe('New');
  });
});
