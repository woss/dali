import { describe, test, expect } from 'vitest';
import { toPlain } from '../serialization';

// =============================================================================
// toPlain() — pure function, no mocks needed
// =============================================================================

describe('toPlain()', () => {
  // -------------------------------------------------------------------------
  // Primitives — pass through unchanged
  // -------------------------------------------------------------------------

  test('null passes through', () => {
    expect(toPlain(null)).toBeNull();
  });

  test('undefined passes through', () => {
    expect(toPlain(undefined)).toBeUndefined();
  });

  test('string passes through unchanged', () => {
    expect(toPlain('hello')).toBe('hello');
  });

  test('number passes through unchanged', () => {
    expect(toPlain(42)).toBe(42);
    expect(toPlain(0)).toBe(0);
    expect(toPlain(-1.5)).toBe(-1.5);
    expect(toPlain(NaN)).toBeNaN();
    expect(toPlain(Infinity)).toBe(Infinity);
  });

  test('boolean passes through unchanged', () => {
    expect(toPlain(true)).toBe(true);
    expect(toPlain(false)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Date objects — pass through unchanged
  // -------------------------------------------------------------------------

  test('Date passes through unchanged', () => {
    const d = new Date('2024-01-15T12:00:00Z');
    expect(toPlain(d)).toBe(d);
  });

  // -------------------------------------------------------------------------
  // Plain objects — recursively converted, keys preserved
  // -------------------------------------------------------------------------

  test('plain object: keys preserved and values recursively converted', () => {
    const input = { a: 1, b: 'two', c: true, d: null };
    const result = toPlain(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input); // shallow copy
  });

  test('plain object: nested plain objects are recursively converted', () => {
    const input = { inner: { x: 10, y: 'hello' } };
    const result = toPlain(input) as typeof input;
    expect(result.inner).toEqual({ x: 10, y: 'hello' });
    expect(result.inner).not.toBe(input.inner);
  });

  test('plain object: nested arrays inside objects', () => {
    const input = { ids: [1, 2, 3], meta: 'data' };
    const result = toPlain(input) as typeof input;
    expect(result.ids).toEqual([1, 2, 3]);
  });

  test('empty plain object passes through', () => {
    const input = {};
    const result = toPlain(input);
    expect(result).toEqual({});
    expect(result).not.toBe(input); // shallow copy
  });

  // -------------------------------------------------------------------------
  // Non-POJO objects — converted to string representation
  // -------------------------------------------------------------------------

  test('class instance is converted to string', () => {
    class MyClass {
      constructor(public value: number) {}
      toString() {
        return `MyClass(${this.value})`;
      }
    }
    const instance = new MyClass(42);
    expect(toPlain(instance)).toBe('MyClass(42)');
  });

  test('object with null prototype throws from String() conversion', () => {
    const obj = Object.create(null);
    (obj as Record<string, unknown>).foo = 'bar';
    // Non-POJO without toString/valueOf → String() throws
    expect(() => toPlain(obj)).toThrow();
  });

  test('class instance with custom toString is converted to string', () => {
    class Custom {
      toString() {
        return 'custom-string';
      }
    }
    expect(toPlain(new Custom())).toBe('custom-string');
  });

  // -------------------------------------------------------------------------
  // Arrays
  // -------------------------------------------------------------------------

  test('array of primitives: each element passes through', () => {
    expect(toPlain([1, 'two', false, null])).toEqual([1, 'two', false, null]);
  });

  test('array of objects: elements recursively converted', () => {
    const a = { name: 'Alice' };
    const b = { name: 'Bob' };
    const result = toPlain([a, b]) as Array<{ name: string }>;
    expect(result).toEqual([{ name: 'Alice' }, { name: 'Bob' }]);
    expect(result[0]).not.toBe(a);
  });

  test('array of mixed types including non-POJO', () => {
    class Tag {
      constructor(public label: string) {}
      toString() {
        return `Tag:${this.label}`;
      }
    }
    const input = [1, new Tag('important'), { nested: { tags: [new Tag('inner')] } }];
    const result = toPlain(input) as unknown[];
    expect(result[0]).toBe(1);
    expect(result[1]).toBe('Tag:important');
    expect((result[2] as Record<string, unknown>).nested).toEqual({
      tags: ['Tag:inner'],
    });
  });

  test('empty array passes through', () => {
    expect(toPlain([])).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Deeply nested structures
  // -------------------------------------------------------------------------

  test('deeply nested object with arrays works correctly', () => {
    const input = {
      level1: {
        level2: [
          { name: 'item', count: 3 },
          { name: 'other', count: 7 },
        ],
        meta: {
          tags: ['a', 'b'],
          active: true,
        },
      },
    };
    const result = toPlain(input) as typeof input;
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    expect(result.level1).not.toBe(input.level1);
    expect(result.level1.level2).not.toBe(input.level1.level2);
  });
});
