/**
 * Tests for query/types.ts
 *
 * Tests the runtime-accessible exports from the types module:
 * - columnRef() factory
 * - recordId() helper
 * - isRelationTable() type guard
 *
 * Type-only exports (ColumnRef, InferSelectResult, etc.) are
 * compile-time checked and tested implicitly through query.test.ts
 */

import { describe, expect, it } from 'vite-plus/test';
import { columnRef, isRelationTable, recordId } from '../types.js';

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
    const ref = columnRef<'user.first_name', string>('user.first_name', '' as string, 'employee');

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
    expect(() => recordId('user', undefined as unknown as string)).toThrow('Record ID is required');
  });

  it('throws on null id', () => {
    expect(() => recordId('user', null as unknown as string)).toThrow('Record ID is required');
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
    const config = { type: 'relation' as const, in: ['user', 'admin'], out: 'post' };
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
    // Partial relation config — type is 'relation' but no in/out
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
