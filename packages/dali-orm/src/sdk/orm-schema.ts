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
export class OrmSchema {
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

  constructor(config: OrmSchemaConfig) {
    this.tables = new Map(Object.entries(config.tables));
    this.access = config.access ?? [];
    this.events = config.events ?? [];
    this.variables = { ...config.variables };
    this.analyzers = config.analyzers ? [...config.analyzers] : [];
    this.functions = config.functions ? [...config.functions] : [];
  }

  /**
   * Create a new OrmSchema (factory static method)
   */
  static create(config: OrmSchemaConfig): OrmSchema {
    return new OrmSchema(config);
  }

  /**
   * Get a table definition by name
   */
  getTable(name: string): TableDefinition | undefined {
    return this.tables.get(name);
  }

  /**
   * Get all table definitions as an array
   */
  getTables(): TableDefinition[] {
    return Array.from(this.tables.values());
  }

  /**
   * Get all access definitions
   */
  getAccess(): AccessConfig[] {
    return [...this.access];
  }

  /**
   * Get all event definitions
   */
  getEvents(): EventConfig[] {
    return [...this.events];
  }

  /**
   * Get all analyzer definitions
   */
  getAnalyzers(): AnalyzerDefinition[] {
    return [...this.analyzers];
  }

  /**
   * Get function definitions as an array
   */
  getFunctions(): FunctionConfig[] {
    return [...this.functions];
  }

  /**
   * Get variable definitions as a record
   */
  getVariables(): Record<string, string> {
    return { ...this.variables };
  }

  /**
   * Check if a table exists in the schema
   */
  hasTable(name: string): boolean {
    return this.tables.has(name);
  }

  /**
   * Number of tables in the schema
   */
  get tableCount(): number {
    return this.tables.size;
  }
}

/**
 * Factory function to create an OrmSchema
 */
export function createOrmSchema(config: OrmSchemaConfig): OrmSchema {
  return new OrmSchema(config);
}
