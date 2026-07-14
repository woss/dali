/**
 * SurrealDB DDL Type Definitions
 *
 * Follows Drizzle v7 architecture with DDL array format.
 * Adapted for SurrealDB's unique features: relations, permissions, vector indexes, schema modes.
 */

import type { SurrealColumnType } from '../../sdk/schema/column/types.js';
import type { TablePermissions } from '../../sdk/table.js';

// =============================================================================
// Main DDL Container
// =============================================================================

export interface SurrealDbDDL {
  tables: SurrealTable[];
  indexes: SurrealIndex[];
  relations: SurrealRelation[];
  // NEW:
  events: SurrealEvent[];
  lives: SurrealLive[];
  views: string[]; // ViewDefinition = raw SQL string
  access: string[]; // Access definitions: raw 'DEFINE ACCESS ...' SQL strings
  accessStructured: SurrealAccess[];
  functions: SurrealFunction[];
  namespaces: string[]; // Namespace definitions: raw 'DEFINE NAMESPACE ...' SQL strings
  databases: string[]; // Database definitions: raw 'DEFINE DATABASE ...' SQL strings
  sequences: SurrealSequence[];
}

/**
 * Full table structure (mirrors Drizzle's TableFull)
 */
export interface SurrealTable {
  name: string;
  schema: 'full' | 'less';
  type: 'normal' | 'relation';
  columns: SurrealColumn[];
  indexes: SurrealIndex[];
  permissions?: TablePermissions;
  // For RELATION type tables
  in?: string | string[];
  out?: string | string[];
  // NEW: From STRUCTURE output
  events?: SurrealEvent[];
  lives?: SurrealLive[];
  views?: string[];
}

/**
 * Field-level permissions (SurrealDB specific)
 */
export interface SurrealPermissions {
  select?: boolean | string;
  create?: boolean | string;
  update?: boolean | string;
}

/**
 * Column structure (mirrors Drizzle's Column)
 */
export interface SurrealColumn {
  name: string;
  kind: SurrealColumnType;
  table: string;
  default?: string;
  default_always?: boolean;
  readonly: boolean;
  optional: boolean;
  permissions: SurrealPermissions;
  flex: boolean;
  // NEW FIELDS from STRUCTURE info:
  value?: string;
  assert?: string;
  computed?: string;
  reference?: { on_delete: string };
  comment?: string;
  // Record type table reference (e.g., record<user> → 'user')
  recordTable?: string;
}

/**
 * Index structure for SurrealDB
 */
export interface SurrealIndex {
  name: string;
  table: string;
  cols: string[];
  index: string;
  // NEW FIELDS:
  comment?: string;
  prepare_remove?: boolean;
  // Kept for generator compatibility:
  analyzer?: string;
  dimension?: number;
  vectorType?: 'float' | 'float32' | 'float64';
  distance?: 'EUCLIDEAN' | 'MANHATTAN' | 'COSINE' | 'MINKOWSKI';
}

/**
 * Relation (edge) table - SurrealDB specific
 */
export interface SurrealRelation {
  name: string;
  in: string | string[];
  out: string | string[];
  fields: SurrealColumn[];
}

/**
 * Event types - SurrealDB event definitions
 */
export interface SurrealEvent {
  name: string;
  what: string;
  when: string;
  then: string[];
  comment?: string;
  async?: boolean;
  retry?: number;
  maxdepth?: number;
}

/**
 * Live query subscription - SurrealDB LIVE SELECT
 */
export interface SurrealLive {
  id: string;
  node: string;
  fields: string;
  what: string;
  cond?: string;
  fetch?: string;
}

/**
 * Function definition - SurrealDB DEFINE FUNCTION
 */
export interface SurrealFunction {
  name: string;
  args?: string[];
  body: string;
  comment?: string;
  permissions?: string;
}

/**
 * Access definition - SturrealDB DEFINE ACCESS
 */
export interface SurrealAccess {
  name: string;
  type: string;
  level?: 'DATABASE' | 'NAMESPACE' | 'ROOT';
  table?: string;
  signup?: string;
  signin?: string;
  identifier?: string;
  algorithm?: string;
  key?: string;
  issuer?: string;
  duration?: string;
  tokenDuration?: string;
}

/**
 * View definition - SurrealDB DEFINE VIEW
 */
export interface SurrealView {
  name: string;
  query: string;
  comment?: string;
}

/**
 * Sequence definition - SurrealDB DEFINE SEQUENCE
 */
export interface SurrealSequence {
  name: string;
  start?: number;
  increment?: number;
  min?: number;
  max?: number;
  cache?: number;
  cycle?: boolean;
  comment?: string;
}

// =============================================================================
// Statement Types (matching Drizzle's JsonStatement)
// =============================================================================

export type SurrealStatement =
  | CreateTableStatement
  | DropTableStatement
  | RenameTableStatement
  | AddColumnStatement
  | RemoveColumnStatement
  | AlterColumnStatement
  | RenameColumnStatement
  | CreateIndexStatement
  | DropIndexStatement
  | AlterTablePermissionsStatement
  | AlterFieldPermissionsStatement
  | RecreateTableStatement
  | CreateRelationStatement
  | CreateAccessStatement
  | DropAccessStatement
  | CreateEventStatement
  | DropEventStatement
  | CreateFunctionStatement
  | DropFunctionStatement
  | CreateViewStatement
  | DropViewStatement
  | CreateNamespaceStatement
  | DropNamespaceStatement
  | CreateDatabaseStatement
  | DropDatabaseStatement
  | CreateSequenceStatement
  | DropSequenceStatement;

export interface CreateTableStatement {
  type: 'create_table';
  name: string;
  schema: 'full' | 'less';
  columns: SurrealColumn[];
  indexes: SurrealIndex[];
  permissions?: TablePermissions;
  in?: string | string[];
  out?: string | string[];
}

export interface DropTableStatement {
  type: 'drop_table';
  name: string;
}

export interface RenameTableStatement {
  type: 'rename_table';
  from: string;
  to: string;
}

export interface AddColumnStatement {
  type: 'add_column';
  table: string;
  column: SurrealColumn;
}

export interface RemoveColumnStatement {
  type: 'remove_column';
  table: string;
  column: string;
}

export interface AlterColumnStatement {
  type: 'alter_column';
  table: string;
  column: string;
  change: {
    type?: SurrealColumnType;
    recordTable?: string;
    flexible?: boolean;
    readonly?: boolean;
    optional?: boolean;
    default?: unknown;
    assert?: string;
  };
  before?: {
    type?: SurrealColumnType;
    recordTable?: string;
    optional?: boolean;
    readonly?: boolean;
    default?: unknown;
  };
  after?: {
    type?: SurrealColumnType;
    recordTable?: string;
    optional?: boolean;
    readonly?: boolean;
    default?: unknown;
  };
}

export interface RenameColumnStatement {
  type: 'rename_column';
  table: string;
  from: string;
  to: string;
}

export interface CreateIndexStatement {
  type: 'create_index';
  index: SurrealIndex;
}

export interface DropIndexStatement {
  type: 'drop_index';
  name: string;
  table: string;
}

export interface AlterTablePermissionsStatement {
  type: 'alter_table_permissions';
  table: string;
  permissions: TablePermissions;
}

export interface AlterFieldPermissionsStatement {
  type: 'alter_field_permissions';
  table: string;
  field: string;
  permissions: string;
}

export interface RecreateTableStatement {
  type: 'recreate_table';
  name: string;
  columns: SurrealColumn[];
  indexes: SurrealIndex[];
  permissions?: TablePermissions;
  // Data migration required
  dataLoss: boolean;
}

export interface CreateRelationStatement {
  type: 'create_relation';
  name: string;
  in: string | string[];
  out: string | string[];
  columns: SurrealColumn[];
}

export interface CreateAccessStatement {
  type: 'create_access';
  access: SurrealAccess;
}

export interface DropAccessStatement {
  type: 'drop_access';
  name: string;
  scope?: 'DATABASE' | 'NAMESPACE' | 'ROOT';
}

export interface CreateEventStatement {
  type: 'create_event';
  event: SurrealEvent;
}

export interface DropEventStatement {
  type: 'drop_event';
  name: string;
  table: string;
}

export interface CreateFunctionStatement {
  type: 'create_function';
  function: SurrealFunction;
}

export interface DropFunctionStatement {
  type: 'drop_function';
  name: string;
}

export interface CreateViewStatement {
  type: 'create_view';
  view: { name: string; query: string; comment?: string };
}

export interface DropViewStatement {
  type: 'drop_view';
  def: SurrealView;
}

export interface CreateSequenceStatement {
  type: 'create_sequence';
  def: SurrealSequence;
}

export interface DropSequenceStatement {
  type: 'drop_sequence';
  def: SurrealSequence;
}

export interface CreateNamespaceStatement {
  type: 'create_namespace';
  name: string;
  comment?: string;
}

export interface DropNamespaceStatement {
  type: 'drop_namespace';
  name: string;
}

export interface CreateDatabaseStatement {
  type: 'create_database';
  name: string;
  comment?: string;
}

export interface DropDatabaseStatement {
  type: 'drop_database';
  name: string;
}

// =============================================================================
// Diff Result Types
// =============================================================================

export interface DdlDiffResult {
  statements: SurrealStatement[];
  sqlStatements: string[];
  groupedStatements: Record<string, SurrealStatement[]>;
  warnings: string[];
  dataLossOperations: string[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create empty DDL structure
 */
export function createEmptyDdl(): SurrealDbDDL {
  return {
    tables: [],
    indexes: [],
    relations: [],
    events: [],
    lives: [],
    views: [],
    access: [],
    accessStructured: [],
    functions: [],
    namespaces: [],
    databases: [],
    sequences: [],
  };
}

/**
 * Check if DDL is empty
 */
export function isDdlEmpty(ddl: SurrealDbDDL): boolean {
  return (
    ddl.tables.length === 0 &&
    ddl.indexes.length === 0 &&
    ddl.relations.length === 0 &&
    ddl.events.length === 0 &&
    ddl.lives.length === 0 &&
    ddl.views.length === 0 &&
    ddl.access.length === 0 &&
    ddl.accessStructured.length === 0 &&
    ddl.functions.length === 0 &&
    ddl.namespaces.length === 0 &&
    ddl.databases.length === 0 &&
    ddl.sequences.length === 0
  );
}
