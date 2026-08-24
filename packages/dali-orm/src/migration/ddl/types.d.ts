/**
 * Shared SurrealDB Type Mappings
 *
 * Centralized type mapping utilities for DDL operations.
 */
import type { SurrealColumnType } from '../../sdk/schema/column/types.js';

export type { SurrealColumnType };
export declare const SURREALDB_TYPE_MAP: Record<string, string>;
/**
 * Maps a column type string to SurrealDB type (as SurrealColumnType)
 */
export declare function mapSurrealType(rawType: string): SurrealColumnType;
/**
 * Gets the SurrealQL type string for a column type
 */
export declare function getSurrealQLType(type: string): string;
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
export declare function parseKind(kind: string): {
  type: SurrealColumnType;
  recordTable?: string;
  recordTables?: string[];
  size?: number;
  value?: string;
};
//# sourceMappingURL=types.d.ts.map
