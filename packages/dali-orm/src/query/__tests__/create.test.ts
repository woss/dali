import type { DaliORM } from '../../sdk/dali-orm.js';
import type { EmbeddedDriver } from '../../sdk/driver/embedded-driver.js';
import {
  afterEach,
  beforeEach,
  create,
  createTestDriver,
  defineTables,
  describe,
  expect,
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
// 9. CreateBuilder
// ============================================================================

describe('CreateBuilder', () => {
  it('create with data()', async () => {
    const results = await create(orm, users)
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
    const results = await create(orm, users)
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
    await expect(create(orm, users).execute()).rejects.toThrow(
      'Cannot create record with empty data',
    );
  });

  it('create returns created record with id', async () => {
    const results = await create(orm, users)
      .data({ name: 'Alice', email: 'alice@test.com' })
      .execute();

    expect(results).toHaveLength(1);
    const record = results[0] as Record<string, unknown>;
    expect(record.id).toBeDefined();
    expect(String(record.id).startsWith('user:')).toBe(true);
  });
});
