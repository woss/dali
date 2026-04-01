/**
 * Base Driver for SurrealDB
 *
 * Thin wrapper around SurrealDB SDK.
 * Parses inputs at boundaries (Parse, Don't Validate).
 * Delegates directly to SDK for all CRUD operations.
 */

import { DateTime, type ExprLike, RecordId, type Surreal, Table } from 'surrealdb';
import type {
  DriverConfig,
  EmbeddedConfig,
  LiveAction,
  LiveData,
  LiveMessageData,
  LiveQueryOptions,
  LiveSubscriptionHandle,
  SurrealDriver,
  Transaction,
} from './types.js';

export abstract class BaseDriver implements SurrealDriver {
  protected abstract db: Surreal;
  protected connected = false;
  protected subscriptions = new Map<string, { created: number; liveSubscription?: unknown }>();

  protected warn(message: string): void {
    console.warn(message);
  }

  abstract connect(): Promise<void>;
  abstract getUrl(): string;
  abstract signin(credentials: unknown): Promise<string>;
  abstract signup(credentials: unknown): Promise<string>;
  abstract authenticate(token: unknown): Promise<{ access: string; refresh?: string }>;
  abstract get config(): DriverConfig | EmbeddedConfig;

  // ==================== Connection Management ====================

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return; // Early Exit - already disconnected

    await Promise.all(Array.from(this.subscriptions.keys()).map((id) => this.kill(id)));
    await this.db.close();
    this.connected = false;
    this.subscriptions.clear(); // Explicit cleanup
  }

  // ==================== Query ====================

  async query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T[]> {
    if (!this.connected) throw new Error('Not connected to SurrealDB');

    try {
      const result = await this.db.query<[T]>(sql, vars).collect();
      return (result[0] ?? []) as unknown as T[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Query failed: ${message}`);
    }
  }

  // ==================== Change Feed ====================

  async showChanges<T = unknown>(
    table: string,
    options?: { since?: string | number; limit?: number },
  ): Promise<T[]> {
    if (!this.connected) throw new Error('Not connected to SurrealDB');

    const sanitizedTable = table.replace(/[^a-zA-Z0-9_:]/g, '');
    if (sanitizedTable !== table) this.warn('Table name contains invalid characters, sanitized');

    const since = options?.since ?? 0;
    const limit = options?.limit ?? 10;
    const sinceClause = since === 0 ? '0' : `${since}`;
    const sql = `SHOW CHANGES FOR TABLE ${sanitizedTable} SINCE ${sinceClause} LIMIT ${limit}`;

    return this.query<T>(sql);
  }

  // ==================== CRUD (Thin SDK Wrappers) ====================

  async select<T = unknown>(table: string): Promise<T[]> {
    if (!this.connected) throw new Error('Not connected to SurrealDB');

    if (!table || typeof table !== 'string' || table.trim() === '') {
      throw new Error('Table name is required');
    }

    try {
      const { tableName, recordId } = this.parseTableWithId(table);

      let results: T[];
      if (recordId) {
        const result = await this.db.select<T>(new RecordId(tableName, recordId));
        results = result ? ([result] as T[]) : [];
      } else {
        results = (await this.db.select<T>(new Table(tableName))) as T[];
      }

      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Select failed: ${message}`);
    }
  }

  async create<T = unknown>(table: string, data: unknown): Promise<T[]> {
    if (!this.connected) throw new Error('Not connected to SurrealDB');

    if (!table || typeof table !== 'string' || table.trim() === '') {
      throw new Error('Table name is required for create');
    }

    if (data === null || data === undefined) {
      throw new Error('Data is required for create');
    }

    try {
      const { tableName, recordId } = this.parseTableWithId(table);
      const transformedData = this.transformDatetimeValues(data);
      const coercedData = this.coerceRecordIds(tableName, transformedData);

      let result: T | T[];
      if (recordId) {
        result = (await this.db
          .create(new RecordId(tableName, recordId))
          .content(coercedData as never)) as T;
      } else {
        result = (await this.db.create(new Table(tableName)).content(coercedData as never)) as T[];
      }

      return Array.isArray(result) ? result : [result];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Create failed: ${message}`);
    }
  }

  async insert<T = unknown>(table: string, data: unknown): Promise<T[]> {
    if (!this.connected) throw new Error('Not connected to SurrealDB');

    if (!table || typeof table !== 'string' || table.trim() === '') {
      throw new Error('Table name is required for insert');
    }

    if (data === null || data === undefined) {
      throw new Error('Data is required for insert');
    }

    try {
      const { tableName } = this.parseTableWithId(table);
      const transformedData = this.transformDatetimeValues(data);
      const coercedData = this.coerceRecordIds(tableName, transformedData);
      const dataArray = Array.isArray(coercedData) ? coercedData : [coercedData];

      const results = (await this.db.insert<T>(new Table(table), dataArray as never)) as T[];

      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Insert failed: ${message}`);
    }
  }

  async update<T = unknown>(table: string, data: unknown): Promise<T[]> {
    if (!this.connected) throw new Error('Not connected to SurrealDB');

    if (!table || typeof table !== 'string' || table.trim() === '') {
      throw new Error('Table name is required for update');
    }

    if (data === null || data === undefined) {
      throw new Error('Data is required for update');
    }

    try {
      const { tableName, recordId } = this.parseTableWithId(table);
      const transformedData = this.transformDatetimeValues(data);
      const coercedData = this.coerceRecordIds(tableName, transformedData);

      let result: T | T[];
      if (recordId) {
        result = (await this.db
          .update(new RecordId(tableName, recordId))
          .merge(coercedData as never)) as T;
      } else {
        result = (await this.db.update(new Table(tableName)).merge(coercedData as never)) as T[];
      }

      const results = Array.isArray(result) ? result : [result];

      return results as T[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Update failed: ${message}`);
    }
  }

  async delete<T = unknown>(table: string): Promise<T[]> {
    if (!this.connected) throw new Error('Not connected to SurrealDB');

    if (!table || typeof table !== 'string' || table.trim() === '') {
      throw new Error('Table name is required for delete');
    }

    try {
      const { tableName, recordId } = this.parseTableWithId(table);

      let result: T | T[];
      if (recordId) {
        result = (await this.db.delete(new RecordId(tableName, recordId))) as T;
      } else {
        result = (await this.db.delete(new Table(tableName))) as T[];
      }

      const results = Array.isArray(result) ? result : [result];

      return results as T[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Delete failed: ${message}`);
    }
  }

  async upsert<T = unknown>(table: string, data: unknown): Promise<T[]> {
    if (!this.connected) throw new Error('Not connected to SurrealDB');

    if (!table || typeof table !== 'string' || table.trim() === '') {
      throw new Error('Table name is required for upsert');
    }

    if (data === null || data === undefined) {
      throw new Error('Data is required for upsert');
    }

    try {
      const { tableName, recordId } = this.parseTableWithId(table);
      if (!recordId) throw new Error('Upsert requires a record ID (e.g., "user:john")');

      const transformedData = this.transformDatetimeValues(data);
      const coercedData = this.coerceRecordIds(tableName, transformedData);

      const result = (await this.db
        .upsert(new RecordId(tableName, recordId))
        .merge(coercedData as never)) as T;

      return [result];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Upsert failed: ${message}`);
    }
  }

  async upsertWhere<T = unknown>(table: string, whereClause: string, data: unknown): Promise<T[]> {
    if (!this.connected) throw new Error('Not connected to SurrealDB');

    if (!table || typeof table !== 'string' || table.trim() === '') {
      throw new Error('Table name is required for upsertWhere');
    }

    if (!whereClause || typeof whereClause !== 'string' || whereClause.trim() === '') {
      throw new Error('WHERE clause is required for upsertWhere');
    }

    if (data === null || data === undefined) {
      throw new Error('Data is required for upsertWhere');
    }

    try {
      const transformedData = this.transformDatetimeValues(data);
      const coercedData = this.coerceRecordIds(table, transformedData);

      const result = (await this.db
        .upsert(new Table(table))
        .where(whereClause as unknown as ExprLike)
        .merge(coercedData as never)) as T;

      return Array.isArray(result) ? result : [result];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Upsert failed: ${message}`);
    }
  }

  async relate<T = unknown>(from: string, edge: string, to: string, data?: unknown): Promise<T[]> {
    if (!this.connected) throw new Error('Not connected to SurrealDB');

    if (!from || typeof from !== 'string' || from.trim() === '') {
      throw new Error('From record ID is required for relate');
    }

    if (!to || typeof to !== 'string' || to.trim() === '') {
      throw new Error('To record ID is required for relate');
    }

    if (!edge || typeof edge !== 'string' || edge.trim() === '') {
      throw new Error('Edge is required for relate');
    }

    try {
      const fromParsed = this.parseTableWithId(from);
      const toParsed = this.parseTableWithId(to);

      if (!fromParsed.recordId) {
        throw new Error('From record ID is required for relate');
      }

      if (!toParsed.recordId) {
        throw new Error('To record ID is required for relate');
      }

      const transformedData = data
        ? this.transformDatetimeValues(data as Record<string, unknown>)
        : undefined;

      const result = (await this.db.relate(
        new RecordId(fromParsed.tableName, fromParsed.recordId),
        new Table(edge),
        new RecordId(toParsed.tableName, toParsed.recordId),
        transformedData as Record<string, unknown> | undefined,
      )) as T;

      return [result];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Relate failed: ${message}`);
    }
  }

  // ==================== Transaction ====================

  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    if (!this.connected) throw new Error('Not connected to SurrealDB');

    const tx = await this.db.beginTransaction();
    // oxlint-disable-next-line typescript/no-this-alias
    const driver = this;
    let committed = false;

    const transaction: Transaction = {
      async commit(): Promise<void> {
        await tx.commit();
        committed = true;
      },
      async rollback(): Promise<void> {
        await tx.cancel();
        committed = true;
      },
      async query<U = unknown>(sql: string, vars?: Record<string, unknown>): Promise<U[]> {
        const result = await tx.query<[U[]]>(sql, vars).collect();
        return (result[0] ?? []) as U[];
      },
      async select<U>(thing: string): Promise<U[]> {
        const { tableName, recordId } = driver.parseTableWithId(thing);
        let results: U[];
        if (recordId) {
          const r = await tx.select(new RecordId(tableName, recordId));
          results = r ? [r as U] : [];
        } else {
          results = (await tx.select(new Table(tableName))) as U[];
        }
        return results;
      },
      async create<U>(thing: string, data: unknown): Promise<U[]> {
        const { tableName, recordId } = driver.parseTableWithId(thing);
        const transformedData = driver.transformDatetimeValues(data);
        let result: U | U[];
        if (recordId) {
          result = (await tx
            .create(new RecordId(tableName, recordId))
            .content(transformedData as never)) as U;
        } else {
          result = (await tx.create(new Table(tableName)).content(transformedData as never)) as U[];
        }
        return Array.isArray(result) ? result : [result];
      },
      async insert<U>(thing: string, data: unknown): Promise<U[]> {
        const transformedData = driver.transformDatetimeValues(data);
        const dataArray = Array.isArray(transformedData) ? transformedData : [transformedData];
        const results = (await tx.insert(new Table(thing), dataArray as never)) as U[];
        return results;
      },
      async update<U>(thing: string, data: unknown): Promise<U[]> {
        const { tableName, recordId } = driver.parseTableWithId(thing);
        const transformedData = driver.transformDatetimeValues(data);
        let result: U | U[];
        if (recordId) {
          result = (await tx
            .update(new RecordId(tableName, recordId))
            .content(transformedData as never)) as U;
        } else {
          result = (await tx.update(new Table(tableName)).content(transformedData as never)) as U[];
        }
        const results = Array.isArray(result) ? result : [result];
        return results as U[];
      },
      async delete<U>(thing: string): Promise<U[]> {
        const { tableName, recordId } = driver.parseTableWithId(thing);
        let result: U | U[];
        if (recordId) {
          result = (await tx.delete(new RecordId(tableName, recordId))) as U;
        } else {
          result = (await tx.delete(new Table(tableName))) as U[];
        }
        return Array.isArray(result) ? result : [result];
      },
      async relate<U>(from: string, edge: string, to: string, data?: unknown): Promise<U[]> {
        const fromParsed = driver.parseTableWithId(from);
        const toParsed = driver.parseTableWithId(to);
        if (!fromParsed.recordId) throw new Error('From record ID is required for relate');
        if (!toParsed.recordId) throw new Error('To record ID is required for relate');
        const transformedData = data ? driver.transformDatetimeValues(data) : undefined;
        const result = (await tx.relate(
          new RecordId(fromParsed.tableName, fromParsed.recordId),
          new Table(edge),
          new RecordId(toParsed.tableName, toParsed.recordId),
          transformedData as Record<string, unknown> | undefined,
        )) as U;
        return [result];
      },
    };

    try {
      const result = await fn(transaction);
      if (!committed) {
        await tx.commit();
      }
      return result;
    } catch (error) {
      if (!committed) {
        await tx.cancel();
      }
      throw error;
    }
  }

  // ==================== Namespace/Database ====================

  async use(namespace: string, database: string): Promise<void> {
    if (!this.connected) throw new Error('Not connected to SurrealDB');
    await this.db.use({ namespace, database });
  }

  async invalidate(): Promise<void> {
    await this.db.invalidate();
    this.connected = false;
  }

  async auth(): Promise<Record<string, unknown> | null> {
    if (!this.connected) throw new Error('Not connected to SurrealDB');

    const result = await this.db.query<[Record<string, unknown> | null]>('RETURN $auth').collect();
    const authData = result[0];

    if (!authData) {
      return null;
    }

    return authData;
  }

  // ==================== Live Queries ====================

  async live<T>(table: string, callback: (data: LiveData<T>) => void): Promise<string> {
    if (!this.connected) throw new Error('Not connected to SurrealDB');

    if (!table || typeof table !== 'string' || table.trim() === '') {
      throw new Error('Table name is required');
    }

    const sanitizedTable = table.replace(/[^a-zA-Z0-9_:]/g, '');
    if (sanitizedTable !== table) this.warn('Table name contains invalid characters, sanitized');

    const subscriptionId = `live_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    return new Promise<string>((resolve, reject) => {
      this.db
        .live(new Table(sanitizedTable))
        .then((liveSubscription) => {
          this.subscriptions.set(subscriptionId, { created: Date.now(), liveSubscription });
          resolve(subscriptionId);

          void (async () => {
            try {
              for await (const update of liveSubscription) {
                const { action, value } = update;
                callback({ action: action as LiveAction, result: value as T });
              }
            } catch {
              // Live query ended
            }
          })();
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  async liveWithOptions<T = unknown>(
    table: string,
    options?: LiveQueryOptions,
  ): Promise<LiveSubscriptionHandle<T>> {
    if (!this.connected) throw new Error('Not connected to SurrealDB');

    if (!table || typeof table !== 'string' || table.trim() === '') {
      throw new Error('Table name is required for live query');
    }

    const sanitizedTable = table.replace(/[^a-zA-Z0-9_:]/g, '');
    if (sanitizedTable !== table) {
      this.warn('Table name contains invalid characters, sanitized');
    }

    // Build the fluent live query via SDK
    let promise = this.db.live<T>(new Table(sanitizedTable));

    if (options?.diff) {
      promise = promise.diff();
    }
    if (options?.fields && options.fields.length > 0) {
      promise = promise.fields(...options.fields);
    }
    if (options?.value) {
      promise = promise.value(options.value);
    }
    if (options?.where) {
      promise = promise.where(options.where as ExprLike);
    }
    if (options?.fetch && options.fetch.length > 0) {
      promise = promise.fetch(...options.fetch);
    }

    const subscription = await promise;
    const subscriptionId = `live_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    this.subscriptions.set(subscriptionId, { created: Date.now(), liveSubscription: subscription });

    const subs = this.subscriptions; // capture for closure

    const handle: LiveSubscriptionHandle<T> = {
      get id(): string {
        return subscriptionId;
      },
      get isAlive(): boolean {
        return subscription.isAlive;
      },
      async kill(): Promise<void> {
        await subscription.kill();
        subs.delete(subscriptionId);
      },
      subscribe(callback: (data: LiveMessageData<T>) => void): () => void {
        return subscription.subscribe((message) => {
          callback({ action: message.action as LiveAction, result: message.value as T });
        });
      },
      async *[Symbol.asyncIterator](): AsyncIterator<LiveMessageData<T>> {
        for await (const message of subscription) {
          yield { action: message.action as LiveAction, result: message.value as T };
        }
      },
    };

    return handle;
  }

  async kill(subscriptionId: string): Promise<void> {
    if (!subscriptionId) return;

    const sub = this.subscriptions.get(subscriptionId);
    if (sub?.liveSubscription && typeof sub.liveSubscription === 'object') {
      const liveSub = sub.liveSubscription as { kill?: () => Promise<void> };
      if (typeof liveSub.kill === 'function') {
        await liveSub.kill();
      }
    }
    this.subscriptions.delete(subscriptionId);
  }

  // ==================== Utilities ====================

  parseTableWithId(table: string): { tableName: string; recordId: string | undefined } {
    const colonIndex = table.indexOf(':');
    if (colonIndex === -1) return { tableName: table, recordId: undefined };

    const tableName = table.substring(0, colonIndex);
    const recordId = table.substring(colonIndex + 1);

    return { tableName, recordId: recordId || undefined };
  }

  transformDatetimeValues(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.transformDatetimeValues(item));

    if (typeof obj === 'object') {
      // Preserve class instances (RecordId, DateTime, Uint8Array, etc.)
      // Only transform plain objects so we don't erase non-enumerable data.
      if (!this.isPlainObject(obj)) return obj;

      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (
          this.isDatetimeField(key) &&
          value !== null &&
          value !== undefined &&
          !Array.isArray(value)
        ) {
          result[key] = this.tryCreateDateTime(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    }

    return obj;
  }

  // ==================== Private Helpers ====================

  private isDatetimeField(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return (
      lowerKey.includes('date') ||
      lowerKey.includes('time') ||
      lowerKey.endsWith('_at') ||
      lowerKey.endsWith('_on')
    );
  }

  private coerceRecordIds(tableName: string, input: unknown): unknown {
    if (input === null || input === undefined) return input;
    if (Array.isArray(input)) return input.map((item) => this.coerceRecordIds(tableName, item));
    if (typeof input !== 'object') return input;
    if (!this.isPlainObject(input)) return input;

    const out: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      out[key] = this.tryCoerceRecordId(value);
    }
    return out;
  }

  private tryCoerceRecordId(value: unknown): unknown {
    if (value === null || value === undefined) return value;

    // Fast path: already our RecordId
    if (value instanceof RecordId) return value;

    // Foreign RecordId instance (different module instance): detect by constructor name
    if (typeof value === 'object' && value !== null) {
      const ctorName = (value as { constructor?: { name?: string } }).constructor?.name;
      if (ctorName === 'RecordId' || ctorName === 'StringRecordId') {
        return this.recordIdFromString(`${value as unknown as string}`);
      }

      const obj = value as Record<string, unknown>;
      if (typeof obj.tb === 'string' && typeof obj.id === 'string') {
        return new RecordId(obj.tb, obj.id);
      }
      if (typeof obj.id === 'string') {
        return this.recordIdFromString(obj.id);
      }
      if (typeof obj.id === 'object' && obj.id !== null) {
        const nested = obj.id as Record<string, unknown>;
        if (typeof nested.id === 'string') {
          return this.recordIdFromString(nested.id);
        }
      }
    }

    if (typeof value === 'string') {
      return this.recordIdFromString(value);
    }

    return value;
  }

  private recordIdFromString(value: string): RecordId | string {
    const trimmed = value.trim();
    if (!trimmed) return value;

    const { tableName, recordId } = this.parseTableWithId(trimmed);
    if (!recordId) return value;
    if (!tableName) return value;

    return new RecordId(tableName, recordId);
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  private tryCreateDateTime(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    try {
      if (typeof value === 'string') return new DateTime(value);
      if (typeof value === 'number') return new DateTime(value);
      return value;
    } catch {
      return value;
    }
  }
}
