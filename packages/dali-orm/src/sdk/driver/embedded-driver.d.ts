/**
 * Embedded Driver for SurrealDB
 *
 * Extends BaseDriver for shared logic.
 * Provides embedded SurrealDB connectivity with:
 * - In-memory storage
 * - SurrealKV storage (file-based persistence)
 * - All standard driver operations
 */
import { Surreal } from 'surrealdb';
import { BaseDriver } from './base-driver.js';
import type { EmbeddedConfig, LiveData, LiveQueryOptions, LiveSubscriptionHandle } from './types.js';
/**
 * EmbeddedDriver - Embedded SurrealDB driver
 *
 * Extends BaseDriver for shared implementations.
 * Only overrides methods that require embedded-specific behavior.
 */
export declare class EmbeddedDriver extends BaseDriver {
    protected db: Surreal;
    private readonly _config;
    get config(): EmbeddedConfig;
    getUrl(): string;
    constructor(config?: EmbeddedConfig);
    /**
     * Build the connection string based on storage mode
     */
    private buildConnectionString;
    connect(): Promise<void>;
    signin(_credentials: Record<string, unknown>): Promise<string>;
    signup(_credentials: Record<string, unknown>): Promise<string>;
    authenticate(_token: string | {
        access: string;
        refresh?: string;
    }): Promise<{
        access: string;
        refresh?: string;
    }>;
    /**
     * Override: Recursive datetime transformation for embedded mode.
     * BaseDriver only transforms top-level; embedded handles nested objects.
     */
    transformDatetimeValues(obj: unknown): unknown;
    /**
     * Override: Live query using query-based approach (not db.live()).
     * EmbeddedDriver uses LIVE SELECT query and async iteration.
     */
    live<T>(table: string, callback: (data: LiveData<T>) => void): Promise<string>;
    /**
     * Override: Live query with options using SQL-based approach.
     * Embedded driver builds LIVE SELECT SQL with WHERE/FETCH clauses.
     * DIFF mode is not supported via SQL; ignored if set.
     *
     * Uses a single LIVE SELECT with multi-subscriber dispatch.
     * Each subscribe() callback and async iterator share the same stream.
     */
    liveWithOptions<T = unknown>(table: string, options?: LiveQueryOptions): Promise<LiveSubscriptionHandle<T>>;
    /**
     * Override: Kill live query using KILL statement.
     * BaseDriver uses liveSubscription.kill(), which doesn't apply to embedded.
     */
    kill(subscriptionId: string): Promise<void>;
}
//# sourceMappingURL=embedded-driver.d.ts.map