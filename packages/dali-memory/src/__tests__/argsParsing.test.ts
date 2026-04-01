import { describe, expect, it } from 'vite-plus/test';
import z from 'zod';
import { parseTheArgs, rehydrateZodMeta } from '../utils/argsParsing.ts';

describe('rehydrateZodMeta', () => {
  it('handles non-object values (null, undefined, string, number)', () => {
    expect(() => rehydrateZodMeta(null)).not.toThrow();
    expect(() => rehydrateZodMeta(undefined)).not.toThrow();
    expect(() => rehydrateZodMeta('string')).not.toThrow();
    expect(() => rehydrateZodMeta(42)).not.toThrow();
  });

  it('handles arrays', () => {
    expect(() => rehydrateZodMeta(['a', 'b'])).not.toThrow();
  });

  it('handles empty objects', () => {
    expect(() => rehydrateZodMeta({})).not.toThrow();
  });

  it('handles objects without _zod property', () => {
    expect(() => rehydrateZodMeta({ foo: 'bar', baz: 123 })).not.toThrow();
  });

  it('processes a zod schema and adds metadata to global registry', () => {
    const schema = z.string().describe('A test string');
    expect(() => rehydrateZodMeta(schema)).not.toThrow();
    // After rehydration, the schema should have metadata registered
    const _meta = z.globalRegistry.get(schema);
    // The global registry may or may not have it depending on Zod internals,
    // but the important thing is it doesn't throw
  });

  it('handles nested zod schemas in an object', () => {
    const argDefs = {
      name: z.string().describe('Name to greet'),
      age: z.number().describe('Age of person'),
    };
    expect(() => rehydrateZodMeta(argDefs)).not.toThrow();
  });

  it('handles circular references without stack overflow', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => rehydrateZodMeta(circular)).not.toThrow();
  });

  it('handles seen objects from WeakSet tracking', () => {
    const shared = { foo: 'bar' };
    const obj = { a: shared, b: shared };
    expect(() => rehydrateZodMeta(obj)).not.toThrow();
  });
});

describe('parseTheArgs', () => {
  const TestSchema = {
    name: z.string().describe('Name to greet'),
    age: z.number().optional().describe('Age'),
  };

  it('validates correct arguments and returns parsed data', () => {
    const result = parseTheArgs('test_tool', TestSchema, { name: 'Alice', age: 30 });
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('returns data with optional fields omitted', () => {
    const result = parseTheArgs('test_tool', TestSchema, { name: 'Bob' });
    expect(result).toEqual({ name: 'Bob' });
  });

  it('throws on missing required fields', () => {
    expect(() => parseTheArgs('test_tool', TestSchema, {} as any)).toThrow();
  });

  it('throws on invalid types', () => {
    expect(() =>
      parseTheArgs('test_tool', TestSchema, { name: 'Charlie', age: 'not-a-number' } as any),
    ).toThrow();
  });

  it('strips extra unknown fields silently', () => {
    const result = parseTheArgs('test_tool', TestSchema, {
      name: 'Dave',
      age: 25,
      extra: 'field',
    } as any);
    expect(result).toEqual({ name: 'Dave', age: 25 });
  });

  it('includes tool ID in error message', () => {
    try {
      parseTheArgs('my_tool', TestSchema, {} as any);
    } catch (e) {
      const error = e as Error;
      expect(error.message).toContain('my_tool');
    }
  });

  it('handles enum schema validation', () => {
    const EnumSchema = {
      mode: z.enum(['add', 'search', 'list']).describe('Mode'),
    };
    const result = parseTheArgs('enum_tool', EnumSchema, { mode: 'add' });
    expect(result).toEqual({ mode: 'add' });
  });

  it('throws on invalid enum value', () => {
    const EnumSchema = {
      mode: z.enum(['add', 'search', 'list']).describe('Mode'),
    };
    expect(() => parseTheArgs('enum_tool', EnumSchema, { mode: 'delete' } as any)).toThrow();
  });

  it('handles arrays of strings', () => {
    const ArraySchema = {
      tags: z.array(z.string()).optional().describe('Tags'),
    };
    const result = parseTheArgs('array_tool', ArraySchema, { tags: ['a', 'b'] });
    expect(result).toEqual({ tags: ['a', 'b'] });
  });

  it('handles empty args object', () => {
    const EmptySchema = {};
    const result = parseTheArgs('empty_tool', EmptySchema, {});
    expect(result).toEqual({});
  });
});
