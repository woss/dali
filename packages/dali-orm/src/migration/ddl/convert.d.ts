/**
 * Type conversion utilities between SDK types and Migration DDL types.
 *
 * Converts between:
 * - ColumnDefinition ↔ SurrealColumn
 * - TableDefinition ↔ SurrealTable
 *
 * Parse, don't validate: Functions transform at boundary, return trusted types.
 */
import type { ColumnDefinition } from '../../sdk/schema/column/types.js';
import type { TableDefinition } from '../../sdk/table.js';
import type {
  SurrealAccess,
  SurrealColumn,
  SurrealEvent,
  SurrealFunction,
  SurrealTable,
} from './ddl.js';
/**
 * Convert SDK ColumnDefinition to Migration SurrealColumn.
 *
 * @param def - Column definition from SDK
 * @param tableName - Table name (required for SurrealColumn.table)
 * @returns SurrealColumn ready for DDL operations
 */
export declare function toSurrealColumn(
  def: ColumnDefinition,
  tableName: string,
): SurrealColumn;
/**
 * Convert Migration SurrealColumn back to SDK ColumnDefinition.
 *
 * @param col - SurrealColumn from DDL
 * @returns ColumnDefinition for SDK usage
 */
export declare function fromSurrealColumn(col: SurrealColumn): ColumnDefinition;
/**
 * Convert SDK TableDefinition to Migration SurrealTable.
 *
 * @param def - Table definition from SDK
 * @returns SurrealTable ready for DDL operations
 */
export declare function toSurrealTable(def: TableDefinition): SurrealTable;
/**
 * Convert Migration SurrealTable back to SDK TableDefinition.
 *
 * @param table - SurrealTable from DDL
 * @returns TableDefinition for SDK usage
 */
export declare function fromSurrealTable(table: SurrealTable): TableDefinition;
/**
 * Convert SDK AccessConfig to Migration SurrealAccess.
 *
 * @param config - Access configuration from SDK
 * @returns SurrealAccess ready for DDL operations
 */
export declare function toSurrealAccess(config: {
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
}): SurrealAccess;
/**
 * Convert Migration SurrealAccess back to SDK-compatible access config.
 *
 * @param access - SurrealAccess from DDL
 * @returns SDK-compatible access config object
 */
export declare function fromSurrealAccess(access: SurrealAccess): {
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
};
/**
 * Convert SDK EventConfig to Migration SurrealEvent.
 *
 * @param config - Event configuration from SDK
 * @returns SurrealEvent ready for DDL operations
 */
export declare function toSurrealEvent(config: {
  name: string;
  on: string;
  when: string;
  then: string[];
  comment?: string;
  async?: boolean;
  retry?: number;
  maxdepth?: number;
}): SurrealEvent;
/**
 * Convert Migration SurrealEvent back to SDK-compatible event config.
 *
 * @param event - SurrealEvent from DDL
 * @returns SDK-compatible event config object
 */
export declare function fromSurrealEvent(event: SurrealEvent): {
  name: string;
  on: string;
  when: string;
  then: string[];
  comment?: string;
  async?: boolean;
  retry?: number;
  maxdepth?: number;
};
/**
 * Convert SDK FunctionConfig to Migration SurrealFunction.
 */
export declare function toSurrealFunction(config: {
  name: string;
  args?: string[];
  body: string;
  comment?: string;
  permissions?: string;
}): SurrealFunction;
/**
 * Convert Migration SurrealFunction back to SDK-compatible function config.
 */
export declare function fromSurrealFunction(func: SurrealFunction): {
  name: string;
  args?: string[];
  body: string;
  comment?: string;
  permissions?: string;
};
//# sourceMappingURL=convert.d.ts.map
