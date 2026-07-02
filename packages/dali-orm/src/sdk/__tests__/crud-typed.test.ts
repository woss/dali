import { describe, expect, it, vi } from 'vite-plus/test';
import { DaliORM } from '../dali-orm.js';
import type { SurrealDriver } from '../driver/types.js';
import { defineTable } from '../table.js';
import { string, int } from '../schema/column/simple-builders.js';

// =============================================================================
// Table definition for typed CRUD tests
// =============================================================================

const usersTable = defineTable('users', {
  name: string('name'),
  age: int('age'),
});

const emptyTable = defineTable('nowhere', {});

// =============================================================================
// insertInto — typed insert
// =============================================================================

describe('insertInto', () => {
  it('delegates to driver.insert with table name and single record, returns typed result', async () => {
    const mockInsert = vi.fn().mockResolvedValue([{ id: 'users:1', name: 'Alice', age: 30 }]);
    const mockDriver = { insert: mockInsert } as unknown as SurrealDriver;

    // @ts-expect-error - accessing private constructor for testing
    const orm = new DaliORM(mockDriver);

    const result = await orm.insertInto(usersTable, { name: 'Alice', age: 30 });

    expect(mockInsert).toHaveBeenCalledOnce();
    expect(mockInsert).toHaveBeenCalledWith('users', { name: 'Alice', age: 30 });
    expect(result).toEqual([{ id: 'users:1', name: 'Alice', age: 30 }]);
  });

  it('accepts array of records', async () => {
    const mockInsert = vi.fn().mockResolvedValue([
      { id: 'users:1', name: 'Alice', age: 30 },
      { id: 'users:2', name: 'Bob', age: 25 },
    ]);
    const mockDriver = { insert: mockInsert } as unknown as SurrealDriver;

    // @ts-expect-error - accessing private constructor for testing
    const orm = new DaliORM(mockDriver);

    const records = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const result = await orm.insertInto(usersTable, records);

    expect(mockInsert).toHaveBeenCalledWith('users', records);
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { id: 'users:1', name: 'Alice', age: 30 },
      { id: 'users:2', name: 'Bob', age: 25 },
    ]);
  });

  it('returns empty array when driver returns no records', async () => {
    const mockInsert = vi.fn().mockResolvedValue([]);
    const mockDriver = { insert: mockInsert } as unknown as SurrealDriver;

    // @ts-expect-error - accessing private constructor for testing
    const orm = new DaliORM(mockDriver);

    const result = await orm.insertInto(usersTable, { name: 'Nobody', age: 0 });
    expect(result).toEqual([]);
  });

  it('passes through driver.insert errors', async () => {
    const mockError = new Error('Insert failed: duplicate key');
    const mockInsert = vi.fn().mockRejectedValue(mockError);
    const mockDriver = { insert: mockInsert } as unknown as SurrealDriver;

    // @ts-expect-error - accessing private constructor for testing
    const orm = new DaliORM(mockDriver);

    await expect(orm.insertInto(usersTable, { name: 'Fail', age: 1 })).rejects.toThrow(
      'Insert failed: duplicate key',
    );
  });
});

// =============================================================================
// updateTable — typed update (all fields optional)
// =============================================================================

describe('updateTable', () => {
  it('delegates to driver.update with table name and data, returns typed result', async () => {
    const mockUpdate = vi
      .fn()
      .mockResolvedValue([{ id: 'users:1', name: 'Alice Updated', age: 31 }]);
    const mockDriver = { update: mockUpdate } as unknown as SurrealDriver;

    // @ts-expect-error - accessing private constructor for testing
    const orm = new DaliORM(mockDriver);

    const result = await orm.updateTable(usersTable, { name: 'Alice Updated', age: 31 });

    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith('users', { name: 'Alice Updated', age: 31 });
    expect(result).toEqual([{ id: 'users:1', name: 'Alice Updated', age: 31 }]);
  });

  it('allows partial update with only some fields', async () => {
    const mockUpdate = vi.fn().mockResolvedValue([{ id: 'users:1', name: 'Alice', age: 30 }]);
    const mockDriver = { update: mockUpdate } as unknown as SurrealDriver;

    // @ts-expect-error - accessing private constructor for testing
    const orm = new DaliORM(mockDriver);

    const result = await orm.updateTable(usersTable, { age: 30 });

    expect(mockUpdate).toHaveBeenCalledWith('users', { age: 30 });
    expect(result).toEqual([{ id: 'users:1', name: 'Alice', age: 30 }]);
  });

  it('returns empty array when driver returns no records', async () => {
    const mockUpdate = vi.fn().mockResolvedValue([]);
    const mockDriver = { update: mockUpdate } as unknown as SurrealDriver;

    // @ts-expect-error - accessing private constructor for testing
    const orm = new DaliORM(mockDriver);

    const result = await orm.updateTable(usersTable, { name: 'Nobody' });
    expect(result).toEqual([]);
  });

  it('passes through driver.update errors', async () => {
    const mockError = new Error('Update failed: record not found');
    const mockUpdate = vi.fn().mockRejectedValue(mockError);
    const mockDriver = { update: mockUpdate } as unknown as SurrealDriver;

    // @ts-expect-error - accessing private constructor for testing
    const orm = new DaliORM(mockDriver);

    await expect(orm.updateTable(usersTable, { name: 'Fail' })).rejects.toThrow(
      'Update failed: record not found',
    );
  });
});

// =============================================================================
// deleteFrom — typed delete (all records)
// =============================================================================

describe('deleteFrom', () => {
  it('delegates to driver.delete with table name, returns typed result', async () => {
    const mockDelete = vi.fn().mockResolvedValue([
      { id: 'users:1', name: 'Alice', age: 30 },
      { id: 'users:2', name: 'Bob', age: 25 },
    ]);
    const mockDriver = { delete: mockDelete } as unknown as SurrealDriver;

    // @ts-expect-error - accessing private constructor for testing
    const orm = new DaliORM(mockDriver);

    const result = await orm.deleteFrom(usersTable);

    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith('users');
    expect(result).toEqual([
      { id: 'users:1', name: 'Alice', age: 30 },
      { id: 'users:2', name: 'Bob', age: 25 },
    ]);
  });

  it('returns empty array when driver returns no records', async () => {
    const mockDelete = vi.fn().mockResolvedValue([]);
    const mockDriver = { delete: mockDelete } as unknown as SurrealDriver;

    // @ts-expect-error - accessing private constructor for testing
    const orm = new DaliORM(mockDriver);

    const result = await orm.deleteFrom(emptyTable);
    expect(result).toEqual([]);
  });

  it('passes through driver.delete errors', async () => {
    const mockError = new Error('Delete failed: permission denied');
    const mockDelete = vi.fn().mockRejectedValue(mockError);
    const mockDriver = { delete: mockDelete } as unknown as SurrealDriver;

    // @ts-expect-error - accessing private constructor for testing
    const orm = new DaliORM(mockDriver);

    await expect(orm.deleteFrom(usersTable)).rejects.toThrow('Delete failed: permission denied');
  });
});

// =============================================================================
// selectFrom — typed select (verification alongside insert/update/delete)
// =============================================================================

describe('selectFrom', () => {
  it('delegates to driver.select with table name, returns typed result', async () => {
    const mockSelect = vi.fn().mockResolvedValue([{ id: 'users:1', name: 'Alice', age: 30 }]);
    const mockDriver = { select: mockSelect } as unknown as SurrealDriver;

    // @ts-expect-error - accessing private constructor for testing
    const orm = new DaliORM(mockDriver);

    const result = await orm.selectFrom(usersTable);

    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockSelect).toHaveBeenCalledWith('users');
    expect(result).toEqual([{ id: 'users:1', name: 'Alice', age: 30 }]);
  });

  it('passes through driver.select errors', async () => {
    const mockError = new Error('Select failed: connection lost');
    const mockSelect = vi.fn().mockRejectedValue(mockError);
    const mockDriver = { select: mockSelect } as unknown as SurrealDriver;

    // @ts-expect-error - accessing private constructor for testing
    const orm = new DaliORM(mockDriver);

    await expect(orm.selectFrom(usersTable)).rejects.toThrow('Select failed: connection lost');
  });
});
