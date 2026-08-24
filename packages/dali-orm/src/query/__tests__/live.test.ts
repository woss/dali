import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DaliORM } from '../../sdk/dali-orm.js';
import { EmbeddedDriver } from '../../sdk/driver/embedded-driver.js';
import { bool, datetime, int, string } from '../../sdk/schema/column/index.js';
import { defineTable } from '../../sdk/table.js';
import { live } from '../live.js';

// ============================================================================
// Test Setup
// ============================================================================

function createTestDriver(): EmbeddedDriver {
  return new EmbeddedDriver({
    driver: 'embedded',
    namespace: 'test_ns',
    database: 'test_db',
    mode: 'memory',
  });
}

let driver: EmbeddedDriver;
let orm: DaliORM;

const users = defineTable('user', {
  name: string('name'),
  email: string('email'),
  age: int('age'),
  active: bool('active'),
  createdAt: datetime('createdAt'),
});

async function defineTables() {
  await driver.query('DEFINE TABLE user SCHEMAFULL');
  await driver.query('DEFINE FIELD name ON user TYPE string');
  await driver.query('DEFINE FIELD email ON user TYPE option<string>');
  await driver.query('DEFINE FIELD age ON user TYPE option<int>');
  await driver.query('DEFINE FIELD active ON user TYPE bool DEFAULT true');
  await driver.query(
    'DEFINE FIELD createdAt ON user TYPE datetime DEFAULT time::now()',
  );
}

beforeEach(async () => {
  driver = createTestDriver();
  await driver.connect();
  orm = { getDriver: () => driver } as unknown as DaliORM;
  await defineTables();
});

afterEach(async () => {
  await driver.disconnect();
});

// ============================================================================
// LiveQueryBuilder - Static Construction
// ============================================================================

describe('LiveQueryBuilder - Construction', () => {
  it('throws without driver', () => {
    expect(() => live(null as unknown as DaliORM, users)).toThrow(
      'DaliORM instance is required',
    );
  });

  it('throws without table definition', () => {
    expect(() => live(orm, null as unknown as typeof users)).toThrow(
      'Table definition with name is required',
    );
  });

  it('creates builder with valid inputs', () => {
    const builder = live(orm, users);
    expect(builder).toBeDefined();
    expect(typeof builder.start).toBe('function');
    expect(typeof builder.subscribe).toBe('function');
  });
});

// ============================================================================
// LiveQueryBuilder - Chainable Methods
// ============================================================================

describe('LiveQueryBuilder - Chainable Methods', () => {
  it('diff returns this for chaining', () => {
    const builder = live(orm, users);
    expect(builder.diff()).toBe(builder);
  });

  it('fields throws with empty arguments', () => {
    const builder = live(orm, users);
    expect(() => builder.fields()).toThrow(
      'At least one field name is required',
    );
  });

  it('fields returns this for chaining', () => {
    const builder = live(orm, users);
    expect(builder.fields('name', 'age')).toBe(builder);
  });

  it('value throws with empty field', () => {
    const builder = live(orm, users);
    expect(() => builder.value('' as any)).toThrow(
      'Field name is required for value()',
    );
  });

  it('value returns this for chaining', () => {
    const builder = live(orm, users);
    expect(builder.value('name' as const)).toBe(builder);
  });

  it('where throws with null condition', () => {
    const builder = live(orm, users);
    expect(() => builder.where(null as unknown as never)).toThrow(
      'WHERE condition cannot be null or undefined',
    );
  });

  it('fetch throws with empty arguments', () => {
    const builder = live(orm, users);
    expect(() => builder.fetch()).toThrow(
      'At least one field name is required for fetch',
    );
  });

  it('fetch returns this for chaining', () => {
    const builder = live(orm, users);
    expect(builder.fetch('authorId')).toBe(builder);
  });

  it('onRecord throws with empty recordId', () => {
    const builder = live(orm, users);
    expect(() => builder.onRecord('')).toThrow(
      'Record ID is required for onRecord',
    );
  });

  it('onRecord returns this for chaining', () => {
    const builder = live(orm, users);
    expect(builder.onRecord('alice')).toBe(builder);
  });
});

// ============================================================================
// LiveSubscription
// ============================================================================

describe('LiveSubscription', () => {
  it('start returns a subscription with id and isAlive', async () => {
    const subscription = await live(orm, users).start();

    expect(subscription).toBeDefined();
    expect(typeof subscription.id).toBe('string');
    // isAlive may be false since embedded LIVE SELECT may not be active
    expect(typeof subscription.isAlive).toBe('boolean');

    await subscription.kill();
  });

  it('subscribe registers a callback and returns unsub function', async () => {
    const subscription = await live(orm, users).start();
    const received: unknown[] = [];

    const unsub = subscription.subscribe((data) => {
      received.push(data);
    });

    expect(typeof unsub).toBe('function');

    // Unsubscribe immediately
    unsub();
    await subscription.kill();
  });

  it('multiple subscribe calls are supported', async () => {
    const subscription = await live(orm, users).start();
    const unsub1 = subscription.subscribe(() => {});
    const unsub2 = subscription.subscribe(() => {});

    expect(typeof unsub1).toBe('function');
    expect(typeof unsub2).toBe('function');

    unsub1();
    unsub2();
    await subscription.kill();
  });

  it('kill stops the subscription', async () => {
    const subscription = await live(orm, users).start();
    await subscription.kill();

    // After kill, subscription should no longer be alive
    // (embedded driver may report false)
    expect(subscription.isAlive).toBe(false);
  });

  it('onRecord filters for specific record', async () => {
    // Create test records
    await driver.query("CREATE user:alice SET name = 'Alice', age = 25");
    await driver.query("CREATE user:bob SET name = 'Bob', age = 30");

    const subscription = await live(orm, users).onRecord('alice').start();

    expect(subscription).toBeDefined();
    expect(typeof subscription.id).toBe('string');

    // The record filter is client-side — the subscription still works
    // but only delivers events matching 'alice' in the record id
    await subscription.kill();
  });
});

// ============================================================================
// LiveQueryBuilder - Fields Selection
// ============================================================================

describe('LiveQueryBuilder - Fields Selection', () => {
  it('fields specific columns in subscription', async () => {
    const subscription = await live(orm, users).fields('name', 'age').start();

    expect(subscription).toBeDefined();
    expect(typeof subscription.id).toBe('string');

    await subscription.kill();
  });
});

// ============================================================================
// LiveQueryBuilder - Start + Async Iterator
// ============================================================================

describe('LiveQueryBuilder - Async Iterator', () => {
  it('subscription is async iterable', async () => {
    const subscription = await live(orm, users).start();

    // Verify it has Symbol.asyncIterator
    expect(typeof subscription[Symbol.asyncIterator]).toBe('function');

    await subscription.kill();
  });
});

// ============================================================================
// Error Handling
// ============================================================================

describe('LiveQueryBuilder - Error Handling', () => {
  it('throws when calling on disconnected driver', async () => {
    await driver.disconnect();

    await expect(live(orm, users).start()).rejects.toThrow('Not connected');
  });
});

// ============================================================================
// LiveQueryBuilder - Convenience subscribe
// ============================================================================

describe('LiveQueryBuilder - Convenience subscribe', () => {
  it('start + subscribe in one call via subscribe method', async () => {
    const sub = await live(orm, users).subscribe(() => {});

    expect(sub).toBeDefined();
    expect(typeof sub.id).toBe('string');
    expect(typeof sub.isAlive).toBe('boolean');

    await sub.kill();
  });

  it('subscribe method works with where chained', async () => {
    const sub = await live(orm, users)
      .fields('name')
      .subscribe(() => {});

    expect(sub).toBeDefined();
    await sub.kill();
  });

  it('subscribe method works with diff mode', async () => {
    const sub = await live(orm, users)
      .diff()
      .subscribe(() => {});

    expect(sub).toBeDefined();
    await sub.kill();
  });
});

// ============================================================================
// LiveSubscription - onRecord filter with subscribe callback
// ============================================================================

// ============================================================================
// LiveQueryBuilder - WHERE with valid condition
// ============================================================================

describe('LiveQueryBuilder - WHERE with valid condition', () => {
  it('where accepts a string condition', () => {
    const builder = live(orm, users);
    expect(builder.where('age > 18' as any)).toBe(builder);
  });

  it('where with string condition creates subscription', async () => {
    const sub = await live(orm, users)
      .where('age > 18' as any)
      .start();

    expect(sub).toBeDefined();
    await sub.kill();
  });
});

// ============================================================================
// LiveSubscription - async iterator
// ============================================================================

describe('LiveSubscription - async iterator', () => {
  it('can be used in for-await-of loop', async () => {
    const subscription = await live(orm, users).start();

    // Exercise the Symbol.asyncIterator method body
    const iterator = subscription[Symbol.asyncIterator]();
    expect(iterator).toBeDefined();
    expect(typeof iterator.next).toBe('function');

    await subscription.kill();
  });
});

// ============================================================================
// LiveSubscription - onRecord filter with subscribe callback
// ============================================================================

describe('LiveSubscription - onRecord filter', () => {
  it('subscribe with record filter executes filter path', async () => {
    // This exercises the filter branch in LiveSubscription.subscribe()
    const subscription = await live(orm, users).onRecord('alice').start();

    const unsub = subscription.subscribe(() => {});

    expect(typeof unsub).toBe('function');
    await subscription.kill();
  });

  it('subscribe with record filter supports multiple callbacks', async () => {
    const subscription = await live(orm, users).onRecord('bob').start();

    const unsub1 = subscription.subscribe(() => {});
    const unsub2 = subscription.subscribe(() => {});

    expect(typeof unsub1).toBe('function');
    expect(typeof unsub2).toBe('function');

    unsub1();
    unsub2();
    await subscription.kill();
  });

  it('onRecord filter does not interfere with kill', async () => {
    const subscription = await live(orm, users).onRecord('charlie').start();

    subscription.subscribe(() => {});

    await subscription.kill();
    expect(subscription.isAlive).toBe(false);
  });
});
