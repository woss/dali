import { describe, expect, it, vi } from 'vite-plus/test';
import { getSurrealQLType, mapSurrealType, parseKind, SURREALDB_TYPE_MAP } from '../types.js';

// ---------------------------------------------------------------------------
// SURREALDB_TYPE_MAP
// ---------------------------------------------------------------------------
describe('SURREALDB_TYPE_MAP', () => {
  it('maps all known types consistently', () => {
    const expectedMappings: [string, string][] = [
      ['string', 'string'],
      ['int', 'int'],
      ['integer', 'int'],
      ['float', 'float'],
      ['decimal', 'decimal'],
      ['bool', 'bool'],
      ['boolean', 'bool'],
      ['datetime', 'datetime'],
      ['date', 'datetime'],
      ['time', 'datetime'],
      ['timestamp', 'datetime'],
      ['duration', 'duration'],
      ['array', 'array'],
      ['object', 'object'],
      ['record', 'record'],
      ['geometry', 'geometry'],
      ['bytes', 'bytes'],
      ['any', 'any'],
      ['null', 'null'],
      ['number', 'number'],
      ['point', 'point'],
      ['uuid', 'uuid'],
      ['function', 'function'],
      ['set', 'set'],
      ['regex', 'regex'],
      ['range', 'range'],
      ['table', 'table'],
      ['file', 'file'],
    ];

    for (const [input, expected] of expectedMappings) {
      expect(SURREALDB_TYPE_MAP[input]).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// mapSurrealType
// ---------------------------------------------------------------------------
describe('mapSurrealType', () => {
  it('maps known types to their canonical form', () => {
    expect(mapSurrealType('string')).toBe('string');
    expect(mapSurrealType('int')).toBe('int');
    expect(mapSurrealType('integer')).toBe('int');
    expect(mapSurrealType('boolean')).toBe('bool');
    expect(mapSurrealType('datetime')).toBe('datetime');
  });

  it('falls back to "string" for unknown types with console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = mapSurrealType('custom_type');

    expect(result).toBe('string');
    expect(warnSpy).toHaveBeenCalledWith(
      'Unknown type "%s", falling back to "%s". Check your column type configuration.',
      'custom_type',
      'string',
    );

    warnSpy.mockRestore();
  });

  it('maps "integer" alias to "int"', () => {
    expect(mapSurrealType('integer')).toBe('int');
  });

  it('maps "boolean" alias to "bool"', () => {
    expect(mapSurrealType('boolean')).toBe('bool');
  });

  it('maps "decimal" correctly', () => {
    expect(mapSurrealType('decimal')).toBe('decimal');
  });
});

// ---------------------------------------------------------------------------
// getSurrealQLType
// ---------------------------------------------------------------------------
describe('getSurrealQLType', () => {
  it('returns canonical type for known type', () => {
    expect(getSurrealQLType('integer')).toBe('int');
    expect(getSurrealQLType('boolean')).toBe('bool');
    expect(getSurrealQLType('datetime')).toBe('datetime');
  });

  it('passes through unknown types unchanged', () => {
    expect(getSurrealQLType('custom_type')).toBe('custom_type');
    expect(getSurrealQLType('unknown')).toBe('unknown');
  });

  it('maps "string" to itself', () => {
    expect(getSurrealQLType('string')).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// parseKind
// ---------------------------------------------------------------------------
describe('parseKind', () => {
  it('throws for empty kind string', () => {
    expect(() => parseKind('')).toThrow('Kind string is required and cannot be empty');
  });

  it('throws for whitespace-only kind string', () => {
    expect(() => parseKind('   ')).toThrow('Kind string is required and cannot be empty');
  });

  // Plain types
  it('parses "string" as plain type', () => {
    expect(parseKind('string')).toEqual({ type: 'string' });
  });

  it('parses "int" as plain type', () => {
    expect(parseKind('int')).toEqual({ type: 'int' });
  });

  it('parses "float" as plain type', () => {
    expect(parseKind('float')).toEqual({ type: 'float' });
  });

  it('parses "bool" as plain type', () => {
    expect(parseKind('bool')).toEqual({ type: 'bool' });
  });

  it('parses "datetime" as plain type', () => {
    expect(parseKind('datetime')).toEqual({ type: 'datetime' });
  });

  it('parses "regex" as plain type', () => {
    expect(parseKind('regex')).toEqual({ type: 'regex' });
  });

  it('parses "range" as plain type', () => {
    expect(parseKind('range')).toEqual({ type: 'range' });
  });

  // Optional / nullable types
  it('parses "option<string>" as string', () => {
    expect(parseKind('option<string>')).toEqual({ type: 'string' });
  });

  it('parses "string | none" as string', () => {
    expect(parseKind('string | none')).toEqual({ type: 'string' });
  });

  it('parses "none | string" as string', () => {
    expect(parseKind('none | string')).toEqual({ type: 'string' });
  });

  // Union types (first type returned, warning logged)
  it('parses union "string | int" returning first type with warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = parseKind('string | int');

    expect(result).toEqual({ type: 'string' });
    expect(warnSpy).toHaveBeenCalledWith(
      'Union type "%s" detected, returning first type "%s". Full union handling not yet implemented.',
      'string | int',
      'string',
    );

    warnSpy.mockRestore();
  });

  // Record types
  it('parses "record<user>" with recordTable', () => {
    expect(parseKind('record<user>')).toEqual({
      type: 'record',
      recordTable: 'user',
      recordTables: ['user'],
    });
  });

  // Array types
  it('parses "array<int>" without size', () => {
    expect(parseKind('array<int>')).toEqual({ type: 'array' });
  });

  it('parses "array<int, 5>" with size', () => {
    expect(parseKind('array<int, 5>')).toEqual({ type: 'array', size: 5 });
  });

  // Set types
  it('parses "set<string>" as set', () => {
    expect(parseKind('set<string>')).toEqual({ type: 'set' });
  });

  // Table types
  it('parses "table<user, post>" with recordTable', () => {
    expect(parseKind('table<user, post>')).toEqual({ type: 'table', recordTable: 'user, post' });
  });

  // File types
  it('parses "file<bucket>" with recordTable', () => {
    expect(parseKind('file<bucket>')).toEqual({ type: 'file', recordTable: 'bucket' });
  });

  // Geometry types
  it('parses "geometry<point>" as geometry', () => {
    expect(parseKind('geometry<point>')).toEqual({ type: 'geometry' });
  });

  // Literal types
  it('parses double-quoted literal like "\\"hello\\""', () => {
    expect(parseKind('"hello"')).toEqual({ type: 'literal', value: 'hello' });
  });

  it('parses single-quoted literal like "\'hello\'"', () => {
    expect(parseKind("'hello'")).toEqual({ type: 'literal', value: 'hello' });
  });

  // Edge cases
  it('trims whitespace from kind input', () => {
    expect(parseKind('  int  ')).toEqual({ type: 'int' });
  });

  it('handles special characters in literal values', () => {
    expect(parseKind("'hello world!'")).toEqual({ type: 'literal', value: 'hello world!' });
  });
});
