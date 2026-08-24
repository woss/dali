/**
 * Embedded Driver for SurrealDB
 *
 * Extends BaseDriver for shared logic.
 * Provides embedded SurrealDB connectivity with:
 * - In-memory storage
 * - SurrealKV storage (file-based persistence)
 * - All standard driver operations
 */

import { createNodeEngines } from '@surrealdb/node';
import { type ExprLike, expr, Surreal } from 'surrealdb';
import { BaseDriver } from './base-driver.js';
import type {
  EmbeddedConfig,
  EmbeddedMode,
  LiveAction,
  LiveData,
  LiveMessageData,
  LiveQueryOptions,
  LiveSubscriptionHandle,
} from './types.js';

// ============================================================================
// Live Query Parsing Helpers
// ============================================================================

/** Parse raw live query data into action + result */
function parseLiveAction(raw: unknown): LiveAction | undefined {
  const data = raw as {
    operation?: number;
    action?: string;
    data?: unknown;
    result?: unknown;
  };

  if (data.operation !== undefined) {
    const actionMap: Record<number, LiveAction> = {
      1: 'CREATE',
      2: 'UPDATE',
      3: 'DELETE',
    };
    return actionMap[data.operation];
  }

  if (data.action !== undefined) {
    return data.action as LiveAction;
  }

  return undefined;
}

/** Parse raw live query data into result value */
function parseLiveResult(raw: unknown): unknown {
  const data = raw as {
    operation?: number;
    action?: string;
    data?: unknown;
    result?: unknown;
  };

  if (data.operation !== undefined) {
    return data.data;
  }

  if (data.result !== undefined) {
    return data.result;
  }

  if (data.data !== undefined) {
    return data.data;
  }

  return raw;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_NAMESPACE = 'default';
const DEFAULT_DATABASE = 'default';
const DEFAULT_MODE: EmbeddedMode = 'memory';
const DEFAULT_PATH = './surrealdb';

interface EmbeddedDriverConfig {
  driver: 'embedded';
  namespace: string;
  database: string;
  debug: boolean;
  mode: EmbeddedMode;
  path: string;
}

/**
 * EmbeddedDriver - Embedded SurrealDB driver
 *
 * Extends BaseDriver for shared implementations.
 * Only overrides methods that require embedded-specific behavior.
 */
export class EmbeddedDriver extends BaseDriver {
  protected db: Surreal;
  private readonly _config: EmbeddedDriverConfig;

  get config(): EmbeddedConfig {
    return this._config;
  }

  getUrl(): string {
    return '';
  }

  constructor(config: EmbeddedConfig = {} as EmbeddedConfig) {
    super();

    this._config = {
      driver: 'embedded',
      namespace: config.namespace ?? DEFAULT_NAMESPACE,
      database: config.database ?? DEFAULT_DATABASE,
      debug: Boolean(config.debug),
      mode: config.mode ?? DEFAULT_MODE,
      path: config.path ?? DEFAULT_PATH,
    };

    this.db = new Surreal({
      engines: {
        ...createNodeEngines(),
      },
    });
  }

  /**
   * Build the connection string based on storage mode
   */
  private buildConnectionString(): string {
    switch (this._config.mode) {
      case 'memory':
        return 'mem://';
      case 'surrealkv':
        return `surrealkv://${this._config.path}`;
      case 'rocksdb':
        // SurrealDB internal: rocksdb mode uses SurrealKV engine
        return `surrealkv://${this._config.path}`;
      default:
        return 'mem://';
    }
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      const connectionString = this.buildConnectionString();

      await this.db.connect(connectionString);

      await this.db.use({
        namespace: this._config.namespace,
        database: this._config.database,
      });

      this.connected = true;
    } catch (error) {
      this.connected = false;
      const mode = this._config.mode;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to connect to embedded SurrealDB (${mode}): ${message}`,
      );
    }
  }

  async signin(_credentials: Record<string, unknown>): Promise<string> {
    throw new Error(
      'Sign in is not supported in embedded mode. Use connection authentication instead.',
    );
  }

  async signup(_credentials: Record<string, unknown>): Promise<string> {
    throw new Error(
      'Sign up is not supported in embedded mode. Use connection authentication instead.',
    );
  }

  async authenticate(
    _token: string | { access: string; refresh?: string },
  ): Promise<{ access: string; refresh?: string }> {
    throw new Error(
      'Authentication is not supported in embedded mode. Use connection authentication instead.',
    );
  }

  /**
   * Override: Recursive datetime transformation for embedded mode.
   * BaseDriver only transforms top-level; embedded handles nested objects.
   */
  override transformDatetimeValues(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.transformDatetimeValues(item));
    }

    if (typeof obj === 'object') {
      // Preserve class instances (RecordId, DateTime, Uint8Array, etc.)
      const proto = Object.getPrototypeOf(obj);
      const isPlain = proto === Object.prototype || proto === null;
      if (!isPlain) return obj;

      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(
        obj as Record<string, unknown>,
      )) {
        result[key] = this.transformDatetimeValues(value);
      }
      return result;
    }

    return obj;
  }

  /**
   * Override: Live query using query-based approach (not db.live()).
   * EmbeddedDriver uses LIVE SELECT query and async iteration.
   */
  override async live<T>(
    table: string,
    callback: (data: LiveData<T>) => void,
  ): Promise<string> {
    if (!this.connected) {
      throw new Error('Not connected to SurrealDB');
    }

    if (!table || table.trim() === '') {
      throw new Error('Table name is required for live queries');
    }

    const sanitizedTable = table.replace(/[^a-zA-Z0-9_:]/g, '');
    if (sanitizedTable !== table) {
      this.warn('Table name contains invalid characters, sanitized');
    }

    const liveQuery = `LIVE SELECT * FROM ${sanitizedTable}`;
    const subscriptionId = `live_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    return this.db
      .query(liveQuery)
      .then((queryResult) => {
        this.subscriptions.set(subscriptionId, { created: Date.now() });

        void (async () => {
          try {
            // oxlint-disable-next-line typescript/await-thenable
            for await (const raw of queryResult) {
              const action = parseLiveAction(raw) ?? 'UPDATE';
              const result = parseLiveResult(raw);
              callback({ action, result: result as T });
            }
          } catch {
            this.warn('Live query ended with error');
          }
        })();

        return subscriptionId;
      })
      .catch((error) => {
        console.error('Live query setup failed:', error);
        throw error;
      });
  }

  /**
   * Override: Live query with options using SQL-based approach.
   * Embedded driver builds LIVE SELECT SQL with WHERE/FETCH clauses.
   * DIFF mode is not supported via SQL; ignored if set.
   *
   * Uses a single LIVE SELECT with multi-subscriber dispatch.
   * Each subscribe() callback and async iterator share the same stream.
   */
  override async liveWithOptions<T = unknown>(
    table: string,
    options?: LiveQueryOptions,
  ): Promise<LiveSubscriptionHandle<T>> {
    if (!this.connected) {
      throw new Error('Not connected to SurrealDB');
    }

    if (!table || table.trim() === '') {
      throw new Error('Table name is required for live query');
    }

    const sanitizedTable = table.replace(/[^a-zA-Z0-9_:]/g, '');
    if (sanitizedTable !== table) {
      this.warn('Table name contains invalid characters, sanitized');
    }

    // Build field list
    let fields = '*';
    if (options?.fields && options.fields.length > 0) {
      fields = options.fields.join(', ');
    }

    let sql = `LIVE SELECT ${fields} FROM ${sanitizedTable}`;
    const params: Record<string, unknown> = {};

    // WHERE — convert SDK Expr to SQL via expr()
    if (options?.where) {
      try {
        const bound = expr(options.where as ExprLike);
        const whereClause = bound.query;
        if (whereClause) {
          sql += ` WHERE ${whereClause}`;
          Object.assign(params, bound.bindings);
        }
      } catch {
        this.warn(
          'Failed to compile WHERE expression for embedded live query, ignoring',
        );
      }
    }

    // FETCH
    if (options?.fetch && options.fetch.length > 0) {
      sql += ` FETCH ${options.fetch.join(', ')}`;
    }

    // DIFF — not supported via SQL, log a warning
    if (options?.diff) {
      this.warn(
        'DIFF mode is not supported in embedded live queries, ignoring',
      );
    }

    const subscriptionId = `live_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Multi-subscriber dispatch
    const subscribers = new Set<(data: LiveMessageData<T>) => void>();
    let alive = true;

    // Queue for async iterator (single consumer)
    const channel: LiveMessageData<T>[] = [];
    let channelResolve:
      | ((value: IteratorResult<LiveMessageData<T>>) => void)
      | null = null;

    // Capture driver references for closure
    const driverDb = this.db;
    const subs = this.subscriptions;
    let onErrorCb: ((error: Error) => void) | undefined;

    // Start the LIVE SELECT query in background
    this.db
      .query(sql, params)
      .then(async (queryResult) => {
        try {
          // oxlint-disable-next-line typescript/await-thenable
          for await (const raw of queryResult) {
            if (!alive) break;

            const action = parseLiveAction(raw);
            const result = parseLiveResult(raw);

            if (!action) continue;

            const data: LiveMessageData<T> = { action, result: result as T };

            // Dispatch to subscribers
            for (const sub of subscribers) {
              sub(data);
            }

            // Push to async iterator channel
            if (channelResolve) {
              const resolve = channelResolve;
              channelResolve = null;
              resolve({ value: data, done: false });
            } else {
              channel.push(data);
            }
          }
        } catch (error) {
          onErrorCb?.(
            error instanceof Error ? error : new Error(String(error)),
          );
        } finally {
          alive = false;
        }
      })
      .catch(() => {
        alive = false;
      });

    this.subscriptions.set(subscriptionId, { created: Date.now() });

    return {
      get id(): string {
        return subscriptionId;
      },
      get isAlive(): boolean {
        return alive;
      },
      get onError(): ((error: Error) => void) | undefined {
        return onErrorCb;
      },
      set onError(cb: ((error: Error) => void) | undefined) {
        onErrorCb = cb;
      },
      async kill(): Promise<void> {
        alive = false;
        await driverDb.query(`KILL ${subscriptionId}`).catch(() => {});
        subs.delete(subscriptionId);
      },
      subscribe(callback: (data: LiveMessageData<T>) => void): () => void {
        subscribers.add(callback);
        return () => {
          subscribers.delete(callback);
        };
      },
      async *[Symbol.asyncIterator](): AsyncIterator<LiveMessageData<T>> {
        try {
          while (alive) {
            if (channel.length > 0) {
              const msg = channel.shift();
              if (msg !== undefined) yield msg;
            } else if (!alive) {
              break;
            } else {
              const data = await new Promise<
                IteratorResult<LiveMessageData<T>>
              >((resolve) => {
                channelResolve = resolve;
              });
              if (data.done) break;
              yield data.value;
            }
          }
        } catch {
          // Iterator ended
        }
      },
    };
  }

  /**
   * Override: Kill live query using KILL statement.
   * BaseDriver uses liveSubscription.kill(), which doesn't apply to embedded.
   */
  override async kill(subscriptionId: string): Promise<void> {
    if (!subscriptionId) {
      return;
    }

    await this.db.query(`KILL ${subscriptionId}`).catch(() => {
      // Ignore if query fails
    });
    this.subscriptions.delete(subscriptionId);
  }
}
