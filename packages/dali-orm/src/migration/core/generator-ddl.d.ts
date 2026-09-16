import type { AnalyzerDefinition, TableConfig } from '../../sdk/table.js';
import type {
  SurrealAccess,
  SurrealEvent,
  SurrealFunction,
  SurrealSequence,
  SurrealView,
} from '../ddl/ddl.js';
/**
 * Generate REMOVE ACCESS statement
 */
export declare function generateRemoveAccess(accessName: string): string;
/**
 * Generate DEFINE NAMESPACE statement
 *
 * SurrealQL: DEFINE NAMESPACE [IF NOT EXISTS] <name> [COMMENT '<str>']
 */
export declare function generateNamespaceDefinition(
  name: string,
  options?: {
    ifNotExists?: boolean;
    comment?: string;
  },
): string;
/**
 * Generate REMOVE NAMESPACE statement
 *
 * SurrealQL: REMOVE NAMESPACE [IF EXISTS] <name>
 */
export declare function generateRemoveNamespace(
  name: string,
  ifExists?: boolean,
): string;
/**
 * Generate DEFINE DATABASE statement
 *
 * SurrealQL: DEFINE DATABASE [IF NOT EXISTS] <name> [COMMENT '<str>']
 */
export declare function generateDatabaseDefinition(
  name: string,
  options?: {
    ifNotExists?: boolean;
    comment?: string;
  },
): string;
/**
 * Generate REMOVE DATABASE statement
 *
 * SurrealQL: REMOVE DATABASE [IF EXISTS] <name>
 */
export declare function generateRemoveDatabase(
  name: string,
  ifExists?: boolean,
): string;
/**
 * Generate DEFINE ACCESS statement from access definition
 *
 * Follows the same pattern as accessToSQL() in sdk/schema.ts
 * but supports configurable level (ROOT/NAMESPACE/DATABASE).
 *
 * @param access - Access definition with name, type, level, and optional auth/JWT fields
 * @returns SurrealQL DEFINE ACCESS statement
 */
export declare function generateAccessDefinition(access: {
  name: string;
  type: string;
  level?: string;
  table?: string;
  signup?: string;
  signin?: string;
  identifier?: string;
  algorithm?: string;
  key?: string;
  issuer?: string;
  duration?: string;
  tokenDuration?: string;
}): string;
/**
 * Generate access migration SQL
 *
 * Generates DEFINE ACCESS statement
 *
 * @param access - Structured access definition
 * @returns Single SurrealQL statement
 */
export declare function generateAccessMigration(access: SurrealAccess): string;
/**
 * Generate DEFINE EVENT statement from event definition
 *
 * @param event - Event definition with name, what, when, then, and optional async/retry/maxdepth
 * @returns SurrealQL DEFINE EVENT statement
 */
export declare function generateEventDefinition(event: {
  name: string;
  what: string;
  when: string;
  then: string[];
  comment?: string;
  async?: boolean;
  retry?: number;
  maxdepth?: number;
}): string;
/**
 * Generate REMOVE EVENT statement
 */
export declare function generateRemoveEvent(
  eventName: string,
  tableName: string,
): string;
/**
 * Generate event migration SQL
 *
 * Generates DEFINE EVENT statement
 *
 * @param event - Structured event definition (SurrealEvent type)
 * @returns Single SurrealQL statement
 */
export declare function generateEventMigration(event: SurrealEvent): string;
/**
 * Generate DEFINE FUNCTION statement
 */
export declare function generateFunctionDefinition(func: {
  name: string;
  args?: string[];
  body: string;
  comment?: string;
  permissions?: string;
}): string;
/**
 * Generate REMOVE FUNCTION statement
 */
export declare function generateRemoveFunction(funcName: string): string;
/**
 * Generate function migration SQL
 */
export declare function generateFunctionMigration(
  func: SurrealFunction,
): string;
/**
 * Generate DEFINE VIEW statement
 */
export declare function generateViewDefinition(view: {
  name: string;
  query: string;
  comment?: string;
}): string;
/**
 * Generate REMOVE VIEW statement
 */
export declare function generateRemoveView(viewName: string): string;
/**
 * Generate view migration SQL
 */
export declare function generateViewMigration(view: SurrealView): string;
/**
 * Generate DEFINE SEQUENCE statement
 *
 * SurrealQL: DEFINE SEQUENCE [IF NOT EXISTS] <name> [START <n>] [INCREMENT <n>] [MIN <n>] [MAX <n>] [CACHE <n>] [CYCLE] [COMMENT '<str>']
 */
export declare function generateSequenceDefinition(
  seq: SurrealSequence,
): string;
/**
 * Generate REMOVE SEQUENCE statement
 *
 * SurrealQL: REMOVE SEQUENCE [IF EXISTS] <name>
 */
export declare function generateRemoveSequence(
  seqName: string,
  ifExists?: boolean,
): string;
/**
 * Generate ALTER FIELD TYPE statement
 */
export declare function generateAlterFieldType(
  tableName: string,
  fieldName: string,
  newType: string,
): string;
/**
 * Generate ALTER TABLE PERMISSIONS statement
 */
export declare function generateAlterTablePermissions(
  tableName: string,
  permissions: TableConfig['permissions'],
): string;
/**
 * Generate ALTER FIELD PERMISSIONS statement
 */
export declare function generateAlterFieldPermissions(
  tableName: string,
  fieldName: string,
  permissions: string,
): string;
/**
 * Generate ALTER FIELD DEFAULT statement
 *
 * @param defaultRaw - Raw SurrealDB expression (e.g., `crypto::blake3(content)`), takes precedence over defaultValue
 * @param defaultValue - Formatted default value (string/number/boolean), passed through formatDefaultValue
 */
export declare function generateAlterFieldDefault(
  tableName: string,
  fieldName: string,
  defaultValue?: unknown,
  defaultRaw?: string,
): string;
/**
 * Generate DEFINE ANALYZER statement
 *
 * SurrealDB 3.0 syntax:
 *   DEFINE ANALYZER [IF NOT EXISTS] @name [TOKENIZERS @t1 [,@tN]] [FILTERS @f1 [,@fN]]
 */
export declare function generateAnalyzerDefinition(
  analyzer: AnalyzerDefinition,
): string;
/**
 * Generate REMOVE ANALYZER statement
 */
export declare function generateRemoveAnalyzer(analyzerName: string): string;
//# sourceMappingURL=generator-ddl.d.ts.map
