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
import type {
  LiveMessageData,
  LiveQueryOptions,
  LiveSubscriptionHandle,
  SurrealDriver,
} from '../sdk/driver/types.js';
import type { TableDefinition } from '../sdk/table.js';
import type { InferSelectResult } from './types.js';

// ============================================================================
// LiveSubscription
// ============================================================================

/**
 * Handle for an active live subscription.
 *
 * Supports callback subscription, async iteration, and manual kill.
 * Wraps the underlying driver handle and optionally filters for a
 * specific record via onRecord.
 */
export class LiveSubscription<T = unknown> {
  private readonly handle: LiveSubscriptionHandle<T>;
  private readonly recordFilter?: string;

  constructor(handle: LiveSubscriptionHandle<T>, recordId?: string) {
    this.handle = handle;
    this.recordFilter = recordId;
  }

  /** The subscription identifier */
  get id(): string {
    return this.handle.id;
  }

  /** Whether the subscription is still alive */
  get isAlive(): boolean {
    return this.handle.isAlive;
  }

  /** Kill the subscription and stop receiving updates */
  async kill(): Promise<void> {
    await this.handle.kill();
  }

  /**
   * Subscribe to live updates via callback.
   * If onRecord was specified, only updates for that record are delivered.
   * Returns an unsubscribe function.
   */
  subscribe(callback: (data: LiveMessageData<T>) => void): () => void {
    const filter = this.recordFilter;
    if (filter) {
      return this.handle.subscribe((data) => {
        const id = (data.result as { id?: string } | undefined)?.id;
        const recordStr = id ?? '';
        if (recordStr === filter) {
          callback(data);
        }
      });
    }
    return this.handle.subscribe(callback);
  }

  /** Async iterator for live updates */
  [Symbol.asyncIterator](): AsyncIterator<LiveMessageData<T>> {
    return this.handle[Symbol.asyncIterator]();
  }
}

// ============================================================================
// LiveQueryBuilder
// ============================================================================

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
export class LiveQueryBuilder<TDef extends TableDefinition, TResult = InferSelectResult<TDef>> {
  private readonly driver: SurrealDriver;
  private readonly tableDef: TDef;
  private readonly options: LiveQueryOptions = {};
  private recordId?: string;

  constructor(orm: DaliORM, tableDef: TDef) {
    if (!orm) throw new Error('DaliORM instance is required');
    if (!tableDef?.name) throw new Error('Table definition with name is required');

    this.driver = orm.getDriver();
    this.tableDef = tableDef;
  }

  // ==================== DIFF Mode ====================

  /**
   * Subscribe to diffs (patches) only instead of full records on each update.
   * Only supported by WebSocket driver; ignored by embedded driver.
   */
  diff(): this {
    this.options.diff = true;
    return this;
  }

  // ==================== Field Selection ====================

  /**
   * Select specific fields to monitor (replaces default '*').
   * Provides autocomplete from TableDefinition columns.
   */
  fields(...names: (keyof TResult)[]): this {
    if (names.length === 0) throw new Error('At least one field name is required');
    this.options.fields = names as string[];
    return this;
  }

  /**
   * Select a single field value.
   */
  value(field: keyof TResult): this {
    if (!field) throw new Error('Field name is required for value()');
    this.options.value = field as string;
    return this;
  }

  // ==================== WHERE Clause ====================

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
  where(condition: ExprLike): this {
    if (condition == null) throw new Error('WHERE condition cannot be null or undefined');
    this.options.where = condition;
    return this;
  }

  // ==================== FETCH (eager load) ====================

  /**
   * Fetch record link contents for the specified fields.
   */
  fetch(...fields: string[]): this {
    if (fields.length === 0) throw new Error('At least one field name is required for fetch');
    this.options.fetch = fields;
    return this;
  }

  // ==================== Single Record Subscription ====================

  /**
   * Subscribe to changes for a specific record only.
   * Filtering is done client-side on the subscription callback.
   *
   * @param recordId - The record ID (e.g., 'alice' for user:alice)
   */
  onRecord(recordId: string): this {
    if (!recordId || typeof recordId !== 'string') {
      throw new Error('Record ID is required for onRecord');
    }
    this.recordId = recordId;
    return this;
  }

  // ==================== Execute ====================

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
  async start(): Promise<LiveSubscription<TResult>> {
    const handle = await this.driver.liveWithOptions<TResult>(this.tableDef.name, this.options);
    return new LiveSubscription(handle, this.recordId);
  }

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
  async subscribe(
    callback: (data: LiveMessageData<TResult>) => void,
  ): Promise<LiveSubscription<TResult>> {
    const subscription = await this.start();
    subscription.subscribe(callback);
    return subscription;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

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
export function live<TDef extends TableDefinition>(
  orm: DaliORM,
  tableDef: TDef,
): LiveQueryBuilder<TDef> {
  return new LiveQueryBuilder(orm, tableDef);
}
