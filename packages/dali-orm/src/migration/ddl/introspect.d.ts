/**
 * Database Introspection for SurrealDB
 *
 * Implements fromDatabase function that queries the database and builds
 * SurrealDbDDL structure. Uses SurrealDB's STRUCTURE output exclusively.
 */
import type { SurrealDriver } from '../../sdk/driver/types.js';
import type { SurrealDbDDL, SurrealFunction, SurrealTable } from './ddl.js';
import { createEmptyDdl } from './ddl.js';
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
export declare function introspectDatabase(
  driver: SurrealDriver,
  filter?: IntrospectFilter,
): Promise<SurrealDbDDL>;
/**
 * Get list of existing access names from database
 */
export declare function introspectAccess(
  driver: SurrealDriver,
): Promise<string[]>;
/**
 * Get access definitions as raw SQL strings from database.
 *
 * Uses INFO FOR DB which returns accesses as:
 * { accesses: { name: "DEFINE ACCESS ... SQL" } }
 *
 * Returns the raw DEFINE ACCESS SQL strings (Object.values).
 */
export declare function introspectAccessSQL(
  driver: SurrealDriver,
): Promise<string[]>;
/**
 * Introspect a single table using STRUCTURE output.
 *
 * Uses valibot schema (InfoForTableSchema) to parse STRUCTURE output at boundary.
 * Determines relation type by checking for 'in' and 'out' fields in the
 * STRUCTURE fields array, and extracts the related table names from their
 * record type definitions.
 */
export declare function introspectTable(
  driver: SurrealDriver,
  tableName: string,
): Promise<SurrealTable>;
/**
 * Introspect function definitions from the database
 *
 * Queries INFO FOR DB to get all defined functions.
 * SurrealDB returns functions as raw "DEFINE FUNCTION ..." SQL strings,
 * which we parse into SurrealFunction[] objects.
 */
export declare function introspectFunctions(
  driver: SurrealDriver,
): Promise<SurrealFunction[]>;
/**
 * Parse a DEFINE FUNCTION SQL string into a SurrealFunction object
 *
 * Handles: DEFINE FUNCTION [IF NOT EXISTS] fn_name($arg1: type, $arg2: type) { body } [COMMENT "..." ] [PERMISSIONS ...]
 */
export declare function parseFunctionSQL(
  _name: string,
  rawSQL: string,
): SurrealFunction;
/**
 * Introspect database definitions from SurrealDB
 *
 * Uses INFO FOR DB to list all defined databases.
 * Falls back to empty array when not at namespace level.
 */
export declare function introspectDatabases(
  driver: SurrealDriver,
): Promise<string[]>;
export { createEmptyDdl };
//# sourceMappingURL=introspect.d.ts.map
