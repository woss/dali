import { connect as createDriver } from './driver/orm-connection.js';
import type { OrmSchema } from './orm-schema.js';
import type { InferSelectResult, InferInsertData, InferUpdateData } from './infer-types.js';
import type { TableDefinition } from './table.js';

/**
 * DaliORM configuration - extends SurrealORMConfig with optional schema
 */
export interface DaliORMConfig {
  /** Node driver configuration (remote connection) */
  nodeDriver?: import('./driver/types.js').DriverConfig;
  /** Embedded driver configuration (in-process SurrealDB) */
  embeddedDriver?: import('./driver/types.js').EmbeddedConfig;
  /** Config file loading options */
  config?: boolean | string | import('./driver/config/types.js').OrmConfig;
  /** Codec options for value encoding/decoding */
  codecOptions?: import('./driver/types.js').CodecOptions;
  /** Reconnect options for automatic reconnection */
  reconnect?: boolean | import('./driver/types.js').ReconnectOptions;
  /** Optional schema with table/access/variable definitions */
  schema?: OrmSchema;
}

/**
 * Connection type after initialization (used for transaction)
 */
export interface DaliORMTransaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T[]>;
}

/**
 * DaliORM - Type-safe SurrealDB ORM
 *
 * Wraps a SurrealDriver with schema awareness for type-safe database access.
 * Acts as the main entry point for application-level database operations.
 */
export class DaliORM {
  /** Underlying SurrealDB driver */
  private readonly driver: import('./driver/types.js').SurrealDriver;

  /** Schema definition if provided */
  readonly schema: OrmSchema | undefined;

  private constructor(driver: import('./driver/types.js').SurrealDriver, schema?: OrmSchema) {
    this.driver = driver;
    this.schema = schema;
  }

  /**
   * Connect to SurrealDB and create a DaliORM instance
   *
   * Usage:
   * ```typescript
   * const orm = await DaliORM.connect({
   *   nodeDriver: { url: 'ws://localhost:10101', namespace: 'test', database: 'test', auth: { username: 'root', password: 'root' } },
   *   schema: mySchema,
   * });
   * ```
   */
  static async connect(config: DaliORMConfig): Promise<DaliORM> {
    const driver = await createDriver({
      nodeDriver: config.nodeDriver,
      embeddedDriver: config.embeddedDriver,
      config: config.config,
      codecOptions: config.codecOptions,
      reconnect: config.reconnect,
      schema: config.schema,
    });
    return new DaliORM(driver, config.schema);
  }

  /**
   * Execute a raw SQL query
   */
  async query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T[]> {
    return this.driver.query<T>(sql, vars);
  }

  /**
   * Execute a query builder object (with toSQL/toParams methods)
   */
  async execute<T = unknown>(queryObj: {
    toSQL(): string;
    toParams?(): Record<string, unknown>;
  }): Promise<T[]> {
    const sql = queryObj.toSQL();
    const params = queryObj.toParams?.() ?? {};
    return this.driver.query<T>(sql, params);
  }

  // ==================== CRUD Operations ====================

  /**
   * Select records from a table or a specific record by ID
   * @param thing - Table name (e.g. 'memories') or record ID (e.g. 'memories:abc123')
   */
  async select<T = unknown>(thing: string): Promise<T[]> {
    return this.driver.select<T>(thing);
  }

  /**
   * Select all records from a table with full type inference from schema
   * @param table - Table definition from defineTable()
   * @returns Typed array of records matching the table schema
   */
  async selectFrom<T extends TableDefinition>(table: T): Promise<InferSelectResult<T>[]> {
    return await this.driver.select<InferSelectResult<T>>(table.name);
  }

  /**
   * Insert typed records into a table with full type inference from schema
   * @param table - Table definition from defineTable()
   * @param data - Typed insert data (excludes auto-generated id field)
   * @returns Typed array of inserted records
   */
  async insertInto<T extends TableDefinition>(
    table: T,
    data: InferInsertData<T> | InferInsertData<T>[],
  ): Promise<InferSelectResult<T>[]> {
    return await this.driver.insert<InferSelectResult<T>>(table.name, data);
  }

  /**
   * Update records in a table with full type inference from schema
   * @param table - Table definition from defineTable()
   * @param data - Partial typed update data (all fields optional)
   * @returns Typed array of updated records
   */
  async updateTable<T extends TableDefinition>(
    table: T,
    data: InferUpdateData<T>,
  ): Promise<InferSelectResult<T>[]> {
    return await this.driver.update<InferSelectResult<T>>(table.name, data);
  }

  /**
   * Delete all records from a table with full type inference from schema
   * @param table - Table definition from defineTable()
   * @returns Typed array of deleted records
   */
  async deleteFrom<T extends TableDefinition>(table: T): Promise<InferSelectResult<T>[]> {
    return await this.driver.delete<InferSelectResult<T>>(table.name);
  }

  /**
   * Insert one or multiple records into a table
   */
  async insert<T = unknown>(table: string, data: T | T[]): Promise<T[]> {
    return this.driver.insert<T>(table, data);
  }

  /**
   * Update records in a table or a specific record
   * @param thing - Table name or record ID (e.g. 'memories:abc123')
   * @param data - The data to update with
   */
  async update<T = unknown>(thing: string, data: unknown): Promise<T[]> {
    return this.driver.update<T>(thing, data);
  }

  /**
   * Delete records from a table or a specific record
   * @param thing - Table name or record ID (e.g. 'memories:abc123')
   */
  async delete<T = unknown>(thing: string): Promise<T[]> {
    return this.driver.delete<T>(thing);
  }

  // ==================== Schema & Connection Management ====================

  /**
   * Get a table definition by name from the schema
   */
  table(name: string) {
    return this.schema?.getTable(name);
  }

  /**
   * Switch to a different namespace and database
   */
  async use(namespace: string, database: string): Promise<void> {
    return this.driver.use(namespace, database);
  }

  /**
   * Check if currently connected to the database
   */
  isConnected(): boolean {
    return this.driver.isConnected();
  }

  /**
   * Run operations within a transaction
   */
  async transaction<T>(fn: (tx: DaliORMTransaction) => Promise<T>): Promise<T> {
    return this.driver.transaction(fn as any);
  }

  /**
   * Access the underlying driver directly (for advanced use)
   */
  getDriver(): import('./driver/types.js').SurrealDriver {
    return this.driver;
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    await this.driver.disconnect();
  }
}
