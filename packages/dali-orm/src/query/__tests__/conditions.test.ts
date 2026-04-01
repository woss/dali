import { describe, expect, it, vi } from 'vite-plus/test';
import {
  allConditions,
  anyConditions,
  buildCondition,
  // Re-exports from surrealdb
  eq,
  gt,
  isNotNull,
  isNull,
  isSerializedCondition,
  negateCondition,
  raw,
} from '../conditions.js';

// ============================================================================
// 1. buildCondition
// ============================================================================

describe('buildCondition', () => {
  it('produces correct SQL pattern from field name and operator', () => {
    const result = buildCondition('name', '=', 'Alice');
    expect(result.sql).toMatch(/^name = \$p_name_\d+$/);
  });

  it('stores value in params with generated param name', () => {
    const result = buildCondition('name', '=', 'Alice');
    const paramName = result.sql.replace('name = $', '');
    expect(result.params[paramName]).toBe('Alice');
  });

  it('uses custom paramPrefix in param name', () => {
    const result = buildCondition('age', '>', 25, 'q');
    expect(result.sql).toMatch(/^age > \$q_age_\d+$/);
    const paramName = result.sql.replace('age > $', '');
    expect(result.params[paramName]).toBe(25);
  });

  it('works with all ConditionOp values', () => {
    const ops = [
      '=',
      '==',
      '!=',
      '>',
      '>=',
      '<',
      '<=',
      'CONTAINS',
      'CONTAINSANY',
      'CONTAINSALL',
      'CONTAINSNONE',
      'INSIDE',
      'OUTSIDE',
      'INTERSECTS',
      'IN',
      '~',
      '!~',
    ] as const;

    for (const op of ops) {
      const result = buildCondition('field', op, 1);
      expect(result.sql).toContain(`field ${op} $`);
      expect(result.params).toBeDefined();
    }
  });

  it('sanitizes special characters in field name for param name', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    const result = buildCondition('my-field.name!', '=', 'val');
    expect(result.sql).toMatch(/^my-field\.name! = \$p_my_field_name__1000$/);

    vi.useRealTimers();
  });

  it('generates unique param names for successive calls', () => {
    vi.useFakeTimers();
    let callCount = 0;

    // Set Date.now to return sequential values
    const spy = vi.spyOn(Date, 'now');
    spy.mockImplementation(() => 1000 + callCount++ * 10);

    const r1 = buildCondition('name', '=', 'Alice');
    const r2 = buildCondition('name', '=', 'Bob');

    const p1 = r1.sql.replace('name = $', '');
    const p2 = r2.sql.replace('name = $', '');

    expect(p1).not.toBe(p2);
    expect(r1.params[p1]).toBe('Alice');
    expect(r2.params[p2]).toBe('Bob');

    vi.useRealTimers();
    spy.mockRestore();
  });

  it('handles boolean and null values', () => {
    const r1 = buildCondition('active', '=', true);
    const r2 = buildCondition('deleted', '=', null);

    const p1 = r1.sql.replace('active = $', '');
    const p2 = r2.sql.replace('deleted = $', '');

    expect(r1.params[p1]).toBe(true);
    expect(r2.params[p2]).toBeNull();
  });

  it('handles array values', () => {
    const result = buildCondition('tags', 'CONTAINSALL', ['a', 'b']);
    const paramName = result.sql.replace('tags CONTAINSALL $', '');
    expect(result.params[paramName]).toEqual(['a', 'b']);
  });

  it('handles numeric zero and empty string values', () => {
    const r1 = buildCondition('count', '=', 0);
    const r2 = buildCondition('name', '=', '');

    const p1 = r1.sql.replace('count = $', '');
    const p2 = r2.sql.replace('name = $', '');

    expect(r1.params[p1]).toBe(0);
    expect(r2.params[p2]).toBe('');
  });
});

// ============================================================================
// 2. isNull
// ============================================================================

describe('isNull', () => {
  it('produces IS NONE SQL', () => {
    expect(isNull('name').sql).toBe('name = NONE');
  });

  it('returns empty params', () => {
    expect(isNull('name').params).toEqual({});
  });

  it('works with dotted field paths', () => {
    expect(isNull('user.profile.name').sql).toBe('user.profile.name = NONE');
  });
});

// ============================================================================
// 3. isNotNull
// ============================================================================

describe('isNotNull', () => {
  it('produces IS NOT NONE SQL', () => {
    expect(isNotNull('name').sql).toBe('name != NONE');
  });

  it('returns empty params', () => {
    expect(isNotNull('name').params).toEqual({});
  });

  it('works with dotted field paths', () => {
    expect(isNotNull('user.profile.name').sql).toBe('user.profile.name != NONE');
  });
});

// ============================================================================
// 4. allConditions (AND)
// ============================================================================

describe('allConditions', () => {
  it('returns empty result for zero conditions', () => {
    const result = allConditions();
    expect(result.sql).toBe('');
    expect(result.params).toEqual({});
  });

  it('returns the condition directly for single condition', () => {
    const cond = buildCondition('name', '=', 'Alice');
    const result = allConditions(cond);

    expect(result).toBe(cond);
    expect(result.sql).toBe(cond.sql);
    expect(result.params).toEqual(cond.params);
  });

  it('AND-joins multiple conditions with merged params', () => {
    const c1 = buildCondition('name', '=', 'Alice');
    const c2 = buildCondition('age', '>', 25);

    const result = allConditions(c1, c2);

    expect(result.sql).toContain(c1.sql);
    expect(result.sql).toContain('AND');
    expect(result.sql).toContain(c2.sql);

    // Params from both conditions should be merged
    const p1 = c1.sql.replace('name = $', '');
    const p2 = c2.sql.replace('age > $', '');
    expect(result.params[p1]).toBe('Alice');
    expect(result.params[p2]).toBe(25);
  });

  it('AND-joins three conditions', () => {
    const c1 = buildCondition('name', '=', 'Alice');
    const c2 = buildCondition('age', '>', 25);
    const c3 = buildCondition('active', '=', true);

    const result = allConditions(c1, c2, c3);

    expect(result.sql).toContain(c1.sql);
    expect(result.sql).toContain(c2.sql);
    expect(result.sql).toContain(c3.sql);
    // Should have two ANDs between three conditions
    expect(result.sql.match(/AND/g)).toHaveLength(2);
  });

  it('works with isNull/isNotNull conditions (empty params)', () => {
    const c1 = isNull('deletedAt');
    const c2 = buildCondition('active', '=', true);

    const result = allConditions(c1, c2);

    expect(result.sql).toContain('deletedAt = NONE');
    expect(result.sql).toContain('AND');

    const p2 = c2.sql.replace('active = $', '');
    expect(result.params[p2]).toBe(true);
  });
});

// ============================================================================
// 5. anyConditions (OR)
// ============================================================================

describe('anyConditions', () => {
  it('returns empty result for zero conditions', () => {
    const result = anyConditions();
    expect(result.sql).toBe('');
    expect(result.params).toEqual({});
  });

  it('returns the condition directly for single condition', () => {
    const cond = buildCondition('name', '=', 'Alice');
    const result = anyConditions(cond);

    expect(result).toBe(cond);
    expect(result.sql).toBe(cond.sql);
    expect(result.params).toEqual(cond.params);
  });

  it('OR-joins multiple conditions with parentheses', () => {
    vi.useFakeTimers();
    let ts = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => ts++);

    const c1 = buildCondition('name', '=', 'Alice');
    const c2 = buildCondition('email', '=', 'bob@test.com');

    const result = anyConditions(c1, c2);

    expect(result.sql).toBe(`(${c1.sql}) OR (${c2.sql})`);
    expect(result.params).toMatchObject(c1.params);
    expect(result.params).toMatchObject(c2.params);

    vi.useRealTimers();
  });

  it('OR-joins three conditions with parentheses', () => {
    const c1 = buildCondition('status', '=', 'pending');
    const c2 = buildCondition('status', '=', 'active');
    const c3 = buildCondition('status', '=', 'archived');

    const result = anyConditions(c1, c2, c3);

    expect(result.sql).toBe(`(${c1.sql}) OR (${c2.sql}) OR (${c3.sql})`);
  });

  it('works with isNull/isNotNull conditions (empty params)', () => {
    const c1 = isNull('deletedAt');
    const c2 = isNull('archivedAt');

    const result = anyConditions(c1, c2);

    expect(result.sql).toBe('(deletedAt = NONE) OR (archivedAt = NONE)');
    expect(result.params).toEqual({});
  });
});

// ============================================================================
// 6. negateCondition
// ============================================================================

describe('negateCondition', () => {
  it('wraps condition in NOT ()', () => {
    const cond = buildCondition('active', '=', true);
    const result = negateCondition(cond);

    expect(result.sql).toBe(`NOT (${cond.sql})`);
  });

  it('preserves original params', () => {
    const cond = buildCondition('name', '=', 'Alice');
    const result = negateCondition(cond);

    expect(result.params).toEqual(cond.params);
  });

  it('does not mutate original condition', () => {
    const cond = buildCondition('age', '>', 25);
    const originalSql = cond.sql;
    const originalParams = { ...cond.params };

    negateCondition(cond);

    expect(cond.sql).toBe(originalSql);
    expect(cond.params).toEqual(originalParams);
  });
});

// ============================================================================
// 7. isSerializedCondition (type guard)
// ============================================================================

describe('isSerializedCondition', () => {
  it('returns true for valid SerializedCondition', () => {
    const cond = buildCondition('name', '=', 'Alice');
    expect(isSerializedCondition(cond)).toBe(true);
  });

  it('returns true for valid condition with extra properties', () => {
    const cond = { sql: 'name = $p', params: { p: 'Alice' }, extra: true };
    expect(isSerializedCondition(cond)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isSerializedCondition(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isSerializedCondition(undefined)).toBe(false);
  });

  it('returns false for string', () => {
    expect(isSerializedCondition('name = $p')).toBe(false);
  });

  it('returns false for number', () => {
    expect(isSerializedCondition(42)).toBe(false);
  });

  it('returns false for array', () => {
    expect(isSerializedCondition([{ sql: 'x', params: {} }])).toBe(false);
  });

  it('returns false for object missing sql', () => {
    expect(isSerializedCondition({ params: {} })).toBe(false);
  });

  it('returns false when sql is not a string', () => {
    expect(isSerializedCondition({ sql: 42, params: {} })).toBe(false);
  });

  it('returns false for object missing params', () => {
    expect(isSerializedCondition({ sql: 'name = $p' })).toBe(false);
  });

  it('returns false when params is not an object', () => {
    expect(isSerializedCondition({ sql: 'name = $p', params: 'not-object' })).toBe(false);
  });

  it('returns false for object with null params', () => {
    expect(isSerializedCondition({ sql: 'name = $p', params: null })).toBe(false);
  });
});

// ============================================================================
// 8. Re-exports from surrealdb
// ============================================================================

describe('surrealdb re-exports', () => {
  it('exports eq as a function', () => {
    expect(typeof eq).toBe('function');
  });

  it('exports gt as a function', () => {
    expect(typeof gt).toBe('function');
  });

  it('exports raw as a function', () => {
    expect(typeof raw).toBe('function');
  });
});

// ============================================================================
// 9. Integration: Combined conditions
// ============================================================================

describe('combined conditions', () => {
  it('allConditions + anyConditions can be nested', () => {
    vi.useFakeTimers();
    let ts = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => ts++);

    const isActive = buildCondition('active', '=', true);
    const isAdmin = buildCondition('role', '=', 'admin');
    const isModerator = buildCondition('role', '=', 'moderator');

    // WHERE active = true AND (role = 'admin' OR role = 'moderator')
    const roleOr = anyConditions(isAdmin, isModerator);
    const combined = allConditions(isActive, roleOr);

    expect(combined.sql).toContain('AND');
    expect(combined.sql).toContain('OR');
    expect(combined.sql).toContain('(');
    expect(combined.sql).toContain(')');

    // All 3 params should be merged
    const count = Object.keys(combined.params).length;
    expect(count).toBe(3);

    vi.useRealTimers();
  });

  it('negateCondition + allConditions can be nested', () => {
    const isDeleted = isNotNull('deletedAt');
    const isActive = buildCondition('active', '=', true);

    // NOT (deletedAt != NONE) AND active = true
    const notDeleted = negateCondition(isDeleted);
    const combined = allConditions(notDeleted, isActive);

    expect(combined.sql).toContain('NOT (');
    expect(combined.sql).toContain('AND');
    expect(combined.params).toEqual(isActive.params);
  });

  it('isSerializedCondition narrows type correctly', () => {
    const values: unknown[] = [buildCondition('x', '=', 1), 'string', null, 42];

    const serialized = values.filter(isSerializedCondition);
    expect(serialized).toHaveLength(1);
    expect(serialized[0]).toHaveProperty('sql');
    expect(serialized[0]).toHaveProperty('params');
  });
});
