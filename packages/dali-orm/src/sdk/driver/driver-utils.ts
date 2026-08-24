/**
 * Driver Utilities
 *
 * Pure functions extracted from BaseDriver for parsing and transforming data.
 * No class dependencies — all functions are module-level.
 */

import { DateTime, RecordId } from 'surrealdb';

export function parseTableWithId(table: string): {
  tableName: string;
  recordId: string | undefined;
} {
  const colonIndex = table.indexOf(':');
  if (colonIndex === -1) return { tableName: table, recordId: undefined };

  const tableName = table.substring(0, colonIndex);
  const recordId = table.substring(colonIndex + 1);

  return { tableName, recordId: recordId || undefined };
}

export function isDatetimeField(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return (
    lowerKey.includes('date') ||
    lowerKey.includes('time') ||
    lowerKey.endsWith('_at') ||
    lowerKey.endsWith('_on')
  );
}

export function transformDatetimeValues(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj))
    return obj.map((item) => transformDatetimeValues(item));

  if (typeof obj === 'object') {
    // Preserve class instances (RecordId, DateTime, Uint8Array, etc.)
    // Only transform plain objects so we don't erase non-enumerable data.
    if (!isPlainObject(obj)) return obj;

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (
        isDatetimeField(key) &&
        value !== null &&
        value !== undefined &&
        !Array.isArray(value)
      ) {
        result[key] = tryCreateDateTime(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return obj;
}

export function coerceRecordIds(
  tableName: string,
  input: unknown,
  schema?: {
    getTable: (
      name: string,
    ) =>
      | { $columns?: Record<string, { config: { recordTable?: string } }> }
      | undefined;
  },
): unknown {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input))
    return input.map((item) => coerceRecordIds(tableName, item, schema));
  if (typeof input !== 'object') return input;
  if (!isPlainObject(input)) return input;

  const out: Record<string, unknown> = {};

  // Schema-aware coercion: only coerce columns defined as record() in the table schema
  if (schema) {
    const tableDef = schema.getTable(tableName);
    if (tableDef?.$columns) {
      const recordColumns = new Set<string>();
      for (const [colName, colDef] of Object.entries(tableDef.$columns)) {
        if (colDef.config.recordTable) {
          recordColumns.add(colName);
        }
      }

      for (const [key, value] of Object.entries(input)) {
        if (recordColumns.has(key)) {
          out[key] = tryCoerceRecordId(value);
        } else {
          out[key] = value;
        }
      }
      return out;
    }
  }

  // Fallback: coerce all values (backward compatibility, FR-005)
  for (const [key, value] of Object.entries(input)) {
    out[key] = tryCoerceRecordId(value);
  }
  return out;
}

export function tryCoerceRecordId(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  // Fast path: already our RecordId
  if (value instanceof RecordId) return value;

  // Foreign RecordId instance (different module instance): detect by constructor name
  if (typeof value === 'object' && value !== null) {
    const ctorName = (value as { constructor?: { name?: string } }).constructor
      ?.name;
    if (ctorName === 'RecordId' || ctorName === 'StringRecordId') {
      return recordIdFromString(`${value as unknown as string}`);
    }

    const obj = value as Record<string, unknown>;
    if (typeof obj.tb === 'string' && typeof obj.id === 'string') {
      return new RecordId(obj.tb, obj.id);
    }
    if (typeof obj.id === 'string') {
      return recordIdFromString(obj.id);
    }
    if (typeof obj.id === 'object' && obj.id !== null) {
      const nested = obj.id as Record<string, unknown>;
      if (typeof nested.id === 'string') {
        return recordIdFromString(nested.id);
      }
    }
  }

  if (typeof value === 'string') {
    return recordIdFromString(value);
  }

  return value;
}

export function recordIdFromString(value: string): RecordId | string {
  const trimmed = value.trim();
  if (!trimmed) return value;

  // Guard: only convert strings that look like valid record references.
  // A SurrealDB record reference is "tablename:id" where tablename is a
  // simple word (word chars only, no whitespace, no newlines) and the
  // entire string has no whitespace/newlines outside the colon boundary.
  // This prevents accidental conversion of long text (e.g. changelogs,
  // descriptions) that happen to contain a colon somewhere inside.
  if (trimmed.includes('\n') || trimmed.includes('\r')) return value;

  const colonIndex = trimmed.indexOf(':');
  if (colonIndex === -1) return value;

  const tableName = trimmed.substring(0, colonIndex);
  const recordId = trimmed.substring(colonIndex + 1);

  // table name must be simple word characters (matching SurrealDB table naming)
  if (!/^\w+$/.test(tableName)) return value;
  // record id part must contain no whitespace — no spaces, tabs, newlines
  if (/\s/.test(recordId)) return value;

  if (!recordId) return value;
  if (!tableName) return value;

  return new RecordId(tableName, recordId);
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function tryCreateDateTime(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  try {
    if (typeof value === 'string') return new DateTime(value);
    if (typeof value === 'number') return new DateTime(value);
    return value;
  } catch {
    return value;
  }
}
