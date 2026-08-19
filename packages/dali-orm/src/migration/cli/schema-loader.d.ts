import type { AccessConfig, FunctionConfig } from '../../sdk/schema.js';
import type { AnalyzerDefinition, TableDefinition } from '../../sdk/table.js';
export interface SchemaFilesResult {
    tables: TableDefinition[];
    access?: AccessConfig[];
    functions?: FunctionConfig[];
    analyzers?: AnalyzerDefinition[];
}
/**
 * Load schema files from directory or file
 *
 * If schemaPath is a file (ends with .ts), imports it directly.
 * If schemaPath is a directory, recursively finds .ts files,
 * dynamically imports them, and extracts table definitions.
 */
export declare function loadSchemaFiles(schemaPath: string, pattern?: string): Promise<SchemaFilesResult>;
/**
 * Load schema from a single file path
 * Extracts table definitions from the module's exports
 */
export declare function loadSchemaFromFile(filePath: string): Promise<SchemaFilesResult>;
/**
 * Find files matching a glob-like pattern recursively
 * Supports: patterns like **\/*.ts (recursive) or *.ts (current dir only)
 */
export declare function findMatchingFiles(dir: string, pattern: string): Promise<string[]>;
/**
 * Type guard to check if value is a TableDefinition
 *
 * Note: TableDefinition can be either:
 * 1. Plain object with name/columns/config (from defineTable/defineRelationTable)
 * 2. SurrealTableInstance (proxy) with $name/$columns properties
 *
 * The type guard needs to handle both cases and normalize the table name.
 */
export declare function isTableDefinition(value: unknown): value is TableDefinition;
/**
 * Convert a SurrealTableInstance to a plain TableDefinition
 * This extracts the real name from $name and normalizes the structure
 */
export declare function normalizeTableDefinition(table: unknown): TableDefinition | null;
//# sourceMappingURL=schema-loader.d.ts.map