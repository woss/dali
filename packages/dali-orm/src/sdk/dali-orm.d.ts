import type { OrmSchema } from './orm-schema.js';
import type { InferSelectResult, InferInsertData, InferUpdateData } from './infer-types.js';
import type { TableDefinition } from './table.js';
import type { Model } from '../query/model.js';
import type { SchemaBuilder } from './schema-builder.js';
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
export declare class DaliORM {
    /** Underlying SurrealDB driver */
    private readonly driver;
    /** Schema definition if provided */
    readonly schemaDefinition: OrmSchema | undefined;
    private constructor();
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
    static connect(config: DaliORMConfig): Promise<DaliORM>;
    /**
     * Execute a raw SQL query
     */
    query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T[]>;
    /**
     * Execute a query builder object (with toSQL/toParams methods)
     */
    execute<T = unknown>(queryObj: {
        toSQL(): string;
        toParams?(): Record<string, unknown>;
    }): Promise<T[]>;
    /**
     * Select records from a table or a specific record by ID
     * @param thing - Table name (e.g. 'memories') or record ID (e.g. 'memories:abc123')
     */
    select<T = unknown>(thing: string): Promise<T[]>;
    /**
     * Select all records from a table with full type inference from schema
     * @param table - Table definition from defineTable()
     * @returns Typed array of records matching the table schema
     */
    selectFrom<T extends TableDefinition>(table: T): Promise<InferSelectResult<T>[]>;
    /**
     * Insert typed records into a table with full type inference from schema
     * @param table - Table definition from defineTable()
     * @param data - Typed insert data (excludes auto-generated id field)
     * @returns Typed array of inserted records
     */
    insertInto<T extends TableDefinition>(table: T, data: InferInsertData<T> | InferInsertData<T>[]): Promise<InferSelectResult<T>[]>;
    /**
     * Update records in a table with full type inference from schema
     * @param table - Table definition from defineTable()
     * @param data - Partial typed update data (all fields optional)
     * @returns Typed array of updated records
     */
    updateTable<T extends TableDefinition>(table: T, data: InferUpdateData<T>): Promise<InferSelectResult<T>[]>;
    /**
     * Delete all records from a table with full type inference from schema
     * @param table - Table definition from defineTable()
     * @returns Typed array of deleted records
     */
    deleteFrom<T extends TableDefinition>(table: T): Promise<InferSelectResult<T>[]>;
    /**
     * Insert one or multiple records into a table
     */
    insert<T = unknown>(table: string, data: T | T[]): Promise<T[]>;
    /**
     * Update records in a table or a specific record
     * @param thing - Table name or record ID (e.g. 'memories:abc123')
     * @param data - The data to update with
     */
    update<T = unknown>(thing: string, data: unknown): Promise<T[]>;
    /**
     * Delete records from a table or a specific record
     * @param thing - Table name or record ID (e.g. 'memories:abc123')
     */
    delete<T = unknown>(thing: string): Promise<T[]>;
    /**
     * Create a runtime SchemaBuilder for defining/modifying database schema
     * without migration files.
     *
     * @example
     * ```typescript
     * await orm.schema()
     *   .defineTable('user', { schema: 'full' })
     *   .defineField('user', 'name', { type: 'string' })
     *   .execute();
     * ```
     */
    schema(): SchemaBuilder;
    /**
     * Get a table definition by name from the schema
     */
    table(name: string): TableDefinition | undefined;
    /**
     * Create a Model instance bound to this ORM for the given table definition.
     *
     * Unlike `table(name)` which returns a raw table definition,
     * `model(tableDef)` returns a full Model with builder methods
     * (select, insert, update, delete, relate, create, upsert, live)
     * pre-bound to this ORM — no need to pass `orm` on every call.
     *
     * @example
     * ```typescript
     * const users = defineTable('user', { name: string() });
     * const userModel = orm.model(users);
     * const results = await userModel.select().where(...).execute();
     * ```
     */
    model<TDef extends TableDefinition>(tableDef: TDef): Model<TDef>;
    /**
     * Switch to a different namespace and database
     */
    use(namespace: string, database: string): Promise<void>;
    /**
     * Check if currently connected to the database
     */
    isConnected(): boolean;
    /**
     * Run operations within a transaction
     */
    transaction<T>(fn: (tx: DaliORMTransaction) => Promise<T>): Promise<T>;
    /**
     * Access the underlying driver directly (for advanced use)
     */
    getDriver(): import('./driver/types.js').SurrealDriver;
    /**
     * Disconnect from the database
     */
    disconnect(): Promise<void>;
}
//# sourceMappingURL=dali-orm.d.ts.map