/**
 * Tests for query/types.ts
 *
 * Tests the runtime-accessible exports from the types module:
 * - columnRef() factory
 * - recordId() helper
 * - isRelationTable() type guard
 *
 * Also tests the type machinery using compile-time assertions:
 * - ColumnType mapping for every Surreal column type
 * - InferTypedRecord with _columns and fallback paths
 * - InferSelectResult, InferInsertInput, InferUpdateInput
 * - InferRelateInput, InferRelateResult
 * - ColumnsToRecord, InferSelection
 * - WithGraphAliases, wildcard column exclusion
 */

import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ColumnConfig } from '../../sdk/schema/column/types.js';
import type {
  ColumnBuilder,
  TableConfig,
  TableDefinition,
} from '../../sdk/table.js';
import type {
  ColumnRef,
  ColumnsToRecord,
  ColumnType,
  InferInsertInput,
  InferRelateInput,
  InferRelateResult,
  InferSelection,
  InferSelectResult,
  InferTypedRecord,
  InferUpdateInput,
  SelectField,
  WithGraphAliases,
} from '../types.js';
import { columnRef, isRelationTable, recordId } from '../types.js';

// ============================================================================
// Helper types for building test table definitions
// ============================================================================

type MockTableDef<TColumns extends Record<string, ColumnBuilder>> =
  TableDefinition & {
    _columns: TColumns;
  };

// ============================================================================
// 1. columnRef - Branded Column Reference Factory
// ============================================================================

describe('columnRef', () => {
  it('creates ColumnRef with correct branded structure', () => {
    const ref = columnRef<'name', string>('name', '' as string, 'user');

    expect(ref).toEqual({
      _brand: 'ColumnRef',
      name: 'name',
      _type: '',
      tableName: 'user',
    });
  });

  it('creates ColumnRef with number type', () => {
    const ref = columnRef<'age', number>('age', 0 as number, 'user');

    expect(ref._brand).toBe('ColumnRef');
    expect(ref.name).toBe('age');
    expect(ref.tableName).toBe('user');
  });

  it('creates ColumnRef with different table names', () => {
    const userCol = columnRef<'id', string>('id', '' as string, 'user');
    const postCol = columnRef<'id', string>('id', '' as string, 'post');

    expect(userCol.tableName).toBe('user');
    expect(postCol.tableName).toBe('post');
    expect(userCol.name).toBe(postCol.name);
  });

  it('creates ColumnRef with complex generic names', () => {
    const ref = columnRef<'user.first_name', string>(
      'user.first_name',
      '' as string,
      'employee',
    );

    expect(ref.name).toBe('user.first_name');
    expect(ref.tableName).toBe('employee');
  });

  it('creates ColumnRef with optional/undefined type', () => {
    const ref = columnRef<'email', string | undefined>(
      'email',
      undefined as unknown as string,
      'user',
    );

    expect(ref.name).toBe('email');
    expect(ref.tableName).toBe('user');
  });

  it('preserves structural typing: same name/type/table are equal', () => {
    const a = columnRef<'name', string>('name', '' as string, 'user');
    const b = columnRef<'name', string>('name', '' as string, 'user');

    expect(a).toEqual(b);
  });

  it('ColumnRef satisfies the ColumnRef interface', () => {
    const ref = columnRef<'name', string>('name', '' as string, 'user');
    expectTypeOf<typeof ref>().toMatchTypeOf<ColumnRef>();
  });
});

// ============================================================================
// 2. recordId - Record ID Constructor
// ============================================================================

describe('recordId', () => {
  it('constructs table:id from table name string', () => {
    expect(recordId('user', 'abc-123')).toBe('user:abc-123');
  });

  it('constructs table:id from table object with name', () => {
    const table = { name: 'sessions' };
    expect(recordId(table, 'abc-123')).toBe('sessions:abc-123');
  });

  it('returns id as-is if already contains colon (table:record format)', () => {
    expect(recordId('user', 'user:alice')).toBe('user:alice');
  });

  it('returns id as-is for cross-table record references', () => {
    expect(recordId('post', 'user:alice')).toBe('user:alice');
  });

  it('handles UUID-style IDs', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(recordId('document', uuid)).toBe(`document:${uuid}`);
  });

  it('handles numeric IDs as strings', () => {
    expect(recordId('product', '42')).toBe('product:42');
  });

  it('throws on empty id', () => {
    expect(() => recordId('user', '')).toThrow('Record ID is required');
  });

  it('throws on undefined id', () => {
    expect(() => recordId('user', undefined as unknown as string)).toThrow(
      'Record ID is required',
    );
  });

  it('throws on null id', () => {
    expect(() => recordId('user', null as unknown as string)).toThrow(
      'Record ID is required',
    );
  });

  it('extracts name from table-like object with name property', () => {
    const tableDef = { name: 'memories', columns: [], config: {} };
    expect(recordId(tableDef, 'xyz')).toBe('memories:xyz');
  });
});

// ============================================================================
// 3. isRelationTable - Table Config Type Guard
// ============================================================================

describe('isRelationTable', () => {
  it('returns true for relation table config', () => {
    const config = { type: 'relation' as const, in: 'user', out: 'post' };
    expect(isRelationTable(config)).toBe(true);
  });

  it('returns true for relation config with extra properties', () => {
    const config = {
      type: 'relation' as const,
      in: 'user',
      out: 'post',
      schema: 'full' as const,
    };
    expect(isRelationTable(config)).toBe(true);
  });

  it('returns true for multi-IN relation config', () => {
    const config = {
      type: 'relation' as const,
      in: ['user', 'admin'],
      out: 'post',
    };
    expect(isRelationTable(config)).toBe(true);
  });

  it('returns false for normal table config', () => {
    const config = { type: 'normal' as const, schema: 'full' as const };
    expect(isRelationTable(config)).toBe(false);
  });

  it('returns false for minimal table config (no type)', () => {
    const config = { schema: 'full' as const };
    expect(isRelationTable(config)).toBe(false);
  });

  it('throws on null (no guard clause)', () => {
    expect(() => isRelationTable(null as unknown as any)).toThrow();
  });

  it('throws on undefined (no guard clause)', () => {
    expect(() => isRelationTable(undefined as unknown as any)).toThrow();
  });

  it('returns false if type is relation but missing in/out', () => {
    const config = { type: 'relation' as const };
    expect(isRelationTable(config)).toBe(false);
  });

  it('returns false if type is relation but missing out', () => {
    const config = { type: 'relation' as const, in: 'user' };
    expect(isRelationTable(config)).toBe(false);
  });

  it('returns false if type is relation but missing in', () => {
    const config = { type: 'relation' as const, out: 'post' };
    expect(isRelationTable(config)).toBe(false);
  });

  it('returns false for array', () => {
    expect(isRelationTable([] as any)).toBe(false);
  });
});

// ============================================================================
// 4. Module Loads Successfully
// ============================================================================

describe('module exports', () => {
  it('exports columnRef as a function', () => {
    expect(typeof columnRef).toBe('function');
  });

  it('exports recordId as a function', () => {
    expect(typeof recordId).toBe('function');
  });

  it('exports isRelationTable as a function', () => {
    expect(typeof isRelationTable).toBe('function');
  });
});

// ============================================================================
// 5. ColumnType - Compile-Time Type Mapping
// ============================================================================

describe('ColumnType', () => {
  it('maps string to string', () => {
    expectTypeOf<ColumnType<{ type: 'string' }>>().toEqualTypeOf<string>();
  });

  it('maps int to number', () => {
    expectTypeOf<ColumnType<{ type: 'int' }>>().toEqualTypeOf<number>();
  });

  it('maps float to number', () => {
    expectTypeOf<ColumnType<{ type: 'float' }>>().toEqualTypeOf<number>();
  });

  it('maps decimal to number', () => {
    expectTypeOf<ColumnType<{ type: 'decimal' }>>().toEqualTypeOf<number>();
  });

  it('maps number to number', () => {
    expectTypeOf<ColumnType<{ type: 'number' }>>().toEqualTypeOf<number>();
  });

  it('maps bool to boolean', () => {
    expectTypeOf<ColumnType<{ type: 'bool' }>>().toEqualTypeOf<boolean>();
  });

  it('maps datetime to Date | string', () => {
    expectTypeOf<ColumnType<{ type: 'datetime' }>>().toEqualTypeOf<
      Date | string
    >();
  });

  it('maps duration to string', () => {
    expectTypeOf<ColumnType<{ type: 'duration' }>>().toEqualTypeOf<string>();
  });

  it('maps array to unknown[]', () => {
    expectTypeOf<ColumnType<{ type: 'array' }>>().toEqualTypeOf<unknown[]>();
  });

  it('maps object to Record<string, unknown>', () => {
    expectTypeOf<ColumnType<{ type: 'object' }>>().toEqualTypeOf<
      Record<string, unknown>
    >();
  });

  it('maps record to string', () => {
    expectTypeOf<ColumnType<{ type: 'record' }>>().toEqualTypeOf<string>();
  });

  it('maps null to null', () => {
    expectTypeOf<ColumnType<{ type: 'null' }>>().toEqualTypeOf<null>();
  });

  it('does not map string to number (negative check)', () => {
    expectTypeOf<ColumnType<{ type: 'string' }>>().not.toEqualTypeOf<number>();
  });
});

// ============================================================================
// 6. InferTypedRecord - _columns path (ColumnBuilder objects)
// ============================================================================

describe('InferTypedRecord', () => {
  it('infers required columns from _columns', () => {
    type TestDef = MockTableDef<{
      name: ColumnBuilder<'string'>;
      age: ColumnBuilder<'int'>;
    }>;
    type Result = InferTypedRecord<TestDef>;

    expectTypeOf<Result>().toHaveProperty('id');
    expectTypeOf<Result['id']>().toEqualTypeOf<string>();
    expectTypeOf<Result['name']>().toEqualTypeOf<string>();
    expectTypeOf<Result['age']>().toEqualTypeOf<number>();
  });

  it('infers optional columns as T | undefined from _columns', () => {
    type TestDef = MockTableDef<{
      name: ColumnBuilder<'string'>;
      email: ColumnBuilder<'string'> & { _optional: true };
    }>;
    type Result = InferTypedRecord<TestDef>;

    expectTypeOf<Result['name']>().toEqualTypeOf<string>();
    expectTypeOf<Result['email']>().toEqualTypeOf<string | undefined>();
  });

  it('excludes wildcard columns (.* pattern) from _columns', () => {
    type TestDef = MockTableDef<{
      name: ColumnBuilder<'string'>;
      'meta.*': ColumnBuilder<'object'>;
    }>;
    type Result = InferTypedRecord<TestDef>;

    // name should exist
    expectTypeOf<Result>().toHaveProperty('name');
    // wildcard column should be excluded
    type Keys = keyof Result;
    expectTypeOf<Keys>().not.toEqualTypeOf<'meta.*'>();
  });

  it('infers columns from fallback columns array', () => {
    type FallbackDef = {
      name: string;
      columns: [
        { name: 'title'; config: { type: 'string' } },
        { name: 'score'; config: { type: 'int' } },
      ];
      config: TableConfig;
    };
    type Result = InferTypedRecord<FallbackDef>;

    expectTypeOf<Result['id']>().toEqualTypeOf<string>();
    expectTypeOf<Result['title']>().toEqualTypeOf<string>();
    expectTypeOf<Result['score']>().toEqualTypeOf<number>();
  });

  it('infers optional columns from fallback with optional flag', () => {
    type FallbackDef = {
      name: string;
      columns: [
        { name: 'title'; config: { type: 'string' } },
        { name: 'summary'; config: { type: 'string'; optional: true } },
      ];
      config: TableConfig;
    };
    type Result = InferTypedRecord<FallbackDef>;

    expectTypeOf<Result['title']>().toEqualTypeOf<string>();
    expectTypeOf<Result['summary']>().toEqualTypeOf<string | undefined>();
  });

  it('excludes wildcard columns from fallback path', () => {
    type FallbackDef = {
      name: string;
      columns: [
        { name: 'name'; config: { type: 'string' } },
        { name: 'data.*'; config: { type: 'object' } },
      ];
      config: TableConfig;
    };
    type Result = InferTypedRecord<FallbackDef>;

    expectTypeOf<Result>().toHaveProperty('name');
    type Keys = keyof Result;
    expectTypeOf<Keys>().not.toEqualTypeOf<'data.*'>();
  });
});

// ============================================================================
// 7. InferSelectResult - alias for InferTypedRecord
// ============================================================================

describe('InferSelectResult', () => {
  it('equals InferTypedRecord', () => {
    type TestDef = MockTableDef<{
      name: ColumnBuilder<'string'>;
    }>;
    type SelectResult = InferSelectResult<TestDef>;
    type TypedRecord = InferTypedRecord<TestDef>;

    expectTypeOf<SelectResult>().toEqualTypeOf<TypedRecord>();
  });

  it('produces a record with id and columns', () => {
    type TestDef = MockTableDef<{
      name: ColumnBuilder<'string'>;
      active: ColumnBuilder<'bool'>;
    }>;
    type Result = InferSelectResult<TestDef>;

    expectTypeOf<Result['id']>().toEqualTypeOf<string>();
    expectTypeOf<Result['name']>().toEqualTypeOf<string>();
    expectTypeOf<Result['active']>().toEqualTypeOf<boolean>();
  });
});

// ============================================================================
// 8. InferInsertInput - Partial of InferTypedRecord
// ============================================================================

describe('InferInsertInput', () => {
  it('makes all fields optional', () => {
    type TestDef = MockTableDef<{
      name: ColumnBuilder<'string'>;
      age: ColumnBuilder<'int'>;
    }>;
    type Input = InferInsertInput<TestDef>;

    expectTypeOf<Input['name']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Input['age']>().toEqualTypeOf<number | undefined>();
  });
});

// ============================================================================
// 9. InferUpdateInput - Partial of InferTypedRecord
// ============================================================================

describe('InferUpdateInput', () => {
  it('makes all fields optional', () => {
    type TestDef = MockTableDef<{
      name: ColumnBuilder<'string'>;
      active: ColumnBuilder<'bool'>;
    }>;
    type Input = InferUpdateInput<TestDef>;

    expectTypeOf<Input['name']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Input['active']>().toEqualTypeOf<boolean | undefined>();
  });
});

// ============================================================================
// 10. ColumnsToRecord - _columns to Record<string, ColumnRef>
// ============================================================================

describe('ColumnsToRecord', () => {
  it('maps column definitions to ColumnRef records', () => {
    type TestDef = MockTableDef<{
      name: ColumnBuilder<'string'>;
      age: ColumnBuilder<'int'>;
    }>;
    type Rec = ColumnsToRecord<TestDef>;

    expectTypeOf<Rec>().toHaveProperty('name');
    expectTypeOf<Rec>().toHaveProperty('age');
    expectTypeOf<Rec['name']>().toMatchTypeOf<ColumnRef>();
    expectTypeOf<Rec['age']>().toMatchTypeOf<ColumnRef>();
  });
});

// ============================================================================
// 11. InferSelection - Drizzle-style selection mapping
// ============================================================================

describe('InferSelection', () => {
  it('infers selection result from ColumnRef map', () => {
    const nameCol = columnRef<'name', string>('name', '' as string, 'user');
    const ageCol = columnRef<'age', number>('age', 0 as number, 'user');
    type Sel = { userName: typeof nameCol; userAge: typeof ageCol };
    type Result = InferSelection<Sel>;

    expectTypeOf<Result['userName']>().toEqualTypeOf<string>();
    expectTypeOf<Result['userAge']>().toEqualTypeOf<number>();
  });
});

// ============================================================================
// 12. WithGraphAliases - intersection type
// ============================================================================

describe('WithGraphAliases', () => {
  it('combines base type with aliases', () => {
    type Base = { id: string; name: string };
    type Aliases = { post_title: string; post_count: number };
    type Result = WithGraphAliases<Base, Aliases>;

    expectTypeOf<Result['id']>().toEqualTypeOf<string>();
    expectTypeOf<Result['name']>().toEqualTypeOf<string>();
    expectTypeOf<Result['post_title']>().toEqualTypeOf<string>();
    expectTypeOf<Result['post_count']>().toEqualTypeOf<number>();
  });

  it('intersection narrows conflicting types to never', () => {
    type Base = { name: string };
    type Aliases = { name: number };
    type Result = WithGraphAliases<Base, Aliases>;

    // string & number = never in intersection
    expectTypeOf<Result['name']>().toBeNever();
  });
});

// ============================================================================
// 13. InferRelateInput - uses _columns path
// ============================================================================

describe('InferRelateInput', () => {
  it('produces typed input from _columns without id', () => {
    type EdgeDef = MockTableDef<{
      rating: ColumnBuilder<'int'> & { _optional: true };
      comment: ColumnBuilder<'string'> & { _optional: true };
    }>;
    type Input = InferRelateInput<EdgeDef>;

    expectTypeOf<Input>().not.toHaveProperty('id');
    expectTypeOf<Input['rating']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<Input['comment']>().toEqualTypeOf<string | undefined>();
  });

  it('produces Record<string, unknown> for non-_columns table', () => {
    type SimpleDef = { name: string; columns: never[]; config: TableConfig };
    type Input = InferRelateInput<SimpleDef>;

    expectTypeOf<Input>().toEqualTypeOf<Record<string, unknown>>();
  });
});

// ============================================================================
// 14. InferRelateResult - InferTypedRecord & { in: string; out: string }
// ============================================================================

describe('InferRelateResult', () => {
  it('extends InferTypedRecord with in/out fields', () => {
    type EdgeDef = MockTableDef<{
      rating: ColumnBuilder<'int'>;
    }>;
    type Result = InferRelateResult<EdgeDef>;

    expectTypeOf<Result['id']>().toEqualTypeOf<string>();
    expectTypeOf<Result['rating']>().toEqualTypeOf<number>();
    expectTypeOf<Result['in']>().toEqualTypeOf<string>();
    expectTypeOf<Result['out']>().toEqualTypeOf<string>();
  });
});

// ============================================================================
// 15. SelectField alias
// ============================================================================

describe('SelectField', () => {
  it('is an alias for ColumnRef', () => {
    expectTypeOf<SelectField>().toEqualTypeOf<ColumnRef>();
  });
});
