/**
 * Live Query Builder
 *
 * Thin wrapper around SurrealDB SDK's fluent live query API.
 * Provides type-safe field selection from TableDefinition and both
 * callback-based and async-iterator subscription patterns.
 *
 * WebSocket drivers: delegates to SDK db.live().diff().fields().where().fetch()
 * Embedded driver:   translates options to LIVE SELECT SQL
 */
import type { ExprLike } from 'surrealdb';
import type { DaliORM } from '../sdk/dali-orm.js';
import type { LiveMessageData, LiveSubscriptionHandle } from '../sdk/driver/types.js';
import type { TableDefinition } from '../sdk/table.js';
import type { InferSelectResult } from './types.js';
/**
 * Handle for an active live subscription.
 *
 * Supports callback subscription, async iteration, and manual kill.
 * Wraps the underlying driver handle and optionally filters for a
 * specific record via onRecord.
 */
export declare class LiveSubscription<T = unknown> {
    private readonly handle;
    private readonly recordFilter?;
    constructor(handle: LiveSubscriptionHandle<T>, recordId?: string);
    /** The subscription identifier */
    get id(): string;
    /** Whether the subscription is still alive */
    get isAlive(): boolean;
    /** Kill the subscription and stop receiving updates */
    kill(): Promise<void>;
    /**
     * Subscribe to live updates via callback.
     * If onRecord was specified, only updates for that record are delivered.
     * Returns an unsubscribe function.
     */
    subscribe(callback: (data: LiveMessageData<T>) => void): () => void;
    /** Async iterator for live updates */
    [Symbol.asyncIterator](): AsyncIterator<LiveMessageData<T>>;
}
/**
 * Fluent builder for SurrealDB live queries.
 *
 * Wraps the driver's liveWithOptions with type inference from TableDefinition.
 *
 * @example
 * ```typescript
 * const sub = await live(driver, users)
 *   .where(eq('name', 'Alice'))
 *   .subscribe((data) => console.log('Update:', data));
 *
 * // Later:
 * await sub.kill();
 * ```
 *
 * @example
 * ```typescript
 * const sub = await live(driver, users)
 *   .fields('name', 'email')
 *   .diff()
 *   .start();
 *
 * for await (const data of sub) {
 *   console.log('Diff:', data);
 * }
 * ```
 */
export declare class LiveQueryBuilder<TDef extends TableDefinition, TResult = InferSelectResult<TDef>> {
    private readonly driver;
    private readonly tableDef;
    private readonly options;
    private recordId?;
    constructor(orm: DaliORM, tableDef: TDef);
    /**
     * Subscribe to diffs (patches) only instead of full records on each update.
     * Only supported by WebSocket driver; ignored by embedded driver.
     */
    diff(): this;
    /**
     * Select specific fields to monitor (replaces default '*').
     * Provides autocomplete from TableDefinition columns.
     */
    fields(...names: (keyof TResult)[]): this;
    /**
     * Select a single field value.
     */
    value(field: keyof TResult): this;
    /**
     * Add a WHERE condition using SDK Expr.
     *
     * Use condition functions imported from 'surrealdb' or from this package:
     * ```typescript
     * import { eq, gt, and } from 'surrealdb';
     *
     * live(driver, users)
     *   .where(and(eq('name', 'Alice'), gt('age', 25)))
     *   .subscribe(handler);
     * ```
     */
    where(condition: ExprLike): this;
    /**
     * Fetch record link contents for the specified fields.
     */
    fetch(...fields: string[]): this;
    /**
     * Subscribe to changes for a specific record only.
     * Filtering is done client-side on the subscription callback.
     *
     * @param recordId - The record ID (e.g., 'alice' for user:alice)
     */
    onRecord(recordId: string): this;
    /**
     * Start the live subscription and return a handle.
     * Use `start()` when you want async iteration:
     *
     * ```typescript
     * const sub = await live(driver, users).start();
     * for await (const data of sub) {
     *   console.log(data);
     * }
     * ```
     */
    start(): Promise<LiveSubscription<TResult>>;
    /**
     * Start the live subscription with a callback.
     * Returns the subscription handle for later kill().
     *
     * ```typescript
     * const sub = await live(driver, users)
     *   .subscribe((data) => console.log('Update:', data));
     * // Later:
     * await sub.kill();
     * ```
     */
    subscribe(callback: (data: LiveMessageData<TResult>) => void): Promise<LiveSubscription<TResult>>;
}
/**
 * Create a new LiveQueryBuilder for the given table definition.
 *
 * @example
 * ```typescript
 * const sub = await live(driver, users)
 *   .where(eq('name', 'Alice'))
 *   .diff()
 *   .subscribe((data) => console.log('Update:', data));
 * ```
 */
export declare function live<TDef extends TableDefinition>(orm: DaliORM, tableDef: TDef): LiveQueryBuilder<TDef>;
//# sourceMappingURL=live.d.ts.map