import type { AccessConfig, EventConfig, FunctionConfig } from './schema.js';
import type { AnalyzerDefinition, TableDefinition } from './table.js';
/**
 * Configuration options for creating an OrmSchema
 */
export interface OrmSchemaConfig {
    /** Table definitions keyed by table name */
    tables: Record<string, TableDefinition>;
    /** Access definitions (DEFINE ACCESS) */
    access?: AccessConfig[];
    /** Event definitions (DEFINE EVENT) */
    events?: EventConfig[];
    /** SurrealDB variables (DEFINE VARIABLE key value) */
    variables?: Record<string, string>;
    /** User-defined SurrealDB functions (DEFINE FUNCTION fn() { ... }) */
    functions?: FunctionConfig[];
    /** Analyzer definitions (DEFINE ANALYZER) */
    analyzers?: AnalyzerDefinition[];
}
/**
 * OrmSchema - container for all schema definitions
 *
 * Holds tables, access controls, variables, and functions
 * that define the complete SurrealDB schema for an application.
 */
export declare class OrmSchema {
    /** Table definitions as a Map for iteration-safe access */
    readonly tables: ReadonlyMap<string, TableDefinition>;
    /** Access definitions */
    readonly access: AccessConfig[];
    /** Event definitions */
    readonly events: EventConfig[];
    /** Variable definitions (DEFINE VARIABLE) */
    readonly variables: Record<string, string>;
    /** Function definitions (DEFINE FUNCTION) */
    readonly functions: FunctionConfig[];
    /** Analyzer definitions (DEFINE ANALYZER) */
    readonly analyzers: AnalyzerDefinition[];
    constructor(config: OrmSchemaConfig);
    /**
     * Create a new OrmSchema (factory static method)
     */
    static create(config: OrmSchemaConfig): OrmSchema;
    /**
     * Get a table definition by name
     */
    getTable(name: string): TableDefinition | undefined;
    /**
     * Get all table definitions as an array
     */
    getTables(): TableDefinition[];
    /**
     * Get all access definitions
     */
    getAccess(): AccessConfig[];
    /**
     * Get all event definitions
     */
    getEvents(): EventConfig[];
    /**
     * Get all analyzer definitions
     */
    getAnalyzers(): AnalyzerDefinition[];
    /**
     * Get function definitions as an array
     */
    getFunctions(): FunctionConfig[];
    /**
     * Get variable definitions as a record
     */
    getVariables(): Record<string, string>;
    /**
     * Check if a table exists in the schema
     */
    hasTable(name: string): boolean;
    /**
     * Number of tables in the schema
     */
    get tableCount(): number;
}
/**
 * Factory function to create an OrmSchema
 */
export declare function createOrmSchema(config: OrmSchemaConfig): OrmSchema;
//# sourceMappingURL=orm-schema.d.ts.map