/**
 * BaseDriver — CRUD (select, create, insert, update, delete, upsert, upsertWhere, relate) tests.
 *
 * Extracted from base-driver.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('surrealdb', () => {
  class MockRecordId {
    constructor(
      public tb: string,
      public id: string | number,
    ) {}
    toJSON() {
      return { tb: this.tb, id: this.id };
    }
    toString() {
      return `${this.tb}:${this.id}`;
    }
  }
  class MockTable {
    constructor(public name: string) {}
    toString() {
      return this.name;
    }
  }
  class MockDateTime {
    value: string;
    constructor(d: Date | string) {
      this.value = d instanceof Date ? d.toISOString() : d;
    }
    toString() {
      return this.value;
    }
    toJSON() {
      return { dt: this.value };
    }
  }
  return { RecordId: MockRecordId, Table: MockTable, DateTime: MockDateTime };
});

import { RecordId, Table } from 'surrealdb';
import {
  TestDriver,
  createMockDb,
  state,
  builderThenable,
  thenableResolve,
  thenableReject,
} from './driver-test-utils.js';
import type { MockDb } from './driver-test-utils.js';

describe('BaseDriver', () => {
  let mockDb: MockDb;
  let driver: TestDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    state.shouldDateTimeThrow = false;
    mockDb = createMockDb();
    driver = new TestDriver(mockDb as unknown as Record<string, import('vitest').Mock>);
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
});
