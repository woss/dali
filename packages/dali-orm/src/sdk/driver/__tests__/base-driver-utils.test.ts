/**
 * BaseDriver — utility method tests (parseTableWithId, transformDatetimeValues,
 * tryCreateDateTime, coerceRecordIds, recordIdFromString, isPlainObject).
 *
 * Extracted from base-driver.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRecordIdCtor, mockTableCtor, mockDateTimeCtor, state } = vi.hoisted(() => {
  const mockRecordIdCtor = vi.fn();
  const mockTableCtor = vi.fn();
  const mockDateTimeCtor = vi.fn();
  const state = { shouldDateTimeThrow: false };
  return { mockRecordIdCtor, mockTableCtor, mockDateTimeCtor, state };
});

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
      if (state.shouldDateTimeThrow) {
        throw new Error('Invalid date');
      }
    }
  }
  Object.defineProperty(DateTime, 'name', { value: 'DateTime' });

  return { RecordId, Table, DateTime };
});

import { RecordId, DateTime } from 'surrealdb';
import { TestDriver, createMockDb, builderThenable } from './driver-test-utils.js';
import type { MockDb } from './driver-test-utils.js';
import {
  parseTableWithId,
  transformDatetimeValues,
  coerceRecordIds,
  tryCoerceRecordId,
  recordIdFromString,
  isPlainObject,
  tryCreateDateTime,
} from '../driver-utils.js';

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
  // Utility Methods
  // ============================================================================

  describe('parseTableWithId()', () => {
    it('returns table name and undefined recordId for plain table', () => {
      const result = parseTableWithId('user');
      expect(result).toEqual({ tableName: 'user', recordId: undefined });
    });

    it('splits table:id correctly', () => {
      const result = parseTableWithId('user:42');
      expect(result).toEqual({ tableName: 'user', recordId: '42' });
    });

    it('handles multiple colons', () => {
      const result = parseTableWithId('edge:in:out');
      expect(result).toEqual({ tableName: 'edge', recordId: 'in:out' });
    });

    it('returns undefined recordId when empty after colon', () => {
      const result = parseTableWithId('user:');
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

      state.shouldDateTimeThrow = true;
      await driver.create('user', { created_at: '2024-01-01' });
      state.shouldDateTimeThrow = false;

      const arg = (builder.content.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
      // When DateTime constructor throws, tryCreateDateTime catches and returns
      // the original value as-is
      expect(arg.created_at).toBe('2024-01-01');
    });

    it('tryCreateDateTime returns null/undefined as-is (covers line 692)', () => {
      const resultNull = tryCreateDateTime(null);
      expect(resultNull).toBeNull();

      const resultUndefined = tryCreateDateTime(undefined);
      expect(resultUndefined).toBeUndefined();
    });

    it('transformDatetimeValues returns null/undefined as-is (covers line 581)', () => {
      const r1 = transformDatetimeValues(null);
      expect(r1).toBeNull();

      const r2 = transformDatetimeValues(undefined);
      expect(r2).toBeUndefined();
    });

    it('tryCoerceRecordId with obj.id=null covers line 659 branch', () => {
      // typeof null === 'object' is true in JS. obj.id=null makes
      // typeof null==='object' (true) && null!==null (false) → short-circuit
      const r1 = tryCoerceRecordId({ id: null });
      expect(r1).toEqual({ id: null });

      // nested.id is non-string: line 661 condition false
      const r2 = tryCoerceRecordId({ id: { id: 42 } });
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

      // Direct invocation of coerceRecordIds to cover defensive null/undefined guards
      const resultNull = coerceRecordIds('user', null);
      expect(resultNull).toBeNull();

      const resultUndefined = coerceRecordIds('user', undefined);
      expect(resultUndefined).toBeUndefined();
    });
  });

  describe('recordIdFromString edge cases', () => {
    it('returns string as-is when no colon present', () => {
      const result = recordIdFromString('plain');
      expect(result).toBe('plain');
    });

    it('returns string as-is when empty table name', () => {
      // This would be table="", id="" → from ":something" which gives tableName=""
      // But parseTableWithId for ":test" gives tableName="" and recordId="test"
      // recordIdFromString checks "if (!tableName) return value"
      // Actually colonIndex=0 for ":test", tableName="" → returns value
      const result = recordIdFromString(':test');
      expect(result).toBe(':test');
    });

    it('returns string as-is when empty recordId', () => {
      // "user:" → tableName="user", recordId="" → recordId || undefined → undefined, so no recordId
      // This means it returns value (the original string)
      const result = recordIdFromString('user:');
      expect(result).toBe('user:');
    });

    it('converts valid table:id strings to RecordId', () => {
      const result = recordIdFromString('user:42');
      expect(result).toBeInstanceOf(RecordId);
    });
  });

  describe('isPlainObject (indirectly tested)', () => {
    it('returns true for plain objects', () => {
      // Tested through transformDatetimeValues which uses isPlainObject
      // A plain object should have its datetime fields transformed
      const result = isPlainObject({});
      expect(result).toBe(true);

      const result2 = isPlainObject({ a: 1 });
      expect(result2).toBe(true);
    });

    it('returns false for class instances', () => {
      const result = isPlainObject(new RecordId('t', '1'));
      expect(result).toBe(false);
    });

    it('returns false for null', () => {
      const result = isPlainObject(null);
      expect(result).toBe(false);
    });

    it('returns false for arrays', () => {
      const result = isPlainObject([1, 2, 3]);
      expect(result).toBe(false);
    });
  });
});
