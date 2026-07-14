/**
 * Statement rendering utilities for SurrealDB DDL
 *
 * Converts SurrealStatement objects into SQL strings.
 * Extracted from diff.ts to keep files under 500 lines.
 */

import { SurrealQLGenerator } from '../core/generator.js';
import { isRaw, quoteString, serializePermissionsFragment } from '../../core/surql.js';
import type { ColumnDefinition } from '../../sdk/schema/column/types.js';
import type { IndexDefinition, TableDefinition, TablePermissions } from '../../sdk/table.js';
import type {
  CreateDatabaseStatement,
  CreateNamespaceStatement,
  SurrealColumn,
  SurrealIndex,
  SurrealStatement,
} from './ddl.js';

const generator = new SurrealQLGenerator();

// Type aliases for discriminated union extraction
type CreateTableStatement = Extract<SurrealStatement, { type: 'create_table' }>;
type AddColumnStatement = Extract<SurrealStatement, { type: 'add_column' }>;
type AlterColumnStatement = Extract<SurrealStatement, { type: 'alter_column' }>;

/**
 * Format a default value for SQL output - handles now() variants and proper SurrealQL escaping
 * Strings: single-quoted ('viewer')
 * Booleans: unquoted (true/false)
 * Numbers: unquoted (42)
 * null/undefined: NULL/NONE
 */
function formatDefaultForSql(value: unknown): string {
  if (value === null) return 'NULL';
  if (value === undefined) return 'NONE';
  if (isRaw(value)) return value.sql;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'now' || normalized === 'now()' || normalized === 'time::now()') {
      return 'time::now()';
    }
    // Single-quote strings for SurrealQL, escape internal single quotes
    return quoteString(value);
  }
  // Fallback for objects/arrays
  return JSON.stringify(value);
}

/**
 * Serialize SurrealPermissions object to SQL string for field permissions
 */
export function serializePermissions(perms: {
  select?: string | boolean;
  create?: string | boolean;
  update?: string | boolean;
  delete?: string | boolean;
}): string {
  return serializePermissionsFragment(perms);
}

/**
 * Order statements following Drizzle's pattern
 */
export function orderStatements(statements: SurrealStatement[]): SurrealStatement[] {
  const order: Array<SurrealStatement['type']> = [
    'create_namespace',
    'drop_namespace',
    'create_database',
    'drop_database',
    'create_sequence',
    'drop_sequence',
    'create_table',
    'create_relation',
    'create_access',
    'create_event',
    'drop_event',
    'create_function',
    'drop_function',
    'create_view',
    'drop_view',
    'rename_table',
    'add_column',
    'alter_column',
    'alter_table_permissions',
    'alter_field_permissions',
    'create_index',
    'drop_index',
    'remove_column',
    'drop_table',
  ];

  return [...statements].sort((a, b) => {
    const aIndex = order.indexOf(a.type);
    const bIndex = order.indexOf(b.type);
    return aIndex - bIndex;
  });
}

/**
 * Group statements by type
 */
export function groupStatements(
  statements: SurrealStatement[],
): Record<string, SurrealStatement[]> {
  const grouped: Record<string, SurrealStatement[]> = {};

  for (const stmt of statements) {
    const group = stmt.type;
    grouped[group] = grouped[group] || [];
    grouped[group].push(stmt);
  }

  return grouped;
}

/**
 * Convert statement to SQL string
 */
export function statementToSql(stmt: SurrealStatement): string {
  switch (stmt.type) {
    case 'create_table':
      return generateCreateTable(stmt);
    case 'drop_table':
      return generator.generateRemoveTable(stmt.name);
    case 'rename_table':
      return `ALTER TABLE ${stmt.from} RENAME TO ${stmt.to}`;
    case 'add_column':
      return generateAddColumn(stmt);
    case 'remove_column':
      return generator.generateRemoveField(stmt.table, stmt.column);
    case 'alter_column':
      return generateAlterColumn(stmt);
    case 'create_index':
      return generateCreateIndex(stmt.index);
    case 'drop_index':
      return generator.generateRemoveIndex(stmt.name, stmt.table);
    case 'alter_table_permissions':
      return generator.generateAlterTablePermissions(stmt.table, stmt.permissions);
    case 'alter_field_permissions':
      return generator.generateAlterFieldPermissions(stmt.table, stmt.field, stmt.permissions);
    case 'create_relation': {
      // Relations are defined as tables with TYPE RELATION
      const inStr = Array.isArray(stmt.in) ? stmt.in.join(', ') : stmt.in;
      const outStr = Array.isArray(stmt.out) ? stmt.out.join(', ') : stmt.out;
      return `DEFINE TABLE ${stmt.name} TYPE RELATION IN ${inStr} OUT ${outStr}`;
    }
    case 'create_access':
      return generator.generateAccessDefinition(stmt.access);
    case 'drop_access':
      return generator.generateRemoveAccess(stmt.name);
    case 'create_event':
      return generator.generateEventDefinition(stmt.event);
    case 'drop_event':
      return generator.generateRemoveEvent(stmt.name, stmt.table);
    case 'create_function':
      return generator.generateFunctionDefinition(stmt.function);
    case 'drop_function':
      return generator.generateRemoveFunction(stmt.name);
    case 'create_view':
      return generator.generateViewDefinition(stmt.view);
    case 'drop_view':
      return generator.generateRemoveView(stmt.name);
    case 'create_namespace':
      return generator.generateNamespaceDefinition(stmt.name, {
        comment: (stmt as CreateNamespaceStatement).comment,
      });
    case 'drop_namespace':
      return generator.generateRemoveNamespace(stmt.name);
    case 'create_database':
      return generator.generateDatabaseDefinition(stmt.name, {
        comment: (stmt as CreateDatabaseStatement).comment,
      });
    case 'drop_database':
      return generator.generateRemoveDatabase(stmt.name);
    case 'create_sequence':
      return generator.generateSequenceDefinition(stmt.def);
    case 'drop_sequence':
      return generator.generateRemoveSequence(stmt.def.name);
    default:
      return `-- Unknown statement type: ${(stmt as any).type}`;
  }
}

// =============================================================================
// Internal helpers
// =============================================================================

function generateCreateTable(stmt: CreateTableStatement): string {
  const lines: string[] = [];

  // Use generator for table definition (handles SCHEMAFULL/SCHEMALESS, TYPE RELATION, permissions)
  const tableDef: TableDefinition = {
    name: stmt.name,
    columns: [],
    config: {
      schema: stmt.schema === 'less' ? 'less' : 'full',
      type: stmt.in && stmt.out ? 'relation' : 'normal',
      in: stmt.in,
      out: stmt.out,
      permissions: stmt.permissions,
    },
  };

  lines.push(generator.generateTableDefinition(tableDef));

  // Use generator for each column - use option<T> syntax for optional fields
  for (const col of stmt.columns) {
    let line = `DEFINE FIELD IF NOT EXISTS ${col.name} ON TABLE ${stmt.name}`;
    // For record types with a target table, include the linked table name
    let typeStr: string = col.kind;
    if (col.kind === 'record' && col.recordTable) {
      typeStr = `record<${col.recordTable}>`;
    }
    // Use option<T> syntax for optional fields (SurrealDB syntax)
    // FLEXIBLE only pairs with plain TYPE object, not option<object>
    if (col.optional && !(col.flex && col.kind === 'object')) line += ` TYPE option<${typeStr}>`;
    else line += ` TYPE ${typeStr}`;
    // FLEXIBLE must be specified after TYPE in SurrealDB
    if (col.flex) line += ' FLEXIBLE';
    if (col.readonly) line += ' READONLY';
    if (col.default !== undefined) line += ` DEFAULT ${formatDefaultForSql(col.default)}`;
    if (col.assert) line += ` ASSERT ${col.assert}`;
    if (col.permissions) {
      const permsStr = serializePermissions(col.permissions);
      if (permsStr) line += ` PERMISSIONS ${permsStr}`;
    }

    lines.push(line);
  }

  // Indexes tracked at top-level ddl.indexes — handled by diffIndexes
  // Do NOT generate inline to avoid duplicate create_index statements

  return lines.join(';\n');
}

function generateAddColumn(stmt: AddColumnStatement): string {
  const colDef = colToColumnDefinition(stmt.table)(stmt.column);
  return generator.generateFieldDefinition(colDef);
}

function generateAlterColumn(stmt: AlterColumnStatement): string {
  const parts: string[] = [`ALTER FIELD ${stmt.column} ON TABLE ${stmt.table}`];

  // Handle type change - use change.type if set, otherwise derive from before
  if (stmt.change.type) {
    let targetType: string = stmt.change.type;
    // For record types with a target table, include the linked table name
    if (targetType === 'record' && stmt.change.recordTable) {
      targetType = `record<${stmt.change.recordTable}>` as any;
    }
    const isOptional = stmt.change.optional ?? stmt.before?.optional ?? false;
    const typeStr = isOptional ? `option<${targetType}>` : targetType;
    parts.push(`TYPE ${typeStr}`);
  }

  // When making optional without explicit type change, use before.type to wrap in option<>
  if (stmt.change.optional === true && !stmt.change.type) {
    const baseType = stmt.before?.type;
    if (baseType) {
      const isRecord = baseType === 'record' && stmt.before?.recordTable;
      const targetType = isRecord ? `record<${stmt.before!.recordTable}>` : baseType;
      parts.push(`TYPE option<${targetType}>`);
    }
    // else: skip — can't express optional toggle without knowing the type
  }

  // Handle readonly
  if (stmt.change.readonly !== undefined) {
    parts.push(stmt.change.readonly ? 'READONLY' : 'DROP READONLY');
  }

  // Handle default
  if (stmt.change.default !== undefined) {
    parts.push(`DEFAULT ${formatDefaultForSql(stmt.change.default)}`);
  }

  return parts.join(' ');
}

function generateCreateIndex(idx: SurrealIndex): string {
  const idxDef = idxToIndexDefinition(idx.table)(idx);
  return generator.generateIndexDefinition(idxDef, idx.table);
}

// Export the function that's used in diffTable for fallback permissions
export function getDefaultPermissions(): TablePermissions {
  return { select: 'WHERE true', create: 'WHERE true', update: 'WHERE true', delete: 'WHERE true' };
}

// =============================================================================
// Helper functions to convert DDL types to Generator types
// =============================================================================

/**
 * Convert SurrealColumn to ColumnDefinition for generator
 */
function colToColumnDefinition(tableName: string) {
  return (col: SurrealColumn): ColumnDefinition => ({
    name: col.name,
    tableName,
    config: {
      // Schemaless columns may not have a kind - default to string for conversion
      type: col.kind ?? 'string',
      recordTable: col.recordTable,
      optional: col.optional,
      default: typeof col.default === 'string' ? col.default : undefined,
      assert: col.assert,
      readonly: col.readonly,
      permissions: col.permissions as unknown as string,
      flexible: col.flex,
    },
  });
}

/**
 * Convert SurrealIndex to IndexDefinition for generator
 */
function idxToIndexDefinition(_tableName: string) {
  return (idx: SurrealIndex): IndexDefinition => ({
    name: idx.name,
    fields: idx.cols,
    type: idx.index as IndexDefinition['type'],
    analyzer: idx.analyzer,
    dimension: idx.dimension,
    vectorType: idx.vectorType,
    distance: idx.distance as IndexDefinition['distance'],
  });
}
