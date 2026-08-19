import type { SurrealDriver } from '../../sdk/driver/types.js';
import type { AccessConfig, EventConfig, FunctionConfig } from '../../sdk/schema.js';
import type { AnalyzerDefinition, TableDefinition } from '../../sdk/table.js';
import { SurrealQLGenerator } from '../core/generator.js';
import type { SerializedAccess, SerializedAnalyzer, SerializedEvent, SerializedFunction } from '../core/snapshot.js';
export { serializeColumnPermissions, normalizeSql } from '../core/format-utils.js';
export { type NonTableChangeCounts, getNonTableChanges, printDiffSummary, detectSection, addSectionSeparators, } from './diff-summary.js';
export { type SchemaFilesResult, loadSchemaFiles, loadSchemaFromFile, findMatchingFiles, isTableDefinition, normalizeTableDefinition, } from './schema-loader.js';
export interface GenerateOptions {
    name: string;
    outputDir?: string;
    tables?: string[];
    version?: string;
    driver?: SurrealDriver;
    /** Snapshot directory for incremental migration (default: ./meta/snapshots) */
    snapshotDir?: string;
    /** Skip snapshot comparison and generate full migration */
    fullMigration?: boolean;
}
/**
 * Co-located snapshot loaded from a migration directory's snapshot.json
 */
export interface CoLocatedSnapshot {
    tables: TableDefinition[];
    access?: SerializedAccess[];
    events?: SerializedEvent[];
    functions?: SerializedFunction[];
    analyzers?: SerializedAnalyzer[];
}
/**
 * Get current database schema using STRUCTURE clause via introspectTable.
 * Maps SurrealTable → TableDefinition for use by SchemaDiffer.
 */
export declare function getLiveSchema(driver: SurrealDriver, tableNames: string[]): Promise<TableDefinition[]>;
/**
 * Generate migration file from schema
 */
export declare function generateMigration(tables: TableDefinition[], options: GenerateOptions, access?: AccessConfig[], events?: EventConfig[], functions?: FunctionConfig[], analyzers?: AnalyzerDefinition[]): Promise<string>;
/**
 * Generate incremental migration by comparing against the last snapshot
 *
 * This is the Drizzle-style approach:
 * 1. Load the last snapshot (if exists)
 * 2. Compare last snapshot against current schema.ts
 * 3. Generate SQL for only the differences
 * 4. If no snapshot exists, compare against empty schema (generate all tables)
 */
export declare function generateSnapshotMigration(tables: TableDefinition[], snapshotDir: string | CoLocatedSnapshot, generator: SurrealQLGenerator, _version: string, access?: AccessConfig[], events?: EventConfig[], functions?: FunctionConfig[], analyzers?: AnalyzerDefinition[]): Promise<{
    upStatements: string[];
}>;
export declare function generateLiveMigration(tables: TableDefinition[], driver: SurrealDriver, generator: SurrealQLGenerator, access?: AccessConfig[], events?: EventConfig[], functions?: FunctionConfig[], analyzers?: AnalyzerDefinition[]): Promise<{
    upStatements: string[];
}>;
/**
 * Generate full migration for all tables
 */
export declare function generateFullMigration(tables: TableDefinition[], generator: SurrealQLGenerator, access?: AccessConfig[], events?: EventConfig[], functions?: FunctionConfig[], analyzers?: AnalyzerDefinition[]): {
    upStatements: string[];
};
/**
 * Generate .surql migration file content
 *
 * Format:
 * -- Migration: create_user
 * -- Version: 001
 *
 * -- UP
 * DEFINE TABLE user SCHEMAFULL;
 * DEFINE FIELD id ON user TYPE string;
 * ...
 *
 * -- DOWN
 * DROP TABLE user;
 */
export declare function generateMigrationFile(version: string, name: string, migration: {
    up: string[];
}): string;
//# sourceMappingURL=generate.d.ts.map