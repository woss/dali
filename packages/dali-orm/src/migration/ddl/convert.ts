/**
 * Type conversion utilities between SDK types and Migration DDL types.
 *
 * Converts between:
 * - ColumnDefinition ↔ SurrealColumn
 * - TableDefinition ↔ SurrealTable
 *
 * Parse, don't validate: Functions transform at boundary, return trusted types.
 */

import type {
  ColumnConfig,
  ColumnDefinition,
} from '../../sdk/schema/column/types.js';
import type {
  IndexDefinition,
  TableConfig,
  TableDefinition,
} from '../../sdk/table.js';
import type {
  SurrealAccess,
  SurrealColumn,
  SurrealEvent,
  SurrealFunction,
  SurrealIndex,
  SurrealTable,
  SurrealPermissions as TableSurrealPermissions,
} from './ddl.js';

// =============================================================================
// Column Conversions
// =============================================================================

/**
 * Convert SDK ColumnDefinition to Migration SurrealColumn.
 *
 * @param def - Column definition from SDK
 * @param tableName - Table name (required for SurrealColumn.table)
 * @returns SurrealColumn ready for DDL operations
 */
export function toSurrealColumn(
  def: ColumnDefinition,
  tableName: string,
): SurrealColumn {
  if (!def) throw new Error('ColumnDefinition required');
  if (!tableName) throw new Error('tableName required for SurrealColumn');

  const { name, config } = def;

  return {
    name,
    kind: config.type,
    table: tableName,
    default: config.defaultRaw ?? config.default,
    readonly: config.readonly ?? false,
    optional: config.optional ?? false,
    permissions: config.permissions
      ? parsePermissions(config.permissions)
      : { select: true, create: true },
    flex: config.flexible ?? false,
    assert: config.assert,
    recordTable: config.recordTable,
    // Fields not present in SDK ColumnConfig remain undefined
    value: undefined,
    computed: undefined,
    reference: undefined,
    comment: undefined,
    default_always: undefined,
  };
}

/**
 * Convert Migration SurrealColumn back to SDK ColumnDefinition.
 *
 * @param col - SurrealColumn from DDL
 * @returns ColumnDefinition for SDK usage
 */
export function fromSurrealColumn(col: SurrealColumn): ColumnDefinition {
  if (!col) throw new Error('SurrealColumn required');

  const config: ColumnConfig = {
    type: col.kind,
  };

  // Only set defined values (avoid undefined pollution)
  if (col.default !== undefined) config.default = col.default;
  if (col.optional) config.optional = true;
  if (col.readonly) config.readonly = true;
  if (col.assert) config.assert = col.assert;
  if (col.flex) config.flexible = true;
  if (col.recordTable) config.recordTable = col.recordTable;

  return {
    name: col.name,
    config,
    tableName: col.table,
  };
}

// =============================================================================
// Table Conversions
// =============================================================================

/**
 * Convert SDK TableDefinition to Migration SurrealTable.
 *
 * @param def - Table definition from SDK
 * @returns SurrealTable ready for DDL operations
 */
export function toSurrealTable(def: TableDefinition): SurrealTable {
  if (!def) throw new Error('TableDefinition required');

  const { name, columns, config } = def;

  return {
    name,
    schema: config.schema ?? 'full',
    type: config.type ?? 'normal',
    columns: columns.map((col) => toSurrealColumn(col, name)),
    indexes: config.indexes ? config.indexes.map(toSurrealIndex) : [],
    permissions: config.permissions,
    in: config.in,
    out: config.out,
    // Fields not present in SDK TableConfig remain undefined
    events: undefined,
    lives: undefined,
    views: undefined,
  };
}

/**
 * Convert Migration SurrealTable back to SDK TableDefinition.
 *
 * @param table - SurrealTable from DDL
 * @returns TableDefinition for SDK usage
 */
export function fromSurrealTable(table: SurrealTable): TableDefinition {
  if (!table) throw new Error('SurrealTable required');

  const config: TableConfig = {};

  // Only set defined values
  if (table.schema !== 'full') config.schema = table.schema;
  if (table.type !== 'normal') config.type = table.type;
  if (table.permissions) config.permissions = table.permissions;
  if (table.in) config.in = table.in;
  if (table.out) config.out = table.out;
  if (table.indexes && table.indexes.length > 0) {
    config.indexes = table.indexes.map(fromSurrealIndex);
  }

  return {
    name: table.name,
    columns: table.columns.map(fromSurrealColumn),
    config,
  };
}

// =============================================================================
// Access Conversions
// =============================================================================

/**
 * Convert SDK AccessConfig to Migration SurrealAccess.
 *
 * @param config - Access configuration from SDK
 * @returns SurrealAccess ready for DDL operations
 */
export function toSurrealAccess(config: {
  name: string;
  type: string;
  table?: string;
  signup?: string;
  signin?: string;
  identifier?: string;
  algorithm?: string;
  key?: string;
  issuer?: string;
  duration?: string;
  tokenDuration?: string;
}): SurrealAccess {
  if (!config) throw new Error('AccessConfig required');
  if (!config.name) throw new Error('Access name is required');

  return {
    name: config.name,
    type: config.type ?? 'RECORD',
    table: config.table,
    signup: config.signup,
    signin: config.signin,
    identifier: config.identifier,
    algorithm: config.algorithm,
    key: config.key,
    issuer: config.issuer,
    duration: config.duration,
    tokenDuration: config.tokenDuration,
  };
}

/**
 * Convert Migration SurrealAccess back to SDK-compatible access config.
 *
 * @param access - SurrealAccess from DDL
 * @returns SDK-compatible access config object
 */
export function fromSurrealAccess(access: SurrealAccess): {
  name: string;
  type: string;
  table?: string;
  signup?: string;
  signin?: string;
  identifier?: string;
  algorithm?: string;
  key?: string;
  issuer?: string;
  duration?: string;
  tokenDuration?: string;
} {
  if (!access) throw new Error('SurrealAccess required');
  if (!access.name) throw new Error('SurrealAccess.name is required');

  const config: {
    name: string;
    type: string;
    table?: string;
    signup?: string;
    signin?: string;
    identifier?: string;
    algorithm?: string;
    key?: string;
    issuer?: string;
    duration?: string;
    tokenDuration?: string;
  } = {
    name: access.name,
    type: access.type,
  };

  if (access.table) config.table = access.table;
  if (access.signup) config.signup = access.signup;
  if (access.signin) config.signin = access.signin;
  if (access.identifier) config.identifier = access.identifier;
  if (access.algorithm) config.algorithm = access.algorithm;
  if (access.key) config.key = access.key;
  if (access.issuer) config.issuer = access.issuer;
  if (access.duration) config.duration = access.duration;
  if (access.tokenDuration) config.tokenDuration = access.tokenDuration;

  return config;
}

// =============================================================================
// Event Conversions
// =============================================================================

/**
 * Convert SDK EventConfig to Migration SurrealEvent.
 *
 * @param config - Event configuration from SDK
 * @returns SurrealEvent ready for DDL operations
 */
export function toSurrealEvent(config: {
  name: string;
  on: string;
  when: string;
  then: string[];
  comment?: string;
  async?: boolean;
  retry?: number;
  maxdepth?: number;
}): SurrealEvent {
  if (!config) throw new Error('EventConfig required');
  if (!config.name) throw new Error('Event name is required');
  if (!config.on) throw new Error('Event table (on) is required');
  if (!config.when) throw new Error('Event condition (when) is required');

  return {
    name: config.name,
    what: config.on,
    when: config.when,
    then: config.then ?? [],
    comment: config.comment,
    async: config.async,
    retry: config.retry,
    maxdepth: config.maxdepth,
  };
}

/**
 * Convert Migration SurrealEvent back to SDK-compatible event config.
 *
 * @param event - SurrealEvent from DDL
 * @returns SDK-compatible event config object
 */
export function fromSurrealEvent(event: SurrealEvent): {
  name: string;
  on: string;
  when: string;
  then: string[];
  comment?: string;
  async?: boolean;
  retry?: number;
  maxdepth?: number;
} {
  if (!event) throw new Error('SurrealEvent required');
  if (!event.name) throw new Error('SurrealEvent.name is required');

  const config: {
    name: string;
    on: string;
    when: string;
    then: string[];
    comment?: string;
    async?: boolean;
    retry?: number;
    maxdepth?: number;
  } = {
    name: event.name,
    on: event.what,
    when: event.when,
    then: [...(event.then ?? [])],
  };

  if (event.comment) config.comment = event.comment;
  if (event.async !== undefined) config.async = event.async;
  if (event.retry !== undefined) config.retry = event.retry;
  if (event.maxdepth !== undefined) config.maxdepth = event.maxdepth;

  return config;
}

// =============================================================================
// Function Conversions
// =============================================================================

/**
 * Convert SDK FunctionConfig to Migration SurrealFunction.
 */
export function toSurrealFunction(config: {
  name: string;
  args?: string[];
  body: string;
  comment?: string;
  permissions?: string;
}): SurrealFunction {
  if (!config) throw new Error('FunctionConfig required');
  if (!config.name) throw new Error('Function name is required');
  if (!config.body) throw new Error('Function body is required');

  return {
    name: config.name,
    args: config.args ? [...config.args] : undefined,
    body: config.body,
    comment: config.comment,
    permissions: config.permissions,
  };
}

/**
 * Convert Migration SurrealFunction back to SDK-compatible function config.
 */
export function fromSurrealFunction(func: SurrealFunction): {
  name: string;
  args?: string[];
  body: string;
  comment?: string;
  permissions?: string;
} {
  if (!func) throw new Error('SurrealFunction required');
  if (!func.name) throw new Error('SurrealFunction.name is required');

  const config: {
    name: string;
    args?: string[];
    body: string;
    comment?: string;
    permissions?: string;
  } = {
    name: func.name,
    body: func.body,
  };

  if (func.args && func.args.length > 0) config.args = [...func.args];
  if (func.comment) config.comment = func.comment;
  if (func.permissions) config.permissions = func.permissions;

  return config;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse permissions string to SurrealPermissions object.
 *
 * Simple parser: assumes format like "SELECT WHERE ...", "FULL" etc.
 * Defaults to open permissions if parsing fails.
 */
function parsePermissions(perm: string): TableSurrealPermissions {
  if (!perm) return { select: true, create: true };

  // If it's a simple permission string, apply to all operations
  // In SurrealDB: "SELECT WHERE ...", "CREATE WHERE ...", etc.
  return {
    select: perm,
    create: perm,
    update: perm,
  };
}

/**
 * Convert SDK IndexDefinition to SurrealIndex.
 */
function toSurrealIndex(idx: IndexDefinition): SurrealIndex {
  return {
    name: idx.name,
    table: '', // Caller must set this
    cols: idx.fields,
    index: idx.type ?? 'idx',
    analyzer: idx.analyzer,
    dimension: idx.dimension,
    vectorType: idx.vectorType,
    distance: idx.distance,
  };
}

/**
 * Convert SurrealIndex back to SDK IndexDefinition.
 */
function fromSurrealIndex(idx: SurrealIndex): IndexDefinition {
  return {
    name: idx.name,
    fields: idx.cols,
    type: idx.index as 'unique' | 'fulltext' | 'hnsw',
    analyzer: idx.analyzer,
    dimension: idx.dimension,
    vectorType: idx.vectorType,
    distance: idx.distance,
  };
}
