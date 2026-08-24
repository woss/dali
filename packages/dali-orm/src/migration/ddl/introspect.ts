/**
 * Database Introspection for SurrealDB
 *
 * Implements fromDatabase function that queries the database and builds
 * SurrealDbDDL structure. Uses SurrealDB's STRUCTURE output exclusively.
 */

import { createDebug as debug } from 'obug';
import * as v from 'valibot';
import type { SurrealDriver } from '../../sdk/driver/types.js';
import type { TablePermissions } from '../../sdk/table.js';
import { SurrealQLGenerator } from '../core/generator.js';
import type {
  SurrealColumn,
  SurrealDbDDL,
  SurrealEvent,
  SurrealFunction,
  SurrealIndex,
  SurrealLive,
  SurrealSequence,
  SurrealTable,
} from './ddl.js';
import { createEmptyDdl } from './ddl.js';
import { InfoForTableSchema } from './schemas.js';
import { parseKind } from './types.js';

const log = debug('dali-orm:kit:introspect');

/**
 * Entity filter for introspection (similar to Drizzle's EntityFilter)
 */
export interface IntrospectFilter {
  schema?: string;
  onlyTables?: string[];
  exceptTables?: string[];
}

/**
 * Introspect filter function type
 */
export type IntrospectFilterFn = (
  name: string,
  type: 'table' | 'index' | 'relation',
) => boolean;

/**
 * Main entry point - introspect database and return DDL structure
 * @param driver - SurrealDB driver
 * @param filter - Optional filter to include/exclude tables. __migrations excluded by default.
 */
export async function introspectDatabase(
  driver: SurrealDriver,
  filter?: IntrospectFilter,
): Promise<SurrealDbDDL> {
  log('Starting database introspection');

  const ddl = createEmptyDdl();

  // Default filter excludes __migrations unless user explicitly whitelists it
  const excludeMigrations = !filter?.onlyTables?.includes('__migrations');
  const exceptTables = excludeMigrations
    ? ['__migrations', ...(filter?.exceptTables || [])]
    : [...(filter?.exceptTables || [])];

  const effectiveFilter: IntrospectFilter = {
    ...filter,
    exceptTables,
  };

  const filterFn = createFilterFn(effectiveFilter);

  // Step 1: Get list of all table names
  const tableNames = await getTableList(driver);
  log('Found %d tables: %O', tableNames.length, tableNames);

  // Step 2: Introspect each table
  for (const tableName of tableNames) {
    if (!filterFn(tableName, 'table')) {
      log('Skipping table %s (filtered out)', tableName);
      continue;
    }

    try {
      const tableInfo = await introspectTable(driver, tableName);
      ddl.tables.push(tableInfo);

      // Register relation if table has in/out fields
      if (tableInfo.type === 'relation') {
        ddl.relations.push({
          name: tableInfo.name,
          in: tableInfo.in ?? '',
          out: tableInfo.out ?? '',
          fields: tableInfo.columns,
        });
      }

      // Collect indexes from table
      for (const idx of tableInfo.indexes) {
        ddl.indexes.push(idx);
      }

      // Collect events from table
      if (tableInfo.events) {
        for (const event of tableInfo.events) {
          ddl.events.push(event);
        }
      }

      // Collect lives from table
      if (tableInfo.lives) {
        for (const live of tableInfo.lives) {
          ddl.lives.push(live);
        }
      }

      // Collect views from table
      if (tableInfo.views) {
        for (const view of tableInfo.views) {
          ddl.views.push(view);
        }
      }
    } catch (error) {
      console.error('Failed to introspect table %s:', tableName, error);
    }
  }

  // Step 3: Introspect access definitions
  const accessSQLs = await introspectAccessSQL(driver);
  ddl.access.push(...accessSQLs);
  log('Found %d access definitions', accessSQLs.length);

  // Step 4: Introspect namespace definitions
  const namespaceSQLs = await introspectNamespaces(driver);
  ddl.namespaces.push(...namespaceSQLs);
  log('Found %d namespace definitions', namespaceSQLs.length);

  // Step 5: Introspect database definitions
  const databaseSQLs = await introspectDatabases(driver);
  ddl.databases.push(...databaseSQLs);
  log('Found %d database definitions', databaseSQLs.length);

  // Step 6: Introspect sequence definitions
  const sequences = await introspectSequences(driver);
  ddl.sequences.push(...sequences);
  log('Found %d sequence definitions', sequences.length);

  log(
    'Introspection complete: %d tables, %d indexes, %d relations, %d events, %d lives, %d views, %d access, %d namespaces, %d databases, %d sequences',
    ddl.tables.length,
    ddl.indexes.length,
    ddl.relations.length,
    ddl.events.length,
    ddl.lives.length,
    ddl.views.length,
    ddl.access.length,
    ddl.namespaces.length,
    ddl.databases.length,
    ddl.sequences.length,
  );

  return ddl;
}

/**
 * Get list of all table names from database
 */
async function getTableList(driver: SurrealDriver): Promise<string[]> {
  log('Query: INFO FOR DB');
  const result = await driver.query('INFO FOR DB');
  log('Result: %O', result);

  // SurrealDB returns: [{ tables: { table1: {}, table2: {}, ... } }]
  const dbInfo = Array.isArray(result) ? result[0] : result;

  if (!dbInfo || typeof dbInfo !== 'object') {
    log('No database info returned');
    return [];
  }

  const tablesObj = (dbInfo as Record<string, unknown>).tables as
    | Record<string, unknown>
    | undefined;
  if (!tablesObj) {
    return [];
  }

  return Object.keys(tablesObj);
}

/**
 * Get list of existing access names from database
 */
export async function introspectAccess(
  driver: SurrealDriver,
): Promise<string[]> {
  log('Query: INFO FOR DB (access)');
  const result = await driver.query('INFO FOR DB');

  const dbInfo = Array.isArray(result) ? result[0] : result;

  if (!dbInfo || typeof dbInfo !== 'object') {
    return [];
  }

  const accessObj = (dbInfo as Record<string, unknown>).accesses as
    | Record<string, unknown>
    | undefined;
  if (!accessObj) {
    return [];
  }

  return Object.keys(accessObj);
}

/**
 * Get access definitions as raw SQL strings from database.
 *
 * Uses INFO FOR DB which returns accesses as:
 * { accesses: { name: "DEFINE ACCESS ... SQL" } }
 *
 * Returns the raw DEFINE ACCESS SQL strings (Object.values).
 */
export async function introspectAccessSQL(
  driver: SurrealDriver,
): Promise<string[]> {
  log('Query: INFO FOR DB (access SQL)');
  const result = await driver.query('INFO FOR DB');

  const dbInfo = Array.isArray(result) ? result[0] : result;

  if (!dbInfo || typeof dbInfo !== 'object') {
    return [];
  }

  const accessObj = (dbInfo as Record<string, unknown>).accesses as
    | Record<string, string>
    | undefined;
  if (!accessObj) {
    return [];
  }

  return Object.values(accessObj);
}

/**
 * Introspect a single table using STRUCTURE output.
 *
 * Uses valibot schema (InfoForTableSchema) to parse STRUCTURE output at boundary.
 * Determines relation type by checking for 'in' and 'out' fields in the
 * STRUCTURE fields array, and extracts the related table names from their
 * record type definitions.
 */
export async function introspectTable(
  driver: SurrealDriver,
  tableName: string,
): Promise<SurrealTable> {
  log('Query: INFO FOR TABLE %s STRUCTURE', tableName);
  const result = await driver.query(`INFO FOR TABLE ${tableName} STRUCTURE`);

  // Parse raw result - handle array wrapper
  const tableInfo = Array.isArray(result) ? result[0] : result;

  if (!tableInfo || typeof tableInfo !== 'object') {
    throw new Error(`No info returned for table ${tableName}`);
  }

  // Parse Don't Validate: use valibot at boundary to get trusted types
  const parsed = v.parse(InfoForTableSchema, tableInfo);
  log('Parsed STRUCTURE for %s: %O', tableName, parsed);

  // Detect relation by checking for 'in' and 'out' fields
  const inField = parsed.fields.find((f) => f.name === 'in');
  const outField = parsed.fields.find((f) => f.name === 'out');
  const isRelation = inField !== undefined && outField !== undefined;

  // Extract related table names from record type definitions
  const parsedInKind =
    isRelation && inField?.kind ? parseKind(inField.kind) : undefined;
  const parsedOutKind =
    isRelation && outField?.kind ? parseKind(outField.kind) : undefined;

  const inTable: string | string[] | undefined = parsedInKind?.recordTables
    ? parsedInKind.recordTables.length === 1
      ? parsedInKind.recordTables[0]
      : parsedInKind.recordTables
    : parsedInKind?.recordTable;

  const outTable: string | string[] | undefined = parsedOutKind?.recordTables
    ? parsedOutKind.recordTables.length === 1
      ? parsedOutKind.recordTables[0]
      : parsedOutKind.recordTables
    : parsedOutKind?.recordTable;

  const type: 'normal' | 'relation' = isRelation ? 'relation' : 'normal';

  // Determine schema mode
  const hasFields = parsed.fields.length > (isRelation ? 2 : 0);
  const schema: 'full' | 'less' = hasFields ? 'full' : 'less';

  // 1. Process fields/columns (skip 'in' and 'out' for relation tables)
  const columns: SurrealColumn[] = parsed.fields
    .filter((field) => {
      // Strip backtick escaping from reserved words (e.g., `value` → value)
      const fieldName =
        field.name.startsWith('`') && field.name.endsWith('`')
          ? field.name.slice(1, -1)
          : field.name;

      if (isRelation && (fieldName === 'in' || fieldName === 'out')) {
        return false;
      }
      return true;
    })
    .map((field) => {
      // Strip backtick escaping from reserved words
      const fieldName =
        field.name.startsWith('`') && field.name.endsWith('`')
          ? field.name.slice(1, -1)
          : field.name;
      const kind = field.kind?.trim() ?? '';
      const hasKind = kind !== '';
      const rawKind = hasKind ? kind : '';
      // Compute optional from kind: option<T>, T | none, or none | T
      const isOptional = Boolean(
        hasKind &&
          (rawKind.startsWith('option<') ||
            /\|\s*none\s*$/.test(rawKind) ||
            /^none\s*\|/.test(rawKind)),
      );
      const parsedKind = hasKind
        ? parseKind(kind)
        : {
            type: undefined as unknown as SurrealColumn['kind'],
            recordTable: undefined,
          };

      const column: SurrealColumn = {
        name: fieldName,
        kind: parsedKind.type,
        table: tableName,
        default: parseDefaultValue(field.default) as string | undefined,
        default_always: field.default_always ?? undefined,
        readonly: field.readonly,
        optional: isOptional,
        permissions: {
          select: field.permissions.select,
          create: field.permissions.create,
          update: field.permissions.update,
        },
        flex: field.flex ?? false,
        recordTable: parsedKind.recordTable,
        value: field.value,
        assert: field.assert,
        computed: field.computed,
        reference: field.reference,
        comment: field.comment,
      };

      log(
        'Field %s: kind=%s, default=%s',
        fieldName,
        column.kind,
        column.default,
      );

      return column;
    });

  // 2. Process indexes
  const indexes: SurrealIndex[] = parsed.indexes.map((idx) => {
    const indexType = mapIndexType(idx.index);
    // Extract analyzer from fulltext definition string (e.g., "FULLTEXT ANALYZER ascii")
    const analyzer =
      indexType === 'fulltext' && typeof idx.index === 'string'
        ? extractAnalyzer(idx.index)
        : undefined;

    // Extract HNSW options from index definition string
    // STRUCTURE packs all HNSW options into the index field: "HNSW DIMENSION 384 DIST COSINE TYPE F32 ..."
    const isHnsw = indexType === 'hnsw' && typeof idx.index === 'string';
    const dimension = isHnsw ? extractHnswDimension(idx.index) : undefined;
    const distance = isHnsw ? extractHnswDistance(idx.index) : undefined;
    const vectorType = isHnsw ? extractHnswVectorType(idx.index) : undefined;

    const index: SurrealIndex = {
      name: idx.name,
      table: tableName,
      cols: idx.cols,
      index: indexType,
      analyzer,
      comment: idx.comment,
      prepare_remove: idx.prepare_remove,
      dimension,
      distance: distance as
        | 'EUCLIDEAN'
        | 'MANHATTAN'
        | 'COSINE'
        | 'MINKOWSKI'
        | undefined,
      vectorType,
    };

    return index;
  });
  log('Indexes found: %O', indexes);

  // 3. Process events
  const events: SurrealEvent[] = parsed.events.map((event) => {
    const base = {
      name: event.name,
      what: event.what,
      when: event.when,
      then: event.then,
      comment: event.comment,
    };

    // Check if async event (has 'async' field)
    if ('async' in event && event.async === true) {
      return {
        ...base,
        async: true,
        retry: event.retry,
        maxdepth: event.maxdepth,
      };
    }

    return base;
  });
  log('Events found: %O', events);

  // 4. Process lives/subscriptions
  const lives: SurrealLive[] = parsed.lives.map((live) => ({
    id: live.id,
    node: live.node,
    fields: live.fields,
    what: live.what,
    cond: live.cond,
    fetch: live.fetch,
  }));
  log('Lives found: %O', lives);

  // 5. Process views (raw SQL strings)
  const views: string[] = parsed.tables;
  log('Views found: %d', views.length);

  // Extract table-level permissions from STRUCTURE output
  const tableInfoRec = tableInfo as Record<string, unknown>;
  const permissions = parseTablePermissions(tableInfoRec.permissions);

  return {
    name: tableName,
    schema,
    type,
    columns,
    indexes,
    permissions,
    in: inTable,
    out: outTable,
    events,
    lives,
    views,
  };
}

/**
 * Map SurrealDB index type string to SurrealIndex type.
 *
 * STRUCTURE returns full definition strings like:
 * - 'UNIQUE' → 'unique'
 * - 'FULLTEXT ANALYZER like BM25(...)' → 'fulltext'
 * - 'HNSW DIMENSION 384 DIST COSINE TYPE F32 ...' → 'hnsw'
 */
function mapIndexType(indexStr: string): string {
  if (!indexStr) return '';
  const upper = indexStr.toUpperCase();
  if (upper.startsWith('UNIQUE')) return 'unique';
  if (upper.startsWith('FULLTEXT')) return 'fulltext';
  if (upper.startsWith('HNSW')) return 'hnsw';
  return '';
}

/**
 * Parse HNSW dimension from index definition string.
 * E.g., "HNSW DIMENSION 384 DIST COSINE" → 384
 */
function extractHnswDimension(indexStr: string): number | undefined {
  const match = /DIMENSION\s+(\d+)/i.exec(indexStr);
  return match ? Number(match[1]) : undefined;
}

/**
 * Parse HNSW distance metric from index definition string.
 * E.g., "HNSW DIMENSION 384 DIST COSINE" → 'COSINE'
 */
function extractHnswDistance(indexStr: string): string | undefined {
  const match = /DIST\s+(\w+)/i.exec(indexStr);
  return match ? match[1].toUpperCase() : undefined;
}

/**
 * Parse HNSW vector type from index definition string.
 * E.g., "HNSW TYPE F32 ..." → 'float32'
 * Maps: F32 → float32, F64 → float64
 */
function extractHnswVectorType(
  indexStr: string,
): 'float32' | 'float64' | undefined {
  const match = /TYPE\s+(F\d+)/i.exec(indexStr);
  if (!match) return undefined;
  const type = match[1].toUpperCase();
  if (type === 'F32') return 'float32';
  if (type === 'F64') return 'float64';
  return undefined;
}

/**
 * Parse table-level permissions from STRUCTURE output.
 *
 * STRUCTURE returns permissions as an object like:
 * { select: "FULL", create: "NONE" } or { select: true, create: false }
 */
function parseTablePermissions(
  permValue: unknown,
): TablePermissions | undefined {
  if (!permValue || typeof permValue !== 'object') {
    return undefined;
  }

  const obj = permValue as Record<string, unknown>;
  const ops = ['select', 'create', 'update', 'delete'] as const;
  const permissions: TablePermissions = {};

  for (const op of ops) {
    const value = obj[op];
    if (typeof value === 'string') {
      permissions[op] = value;
    } else if (value === true) {
      permissions[op] = 'FULL';
    } else if (value === false) {
      permissions[op] = 'NONE';
    }
  }

  return Object.keys(permissions).length > 0 ? permissions : undefined;
}

/**
 * Parse a raw SurrealQL default value from STRUCTURE output into a typed value.
 *
 * Handles:
 * - String defaults: `"'hello'"` → `"hello"`
 * - Boolean defaults: `"true"` → `true`, `"false"` → `false`
 * - Null defaults: `"null"` → `null`
 * - Numeric defaults: `"42"` → `42`
 * - Pass-through for complex expressions (functions, references)
 */
function parseDefaultValue(rawValue: unknown): unknown {
  if (rawValue === undefined || rawValue === null) {
    return undefined;
  }

  if (typeof rawValue === 'string') {
    // Quoted string: strip surrounding quotes
    if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
      return rawValue.slice(1, -1).replace(/\\'/g, "'");
    }

    // Boolean literals (case-insensitive)
    if (rawValue.toLowerCase() === 'true') return true;
    if (rawValue.toLowerCase() === 'false') return false;

    // Null literal (case-insensitive)
    if (rawValue.toLowerCase() === 'null') return null;

    // Numeric literals
    if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
      return Number(rawValue);
    }

    // Complex expression (function call, reference, etc.) — return as-is
    return rawValue;
  }

  // Already a primitive (number, boolean)
  return rawValue;
}

/**
 * Extract analyzer name from fulltext index definition string.
 *
 * Parses: "FULLTEXT ANALYZER ascii" → "ascii"
 * Parses: "FULLTEXT ANALYZER like BM25(1.2,0.75)" → "like"
 */
function extractAnalyzer(indexDef: string): string | undefined {
  const match = /ANALYZER\s+(\w+)/i.exec(indexDef);
  return match ? match[1] : undefined;
}

/**
 * Introspect function definitions from the database
 *
 * Queries INFO FOR DB to get all defined functions.
 * SurrealDB returns functions as raw "DEFINE FUNCTION ..." SQL strings,
 * which we parse into SurrealFunction[] objects.
 */
export async function introspectFunctions(
  driver: SurrealDriver,
): Promise<SurrealFunction[]> {
  log('Query: INFO FOR DB (functions)');
  const result = await driver.query('INFO FOR DB');

  const dbInfo = Array.isArray(result) ? result[0] : result;

  if (!dbInfo || typeof dbInfo !== 'object') {
    return [];
  }

  const funcsObj = (dbInfo as Record<string, unknown>).functions as
    | Record<string, string>
    | undefined;
  if (!funcsObj) {
    return [];
  }

  const functions: SurrealFunction[] = [];

  for (const [name, rawSQL] of Object.entries(funcsObj)) {
    if (typeof rawSQL !== 'string') continue;

    try {
      const parsed = parseFunctionSQL(name, rawSQL);
      functions.push(parsed);
    } catch {
      log('Failed to parse function %s, skipping', name);
    }
  }

  log('Found %d functions', functions.length);
  return functions;
}

/**
 * Parse a DEFINE FUNCTION SQL string into a SurrealFunction object
 *
 * Handles: DEFINE FUNCTION [IF NOT EXISTS] fn_name($arg1: type, $arg2: type) { body } [COMMENT "..." ] [PERMISSIONS ...]
 */
export function parseFunctionSQL(
  _name: string,
  rawSQL: string,
): SurrealFunction {
  const func: SurrealFunction = {
    name: _name,
    body: '',
  };

  // Extract name from DEFINE FUNCTION statement (after optional IF NOT EXISTS)
  const nameMatch = rawSQL.match(
    /DEFINE\s+FUNCTION(?:\s+IF\s+NOT\s+EXISTS)?\s+(\w+(?:\([^)]*\))?)/i,
  );
  if (nameMatch) {
    const fullName = nameMatch[1];
    // If name contains args like fn($a, $b), extract just the name and args
    const argsMatch = fullName.match(/\(([^)]*)\)/);
    if (argsMatch) {
      func.name = fullName.split('(')[0];
      func.args = argsMatch[1]
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
    } else {
      func.name = fullName;
    }
  }

  // Extract body (content between outermost braces) — brace-depth-aware
  const bodyStart = rawSQL.indexOf('{');
  if (bodyStart !== -1) {
    let depth = 0;
    let bodyEnd = -1;
    for (let i = bodyStart; i < rawSQL.length; i++) {
      if (rawSQL[i] === '{') depth++;
      else if (rawSQL[i] === '}') {
        depth--;
        if (depth === 0) {
          bodyEnd = i;
          break;
        }
      }
    }
    if (bodyEnd !== -1) {
      func.body = rawSQL.slice(bodyStart + 1, bodyEnd).trim();
    }
  }

  // Extract comment
  const commentMatch = rawSQL.match(/COMMENT\s+"([^"]+)"/i);
  if (commentMatch) {
    func.comment = commentMatch[1];
  }

  // Extract permissions
  const permsMatch = rawSQL.match(/PERMISSIONS\s+(.+)$/i);
  if (permsMatch) {
    func.permissions = permsMatch[1].trim();
  }

  return func;
}

/**
 * Introspect namespace definitions from SurrealDB
 *
 * Uses INFO FOR NS to list all defined namespaces.
 * Falls back to empty array when at database level.
 */
async function introspectNamespaces(driver: SurrealDriver): Promise<string[]> {
  try {
    const result = await driver.query('INFO FOR NS');
    if (!result || !Array.isArray(result)) {
      return [];
    }

    // INFO FOR NS returns objects with name, type, etc.
    // Convert to DEFINE NAMESPACE SQL statements
    const namespaces: string[] = [];
    for (const row of result) {
      if (row && typeof row === 'object') {
        const obj = row as Record<string, unknown>;
        const name = String(obj.name ?? '');
        if (name) {
          const comment = obj.comment ? String(obj.comment) : undefined;
          namespaces.push(
            new SurrealQLGenerator().generateNamespaceDefinition(name, {
              comment,
            }),
          );
        }
      }
    }
    return namespaces;
  } catch {
    // INFO FOR NS may fail at database level — that's expected
    return [];
  }
}

/**
 * Introspect database definitions from SurrealDB
 *
 * Uses INFO FOR DB to list all defined databases.
 * Falls back to empty array when not at namespace level.
 */
export async function introspectDatabases(
  driver: SurrealDriver,
): Promise<string[]> {
  try {
    const result = await driver.query('INFO FOR DB');
    if (!result || !Array.isArray(result)) {
      return [];
    }

    // INFO FOR DB returns database info with databases key
    const databases: string[] = [];
    for (const row of result) {
      if (row && typeof row === 'object') {
        const obj = row as Record<string, unknown>;
        // Check for databases key in the result
        const dbObj = obj.databases as Record<string, unknown> | undefined;
        if (dbObj) {
          for (const [name, info] of Object.entries(dbObj)) {
            if (info && typeof info === 'object') {
              const dbInfo = info as Record<string, unknown>;
              const comment = dbInfo.comment
                ? String(dbInfo.comment)
                : undefined;
              databases.push(
                new SurrealQLGenerator().generateDatabaseDefinition(name, {
                  comment,
                }),
              );
            } else {
              databases.push(
                new SurrealQLGenerator().generateDatabaseDefinition(name),
              );
            }
          }
        }
      }
    }
    return databases;
  } catch {
    // INFO FOR DB may fail at namespace level — that's expected
    return [];
  }
}

/**
 * Create filter function from filter options
 */
function createFilterFn(filter?: IntrospectFilter): IntrospectFilterFn {
  if (!filter) {
    return () => true;
  }

  const onlySet = filter.onlyTables ? new Set(filter.onlyTables) : null;
  const exceptSet = filter.exceptTables ? new Set(filter.exceptTables) : null;

  return (name, _type) => {
    if (onlySet && !onlySet.has(name)) {
      return false;
    }
    if (exceptSet?.has(name)) {
      return false;
    }
    return true;
  };
}

/**
 * Introspect sequence definitions from SurrealDB
 *
 * Uses INFO FOR DB which returns sequences as:
 * { sequences: { name: "DEFINE SEQUENCE ... SQL" } }
 *
 * Returns parsed SurrealSequence objects.
 */
async function introspectSequences(
  driver: SurrealDriver,
): Promise<SurrealSequence[]> {
  try {
    const result = await driver.query('INFO FOR DB');
    const dbInfo = Array.isArray(result) ? result[0] : result;

    if (!dbInfo || typeof dbInfo !== 'object') {
      return [];
    }

    const seqsObj = (dbInfo as Record<string, unknown>).sequences as
      | Record<string, string>
      | undefined;
    if (!seqsObj) {
      return [];
    }

    const sequences: SurrealSequence[] = [];
    for (const [name, rawSQL] of Object.entries(seqsObj)) {
      if (typeof rawSQL !== 'string') continue;
      const parsed = parseSequenceSQL(name, rawSQL);
      if (parsed) {
        sequences.push(parsed);
      }
    }

    return sequences;
  } catch {
    return [];
  }
}

/**
 * Parse a DEFINE SEQUENCE SQL string into a SurrealSequence object
 *
 * Handles: DEFINE SEQUENCE [IF NOT EXISTS] <name> [START <n>] [INCREMENT <n>]
 *          [MIN <n>] [MAX <n>] [CACHE <n>] [CYCLE] [COMMENT '<str>']
 */
function parseSequenceSQL(
  _name: string,
  rawSQL: string,
): SurrealSequence | null {
  const seq: SurrealSequence = { name: _name };

  const startMatch = rawSQL.match(/START\s+(-?\d+)/i);
  if (startMatch) seq.start = Number(startMatch[1]);

  const incMatch = rawSQL.match(/INCREMENT\s+(-?\d+)/i);
  if (incMatch) seq.increment = Number(incMatch[1]);

  const minMatch = rawSQL.match(/\bMIN\s+(-?\d+)/i);
  if (minMatch) seq.min = Number(minMatch[1]);

  const maxMatch = rawSQL.match(/\bMAX\s+(-?\d+)/i);
  if (maxMatch) seq.max = Number(maxMatch[1]);

  const cacheMatch = rawSQL.match(/CACHE\s+(\d+)/i);
  if (cacheMatch) seq.cache = Number(cacheMatch[1]);

  if (/CYCLE/i.test(rawSQL)) seq.cycle = true;

  const commentMatch = rawSQL.match(/COMMENT\s+"([^"]+)"/i);
  if (commentMatch) seq.comment = commentMatch[1];

  return seq;
}

export { createEmptyDdl };
