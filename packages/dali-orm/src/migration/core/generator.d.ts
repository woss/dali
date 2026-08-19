/**
 * SurrealQL Generator for Schema Definitions
 *
 * Converts TableDefinition and ColumnDefinition objects into SurrealQL statements.
 */
import type { ColumnDefinition } from '../../sdk/schema/column/types.js';
import type { AnalyzerDefinition, IndexDefinition, TableConfig, TableDefinition } from '../../sdk/table.js';
import type { SurrealAccess, SurrealEvent, SurrealFunction, SurrealSequence, SurrealView } from '../ddl/ddl.js';
/**
 * SurrealQL Generator for Schema Definitions
 *
 * Converts schema definitions into SurrealQL migration statements.
 */
export declare class SurrealQLGenerator {
    /**
     * Generate DEFINE TABLE statement
     */
    generateTableDefinition(table: TableDefinition): string;
    /**
     * Generate DEFINE FIELD statement
     * Handles tuple types with element sub-fields
     * Returns single string (joined if multiple statements for tuple)
     */
    generateFieldDefinition(column: ColumnDefinition): string;
    /**
     * Generate field redefine statement that overwrites existing field.
     * Uses DEFINE FIELD (without IF NOT EXISTS) so SurrealDB updates the field definition.
     */
    generateFieldRedefine(column: ColumnDefinition): string;
    /**
     * Generate multiple field definitions (for internal use with tuples)
     * Returns array of SQL statements
     */
    generateFieldDefinitions(column: ColumnDefinition): string[];
    /**
     * Generate tuple field with element sub-fields
     */
    private generateTupleFieldDefinition;
    /**
     * Generate single (non-tuple) field definition
     */
    private generateSingleFieldDefinition;
    /**
     * Generate single (non-tuple) field redefine statement (overwrites existing field definition)
     */
    private generateSingleFieldRedefine;
    /**
     * Generate DEFINE INDEX statement
     */
    generateIndexDefinition(index: IndexDefinition, tableName: string): string;
    /**
     * Generate REMOVE TABLE statement
     */
    generateRemoveTable(tableName: string): string;
    /**
     * Generate REMOVE FIELD statement
     */
    generateRemoveField(tableName: string, fieldName: string): string;
    /**
     * Generate REMOVE INDEX statement
     */
    generateRemoveIndex(indexName: string, tableName: string): string;
    /**
     * Generate REMOVE ACCESS statement
     */
    generateRemoveAccess(accessName: string): string;
    /**
     * Generate DEFINE NAMESPACE statement
     *
     * SurrealQL: DEFINE NAMESPACE [IF NOT EXISTS] <name> [COMMENT '<str>']
     */
    generateNamespaceDefinition(name: string, options?: {
        ifNotExists?: boolean;
        comment?: string;
    }): string;
    /**
     * Generate REMOVE NAMESPACE statement
     *
     * SurrealQL: REMOVE NAMESPACE [IF EXISTS] <name>
     */
    generateRemoveNamespace(name: string, ifExists?: boolean): string;
    /**
     * Generate DEFINE DATABASE statement
     *
     * SurrealQL: DEFINE DATABASE [IF NOT EXISTS] <name> [COMMENT '<str>']
     */
    generateDatabaseDefinition(name: string, options?: {
        ifNotExists?: boolean;
        comment?: string;
    }): string;
    /**
     * Generate REMOVE DATABASE statement
     *
     * SurrealQL: REMOVE DATABASE [IF EXISTS] <name>
     */
    generateRemoveDatabase(name: string, ifExists?: boolean): string;
    /**
     * Generate DEFINE ACCESS statement from access definition
     *
     * Follows the same pattern as accessToSQL() in sdk/schema.ts
     * but supports configurable level (ROOT/NAMESPACE/DATABASE).
     *
     * @param access - Access definition with name, type, level, and optional auth/JWT fields
     * @returns SurrealQL DEFINE ACCESS statement
     */
    generateAccessDefinition(access: {
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
    generateAccessMigration(access: SurrealAccess): string;
    /**
     * Generate DEFINE EVENT statement from event definition
     *
     * @param event - Event definition with name, what, when, then, and optional async/retry/maxdepth
     * @returns SurrealQL DEFINE EVENT statement
     */
    generateEventDefinition(event: {
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
    generateRemoveEvent(eventName: string, tableName: string): string;
    /**
     * Generate event migration SQL
     *
     * Generates DEFINE EVENT statement
     *
     * @param event - Structured event definition (SurrealEvent type)
     * @returns Single SurrealQL statement
     */
    generateEventMigration(event: SurrealEvent): string;
    /**
     * Generate DEFINE FUNCTION statement
     */
    generateFunctionDefinition(func: {
        name: string;
        args?: string[];
        body: string;
        comment?: string;
        permissions?: string;
    }): string;
    /**
     * Generate REMOVE FUNCTION statement
     */
    generateRemoveFunction(funcName: string): string;
    /**
     * Generate function migration SQL
     */
    generateFunctionMigration(func: SurrealFunction): string;
    /**
     * Generate DEFINE VIEW statement
     */
    generateViewDefinition(view: {
        name: string;
        query: string;
        comment?: string;
    }): string;
    /**
     * Generate REMOVE VIEW statement
     */
    generateRemoveView(viewName: string): string;
    /**
     * Generate view migration SQL
     */
    generateViewMigration(view: SurrealView): string;
    /**
     * Generate DEFINE SEQUENCE statement
     *
     * SurrealQL: DEFINE SEQUENCE [IF NOT EXISTS] <name> [START <n>] [INCREMENT <n>] [MIN <n>] [MAX <n>] [CACHE <n>] [CYCLE] [COMMENT '<str>']
     */
    generateSequenceDefinition(seq: SurrealSequence): string;
    /**
     * Generate REMOVE SEQUENCE statement
     *
     * SurrealQL: REMOVE SEQUENCE [IF EXISTS] <name>
     */
    generateRemoveSequence(seqName: string, ifExists?: boolean): string;
    /**
     * Generate ALTER FIELD TYPE statement
     */
    generateAlterFieldType(tableName: string, fieldName: string, newType: string): string;
    /**
     * Generate ALTER TABLE PERMISSIONS statement
     */
    generateAlterTablePermissions(tableName: string, permissions: TableConfig['permissions']): string;
    /**
     * Generate ALTER FIELD PERMISSIONS statement
     */
    generateAlterFieldPermissions(tableName: string, fieldName: string, permissions: string): string;
    /**
     * Generate ALTER FIELD DEFAULT statement
     *
     * @param defaultRaw - Raw SurrealDB expression (e.g., `crypto::blake3(content)`), takes precedence over defaultValue
     * @param defaultValue - Formatted default value (string/number/boolean), passed through formatDefaultValue
     */
    generateAlterFieldDefault(tableName: string, fieldName: string, defaultValue?: unknown, defaultRaw?: string): string;
    /**
     * Generate complete migration SQL for a table
     */
    generateTableMigration(table: TableDefinition): string[];
    /**
     * Generate DEFINE ANALYZER statement
     *
     * SurrealDB 3.0 syntax:
     *   DEFINE ANALYZER [IF NOT EXISTS] @name [TOKENIZERS @t1 [,@tN]] [FILTERS @f1 [,@fN]]
     */
    generateAnalyzerDefinition(analyzer: AnalyzerDefinition): string;
    /**
     * Generate REMOVE ANALYZER statement
     */
    generateRemoveAnalyzer(analyzerName: string): string;
    /**
     * Generate migration from multiple tables
     */
    generateMigration(tables: TableDefinition[], analyzers?: AnalyzerDefinition[]): string[];
    /**
     * Generate a complete migration file structure
     *
     * This creates 'up' (apply) SQL statements
     * from table definitions, suitable for writing to a migration file.
     */
    generateMigrationFile(tables: TableDefinition[], _version: string, _name: string, analyzers?: AnalyzerDefinition[]): {
        up: string[];
    };
    /**
     * Generate PERMISSIONS clause from permissions object
     */
    private generatePermissions;
}
//# sourceMappingURL=generator.d.ts.map