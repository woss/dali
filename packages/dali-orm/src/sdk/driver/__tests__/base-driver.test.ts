/**
 * Comprehensive test suite for BaseDriver
 *
 * Tests every method, guard clause, error path, and branch.
 * Uses a TestDriver subclass with a fully mocked Surreal SDK.
 */

import { beforeEach, describe, expect, it, type Mock, vi } from 'vite-plus/test';
import { BaseDriver } from '../base-driver.js';
import type { DriverConfig, EmbeddedConfig, LiveAction, LiveData } from '../types.js';

// ============================================================================
// Mock surrealdb module — hoisted by vi.mock, replaces SDK classes
// ============================================================================

const mockRecordIdCtor = vi.fn();
const mockTableCtor = vi.fn();
const mockDateTimeCtor = vi.fn();
let shouldDateTimeThrow = false;

vi.mock('surrealdb', () => {
  class RecordId {
    tb: string;
    id: string;
    constructor(tb: string, id: string) {
      this.tb = tb;
      this.id = id;
      mockRecordIdCtor(tb, id);
    }
    toString(): string {
      return `${this.tb}:${this.id}`;
    }
  }
  Object.defineProperty(RecordId, 'name', { value: 'RecordId' });

  class Table {
    table: string;
    constructor(table: string) {
      this.table = table;
      mockTableCtor(table);
    }
    toString(): string {
      return this.table;
    }
  }
  Object.defineProperty(Table, 'name', { value: 'Table' });

  class DateTime {
    value: string | number;
    constructor(value: string | number) {
      this.value = value;
      mockDateTimeCtor(value);
      if (shouldDateTimeThrow) {
        throw new Error('Invalid date');
      }
    }
  }
  Object.defineProperty(DateTime, 'name', { value: 'DateTime' });

  return { RecordId, Table, DateTime };
});

// ============================================================================
// Import the mocked classes for instanceof checks
// ============================================================================

// eslint-disable-next-line import/order
import { DateTime, RecordId, Table } from 'surrealdb';

// ============================================================================
// Helper: thenable objects that mimic Surreal SDK query/promise types
// ============================================================================

/** Creates an object with .then() and .catch() that resolves to `value` */
function thenableResolve<T>(value: T) {
  const p = Promise.resolve(value);
  return {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
  };
}

/** Creates an object with .then() and .catch() that rejects with `error` */
function thenableReject(error: Error) {
  const p = Promise.reject(error);
  p.catch(() => {}); // Suppress unhandled rejection warning
  return {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
  };
}

/** Creates a thenable with builder methods (content, merge, where) that return `this` */
function builderThenable<T>(resolveTo: T) {
  const base = thenableResolve(resolveTo);
  return {
    ...base,
    content: vi.fn(function (this: unknown) {
      return this;
    }),
    merge: vi.fn(function (this: unknown) {
      return this;
    }),
    where: vi.fn(function (this: unknown) {
      return this;
    }),
  };
}

/** Creates a mock DB query result with .collect() */
function queryMock<T>(result: T) {
  return {
    collect: vi.fn().mockResolvedValue(result),
  };
}

/** Creates a mock live subscription with controllable async iterator */
function createMockSubscription(yieldedUpdates?: Array<{ action: string; value: unknown }>) {
  const updates = yieldedUpdates ?? [
    { action: 'CREATE' as const, value: { id: '1', name: 'Alice' } },
  ];

  let index = 0;
  const asyncIterable = {
    [Symbol.asyncIterator]: () => ({
      next: () => {
        if (index < updates.length) {
          return Promise.resolve({ value: updates[index++], done: false });
        }
        return Promise.resolve({ value: undefined, done: true });
      },
    }),
  };

  return {
    [Symbol.asyncIterator]: asyncIterable[Symbol.asyncIterator],
    isAlive: true,
    kill: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn((cb: (msg: { action: string; value: unknown }) => void) => {
      cb({ action: 'CREATE', value: { id: '1' } });
      return () => {};
    }),
  };
}

/** Creates a mock live subscription whose async iterator throws (for testing error catch) */
function createThrowingSubscription() {
  return {
    [Symbol.asyncIterator]: () => ({
      next: () => Promise.reject(new Error('stream error')),
    }),
    isAlive: true,
    kill: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn((cb: (msg: { action: string; value: unknown }) => void) => {
      cb({ action: 'CREATE', value: { id: '1' } });
      return () => {};
    }),
  };
}

// ============================================================================
// TestDriver — concrete subclass that replaces abstract members with mocks
// ============================================================================

class TestDriver extends BaseDriver {
  // @ts-expect-error — mock db, not real Surreal instance
  public db: Record<string, Mock>;
  connected = false;
  subscriptions = new Map<string, { created: number; liveSubscription?: unknown }>();

  constructor(mockDb: Record<string, Mock>) {
    super();
    this.db = mockDb;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  getUrl(): string {
    return 'test://localhost';
  }

  async signin(): Promise<string> {
    return 'token';
  }

  async signup(): Promise<string> {
    return 'token';
  }

  async authenticate(): Promise<{ access: string }> {
    return { access: 'token' };
  }

  get config(): DriverConfig | EmbeddedConfig {
    return { driver: 'test' } as unknown as DriverConfig | EmbeddedConfig;
  }
}

// ============================================================================
// Test helpers
// ============================================================================

function createMockDb() {
  const mockTx = {
    commit: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockReturnValue(queryMock([[]])),
    select: vi.fn().mockReturnValue(thenableResolve([])),
    create: vi.fn().mockReturnValue(builderThenable([])),
    insert: vi.fn().mockReturnValue(thenableResolve([])),
    update: vi.fn().mockReturnValue(builderThenable([])),
    delete: vi.fn().mockReturnValue(thenableResolve([])),
    relate: vi.fn().mockReturnValue(thenableResolve({})),
  };

  return {
    query: vi.fn().mockReturnValue(queryMock([[]])),
    select: vi.fn().mockReturnValue(thenableResolve([])),
    create: vi.fn().mockReturnValue(builderThenable([])),
    insert: vi.fn().mockReturnValue(thenableResolve([])),
    update: vi.fn().mockReturnValue(builderThenable([])),
    delete: vi.fn().mockReturnValue(thenableResolve([])),
    upsert: vi.fn().mockReturnValue(builderThenable({})),
    close: vi.fn().mockResolvedValue(true),
    use: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
    relate: vi.fn().mockReturnValue(thenableResolve({})),
    live: vi.fn(),
    beginTransaction: vi.fn().mockResolvedValue(mockTx),
    mockTx,
  };
}

type MockDb = ReturnType<typeof createMockDb>;

// ============================================================================
// Tests
// ============================================================================

describe('BaseDriver', () => {
  let mockDb: MockDb;
  let driver: TestDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    shouldDateTimeThrow = false;
    mockDb = createMockDb();
    driver = new TestDriver(mockDb as unknown as Record<string, Mock>);
  });

  // ============================================================================
  // Connection Management
  // ============================================================================

  describe('connection management', () => {
    describe('isConnected', () => {
      it('returns false when not connected', () => {
        driver.connected = false;
        expect(driver.isConnected()).toBe(false);
      });

      it('returns true when connected', () => {
        driver.connected = true;
        expect(driver.isConnected()).toBe(true);
      });
    });

    describe('disconnect', () => {
      it('is a no-op when not connected', async () => {
        driver.connected = false;
        await driver.disconnect();
        expect(mockDb.close).not.toHaveBeenCalled();
      });

      it('kills subscriptions, closes db, clears map when connected', async () => {
        driver.connected = true;
        const subKill = vi.fn().mockResolvedValue(undefined);
        driver.subscriptions.set('sub1', { created: 100, liveSubscription: { kill: subKill } });
        driver.subscriptions.set('sub2', { created: 200, liveSubscription: { kill: subKill } });

        await driver.disconnect();

        expect(subKill).toHaveBeenCalledTimes(2);
        expect(mockDb.close).toHaveBeenCalledOnce();
        expect(driver.connected).toBe(false);
        expect(driver.subscriptions.size).toBe(0);
      });
    });
  });

  // ============================================================================
  // Query
  // ============================================================================

  describe('query()', () => {
    it('throws if not connected', async () => {
      driver.connected = false;
      await expect(driver.query('SELECT * FROM user')).rejects.toThrow(
        'Not connected to SurrealDB',
      );
    });

    it('executes SQL and returns results', async () => {
      driver.connected = true;
      mockDb.query.mockReturnValue(queryMock([[{ id: '1', name: 'Alice' }]]));

      const result = await driver.query('SELECT * FROM user', { limit: 10 });

      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM user', { limit: 10 });
      expect(result).toEqual([{ id: '1', name: 'Alice' }]);
    });

    it('returns empty array when result[0] is undefined', async () => {
      driver.connected = true;
      mockDb.query.mockReturnValue(queryMock([undefined]));

      const result = await driver.query('SELECT * FROM user');

      expect(result).toEqual([]);
    });

    it('wraps SDK errors', async () => {
      driver.connected = true;
      mockDb.query.mockReturnValue({
        collect: vi.fn().mockRejectedValue(new Error('DB timeout')),
      });

      await expect(driver.query('SELECT * FROM user')).rejects.toThrow('Query failed: DB timeout');
    });

    it('wraps non-Error SDK errors as strings', async () => {
      driver.connected = true;
      mockDb.query.mockReturnValue({
        collect: vi.fn().mockRejectedValue('string error'),
      });

      await expect(driver.query('SELECT * FROM user')).rejects.toThrow(
        'Query failed: string error',
      );
    });
  });

  // ============================================================================
  // Change Feed (showChanges)
  // ============================================================================

  describe('showChanges()', () => {
    it('throws if not connected', async () => {
      driver.connected = false;
      await expect(driver.showChanges('user')).rejects.toThrow('Not connected to SurrealDB');
    });

    it('uses default options when none provided', async () => {
      driver.connected = true;
      mockDb.query.mockReturnValue(queryMock([[{ id: '1' }]]));

      const result = await driver.showChanges('user');

      expect(mockDb.query).toHaveBeenCalledWith(
        'SHOW CHANGES FOR TABLE user SINCE 0 LIMIT 10',
        undefined,
      );
      expect(result).toEqual([{ id: '1' }]);
    });

    it('uses custom since and limit', async () => {
      driver.connected = true;
      mockDb.query.mockReturnValue(queryMock([[]]));

      await driver.showChanges('user', { since: '2024-01-01T00:00:00Z', limit: 50 });

      expect(mockDb.query).toHaveBeenCalledWith(
        'SHOW CHANGES FOR TABLE user SINCE 2024-01-01T00:00:00Z LIMIT 50',
        undefined,
      );
    });

    it('warns when table name contains invalid characters', async () => {
      driver.connected = true;
      mockDb.query.mockReturnValue(queryMock([[]]));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await driver.showChanges('user table!');

      expect(warnSpy).toHaveBeenCalledWith('Table name contains invalid characters, sanitized');
      expect(mockDb.query).toHaveBeenCalledWith(
        'SHOW CHANGES FOR TABLE usertable SINCE 0 LIMIT 10',
        undefined,
      );
      warnSpy.mockRestore();
    });

    it('does not warn for clean table names', async () => {
      driver.connected = true;
      mockDb.query.mockReturnValue(queryMock([[]]));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await driver.showChanges('user');

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // ============================================================================
  // CRUD — select
  // ============================================================================

  describe('CRUD: select()', () => {
    it('throws if not connected', async () => {
      driver.connected = false;
      await expect(driver.select('user')).rejects.toThrow('Not connected to SurrealDB');
    });

    it('throws on empty table name', async () => {
      driver.connected = true;
      await expect(driver.select('')).rejects.toThrow('Table name is required');
    });

    it('throws on whitespace-only table name', async () => {
      driver.connected = true;
      await expect(driver.select('   ')).rejects.toThrow('Table name is required');
    });

    it('selects all records from a table', async () => {
      driver.connected = true;
      mockDb.select.mockReturnValue(thenableResolve([{ id: '1', name: 'Alice' }]));

      const result = await driver.select('user');

      expect(mockDb.select).toHaveBeenCalledWith(expect.any(Table));
      expect(result).toEqual([{ id: '1', name: 'Alice' }]);
    });

    it('selects a single record by ID', async () => {
      driver.connected = true;
      mockDb.select.mockReturnValue(thenableResolve({ id: '1', name: 'Alice' }));

      const result = await driver.select('user:1');

      expect(mockDb.select).toHaveBeenCalledWith(expect.any(RecordId));
      expect(result).toEqual([{ id: '1', name: 'Alice' }]);
    });

    it('returns empty array when single record select returns nullish', async () => {
      driver.connected = true;
      mockDb.select.mockReturnValue(thenableResolve(null));

      const result = await driver.select('user:1');

      expect(result).toEqual([]);
    });

    it('wraps SDK errors', async () => {
      driver.connected = true;
      mockDb.select.mockReturnValue(thenableReject(new Error('not found')));

      await expect(driver.select('user')).rejects.toThrow('Select failed: not found');
    });
  });

  // ============================================================================
  // CRUD — create
  // ============================================================================

  describe('CRUD: create()', () => {
    it('throws if not connected', async () => {
      driver.connected = false;
      await expect(driver.create('user', { name: 'Alice' })).rejects.toThrow(
        'Not connected to SurrealDB',
      );
    });

    it('throws on empty table name', async () => {
      driver.connected = true;
      await expect(driver.create('', {})).rejects.toThrow('Table name is required for create');
    });

    it('throws on null data', async () => {
      driver.connected = true;
      await expect(driver.create('user', null)).rejects.toThrow('Data is required for create');
    });

    it('throws on undefined data', async () => {
      driver.connected = true;
      await expect(driver.create('user', undefined)).rejects.toThrow('Data is required for create');
    });

    it('creates a record in a table (no record ID)', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      const result = await driver.create('user', { name: 'Alice' });

      expect(mockDb.create).toHaveBeenCalledWith(expect.any(Table));
      expect(builder.content).toHaveBeenCalledWith({ name: 'Alice' });
      expect(result).toEqual([{ id: '1' }]);
    });

    it('creates a record with a specific ID', async () => {
      driver.connected = true;
      const builder = builderThenable({ id: '1' });
      mockDb.create.mockReturnValue(builder);

      const result = await driver.create('user:1', { name: 'Alice' });

      expect(mockDb.create).toHaveBeenCalledWith(expect.any(RecordId));
      expect(builder.content).toHaveBeenCalledWith({ name: 'Alice' });
      expect(result).toEqual([{ id: '1' }]);
    });

    it('wraps non-array create result in array', async () => {
      driver.connected = true;
      mockDb.create.mockReturnValue(builderThenable({ id: '1' }));

      const result = await driver.create('user:1', { name: 'Alice' });

      expect(result).toEqual([{ id: '1' }]);
    });

    it('passes primitive data through transformDatetimeValues (covers line 600 fallback)', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      // Primitive data is not object/array/null/undefined, so transformDatetimeValues
      // falls through to `return obj` at line 600
      await driver.create('user', 42);

      expect(builder.content).toHaveBeenCalledWith(42);
      // Also test with a string
      await driver.create('user', 'hello');
      expect(builder.content).toHaveBeenCalledWith('hello');
    });

    it('wraps SDK errors', async () => {
      driver.connected = true;
      mockDb.create.mockReturnValue({
        ...builderThenable({}),
        content: vi.fn(() => thenableReject(new Error('duplicate'))),
      });

      await expect(driver.create('user', { name: 'Alice' })).rejects.toThrow(
        'Create failed: duplicate',
      );
    });
  });

  // ============================================================================
  // CRUD — insert
  // ============================================================================

  describe('CRUD: insert()', () => {
    it('throws if not connected', async () => {
      driver.connected = false;
      await expect(driver.insert('user', { name: 'Alice' })).rejects.toThrow(
        'Not connected to SurrealDB',
      );
    });

    it('throws on empty table name', async () => {
      driver.connected = true;
      await expect(driver.insert('', {})).rejects.toThrow('Table name is required for insert');
    });

    it('throws on null data', async () => {
      driver.connected = true;
      await expect(driver.insert('user', null)).rejects.toThrow('Data is required for insert');
    });

    it('wraps single object in array before passing to SDK', async () => {
      driver.connected = true;
      mockDb.insert.mockReturnValue(thenableResolve([{ id: '1' }]));

      const result = await driver.insert('user', { name: 'Alice' });

      expect(mockDb.insert).toHaveBeenCalledWith(expect.any(Table), [{ name: 'Alice' }]);
      expect(result).toEqual([{ id: '1' }]);
    });

    it('passes array data through directly', async () => {
      driver.connected = true;
      mockDb.insert.mockReturnValue(thenableResolve([{ id: '1' }, { id: '2' }]));

      const result = await driver.insert('user', [{ name: 'Alice' }, { name: 'Bob' }]);

      expect(mockDb.insert).toHaveBeenCalledWith(expect.any(Table), [
        { name: 'Alice' },
        { name: 'Bob' },
      ]);
      expect(result).toEqual([{ id: '1' }, { id: '2' }]);
    });

    it('wraps SDK errors', async () => {
      driver.connected = true;
      mockDb.insert.mockReturnValue(thenableReject(new Error('constraint')));

      await expect(driver.insert('user', { name: 'Alice' })).rejects.toThrow(
        'Insert failed: constraint',
      );
    });
  });

  // ============================================================================
  // CRUD — update
  // ============================================================================

  describe('CRUD: update()', () => {
    it('throws if not connected', async () => {
      driver.connected = false;
      await expect(driver.update('user', { name: 'Bob' })).rejects.toThrow(
        'Not connected to SurrealDB',
      );
    });

    it('throws on empty table name', async () => {
      driver.connected = true;
      await expect(driver.update('', {})).rejects.toThrow('Table name is required for update');
    });

    it('throws on null data', async () => {
      driver.connected = true;
      await expect(driver.update('user', null)).rejects.toThrow('Data is required for update');
    });

    it('updates by table name (no record ID)', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1', name: 'Bob' }]);
      mockDb.update.mockReturnValue(builder);

      const result = await driver.update('user', { name: 'Bob' });

      expect(mockDb.update).toHaveBeenCalledWith(expect.any(Table));
      expect(builder.merge).toHaveBeenCalledWith({ name: 'Bob' });
      expect(result).toEqual([{ id: '1', name: 'Bob' }]);
    });

    it('updates by record ID', async () => {
      driver.connected = true;
      const builder = builderThenable({ id: '1', name: 'Bob' });
      mockDb.update.mockReturnValue(builder);

      const result = await driver.update('user:1', { name: 'Bob' });

      expect(mockDb.update).toHaveBeenCalledWith(expect.any(RecordId));
      expect(builder.merge).toHaveBeenCalledWith({ name: 'Bob' });
      expect(result).toEqual([{ id: '1', name: 'Bob' }]);
    });

    it('wraps non-array result in array', async () => {
      driver.connected = true;
      mockDb.update.mockReturnValue(builderThenable({ id: '1' }));

      const result = await driver.update('user:1', { name: 'Bob' });

      expect(result).toEqual([{ id: '1' }]);
    });

    it('wraps SDK errors', async () => {
      driver.connected = true;
      mockDb.update.mockReturnValue({
        ...builderThenable({}),
        merge: vi.fn(() => thenableReject(new Error('not found'))),
      });

      await expect(driver.update('user:1', { name: 'Bob' })).rejects.toThrow(
        'Update failed: not found',
      );
    });
  });

  // ============================================================================
  // CRUD — delete
  // ============================================================================

  describe('CRUD: delete()', () => {
    it('throws if not connected', async () => {
      driver.connected = false;
      await expect(driver.delete('user')).rejects.toThrow('Not connected to SurrealDB');
    });

    it('throws on empty table name', async () => {
      driver.connected = true;
      await expect(driver.delete('')).rejects.toThrow('Table name is required for delete');
    });

    it('deletes all records in a table', async () => {
      driver.connected = true;
      mockDb.delete.mockReturnValue(thenableResolve([{ id: '1' }]));

      const result = await driver.delete('user');

      expect(mockDb.delete).toHaveBeenCalledWith(expect.any(Table));
      expect(result).toEqual([{ id: '1' }]);
    });

    it('deletes a single record by ID', async () => {
      driver.connected = true;
      mockDb.delete.mockReturnValue(thenableResolve({ id: '1' }));

      const result = await driver.delete('user:1');

      expect(mockDb.delete).toHaveBeenCalledWith(expect.any(RecordId));
      expect(result).toEqual([{ id: '1' }]);
    });

    it('wraps non-array result in array', async () => {
      driver.connected = true;
      mockDb.delete.mockReturnValue(thenableResolve({ id: '1' }));

      const result = await driver.delete('user:1');

      expect(result).toEqual([{ id: '1' }]);
    });

    it('wraps SDK errors', async () => {
      driver.connected = true;
      mockDb.delete.mockReturnValue(thenableReject(new Error('not found')));

      await expect(driver.delete('user')).rejects.toThrow('Delete failed: not found');
    });
  });

  // ============================================================================
  // CRUD — upsert
  // ============================================================================

  describe('CRUD: upsert()', () => {
    it('throws if not connected', async () => {
      driver.connected = false;
      await expect(driver.upsert('user:1', { name: 'Alice' })).rejects.toThrow(
        'Not connected to SurrealDB',
      );
    });

    it('throws on empty table name', async () => {
      driver.connected = true;
      await expect(driver.upsert('', {})).rejects.toThrow('Table name is required for upsert');
    });

    it('throws on null data', async () => {
      driver.connected = true;
      await expect(driver.upsert('user:1', null)).rejects.toThrow('Data is required for upsert');
    });

    it('upserts by record ID with merge', async () => {
      driver.connected = true;
      const builder = builderThenable({ id: '1' });
      mockDb.upsert.mockReturnValue(builder);

      const result = await driver.upsert('user:1', { name: 'Alice' });

      expect(mockDb.upsert).toHaveBeenCalledWith(expect.any(RecordId));
      expect(builder.merge).toHaveBeenCalledWith({ name: 'Alice' });
      expect(result).toEqual([{ id: '1' }]);
    });

    it('throws when no record ID is provided (table-only)', async () => {
      driver.connected = true;
      await expect(driver.upsert('user', { name: 'Alice' })).rejects.toThrow(
        'Upsert requires a record ID (e.g., "user:john")',
      );
    });

    it('wraps SDK errors', async () => {
      driver.connected = true;
      mockDb.upsert.mockReturnValue({
        ...builderThenable({}),
        merge: vi.fn(() => thenableReject(new Error('conflict'))),
      });

      await expect(driver.upsert('user:1', { name: 'Alice' })).rejects.toThrow(
        'Upsert failed: conflict',
      );
    });
  });

  // ============================================================================
  // CRUD — upsertWhere
  // ============================================================================

  describe('CRUD: upsertWhere()', () => {
    it('throws if not connected', async () => {
      driver.connected = false;
      await expect(
        driver.upsertWhere('user', 'email = "a@b.com"', { name: 'Alice' }),
      ).rejects.toThrow('Not connected to SurrealDB');
    });

    it('throws on empty table name', async () => {
      driver.connected = true;
      await expect(driver.upsertWhere('', 'email = "a@b.com"', {})).rejects.toThrow(
        'Table name is required for upsertWhere',
      );
    });

    it('throws on empty where clause', async () => {
      driver.connected = true;
      await expect(driver.upsertWhere('user', '', {})).rejects.toThrow(
        'WHERE clause is required for upsertWhere',
      );
    });

    it('throws on null data', async () => {
      driver.connected = true;
      await expect(driver.upsertWhere('user', 'email = "a@b.com"', null)).rejects.toThrow(
        'Data is required for upsertWhere',
      );
    });

    it('upserts with table, where clause, and merge', async () => {
      driver.connected = true;
      const builder = builderThenable({ id: '1' });
      mockDb.upsert.mockReturnValue(builder);

      const result = await driver.upsertWhere('user', 'email = "a@b.com"', { name: 'Alice' });

      expect(mockDb.upsert).toHaveBeenCalledWith(expect.any(Table));
      expect(builder.where).toHaveBeenCalledWith('email = "a@b.com"');
      expect(builder.merge).toHaveBeenCalledWith({ name: 'Alice' });
      expect(result).toEqual([{ id: '1' }]);
    });

    it('wraps SDK errors with "Upsert failed:" prefix', async () => {
      driver.connected = true;
      mockDb.upsert.mockReturnValue({
        ...builderThenable({}),
        where: vi.fn(() => ({
          ...builderThenable({}),
          merge: vi.fn(() => thenableReject(new Error('conflict'))),
        })),
      });

      await expect(
        driver.upsertWhere('user', 'email = "a@b.com"', { name: 'Alice' }),
      ).rejects.toThrow('Upsert failed: conflict');
    });

    it('wraps array result in array (non-array)', async () => {
      driver.connected = true;
      mockDb.upsert.mockReturnValue({
        ...builderThenable({}),
        where: vi.fn(() => ({
          ...builderThenable({}),
          merge: vi.fn(() => thenableResolve({ id: '1' })),
        })),
      });

      const result = await driver.upsertWhere('user', 'email = "a@b.com"', { name: 'Alice' });

      expect(result).toEqual([{ id: '1' }]);
    });
  });

  // ============================================================================
  // CRUD — relate
  // ============================================================================

  describe('CRUD: relate()', () => {
    it('throws if not connected', async () => {
      driver.connected = false;
      await expect(driver.relate('user:1', 'follows', 'user:2')).rejects.toThrow(
        'Not connected to SurrealDB',
      );
    });

    it('throws on empty from', async () => {
      driver.connected = true;
      await expect(driver.relate('', 'follows', 'user:2')).rejects.toThrow(
        'From record ID is required for relate',
      );
    });

    it('throws on empty to', async () => {
      driver.connected = true;
      await expect(driver.relate('user:1', 'follows', '')).rejects.toThrow(
        'To record ID is required for relate',
      );
    });

    it('throws on empty edge', async () => {
      driver.connected = true;
      await expect(driver.relate('user:1', '', 'user:2')).rejects.toThrow(
        'Edge is required for relate',
      );
    });

    it('throws when from has no record ID', async () => {
      driver.connected = true;
      await expect(driver.relate('user', 'follows', 'user:2')).rejects.toThrow(
        'From record ID is required for relate',
      );
    });

    it('throws when to has no record ID', async () => {
      driver.connected = true;
      await expect(driver.relate('user:1', 'follows', 'user')).rejects.toThrow(
        'To record ID is required for relate',
      );
    });

    it('relates without data', async () => {
      driver.connected = true;
      mockDb.relate.mockReturnValue(thenableResolve({ id: 'follows:abc' }));

      const result = await driver.relate('user:1', 'follows', 'user:2');

      expect(mockDb.relate).toHaveBeenCalledWith(
        expect.any(RecordId),
        expect.any(Table),
        expect.any(RecordId),
        undefined,
      );
      expect(result).toEqual([{ id: 'follows:abc' }]);
    });

    it('relates with data', async () => {
      driver.connected = true;
      mockDb.relate.mockReturnValue(thenableResolve({ id: 'follows:abc', since: '2024' }));

      const result = await driver.relate('user:1', 'follows', 'user:2', { since: '2024' });

      expect(mockDb.relate).toHaveBeenCalledWith(
        expect.any(RecordId),
        expect.any(Table),
        expect.any(RecordId),
        { since: '2024' },
      );
      expect(result).toEqual([{ id: 'follows:abc', since: '2024' }]);
    });

    it('wraps SDK errors', async () => {
      driver.connected = true;
      mockDb.relate.mockReturnValue(thenableReject(new Error('invalid relation')));

      await expect(driver.relate('user:1', 'follows', 'user:2')).rejects.toThrow(
        'Relate failed: invalid relation',
      );
    });
  });

  // ============================================================================
  // Transaction
  // ============================================================================

  describe('transaction()', () => {
    it('throws if not connected', async () => {
      driver.connected = false;
      await expect(driver.transaction(async () => 'ok')).rejects.toThrow(
        'Not connected to SurrealDB',
      );
    });

    it('commits on successful fn', async () => {
      driver.connected = true;
      const result = await driver.transaction(async (tx) => {
        const data = await tx.query('SELECT * FROM user');
        return data;
      });

      expect(mockDb.beginTransaction).toHaveBeenCalledOnce();
      expect(mockDb.mockTx.commit).toHaveBeenCalledOnce();
      expect(mockDb.mockTx.cancel).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('rolls back via cancel on fn error', async () => {
      driver.connected = true;
      mockDb.mockTx.query.mockReturnValue(queryMock([[]]));

      await expect(
        driver.transaction(async () => {
          throw new Error('tx error');
        }),
      ).rejects.toThrow('tx error');

      expect(mockDb.mockTx.cancel).toHaveBeenCalledOnce();
      expect(mockDb.mockTx.commit).not.toHaveBeenCalled();
    });

    it('calls wrapper commit from inside transaction fn', async () => {
      driver.connected = true;

      await driver.transaction(async (tx) => {
        await tx.commit();
        return 'done';
      });

      // Called once: wrapper's commit() skips auto-commit
      expect(mockDb.mockTx.commit).toHaveBeenCalledOnce();
    });

    it('calls wrapper rollback from inside transaction fn', async () => {
      driver.connected = true;

      await driver.transaction(async (tx) => {
        await tx.rollback();
        return 'rolled back';
      });

      expect(mockDb.mockTx.cancel).toHaveBeenCalledOnce();
      // Explicit rollback suppresses auto-commit
      expect(mockDb.mockTx.commit).not.toHaveBeenCalled();
    });

    describe('transaction operations', () => {
      beforeEach(() => {
        driver.connected = true;
      });

      it('tx.select by table', async () => {
        mockDb.mockTx.select.mockReturnValue(thenableResolve([{ id: '1' }]));

        await driver.transaction(async (tx) => {
          const r = await tx.select('user');
          expect(r).toEqual([{ id: '1' }]);
        });
      });

      it('tx.select by record ID', async () => {
        mockDb.mockTx.select.mockReturnValue(thenableResolve({ id: '1' }));

        await driver.transaction(async (tx) => {
          const r = await tx.select('user:1');
          expect(r).toEqual([{ id: '1' }]);
        });
      });

      it('tx.create by table', async () => {
        const builder = builderThenable([{ id: '1' }]);
        mockDb.mockTx.create.mockReturnValue(builder);

        await driver.transaction(async (tx) => {
          const r = await tx.create('user', { name: 'Alice' });
          expect(r).toEqual([{ id: '1' }]);
        });

        expect(mockDb.mockTx.create).toHaveBeenCalledWith(expect.any(Table));
      });

      it('tx.create by record ID', async () => {
        const builder = builderThenable({ id: '1' });
        mockDb.mockTx.create.mockReturnValue(builder);

        await driver.transaction(async (tx) => {
          const r = await tx.create('user:1', { name: 'Alice' });
          expect(r).toEqual([{ id: '1' }]);
        });

        expect(mockDb.mockTx.create).toHaveBeenCalledWith(expect.any(RecordId));
      });

      it('tx.insert', async () => {
        mockDb.mockTx.insert.mockReturnValue(thenableResolve([{ id: '1' }]));

        await driver.transaction(async (tx) => {
          const r = await tx.insert('user', { name: 'Alice' });
          expect(r).toEqual([{ id: '1' }]);
        });
      });

      it('tx.update by table', async () => {
        const builder = builderThenable([{ id: '1' }]);
        mockDb.mockTx.update.mockReturnValue(builder);

        await driver.transaction(async (tx) => {
          const r = await tx.update('user', { name: 'Bob' });
          expect(r).toEqual([{ id: '1' }]);
        });
      });

      it('tx.update by record ID', async () => {
        const builder = builderThenable({ id: '1' });
        mockDb.mockTx.update.mockReturnValue(builder);

        await driver.transaction(async (tx) => {
          const r = await tx.update('user:1', { name: 'Bob' });
          expect(r).toEqual([{ id: '1' }]);
        });
      });

      it('tx.delete by table', async () => {
        mockDb.mockTx.delete.mockReturnValue(thenableResolve([{ id: '1' }]));

        await driver.transaction(async (tx) => {
          const r = await tx.delete('user');
          expect(r).toEqual([{ id: '1' }]);
        });
      });

      it('tx.delete by record ID', async () => {
        mockDb.mockTx.delete.mockReturnValue(thenableResolve({ id: '1' }));

        await driver.transaction(async (tx) => {
          const r = await tx.delete('user:1');
          expect(r).toEqual([{ id: '1' }]);
        });
      });

      it('tx.relate', async () => {
        mockDb.mockTx.relate.mockReturnValue(thenableResolve({ id: 'edge:abc' }));

        await driver.transaction(async (tx) => {
          const r = await tx.relate('user:1', 'follows', 'user:2');
          expect(r).toEqual([{ id: 'edge:abc' }]);
        });
      });

      it('tx.relate throws without from record ID', async () => {
        await expect(
          driver.transaction(async (tx) => {
            await tx.relate('user', 'follows', 'user:2');
          }),
        ).rejects.toThrow('From record ID is required for relate');
      });

      it('tx.relate throws without to record ID', async () => {
        await expect(
          driver.transaction(async (tx) => {
            await tx.relate('user:1', 'follows', 'user');
          }),
        ).rejects.toThrow('To record ID is required for relate');
      });

      it('tx.relate with data (covers line 404 truthy branch)', async () => {
        mockDb.mockTx.relate.mockReturnValue(thenableResolve({ id: 'edge:abc' }));
        await driver.transaction(async (tx) => {
          const r = await tx.relate('user:1', 'follows', 'user:2', { since: '2024' });
          expect(r).toEqual([{ id: 'edge:abc' }]);
        });
      });
    });
  });

  // ============================================================================
  // Namespace / Database
  // ============================================================================

  describe('namespace/database management', () => {
    describe('use()', () => {
      it('throws if not connected', async () => {
        driver.connected = false;
        await expect(driver.use('ns', 'db')).rejects.toThrow('Not connected to SurrealDB');
      });

      it('switches namespace and database', async () => {
        driver.connected = true;
        await driver.use('my_ns', 'my_db');
        expect(mockDb.use).toHaveBeenCalledWith({ namespace: 'my_ns', database: 'my_db' });
      });
    });

    describe('invalidate()', () => {
      it('invalidates session and sets connected to false', async () => {
        driver.connected = true;
        await driver.invalidate();
        expect(mockDb.invalidate).toHaveBeenCalledOnce();
        expect(driver.connected).toBe(false);
      });
    });

    describe('auth()', () => {
      it('throws if not connected', async () => {
        driver.connected = false;
        await expect(driver.auth()).rejects.toThrow('Not connected to SurrealDB');
      });

      it('returns auth data when present', async () => {
        driver.connected = true;
        // .collect() returns [data], where data is the first (only) result set
        mockDb.query.mockReturnValue(queryMock([{ id: 'user:1', name: 'Alice' }]));

        const result = await driver.auth();

        expect(mockDb.query).toHaveBeenCalledWith('RETURN $auth');
        expect(result).toEqual({ id: 'user:1', name: 'Alice' });
      });

      it('returns null when auth data is empty', async () => {
        driver.connected = true;
        // .collect() returns [null] → result[0] is null
        mockDb.query.mockReturnValue(queryMock([null]));

        const result = await driver.auth();

        expect(result).toBeNull();
      });
    });
  });

  // ============================================================================
  // Live Queries
  // ============================================================================

  describe('live queries', () => {
    describe('live()', () => {
      it('throws if not connected', async () => {
        driver.connected = false;
        await expect(driver.live('user', vi.fn())).rejects.toThrow('Not connected to SurrealDB');
      });

      it('throws on empty table name', async () => {
        driver.connected = true;
        await expect(driver.live('', vi.fn())).rejects.toThrow('Table name is required');
      });

      it('warns on table name sanitization', async () => {
        driver.connected = true;
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const subscription = createMockSubscription();
        mockDb.live.mockReturnValue(thenableResolve(subscription));

        await driver.live('user table!', vi.fn());

        expect(warnSpy).toHaveBeenCalledWith('Table name contains invalid characters, sanitized');
        warnSpy.mockRestore();
      });

      it('subscribes and receives live updates via callback', async () => {
        driver.connected = true;
        const updates = [{ action: 'CREATE', value: { id: '1', name: 'Alice' } }];
        const subscription = createMockSubscription(updates);
        mockDb.live.mockReturnValue(thenableResolve(subscription));
        const callback = vi.fn();

        const id = await driver.live('user', callback);

        expect(id).toMatch(/^live_/);
        expect(mockDb.live).toHaveBeenCalledWith(expect.any(Table));

        // Wait for background async iterator to process
        await vi.waitFor(() => {
          expect(callback).toHaveBeenCalledWith({
            action: 'CREATE' as LiveAction,
            result: { id: '1', name: 'Alice' },
          });
        });
      });

      it('rejects on SDK error', async () => {
        driver.connected = true;
        mockDb.live.mockReturnValue(thenableReject(new Error('SDK failure')));

        await expect(driver.live('user', vi.fn())).rejects.toThrow('SDK failure');
      });

      it('gracefully handles async iterator errors', async () => {
        driver.connected = true;
        const subscription = createThrowingSubscription();
        mockDb.live.mockReturnValue(thenableResolve(subscription));
        const callback = vi.fn();

        // Should not throw — the for-await catch handles iterator errors
        const id = await driver.live('user', callback);
        expect(id).toMatch(/^live_/);
      });
    });

    describe('liveWithOptions()', () => {
      it('throws if not connected', async () => {
        driver.connected = false;
        await expect(driver.liveWithOptions('user')).rejects.toThrow('Not connected to SurrealDB');
      });

      it('throws on empty table name', async () => {
        driver.connected = true;
        await expect(driver.liveWithOptions('')).rejects.toThrow(
          'Table name is required for live query',
        );
      });

      it('warns on table name sanitization', async () => {
        driver.connected = true;
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const subscription = createMockSubscription();
        const livePromise = {
          ...builderThenable(subscription),
          diff: vi.fn().mockReturnThis(),
          fields: vi.fn().mockReturnThis(),
          value: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          fetch: vi.fn().mockReturnThis(),
        };
        mockDb.live.mockReturnValue(livePromise);

        await driver.liveWithOptions('user table!');

        expect(warnSpy).toHaveBeenCalledWith('Table name contains invalid characters, sanitized');
        warnSpy.mockRestore();
      });

      it('subscribes without options', async () => {
        driver.connected = true;
        const subscription = createMockSubscription();
        const livePromise = {
          ...builderThenable(subscription),
          diff: vi.fn().mockReturnThis(),
          fields: vi.fn().mockReturnThis(),
          value: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          fetch: vi.fn().mockReturnThis(),
        };
        mockDb.live.mockReturnValue(livePromise);

        const handle = await driver.liveWithOptions('user');

        expect(handle.id).toMatch(/^live_/);
        expect(livePromise.diff).not.toHaveBeenCalled();
        expect(livePromise.fields).not.toHaveBeenCalled();
      });

      it('with diff option', async () => {
        driver.connected = true;
        const subscription = createMockSubscription();
        const livePromise = {
          ...builderThenable(subscription),
          diff: vi.fn().mockReturnThis(),
          fields: vi.fn().mockReturnThis(),
          value: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          fetch: vi.fn().mockReturnThis(),
        };
        mockDb.live.mockReturnValue(livePromise);

        await driver.liveWithOptions('user', { diff: true });

        expect(livePromise.diff).toHaveBeenCalledOnce();
      });

      it('with fields option', async () => {
        driver.connected = true;
        const subscription = createMockSubscription();
        const livePromise = {
          ...builderThenable(subscription),
          diff: vi.fn().mockReturnThis(),
          fields: vi.fn().mockReturnThis(),
          value: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          fetch: vi.fn().mockReturnThis(),
        };
        mockDb.live.mockReturnValue(livePromise);

        await driver.liveWithOptions('user', { fields: ['name', 'email'] });

        expect(livePromise.fields).toHaveBeenCalledWith('name', 'email');
      });

      it('with value option', async () => {
        driver.connected = true;
        const subscription = createMockSubscription();
        const livePromise = {
          ...builderThenable(subscription),
          diff: vi.fn().mockReturnThis(),
          fields: vi.fn().mockReturnThis(),
          value: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          fetch: vi.fn().mockReturnThis(),
        };
        mockDb.live.mockReturnValue(livePromise);

        await driver.liveWithOptions('user', { value: 'name' });

        expect(livePromise.value).toHaveBeenCalledWith('name');
      });

      it('with where option', async () => {
        driver.connected = true;
        const subscription = createMockSubscription();
        const livePromise = {
          ...builderThenable(subscription),
          diff: vi.fn().mockReturnThis(),
          fields: vi.fn().mockReturnThis(),
          value: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          fetch: vi.fn().mockReturnThis(),
        };
        mockDb.live.mockReturnValue(livePromise);

        await driver.liveWithOptions('user', { where: 'age > 18' });

        expect(livePromise.where).toHaveBeenCalledWith('age > 18');
      });

      it('with fetch option', async () => {
        driver.connected = true;
        const subscription = createMockSubscription();
        const livePromise = {
          ...builderThenable(subscription),
          diff: vi.fn().mockReturnThis(),
          fields: vi.fn().mockReturnThis(),
          value: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          fetch: vi.fn().mockReturnThis(),
        };
        mockDb.live.mockReturnValue(livePromise);

        await driver.liveWithOptions('user', { fetch: ['profile'] });

        expect(livePromise.fetch).toHaveBeenCalledWith('profile');
      });

      describe('LiveSubscriptionHandle', () => {
        it('id getter returns subscriptionId', async () => {
          driver.connected = true;
          const subscription = createMockSubscription();
          const livePromise = {
            ...builderThenable(subscription),
            diff: vi.fn().mockReturnThis(),
            fields: vi.fn().mockReturnThis(),
            value: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            fetch: vi.fn().mockReturnThis(),
          };
          mockDb.live.mockReturnValue(livePromise);

          const handle = await driver.liveWithOptions('user');
          expect(handle.id).toMatch(/^live_/);
        });

        it('isAlive getter delegates to subscription', async () => {
          driver.connected = true;
          const subscription = createMockSubscription();
          const livePromise = {
            ...builderThenable(subscription),
            diff: vi.fn().mockReturnThis(),
            fields: vi.fn().mockReturnThis(),
            value: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            fetch: vi.fn().mockReturnThis(),
          };
          mockDb.live.mockReturnValue(livePromise);

          const handle = await driver.liveWithOptions('user');
          expect(handle.isAlive).toBe(true);
        });

        it('kill method kills subscription and removes from map', async () => {
          driver.connected = true;
          const subscription = createMockSubscription();
          const livePromise = {
            ...builderThenable(subscription),
            diff: vi.fn().mockReturnThis(),
            fields: vi.fn().mockReturnThis(),
            value: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            fetch: vi.fn().mockReturnThis(),
          };
          mockDb.live.mockReturnValue(livePromise);

          const handle = await driver.liveWithOptions('user');
          await handle.kill();

          expect(subscription.kill).toHaveBeenCalledOnce();
        });

        it('subscribe method invokes callback when subscription emits', async () => {
          driver.connected = true;
          const subscription = createMockSubscription();
          const livePromise = {
            ...builderThenable(subscription),
            diff: vi.fn().mockReturnThis(),
            fields: vi.fn().mockReturnThis(),
            value: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            fetch: vi.fn().mockReturnThis(),
          };
          mockDb.live.mockReturnValue(livePromise);

          const handle = await driver.liveWithOptions('user');
          const callback = vi.fn();
          const unsubscribe = handle.subscribe(callback);

          // Subscribe returns unsubscribe
          expect(typeof unsubscribe).toBe('function');

          // The mock subscription.subscribe fires its callback immediately,
          // which should trigger line 542: callback({ action, result })
          expect(callback).toHaveBeenCalledWith({
            action: 'CREATE',
            result: { id: '1' },
          });
        });

        it('async iterator yields messages', async () => {
          driver.connected = true;
          const updates = [{ action: 'CREATE', value: { id: '1' } }];
          const subscription = createMockSubscription(updates);
          const livePromise = {
            ...builderThenable(subscription),
            diff: vi.fn().mockReturnThis(),
            fields: vi.fn().mockReturnThis(),
            value: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            fetch: vi.fn().mockReturnThis(),
          };
          mockDb.live.mockReturnValue(livePromise);

          const handle = await driver.liveWithOptions('user');
          const results: LiveData[] = [];
          for await (const msg of handle) {
            results.push(msg);
            break; // Only one message
          }

          expect(results).toHaveLength(1);
          expect(results[0].action).toBe('CREATE');
        });
      });
    });

    describe('kill()', () => {
      it('is no-op with empty subscriptionId', async () => {
        await driver.kill('');
        // Should not throw
      });

      it('deletes unknown subscription from map', async () => {
        driver.subscriptions.set('known', { created: 100 });
        await driver.kill('unknown');
        expect(driver.subscriptions.has('known')).toBe(true);
      });

      it('calls kill on live subscription and deletes from map', async () => {
        const subKill = vi.fn().mockResolvedValue(undefined);
        driver.subscriptions.set('sub1', {
          created: 100,
          liveSubscription: { kill: subKill },
        });

        await driver.kill('sub1');

        expect(subKill).toHaveBeenCalledOnce();
        expect(driver.subscriptions.has('sub1')).toBe(false);
      });

      it('handles subscription without kill method', async () => {
        driver.subscriptions.set('sub1', {
          created: 100,
          liveSubscription: {},
        });

        // Should not throw even though liveSubscription has no kill
        await driver.kill('sub1');
        expect(driver.subscriptions.has('sub1')).toBe(false);
      });
    });
  });

  // ============================================================================
  // Utility Methods
  // ============================================================================

  describe('parseTableWithId()', () => {
    it('returns table name and undefined recordId for plain table', () => {
      const result = (driver as any).parseTableWithId('user');
      expect(result).toEqual({ tableName: 'user', recordId: undefined });
    });

    it('splits table:id correctly', () => {
      const result = (driver as any).parseTableWithId('user:42');
      expect(result).toEqual({ tableName: 'user', recordId: '42' });
    });

    it('handles multiple colons', () => {
      const result = (driver as any).parseTableWithId('edge:in:out');
      expect(result).toEqual({ tableName: 'edge', recordId: 'in:out' });
    });

    it('returns undefined recordId when empty after colon', () => {
      const result = (driver as any).parseTableWithId('user:');
      expect(result).toEqual({ tableName: 'user', recordId: undefined });
    });
  });

  // ============================================================================
  // Private method behavior (tested through public methods)
  // ============================================================================

  describe('transformDatetimeValues (through create)', () => {
    it('transforms datetime fields in data', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('user', {
        name: 'Alice',
        created_at: '2024-01-15T10:00:00Z',
      });

      const contentArg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      expect(contentArg.name).toBe('Alice');
      expect(contentArg.created_at).toBeInstanceOf(DateTime);
    });

    it('transforms date/time/_at/_on fields', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('user', {
        birthDate: '2024-01-01',
        startTime: '12:00:00',
        updated_at: '2024-06-15',
        created_on: '2024-01-01',
        name: 'Alice',
      });

      const contentArg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      expect(contentArg.birthDate).toBeInstanceOf(DateTime);
      expect(contentArg.startTime).toBeInstanceOf(DateTime);
      expect(contentArg.updated_at).toBeInstanceOf(DateTime);
      expect(contentArg.created_on).toBeInstanceOf(DateTime);
      expect(contentArg.name).toBe('Alice');
    });

    it('skips non-datetime fields', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('user', { name: 'Alice', age: 30, active: true });

      const contentArg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      expect(contentArg.name).toBe('Alice');
      expect(contentArg.age).toBe(30);
      expect(contentArg.active).toBe(true);
    });

    it('handles null and undefined values in datetime fields', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('user', { created_at: null, updated_at: undefined });

      const contentArg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      expect(contentArg.created_at).toBeNull();
      expect(contentArg.updated_at).toBeUndefined();
    });

    it('skips array values in datetime fields', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('user', { dates: ['2024-01-01', '2024-06-15'] });

      const contentArg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      // Array fields with "date" in name should NOT be transformed to DateTime
      expect(Array.isArray(contentArg.dates)).toBe(true);
      expect(contentArg.dates).toEqual(['2024-01-01', '2024-06-15']);
    });

    it('processes array items recursively', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('user', [
        { created_at: '2024-01-01', name: 'Alice' },
        { created_at: '2024-06-15', name: 'Bob' },
      ]);

      const contentArg = (builder.content.mock.calls[0] as unknown[])[0] as Array<
        Record<string, unknown>
      >;
      expect(Array.isArray(contentArg)).toBe(true);
      expect((contentArg[0] as any).created_at).toBeInstanceOf(DateTime);
      expect((contentArg[1] as any).created_at).toBeInstanceOf(DateTime);
    });

    it('preserves non-plain objects (class instances)', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      const recordId = new RecordId('other', '123');
      await driver.create('user', { ref: recordId, name: 'Alice' });

      const contentArg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      // RecordId (class instance) should be preserved as-is
      expect(contentArg.ref).toBe(recordId);
    });
  });

  describe('tryCreateDateTime (through create)', () => {
    it('converts string values to DateTime', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('user', { created_at: '2024-01-01' });

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      expect(arg.created_at).toBeInstanceOf(DateTime);
    });

    it('converts number values to DateTime', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('user', { created_at: 1704067200000 });

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      expect(arg.created_at).toBeInstanceOf(DateTime);
    });

    it('returns value as-is on DateTime construction error', async () => {
      // The mock DateTime doesn't throw, but let's verify the tryCreateDateTime
      // catch block works by passing a symbol (which would cause issues with `new DateTime(symbol)`)
      // Actually the mock accepts anything. To test the catch block, we need the real DateTime
      // constructor to throw. Let's override to test the catch path.
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      // Pass a non-string, non-number value — it will be returned as-is by tryCreateDateTime
      await driver.create('user', { created_at: true });

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      // Boolean should pass through unchanged since tryCreateDateTime
      // returns non-string/non-number values directly
      expect(arg.created_at).toBe(true);
    });

    it('catch block on DateTime construction failure (covers line 698)', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      shouldDateTimeThrow = true;
      await driver.create('user', { created_at: '2024-01-01' });
      shouldDateTimeThrow = false;

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      // When DateTime constructor throws, tryCreateDateTime catches and returns
      // the original value as-is
      expect(arg.created_at).toBe('2024-01-01');
    });

    it('tryCreateDateTime returns null/undefined as-is (covers line 692)', () => {
      const resultNull = (driver as any).tryCreateDateTime(null);
      expect(resultNull).toBeNull();

      const resultUndefined = (driver as any).tryCreateDateTime(undefined);
      expect(resultUndefined).toBeUndefined();
    });

    it('transformDatetimeValues returns null/undefined as-is (covers line 581)', () => {
      const r1 = (driver as any).transformDatetimeValues(null);
      expect(r1).toBeNull();

      const r2 = (driver as any).transformDatetimeValues(undefined);
      expect(r2).toBeUndefined();
    });

    it('tryCoerceRecordId with obj.id=null covers line 659 branch', () => {
      // typeof null === 'object' is true in JS. obj.id=null makes
      // typeof null==='object' (true) && null!==null (false) → short-circuit
      const r1 = (driver as any).tryCoerceRecordId({ id: null });
      expect(r1).toEqual({ id: null });

      // nested.id is non-string: line 661 condition false
      const r2 = (driver as any).tryCoerceRecordId({ id: { id: 42 } });
      expect(r2).toEqual({ id: { id: 42 } });
    });
  });

  describe('coerceRecordIds (through create)', () => {
    it('preserves existing RecordId instances', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);
      const existingId = new RecordId('user', '5');

      await driver.create('relation', { owner: existingId, name: 'test' });

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      expect(arg.owner).toBe(existingId);
    });

    it('converts tb/id objects to RecordId for record fields', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('relation', { in: { tb: 'user', id: '5' }, name: 'test' });

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      expect(arg.in).toBeInstanceOf(RecordId);
    });

    it('converts string record IDs for owner/in/out fields', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('relation', { owner: 'user:5', name: 'test' });

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      expect(arg.owner).toBeInstanceOf(RecordId);
    });

    it('passes through non-record fields unchanged', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('user', { name: 'Alice', email: 'alice@test.com' });

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      expect(arg.name).toBe('Alice');
      expect(arg.email).toBe('alice@test.com');
    });

    it('recurses into arrays', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('relation', [
        { owner: 'user:1', name: 'rel1' },
        { owner: 'user:2', name: 'rel2' },
      ]);

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Array<Record<string, unknown>>;
      expect((arg[0] as any).owner).toBeInstanceOf(RecordId);
      expect((arg[1] as any).owner).toBeInstanceOf(RecordId);
    });

    it('converts nested RecordId-like objects with id field', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('relation', { owner: { id: 'user:5' }, name: 'test' });

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      expect(arg.owner).toBeInstanceOf(RecordId);
    });

    it('converts nested nested RecordId-like objects', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('relation', { owner: { id: { id: 'user:5' } }, name: 'test' });

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      expect(arg.owner).toBeInstanceOf(RecordId);
    });

    it('handles null and undefined values', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('relation', { owner: null, out: undefined });

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      expect(arg.owner).toBeNull();
      expect(arg.out).toBeUndefined();
    });

    it('preserves plain string values (no colon → not a record ID)', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      // "simple-string" has no colon, so recordIdFromString returns it as-is
      await driver.create('relation', { owner: 'simple-string', name: 'test' });

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      expect(arg.owner).toBe('simple-string');
    });

    it('preserves non-object, non-string, non-null values', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('relation', { owner: 42, name: 'test' });

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      expect(arg.owner).toBe(42);
    });

    it('coerces StringRecordId-like objects (covers line 649 branch)', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      // Object with constructor.name === 'StringRecordId' triggers that branch
      const stringRecordIdLike = {
        constructor: { name: 'StringRecordId' },
        toString: () => 'user:42',
      };
      await driver.create('relation', { owner: stringRecordIdLike, name: 'test' });

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      // Should be converted to RecordId via recordIdFromString
      expect(arg.owner).toBeInstanceOf(RecordId);
    });

    it('handles empty string in record ID coercion', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('relation', { owner: '', name: 'test' });

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      expect(arg.owner).toBe('');
    });

    it('coerceRecordIds returns non-plain objects as-is (covers line 619)', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      // Passing a RecordId instance as top-level data means coerceRecordIds
      // receives a non-plain object and returns it at line 619
      const recordId = new RecordId('user', '1');
      await driver.create('user', recordId);

      expect(builder.content).toHaveBeenCalledWith(recordId);
    });

    it('coerceRecordIds returns null/undefined top-level input (line 616 guards)', async () => {
      driver.connected = true;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      // Direct invocation of private coerceRecordIds to cover defensive null/undefined guards
      const resultNull = (driver as any).coerceRecordIds('user', null);
      expect(resultNull).toBeNull();

      const resultUndefined = (driver as any).coerceRecordIds('user', undefined);
      expect(resultUndefined).toBeUndefined();
    });
  });

  describe('recordIdFromString edge cases', () => {
    it('returns string as-is when no colon present', () => {
      const result = (driver as any).recordIdFromString('plain');
      expect(result).toBe('plain');
    });

    it('returns string as-is when empty table name', () => {
      // This would be table="", id="" → from ":something" which gives tableName=""
      // But parseTableWithId for ":test" gives tableName="" and recordId="test"
      // recordIdFromString checks "if (!tableName) return value"
      // Actually colonIndex=0 for ":test", tableName="" → returns value
      const result = (driver as any).recordIdFromString(':test');
      expect(result).toBe(':test');
    });

    it('returns string as-is when empty recordId', () => {
      // "user:" → tableName="user", recordId="" → recordId || undefined → undefined, so no recordId
      // This means it returns value (the original string)
      const result = (driver as any).recordIdFromString('user:');
      expect(result).toBe('user:');
    });

    it('converts valid table:id strings to RecordId', () => {
      const result = (driver as any).recordIdFromString('user:42');
      expect(result).toBeInstanceOf(RecordId);
    });
  });

  describe('isPlainObject (indirectly tested)', () => {
    it('returns true for plain objects', () => {
      // Tested through transformDatetimeValues which uses isPlainObject
      // A plain object should have its datetime fields transformed
      const result = (driver as any).isPlainObject({});
      expect(result).toBe(true);

      const result2 = (driver as any).isPlainObject({ a: 1 });
      expect(result2).toBe(true);
    });

    it('returns false for class instances', () => {
      const result = (driver as any).isPlainObject(new RecordId('t', '1'));
      expect(result).toBe(false);
    });

    it('returns false for null', () => {
      const result = (driver as any).isPlainObject(null);
      expect(result).toBe(false);
    });

    it('returns false for arrays', () => {
      const result = (driver as any).isPlainObject([1, 2, 3]);
      expect(result).toBe(false);
    });
  });
});
