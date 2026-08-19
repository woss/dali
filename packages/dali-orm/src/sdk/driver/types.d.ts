/**
 * SurrealDB Driver Layer Types
 *
 * Defines the core interfaces for database drivers, configuration,
 * query results, and transaction support.
 */
import type { ConfigAuth } from './config/types.js';
import type { OrmSchema } from '../orm-schema.js';
/**
 * Codec options for value encoding/decoding
 */
export interface CodecOptions {
    /** Use native JavaScript Date instead of DateTime */
    useNativeDates?: boolean;
    /** Custom visitor for encoding values */
    valueEncodeVisitor?: (value: unknown) => unknown;
    /** Custom visitor for decoding values */
    valueDecodeVisitor?: (value: unknown) => unknown;
}
/**
 * Reconnect options for automatic reconnection
 */
export interface ReconnectOptions {
    /** Enable automatic reconnection */
    enabled: boolean;
    /** Maximum number of retry attempts */
    attempts: number;
    /** Initial delay between retries (ms) */
    retryDelay: number;
    /** Maximum delay between retries (ms) */
    retryDelayMax: number;
    /** Multiply delay by this factor each retry */
    retryDelayMultiplier: number;
    /** Add random jitter to delay (ms) */
    retryDelayJitter: number;
}
/**
 * Authentication types supported by SurrealDB
 */
export type AuthType = 'root' | 'namespace' | 'database' | 'record';
/**
 * Configuration for establishing a connection to SurrealDB
 */
export interface DriverConfig {
    /** Explicit driver type */
    driver: 'node';
    /** Remote connection URL (e.g., 'ws://localhost:10101') */
    url?: string;
    /** Namespace to use (default: 'default') */
    namespace?: string;
    /** Database to use (default: 'default') */
    database?: string;
    /** Authentication credentials */
    auth?: ConfigAuth;
    /** Enable debug logging */
    debug?: boolean;
    /** Codec options for value encoding/decoding */
    codecOptions?: CodecOptions;
    /** Reconnect options for automatic reconnection */
    reconnect?: boolean | ReconnectOptions;
}
/**
 * Validated/parsed auth config (Parse, Don't Validate)
 * Guaranteed to be well-formed after validation
 * Uses SDK field names: username/password
 */
export type ValidatedAuthConfig = ConfigAuth;
/**
 * Transaction interface for managing database transactions
 *
 * Note: The SurrealDB SDK uses `cancel()` internally for transaction rollback.
 * This interface exposes `rollback()` for API familiarity, but drivers should
 * call the SDK's `cancel()` method when implementing this interface.
 */
export interface Transaction<_T = unknown> {
    /** Commit the current transaction */
    commit(): Promise<void>;
    /** Rollback the current transaction (internally uses SDK's cancel()) */
    rollback(): Promise<void>;
    /** Execute a query within the transaction */
    query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T[]>;
    /** Select all records from a table using native SDK */
    select<T = unknown>(thing: string): Promise<T[]>;
    /** Create a record using native SDK */
    create<T = unknown>(thing: string, data: T): Promise<T[]>;
    /** Insert one or multiple records using native SDK */
    insert<T = unknown>(thing: string, data: T | T[]): Promise<T[]>;
    /** Update a record using native SDK */
    update<T = unknown>(thing: string, data: T): Promise<T[]>;
    /** Delete a record using native SDK */
    delete<T = unknown>(thing: string): Promise<T[]>;
    /** Create a graph relation using native SDK */
    relate<T = unknown>(from: string, edge: string, to: string, data?: T): Promise<T[]>;
}
/**
 * Live query action types
 */
export type LiveAction = 'CREATE' | 'UPDATE' | 'DELETE';
/**
 * Data payload for live query callbacks
 */
export interface LiveData<T = unknown> {
    /** The type of operation that triggered the callback */
    action: LiveAction;
    /** The resulting record data */
    result: T;
}
/**
 * Live message data payload for advanced live subscription callbacks
 */
export interface LiveMessageData<T = unknown> {
    /** The type of operation that triggered the callback */
    action: LiveAction;
    /** The resulting record data */
    result: T;
}
/**
 * KILLED sentinel type — a subscription has been killed
 */
export type KILLED = 'KILLED';
/**
 * Options for advanced live queries via liveWithOptions
 */
export interface LiveQueryOptions {
    /** Subscribe to diffs (patches) only */
    diff?: boolean;
    /** Select specific fields from the record */
    fields?: string[];
    /** WHERE condition using SDK Expr (from surrealdb) */
    where?: unknown;
    /** FETCH record links for the specified fields */
    fetch?: string[];
    /** Select a single field value */
    value?: string;
}
/**
 * Handle for an active live subscription.
 * Supports callback subscription, async iteration, and kill.
 */
export interface LiveSubscriptionHandle<T = unknown> {
    /** The subscription identifier */
    readonly id: string;
    /** Whether the subscription is still alive */
    readonly isAlive: boolean;
    /** Kill the subscription and stop receiving updates */
    kill(): Promise<void>;
    /**
     * Subscribe to live updates via callback.
     * Returns an unsubscribe function.
     */
    subscribe(callback: (data: LiveMessageData<T>) => void): () => void;
    /** Async iterator for live updates */
    [Symbol.asyncIterator](): AsyncIterator<LiveMessageData<T>>;
    /** Optional callback for subscription errors */
    onError?: (error: Error) => void;
}
/**
 * Core driver interface that all database drivers must implement
 */
export interface SurrealDriver {
    /** Get the connection URL */
    getUrl(): string;
    /** Establish connection to the database */
    connect(): Promise<void>;
    /** Close the database connection */
    disconnect(): Promise<void>;
    /** Check if currently connected */
    isConnected(): boolean;
    /** Execute a raw SQL query with optional variables */
    query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T[]>;
    /** Execute a function within a transaction */
    transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
    /** Subscribe to live queries on a table */
    live<T>(table: string, callback: (data: LiveData<T>) => void): Promise<string>;
    /** Subscribe to live queries with advanced options (diff, fields, where, fetch) */
    liveWithOptions<T = unknown>(table: string, options?: LiveQueryOptions): Promise<LiveSubscriptionHandle<T>>;
    /** Kill a live query subscription */
    kill(subscriptionId: string): Promise<void>;
    /** Switch to a different namespace and database */
    use(namespace: string, database: string): Promise<void>;
    /** Invalidate the current session/token */
    invalidate(): Promise<void>;
    /** Select all records from a table using native SDK */
    select<T = unknown>(table: string): Promise<T[]>;
    /** Create a record using native SDK */
    create<T = unknown>(table: string, data: unknown): Promise<T[]>;
    /** Insert one or multiple records using native SDK */
    insert<T = unknown>(table: string, data: unknown): Promise<T[]>;
    /** Update a record using native SDK */
    update<T = unknown>(table: string, data: unknown): Promise<T[]>;
    /** Delete a record using native SDK */
    delete<T = unknown>(table: string): Promise<T[]>;
    /** Upsert (create or replace) a record using native SDK */
    upsert<T = unknown>(table: string, data: unknown): Promise<T[]>;
    /** Upsert by field condition (field-based WHERE, not record ID) using native SDK */
    upsertWhere<T = unknown>(table: string, whereClause: string, data: unknown): Promise<T[]>;
    /** Create a graph relation using native SDK */
    relate<T = unknown>(from: string, edge: string, to: string, data?: unknown): Promise<T[]>;
    /** Sign in with credentials */
    signin(credentials: ConfigAuth): Promise<string>;
    /** Sign up for a new user account */
    signup(credentials: ConfigAuth): Promise<string>;
    /** Authenticate with existing token(s) */
    authenticate(token: string | {
        access: string;
        refresh?: string;
    }): Promise<{
        access: string;
        refresh?: string;
    }>;
    /** Get current authenticated user info */
    auth(): Promise<Record<string, unknown> | null>;
    /** Get the driver configuration */
    config: DriverConfig | EmbeddedConfig;
    /** Schema definition for column metadata (recordTable, etc.) */
    schema?: OrmSchema;
    /** Show changes for a table since a given point */
    showChanges<T = unknown>(table: string, options?: {
        since?: string | number;
        limit?: number;
    }): Promise<T[]>;
}
/**
 * Storage mode for embedded SurrealDB
 */
export type EmbeddedMode = 'memory' | 'surrealkv' | 'rocksdb';
/**
 * Configuration for embedded SurrealDB driver
 *
 * Note: Authentication is not required for embedded mode.
 * Embedded SurrealDB instances operate without authentication by default.
 */
export interface EmbeddedConfig {
    /** Explicit driver type */
    driver: 'embedded';
    /** Namespace to use (default: 'default') */
    namespace?: string;
    /** Database to use (default: 'default') */
    database?: string;
    /** Enable debug logging */
    debug?: boolean;
    /** Storage mode (default: 'memory') */
    mode?: EmbeddedMode;
    /** Path for persistent storage */
    path?: string;
}
//# sourceMappingURL=types.d.ts.map