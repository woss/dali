/**
 * Delta Generation for SurrealDB
 *
 * Implements ddlDiff function that computes schema deltas between two DDL states.
 * Generates ordered statement list following Drizzle's pattern.
 */

import { createDebug as debug } from 'obug';
import { normalizeDefault } from '../utils/format.js';
import type {
  DdlDiffResult,
  SurrealAccess,
  SurrealColumn,
  SurrealDbDDL,
  SurrealEvent,
  SurrealFunction,
  SurrealIndex,
  SurrealSequence,
  SurrealStatement,
  SurrealTable,
} from './ddl.js';
import {
  orderStatements,
  groupStatements,
  statementToSql,
  serializePermissions,
} from './statement-renderer.js';

export { statementToSql, getDefaultPermissions } from './statement-renderer.js';

const log = debug('dali-orm:kit:diff');

// SurrealDB auto-creates an `id` field for all tables (record ID), but it's not returned
// in INFO FOR TABLE. Skip it when comparing to avoid false "missing field" warnings.
const SURREALDB_IMPLICIT_FIELDS = new Set(['id']);

/**
 * Diff mode - push vs migrate determines certain behaviors
 */
export type DiffMode = 'push' | 'migrate';

/**
 * Generate schema delta between two DDL states
 */
export async function ddlDiff(
  ddl1: SurrealDbDDL,
  ddl2: SurrealDbDDL,
  mode: DiffMode = 'migrate',
): Promise<DdlDiffResult> {
  log('Computing diff: mode=%s', mode);

  const statements: SurrealStatement[] = [];
  const warnings: string[] = [];
  const dataLossOperations: string[] = [];

  // Build lookup maps
  const tables1Map = new Map(ddl1.tables.map((t) => [t.name, t]));
  const tables2Map = new Map(ddl2.tables.map((t) => [t.name, t]));

  // 1. Find new tables (in ddl2 but not in ddl1)
  for (const [name, table] of tables2Map) {
    if (!tables1Map.has(name)) {
      log('New table: %s', name);
      statements.push({
        type: 'create_table',
        name: table.name,
        schema: table.schema,
        columns: table.columns,
        indexes: table.indexes,
        permissions: table.permissions,
        in: table.in,
        out: table.out,
      });
    }
  }

  // 2. Find removed tables (in ddl1 but not in ddl2)
  for (const [name, _table] of tables1Map) {
    if (!tables2Map.has(name)) {
      log('Removed table: %s', name);
      // Check for data loss in push mode
      if (mode === 'push') {
        // Would need to check if table has data - handled in push command
        dataLossOperations.push(`DROP TABLE ${name}`);
        warnings.push(`Dropping table ${name} will delete all data`);
      }
      statements.push({
        type: 'drop_table',
        name,
      });
    }
  }

  // 3. Find changed tables (compare columns, indexes, permissions)
  for (const [name, table2] of tables2Map) {
    const table1 = tables1Map.get(name);
    if (!table1) continue; // New table handled above

    const changes = diffTable(table1, table2, mode);
    statements.push(...changes.statements);
    warnings.push(...changes.warnings);
    dataLossOperations.push(...changes.dataLossOperations);
  }

  // 4. Handle index changes
  const indexChanges = diffIndexes(ddl1.indexes, ddl2.indexes, tables2Map);
  statements.push(...indexChanges.statements);
  warnings.push(...indexChanges.warnings);
  dataLossOperations.push(...indexChanges.dataLossOperations);

  // 5. Handle relation changes
  const relationChanges = diffRelations(ddl1.relations, ddl2.relations, tables2Map);
  statements.push(...relationChanges.statements);

  // 6. Handle access changes
  const accessChanges = diffAccess(ddl1.accessStructured, ddl2.accessStructured);
  statements.push(...accessChanges.statements);

  // X. Handle namespace changes
  const namespaceChanges = diffNamespaces(ddl1.namespaces, ddl2.namespaces);
  statements.push(...namespaceChanges.statements);

  // Y. Handle database changes
  const databaseChanges = diffDatabases(ddl1.databases, ddl2.databases);
  statements.push(...databaseChanges.statements);

  // 7. Handle sequence changes
  const sequenceChanges = diffSequences(ddl1.sequences, ddl2.sequences);
  statements.push(...sequenceChanges.statements);

  // 8. Handle event changes
  const eventChanges = diffEvents(ddl1.events, ddl2.events);
  statements.push(...eventChanges.statements);

  // 9. Handle function changes
  const functionChanges = diffFunctions(ddl1.functions, ddl2.functions);
  statements.push(...functionChanges.statements);

  // 10. Handle view changes
  const viewChanges = diffViews(ddl1.views, ddl2.views);
  statements.push(...viewChanges.statements);

  // Order statements: create tables, rename, add columns, alter, recreate, drop indexes, create indexes, drop tables, drop columns
  const orderedStatements = orderStatements(statements);

  // Convert to SQL strings
  const sqlStatements = orderedStatements.map((stmt) => statementToSql(stmt));

  // Group by operation type
  const groupedStatements = groupStatements(orderedStatements);

  log('Diff complete: %d statements, %d warnings', statements.length, warnings.length);

  return {
    statements: orderedStatements,
    sqlStatements,
    groupedStatements,
    warnings,
    dataLossOperations,
  };
}

/**
 * Diff a single table
 */
function diffTable(
  table1: SurrealTable,
  table2: SurrealTable,
  mode: DiffMode,
): { statements: SurrealStatement[]; warnings: string[]; dataLossOperations: string[] } {
  const statements: SurrealStatement[] = [];
  const warnings: string[] = [];
  const dataLossOperations: string[] = [];

  const tableName = table1.name;

  // Debug logging for index comparison
  log('Table %s: DB indexes: %O', tableName, table1.indexes);
  log('Table %s: Schema indexes: %O', tableName, table2.indexes);

  // Check diffIndexes results
  const indexChanges = diffIndexes(table1.indexes, table2.indexes, new Map());
  log('Index changes: %O', indexChanges);

  // Add index changes to statements
  statements.push(...indexChanges.statements);
  warnings.push(...indexChanges.warnings);
  dataLossOperations.push(...indexChanges.dataLossOperations);

  // Check schema mode change
  if (table1.schema !== table2.schema) {
    warnings.push(
      `Table ${table1.name}: schema mode changed from ${table1.schema} to ${table2.schema}`,
    );
    // This requires table recreation in most cases
  }

  // Check table type change
  if (table1.type !== table2.type) {
    warnings.push(`Table ${table1.name}: type changed from ${table1.type} to ${table2.type}`);
    dataLossOperations.push(`CHANGE TABLE TYPE ${table1.name}`);
  }

  // Column diff
  const columns1Map = new Map(table1.columns.map((c) => [c.name, c]));
  const columns2Map = new Map(table2.columns.map((c) => [c.name, c]));

  // New columns
  for (const [name, col2] of columns2Map) {
    // Skip implicit SurrealDB fields (id is auto-created but not in INFO FOR TABLE)
    if (SURREALDB_IMPLICIT_FIELDS.has(name)) {
      continue;
    }

    const dbColumn = columns1Map.get(name);

    // If column exists in DB but with no kind info, it's a schemaless field - no diff needed
    if (dbColumn && !dbColumn.kind) {
      log('Schemaless column: %s.%s (no type defined, skipping)', table2.name, name);
      continue;
    }

    if (!dbColumn) {
      log('New column: %s.%s', table2.name, name);

      // Check if adding NOT NULL without default (data loss in push mode)
      if (mode === 'push' && !col2.optional && col2.default === undefined) {
        dataLossOperations.push(`ADD NOT NULL COLUMN ${table2.name}.${name} without default`);
        warnings.push(
          `Adding NOT NULL column ${table2.name}.${name} without default will fail on existing rows`,
        );
      }

      statements.push({
        type: 'add_column',
        table: table2.name,
        column: col2,
      });
    }
  }

  // Removed columns
  for (const [name, _col1] of columns1Map) {
    if (!columns2Map.has(name)) {
      log('Removed column: %s.%s', table1.name, name);

      if (mode === 'push') {
        dataLossOperations.push(`DROP COLUMN ${table1.name}.${name}`);
        warnings.push(`Dropping column ${table1.name}.${name} will delete data`);
      }

      statements.push({
        type: 'remove_column',
        table: table1.name,
        column: name,
      });
    }
  }

  // Changed columns (only process if column exists in BOTH source and target)
  // Skip - new columns handled in new columns section above
  for (const [name, col2] of columns2Map) {
    const col1 = columns1Map.get(name);
    if (!col1) continue; // Column only in target - handled as add_column above

    const colChanges = diffColumn(col1, col2, table1.name, mode);
    statements.push(...colChanges.statements);
    warnings.push(...colChanges.warnings);
    dataLossOperations.push(...colChanges.dataLossOperations);
  }

  // Permission changes
  if (table1.permissions || table2.permissions) {
    const permsChanged = JSON.stringify(table1.permissions) !== JSON.stringify(table2.permissions);
    if (permsChanged) {
      statements.push({
        type: 'alter_table_permissions',
        table: table2.name,
        permissions: table2.permissions || {
          select: 'WHERE true',
          create: 'WHERE true',
          update: 'WHERE true',
          delete: 'WHERE true',
        },
      });
    }
  }

  return { statements, warnings, dataLossOperations };
}

/**
 * Diff a single column
 */
function diffColumn(
  col1: SurrealColumn,
  col2: SurrealColumn,
  tableName: string,
  mode: DiffMode,
): { statements: SurrealStatement[]; warnings: string[]; dataLossOperations: string[] } {
  const statements: SurrealStatement[] = [];
  const warnings: string[] = [];
  const dataLossOperations: string[] = [];

  // Type change
  if (col1.kind !== col2.kind) {
    log('Column type change: %s.%s: %s -> %s', tableName, col1.name, col1.kind, col2.kind);

    if (mode === 'push') {
      dataLossOperations.push(`CHANGE COLUMN TYPE ${tableName}.${col2.name}`);
      warnings.push(
        `Changing column type ${tableName}.${col2.name} from ${col1.kind} to ${col2.kind} may lose data`,
      );
    }

    statements.push({
      type: 'alter_column',
      table: tableName,
      column: col2.name,
      change: { type: col2.kind },
      before: { type: col1.kind },
      after: { type: col2.kind },
    });
  }

  // Optional change detection - track when optional flag changes
  // Note: SurrealDB has NOT NULL (NOT OPTIONAL), so optional=false means NOT NULL
  if (col1.optional !== col2.optional) {
    // Only warn about making NOT NULL without default in push mode
    if (mode === 'push' && col2.optional === false && col2.default === undefined) {
      dataLossOperations.push(`ADD NOT NULL ${tableName}.${col2.name}`);
      warnings.push(`Making column ${tableName}.${col2.name} NOT NULL without default may fail`);
    }

    // Always create the alter statement to track the change - include kind for SQL generation
    statements.push({
      type: 'alter_column',
      table: tableName,
      column: col2.name,
      change: { optional: col2.optional, type: col2.kind },
      before: { optional: col1.optional, type: col1.kind },
      after: { optional: col2.optional, type: col2.kind },
    });
  }

  // Readonly change - include optional in change for TYPE generation
  if (col1.readonly !== col2.readonly) {
    statements.push({
      type: 'alter_column',
      table: tableName,
      column: col2.name,
      change: { readonly: col2.readonly, optional: col2.optional, type: col2.kind },
      before: { readonly: col1.readonly, optional: col1.optional, type: col1.kind },
      after: { readonly: col2.readonly, optional: col2.optional, type: col2.kind },
    });
  }

  // Default change - include optional in change for TYPE generation
  // Normalize both defaults before comparison to handle string 'true'/'false' vs boolean true/false
  const normCol1Default = normalizeDefault(col1.default);
  const normCol2Default = normalizeDefault(col2.default);
  if (JSON.stringify(normCol1Default) !== JSON.stringify(normCol2Default)) {
    statements.push({
      type: 'alter_column',
      table: tableName,
      column: col2.name,
      change: { default: col2.default, optional: col2.optional, type: col2.kind } as any,
      before: { default: col1.default, optional: col1.optional, type: col1.kind } as any,
      after: { default: col2.default, optional: col2.optional, type: col2.kind } as any,
    });
  }

  // Record table change
  if (col1.recordTable !== col2.recordTable) {
    statements.push({
      type: 'alter_column',
      table: tableName,
      column: col2.name,
      change: { type: col2.kind, recordTable: col2.recordTable },
      before: { type: col1.kind, recordTable: col1.recordTable },
      after: { type: col2.kind, recordTable: col2.recordTable },
    });
  }

  // Permission change
  if (col1.permissions !== col2.permissions) {
    if (col2.permissions) {
      const permsStr = serializePermissions(col2.permissions);
      if (permsStr) {
        statements.push({
          type: 'alter_field_permissions',
          table: tableName,
          field: col2.name,
          permissions: permsStr,
        });
      }
    }
  }

  return { statements, warnings, dataLossOperations };
}

/**
 * Diff indexes
 */
function diffIndexes(
  indexes1: SurrealIndex[] | undefined,
  indexes2: SurrealIndex[] | undefined,
  _tables2Map: Map<string, SurrealTable>,
): { statements: SurrealStatement[]; warnings: string[]; dataLossOperations: string[] } {
  const statements: SurrealStatement[] = [];
  const warnings: string[] = [];
  const dataLossOperations: string[] = [];

  const idx1Map = new Map((indexes1 ?? []).map((i) => [`${i.table}:${i.name}`, i]));
  const idx2Map = new Map((indexes2 ?? []).map((i) => [`${i.table}:${i.name}`, i]));

  // New indexes
  for (const [key, idx2] of idx2Map) {
    if (!idx1Map.has(key)) {
      statements.push({
        type: 'create_index',
        index: idx2,
      });
    }
  }

  // Removed indexes
  for (const [key, idx1] of idx1Map) {
    if (!idx2Map.has(key)) {
      statements.push({
        type: 'drop_index',
        name: idx1.name,
        table: idx1.table,
      });
    }
  }

  // Changed indexes (compare properties)
  for (const [key, idx2] of idx2Map) {
    const idx1 = idx1Map.get(key);
    if (idx1 && JSON.stringify(idx1) !== JSON.stringify(idx2)) {
      // Drop and recreate
      statements.push({
        type: 'drop_index',
        name: idx1.name,
        table: idx1.table,
      });
      statements.push({
        type: 'create_index',
        index: idx2,
      });
    }
  }

  return { statements, warnings, dataLossOperations };
}

/**
 * Diff relations (edge tables)
 */
function diffRelations(
  relations1: SurrealDbDDL['relations'],
  relations2: SurrealDbDDL['relations'],
  tables2Map?: Map<string, SurrealTable>,
): { statements: SurrealStatement[] } {
  const statements: SurrealStatement[] = [];

  const rel1Map = new Map(relations1.map((r) => [r.name, r]));
  const rel2Map = new Map(relations2.map((r) => [r.name, r]));

  // New relations
  for (const [name, rel2] of rel2Map) {
    if (!rel1Map.has(name)) {
      // Skip if table already being created as a relation table (handles TYPE RELATION)
      if (tables2Map?.has(name)) continue;
      statements.push({
        type: 'create_relation',
        name: rel2.name,
        in: rel2.in,
        out: rel2.out,
        columns: rel2.fields,
      });
    }
  }

  // Removed relations
  for (const [name] of rel1Map) {
    if (!rel2Map.has(name)) {
      statements.push({
        type: 'drop_table',
        name,
      });
    }
  }

  return { statements };
}

/**
 * Diff access definitions
 */
function diffAccess(
  access1: SurrealAccess[] | undefined,
  access2: SurrealAccess[] | undefined,
): { statements: SurrealStatement[] } {
  const statements: SurrealStatement[] = [];

  const acc1Map = new Map((access1 ?? []).map((a) => [a.name, a]));
  const acc2Map = new Map((access2 ?? []).map((a) => [a.name, a]));

  // New access definitions
  for (const [name, acc2] of acc2Map) {
    if (!acc1Map.has(name)) {
      statements.push({
        type: 'create_access',
        access: acc2,
      });
    }
  }

  // Removed access definitions - safety-first: never auto-remove access
  // Access definitions are only added during migration, never automatically removed
  // to prevent accidental auth breakage. Users must manually remove access.

  return { statements };
}

/**
 * Diff namespace definitions
 *
 * Namespaces are simple string arrays. Detect additions and removals.
 * Safety-first: never auto-remove namespaces to prevent data loss.
 */
function diffNamespaces(
  ns1: string[] | undefined,
  ns2: string[] | undefined,
): { statements: SurrealStatement[] } {
  const statements: SurrealStatement[] = [];

  const set1 = new Set(ns1 ?? []);
  const set2 = new Set(ns2 ?? []);

  // New namespaces
  for (const ns of set2) {
    if (!set1.has(ns)) {
      statements.push({
        type: 'create_namespace',
        name: ns,
      });
    }
  }

  // Removed namespaces - intentionally skipped (safety-first)
  // Namespaces are only added during migration, never automatically removed
  // because removing a namespace drops ALL databases within it.

  return { statements };
}

/**
 * Diff database definitions
 *
 * Databases are simple string arrays. Detect additions and removals.
 * Safety-first: never auto-remove databases to prevent data loss.
 */
function diffDatabases(
  db1: string[] | undefined,
  db2: string[] | undefined,
): { statements: SurrealStatement[] } {
  const statements: SurrealStatement[] = [];

  const set1 = new Set(db1 ?? []);
  const set2 = new Set(db2 ?? []);

  // New databases
  for (const db of set2) {
    if (!set1.has(db)) {
      statements.push({
        type: 'create_database',
        name: db,
      });
    }
  }

  // Removed databases - intentionally skipped (safety-first)
  // Databases are only added during migration, never automatically removed
  // because removing a database drops ALL data within it.

  return { statements };
}

/**
 * Diff sequence definitions
 *
 * Sequences are compared by name using SurrealSequence objects.
 * Detects new sequences and changed sequences (drop+recreate).
 * Removed sequences are intentionally skipped (safety-first by default).
 */
function diffSequences(
  seqs1: SurrealSequence[] | undefined,
  seqs2: SurrealSequence[] | undefined,
): { statements: SurrealStatement[] } {
  const statements: SurrealStatement[] = [];

  const seq1Map = new Map((seqs1 ?? []).map((s) => [s.name, s]));
  const seq2Map = new Map((seqs2 ?? []).map((s) => [s.name, s]));

  // New sequences
  for (const [name, seq2] of seq2Map) {
    if (!seq1Map.has(name)) {
      statements.push({
        type: 'create_sequence',
        def: seq2,
      });
    }
  }

  // Changed sequences (compare properties — drop and recreate)
  for (const [name, seq2] of seq2Map) {
    const seq1 = seq1Map.get(name);
    if (seq1 && JSON.stringify(seq1) !== JSON.stringify(seq2)) {
      statements.push({
        type: 'drop_sequence',
        def: { name: seq1.name },
      });
      statements.push({
        type: 'create_sequence',
        def: seq2,
      });
    }
  }

  // Removed sequences — intentionally skipped by default
  // Sequences are only added/modified during migration, never automatically removed
  // to prevent accidental disruption. Users must manually remove sequences.

  return { statements };
}

/**
 * Diff event definitions
 *
 * Events are defined per-table. Compares events arrays by (table:name) key.
 * Detects new events, changed events (drop+recreate), and intentionally
 * skips removal (safety-first by default).
 */
function diffEvents(
  events1: SurrealEvent[] | undefined,
  events2: SurrealEvent[] | undefined,
): { statements: SurrealStatement[] } {
  const statements: SurrealStatement[] = [];

  const evt1Map = new Map((events1 ?? []).map((e) => [`${e.what}:${e.name}`, e]));
  const evt2Map = new Map((events2 ?? []).map((e) => [`${e.what}:${e.name}`, e]));

  // New events
  for (const [key, evt2] of evt2Map) {
    if (!evt1Map.has(key)) {
      statements.push({
        type: 'create_event',
        event: evt2,
      });
    }
  }

  // Changed events (compare properties)
  for (const [key, evt2] of evt2Map) {
    const evt1 = evt1Map.get(key);
    if (evt1 && JSON.stringify(evt1) !== JSON.stringify(evt2)) {
      // Drop and recreate
      statements.push({
        type: 'drop_event',
        name: evt1.name,
        table: evt1.what,
      });
      statements.push({
        type: 'create_event',
        event: evt2,
      });
    }
  }

  // Removed events - intentionally skipped by default
  // Events are only added/modified during migration, never automatically removed
  // to prevent accidental trigger disruption. Users must manually remove events.

  return { statements };
}

/**
 * Diff function definitions
 *
 * Functions are compared by name. Detects new functions and changed functions (drop+recreate).
 * Removed functions are intentionally skipped (safety-first by default).
 */
function diffFunctions(
  funcs1: SurrealFunction[] | undefined,
  funcs2: SurrealFunction[] | undefined,
): { statements: SurrealStatement[] } {
  const statements: SurrealStatement[] = [];

  const fn1Map = new Map((funcs1 ?? []).map((f) => [f.name, f]));
  const fn2Map = new Map((funcs2 ?? []).map((f) => [f.name, f]));

  // New functions
  for (const [name, fn2] of fn2Map) {
    if (!fn1Map.has(name)) {
      statements.push({
        type: 'create_function',
        function: fn2,
      });
    }
  }

  // Changed functions (compare properties — drop and recreate)
  for (const [key, fn2] of fn2Map) {
    const fn1 = fn1Map.get(key);
    if (fn1 && JSON.stringify(fn1) !== JSON.stringify(fn2)) {
      statements.push({
        type: 'drop_function',
        name: fn1.name,
      });
      statements.push({
        type: 'create_function',
        function: fn2,
      });
    }
  }

  // Removed functions — intentionally skipped by default
  // Functions are only added/modified during migration, never automatically removed
  // to prevent accidental breakage. Users must manually remove functions.

  return { statements };
}

/**
 * Diff view definitions
 *
 * Views are compared by name. Detects new views and changed views (drop+recreate).
 * Removed views are intentionally skipped (safety-first by default).
 */
function diffViews(
  views1: string[] | undefined,
  views2: string[] | undefined,
): { statements: SurrealStatement[] } {
  const statements: SurrealStatement[] = [];

  // Parse views into name+query+comment pairs for comparison
  const parseView = (sql: string): { name: string; query: string; comment?: string } => {
    const rest = sql.replace(/^DEFINE VIEW IF NOT EXISTS /i, '').replace(/^DEFINE VIEW /i, '');
    // Split on ' AS ' to get name and query
    const idx = rest.search(/\s+AS\s+/i);
    if (idx === -1) return { name: rest.trim(), query: '' };

    let query = rest.slice(idx + 4).trim();
    let comment: string | undefined;

    // Strip trailing PERMISSIONS clause (last clause in DEFINE VIEW)
    query = query.replace(/\s+PERMISSIONS\s+.+$/i, '');

    // Strip trailing COMMENT clause and capture its value
    const commentMatch = query.match(/\s+COMMENT\s+"([^"]*)"\s*$/i);
    if (commentMatch) {
      comment = commentMatch[1];
      query = query.slice(0, commentMatch.index);
    }

    return { name: rest.slice(0, idx).trim(), query: query.trim(), comment };
  };

  const v1Map = new Map(
    (views1 ?? []).map((s) => {
      const v = parseView(s);
      return [v.name, v];
    }),
  );
  const v2Map = new Map(
    (views2 ?? []).map((s) => {
      const v = parseView(s);
      return [v.name, v];
    }),
  );

  // New views
  for (const [name, v2] of v2Map) {
    if (!v1Map.has(name)) {
      statements.push({
        type: 'create_view',
        view: { name, query: v2.query, comment: v2.comment },
      });
    }
  }

  // Changed views (compare query — drop and recreate)
  for (const [name, v2] of v2Map) {
    const v1 = v1Map.get(name);
    if (v1 && (v1.query !== v2.query || v1.comment !== v2.comment)) {
      statements.push({
        type: 'drop_view',
        name,
      });
      statements.push({
        type: 'create_view',
        view: { name, query: v2.query, comment: v2.comment },
      });
    }
  }

  // Removed views — intentionally skipped by default

  return { statements };
}
