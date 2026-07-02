import { describe, expect, it, vi, expectTypeOf } from 'vite-plus/test';
import type { SurrealColumnType } from '../schema/column/types.js';
import type {
  SurrealTypeToTS,
  InferSelectResult,
  InferInsertData,
  InferUpdateData,
} from '../infer-types.js';
import type { TableDefinition, ColumnBuilder } from '../table.js';
import { DaliORM } from '../dali-orm.js';
import type { SurrealDriver } from '../driver/types.js';

// =============================================================================
// SurrealTypeToTS type mapping — compile-time assertions
// =============================================================================

describe('SurrealTypeToTS', () => {
  it("maps 'string' to string", () => {
    expectTypeOf<SurrealTypeToTS<'string'>>().toEqualTypeOf<string>();
  });

  it("maps 'uuid' to string", () => {
    expectTypeOf<SurrealTypeToTS<'uuid'>>().toEqualTypeOf<string>();
  });

  it("maps 'record' to string", () => {
    expectTypeOf<SurrealTypeToTS<'record'>>().toEqualTypeOf<string>();
  });

  it("maps 'duration' to string", () => {
    expectTypeOf<SurrealTypeToTS<'duration'>>().toEqualTypeOf<string>();
  });

  it("maps 'regex' to string", () => {
    expectTypeOf<SurrealTypeToTS<'regex'>>().toEqualTypeOf<string>();
  });

  it("maps 'range' to string", () => {
    expectTypeOf<SurrealTypeToTS<'range'>>().toEqualTypeOf<string>();
  });

  it("maps 'table' to string", () => {
    expectTypeOf<SurrealTypeToTS<'table'>>().toEqualTypeOf<string>();
  });

  it("maps 'file' to string", () => {
    expectTypeOf<SurrealTypeToTS<'file'>>().toEqualTypeOf<string>();
  });

  it("maps 'literal' to string", () => {
    expectTypeOf<SurrealTypeToTS<'literal'>>().toEqualTypeOf<string>();
  });

  it("maps 'int' to number", () => {
    expectTypeOf<SurrealTypeToTS<'int'>>().toEqualTypeOf<number>();
  });

  it("maps 'float' to number", () => {
    expectTypeOf<SurrealTypeToTS<'float'>>().toEqualTypeOf<number>();
  });

  it("maps 'decimal' to number", () => {
    expectTypeOf<SurrealTypeToTS<'decimal'>>().toEqualTypeOf<number>();
  });

  it("maps 'number' to number", () => {
    expectTypeOf<SurrealTypeToTS<'number'>>().toEqualTypeOf<number>();
  });

  it("maps 'bool' to boolean", () => {
    expectTypeOf<SurrealTypeToTS<'bool'>>().toEqualTypeOf<boolean>();
  });

  it("maps 'datetime' to Date | string", () => {
    expectTypeOf<SurrealTypeToTS<'datetime'>>().toEqualTypeOf<Date | string>();
  });

  it("maps 'array' to unknown[]", () => {
    expectTypeOf<SurrealTypeToTS<'array'>>().toEqualTypeOf<unknown[]>();
  });

  it("maps 'set' to unknown[]", () => {
    expectTypeOf<SurrealTypeToTS<'set'>>().toEqualTypeOf<unknown[]>();
  });

  it("maps 'object' to Record<string, unknown>", () => {
    expectTypeOf<SurrealTypeToTS<'object'>>().toEqualTypeOf<Record<string, unknown>>();
  });

  it("maps 'tuple' to unknown[]", () => {
    expectTypeOf<SurrealTypeToTS<'tuple'>>().toEqualTypeOf<unknown[]>();
  });

  it("maps 'geometry' to { type: string; coordinates: number[] }", () => {
    expectTypeOf<SurrealTypeToTS<'geometry'>>().toEqualTypeOf<{
      type: string;
      coordinates: number[];
    }>();
  });

  it("maps 'point' to { type: string; coordinates: number[] }", () => {
    expectTypeOf<SurrealTypeToTS<'point'>>().toEqualTypeOf<{
      type: string;
      coordinates: number[];
    }>();
  });

  it("maps 'bytes' to Uint8Array", () => {
    expectTypeOf<SurrealTypeToTS<'bytes'>>().toEqualTypeOf<Uint8Array>();
  });

  it("maps 'function' to (...args: unknown[]) => unknown", () => {
    expectTypeOf<SurrealTypeToTS<'function'>>().toEqualTypeOf<(...args: unknown[]) => unknown>();
  });

  it("maps 'any' to unknown", () => {
    expectTypeOf<SurrealTypeToTS<'any'>>().toEqualTypeOf<unknown>();
  });

  it("maps 'null' to unknown", () => {
    expectTypeOf<SurrealTypeToTS<'null'>>().toEqualTypeOf<unknown>();
  });
});

// =============================================================================
// InferSelectResult — includes id: string + column mappings
// =============================================================================

describe('InferSelectResult', () => {
  it('includes id: string plus all column types from _columns', () => {
    interface TestTable extends TableDefinition {
      _columns: {
        name: ColumnBuilder<'string'>;
        age: ColumnBuilder<'int'>;
        active: ColumnBuilder<'bool'>;
        created_at: ColumnBuilder<'datetime'>;
        tags: ColumnBuilder<'array'>;
      };
    }

    type Result = InferSelectResult<TestTable>;
    type Expected = { id: string } & {
      name: string;
      age: number;
      active: boolean;
      created_at: Date | string;
      tags: unknown[];
    };
    expectTypeOf<Result>().toEqualTypeOf<Expected>();
  });

  it('falls back to { id: string } when _columns is missing', () => {
    type Result = InferSelectResult<TableDefinition>;
    expectTypeOf<Result>().toEqualTypeOf<{ id: string }>();
  });
});

// =============================================================================
// InferInsertData — excludes 'id' key
// =============================================================================

describe('InferInsertData', () => {
  it('excludes id key from the result type', () => {
    interface TestTable extends TableDefinition {
      _columns: {
        id: ColumnBuilder<'string'>;
        name: ColumnBuilder<'string'>;
        age: ColumnBuilder<'int'>;
      };
    }

    type Result = InferInsertData<TestTable>;
    // 'name' should still be present
    expectTypeOf<Result['name']>().toEqualTypeOf<string>();
    // 'age' should still be present
    expectTypeOf<Result['age']>().toEqualTypeOf<number>();
    // Only keys should be 'name' | 'age' (id excluded)
    type ResultKeys = keyof Result;
    expectTypeOf<ResultKeys>().toEqualTypeOf<'name' | 'age'>();
  });

  it('falls back to {} when _columns is missing', () => {
    type Result = InferInsertData<TableDefinition>;
    expectTypeOf<Result>().toEqualTypeOf<{}>();
  });
});

// =============================================================================
// InferUpdateData — Partial<InferSelectResult>
// =============================================================================

describe('InferUpdateData', () => {
  it('makes all fields optional via Partial', () => {
    interface TestTable extends TableDefinition {
      _columns: {
        name: ColumnBuilder<'string'>;
        age: ColumnBuilder<'int'>;
      };
    }

    type Result = InferUpdateData<TestTable>;
    type Full = InferSelectResult<TestTable>;
    // All fields should be optional: id?, name?, age?
    type Expected = Partial<Full>;
    expectTypeOf<Result>().toEqualTypeOf<Expected>();
  });
});

// =============================================================================
// selectFrom — runtime behavior with mock driver
// =============================================================================

describe('selectFrom', () => {
  it('delegates to driver.select with table name and returns typed results', async () => {
    const mockSelect = vi
      .fn()
      .mockResolvedValue([{ id: 'users:1', name: 'Alice', age: 30, active: true }]);
    const mockDriver = { select: mockSelect } as unknown as SurrealDriver;

    // @ts-expect-error - accessing private constructor for testing
    const orm = new DaliORM(mockDriver);

    const result = await orm.selectFrom({
      name: 'users',
      columns: [],
      config: { schema: 'full', type: 'normal' },
      _columns: {},
    });

    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockSelect).toHaveBeenCalledWith('users');
    expect(result).toEqual([{ id: 'users:1', name: 'Alice', age: 30, active: true }]);
  });

  it('returns empty array when driver returns no records', async () => {
    const mockSelect = vi.fn().mockResolvedValue([]);
    const mockDriver = { select: mockSelect } as unknown as SurrealDriver;

    // @ts-expect-error - accessing private constructor for testing
    const orm = new DaliORM(mockDriver);

    const result = await orm.selectFrom({
      name: 'empty_table',
      columns: [],
      config: { schema: 'full', type: 'normal' },
      _columns: {},
    });

    expect(mockSelect).toHaveBeenCalledWith('empty_table');
    expect(result).toEqual([]);
  });

  it('passes through driver.select errors', async () => {
    const mockError = new Error('DB connection failed');
    const mockSelect = vi.fn().mockRejectedValue(mockError);
    const mockDriver = { select: mockSelect } as unknown as SurrealDriver;

    // @ts-expect-error - accessing private constructor for testing
    const orm = new DaliORM(mockDriver);

    await expect(
      orm.selectFrom({
        name: 'faulty',
        columns: [],
        config: { schema: 'full', type: 'normal' },
        _columns: {},
      }),
    ).rejects.toThrow('DB connection failed');
  });
});
