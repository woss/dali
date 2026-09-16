/**
 * Shared SurrealDB Type Mappings
 *
 * Centralized type mapping utilities for DDL operations.
 */

import type { SurrealColumnType } from '../../sdk/schema/column/types.js';

export type { SurrealColumnType };

export const SURREALDB_TYPE_MAP: Record<string, string> = {
  string: 'string',
  int: 'int',
  integer: 'int',
  float: 'float',
  decimal: 'decimal',
  bool: 'bool',
  boolean: 'bool',
  datetime: 'datetime',
  date: 'datetime',
  time: 'datetime',
  timestamp: 'datetime',
  duration: 'duration',
  array: 'array',
  object: 'object',
  record: 'record',
  geometry: 'geometry',
  bytes: 'bytes',
  any: 'any',
  null: 'null',
  number: 'number',
  point: 'point',
  uuid: 'uuid',
  function: 'function',
  set: 'set',
  regex: 'regex',
  range: 'range',
  table: 'table',
  file: 'file',
  // literal handled separately in parseKind
};

/**
 * Maps a column type string to SurrealDB type (as SurrealColumnType)
 */
export function mapSurrealType(rawType: string): SurrealColumnType {
  const fallback = 'string';
  const mapped = SURREALDB_TYPE_MAP[rawType] ?? fallback;

  // Log warning when fallback occurs - prevents silent masking of config errors
  if (mapped === fallback && !SURREALDB_TYPE_MAP[rawType]) {
    console.warn(
      'Unknown type "%s", falling back to "%s". Check your column type configuration.',
      rawType,
      fallback,
    );
  }

  return mapped as SurrealColumnType;
}

/**
 * Gets the SurrealQL type string for a column type
 */
export function getSurrealQLType(type: string): string {
  return SURREALDB_TYPE_MAP[type] ?? type;
}

/**
 * Parses a SurrealDB kind string from STRUCTURE output into structured data.
 *
 * Supported plain types:
 *   string, int, float, bool, datetime, duration, decimal, array, object,
 *   geometry, bytes, record, tuple, any, null, number, point, uuid, function, set,
 *   regex, range, table, file, literal
 *
 * Handles:
 * - Plain types: `'string'` → { type: 'string' }
 * - Record types: `'record<user>'` → { type: 'record', recordTable: 'user' }
 * - Array types: `'array<int>'` → { type: 'array' }
 * - Sized arrays: `'array<int, 2>'` → { type: 'array', size: 2 }
 * - Set types: `'set<int>'` → { type: 'set' }
 * - Geometry types: `'geometry<point>'` → { type: 'geometry' }
 * - Point type: `'point'` → { type: 'point' }
 * - Optional types: `'option<string>'` or `'string | none'` → { type: 'string' }
 * - Regex type: `'regex'` → { type: 'regex' }
 * - Range type: `'range'` → { type: 'range' }
 * - Table type: `'table<user, post>'` → { type: 'table' }
 * - File type: `'file<bucket>'` → { type: 'file' }
 * - Literal type: `'"literal"'` → { type: 'literal', value: 'literal' }
 * - Union types: `'T | U'` → returns first type, logs warning
 */
export function parseKind(kind: string): {
  type: SurrealColumnType;
  recordTable?: string;
  recordTables?: string[];
  size?: number;
  value?: string;
} {
  if (!kind || kind.trim() === '') {
    throw new Error('Kind string is required and cannot be empty');
  }

  const trimmed = kind.trim();

  // Handle option<T> or T | none → strip wrapper, return base type
  const optionMatch = /^option<(.+)>$/.exec(trimmed);
  if (optionMatch) {
    return parseKind(optionMatch[1]);
  }

  if (trimmed.endsWith('| none') || trimmed.includes(' | none')) {
    const bare = trimmed.replace(/\s*\|\s*none\s*$/, '').trim();
    return parseKind(bare);
  }

  // Handle none | T (none on left side)
  if (trimmed.startsWith('none |') || trimmed.startsWith('none|')) {
    const bare = trimmed.replace(/^none\s*\|\s*/, '').trim();
    return parseKind(bare);
  }

  // Handle union types T | U (excluding '| none' handled above)
  // Match patterns like 'string | int' or 'record<user> | record<post>'
  if (trimmed.includes(' | ') && !trimmed.endsWith('| none')) {
    const parts = trimmed.split('|').map((p) => p.trim());

    // Check if this is a union of record<T> types (for multi-table relations)
    const recordTables: string[] = [];
    for (const part of parts) {
      const recordMatch = /^record<(.+)>$/.exec(part);
      if (recordMatch) {
        recordTables.push(recordMatch[1].trim());
      }
    }

    if (recordTables.length > 0) {
      // Union of record types — return first as recordTable, all as recordTables
      return {
        type: 'record' as SurrealColumnType,
        recordTable: recordTables[0],
        recordTables,
      };
    }

    // Fallback: return first type with warning
    const firstType = parts[0];
    console.warn(
      'Union type "%s" detected, returning first type "%s". Full union handling not yet implemented.',
      trimmed,
      firstType,
    );
    return parseKind(firstType);
  }

  // Handle quoted string literals: "literal" or 'literal'
  const literalMatch = /^["'](.+?)["']$/.exec(trimmed);
  if (literalMatch) {
    return { type: 'literal' as SurrealColumnType, value: literalMatch[1] };
  }

  // Handle parameterized types: record<user>, array<int>, array<int, 2>, table<user, post>, file<bucket>
  const paramMatch = /^(\w+)<([^>]+)>$/.exec(trimmed);
  if (paramMatch) {
    const [, baseType, inner] = paramMatch;
    const mappedType = mapSurrealType(baseType) ?? baseType;

    // record<user> → extract record table
    if (baseType === 'record') {
      return {
        type: mappedType,
        recordTable: inner.trim(),
        recordTables: [inner.trim()],
      };
    }

    // table<user, post> → extract as recordTable (comma-separated list)
    if (baseType === 'table') {
      return { type: mappedType, recordTable: inner.trim() };
    }

    // file<bucket> → extract bucket name as recordTable
    if (baseType === 'file') {
      return { type: mappedType, recordTable: inner.trim() };
    }

    // array<int, 2> → extract size
    if (baseType === 'array') {
      const sizeMatch = /,\s*(\d+)\s*$/.exec(inner);
      const result: {
        type: SurrealColumnType;
        recordTable?: string;
        recordTables?: string[];
        size?: number;
        value?: string;
      } = {
        type: mappedType,
      };
      if (sizeMatch) {
        result.size = Number.parseInt(sizeMatch[1], 10);
      }
      return result;
    }

    // Other parameterized types → just return mapped type
    return { type: mappedType };
  }

  // Plain type: map via SURREALDB_TYPE_MAP
  // Handles: regex, range, and all other plain types
  const mapped = mapSurrealType(trimmed);
  return { type: mapped };
}
