/**
 * Base Driver for SurrealDB
 *
 * Thin wrapper around SurrealDB SDK.
 * Parses inputs at boundaries (Parse, Don't Validate).
 * Delegates directly to SDK for all CRUD operations.
 */
import { type Surreal } from 'surrealdb';
import type { OrmSchema } from '../orm-schema.js';
import type {
  DriverConfig,
  EmbeddedConfig,
  LiveData,
  LiveQueryOptions,
  LiveSubscriptionHandle,
  SurrealDriver,
  Transaction,
} from './types.js';
export declare abstract class BaseDriver implements SurrealDriver {
  protected abstract db: Surreal;
  protected connected: boolean;
  protected subscriptions: Map<
    string,
    {
      created: number;
      liveSubscription?: unknown;
    }
  >;
  schema?: OrmSchema;
  protected warn(message: string): void;
  /**
   * Transform datetime values in data.
   * Protected wrapper to allow polymorphism (embedded driver overrides for recursive transformation).
   */
  protected transformDatetimeValues(obj: unknown): unknown;
  abstract connect(): Promise<void>;
  abstract getUrl(): string;
  abstract signin(credentials: unknown): Promise<string>;
  abstract signup(credentials: unknown): Promise<string>;
  abstract authenticate(token: unknown): Promise<{
    access: string;
    refresh?: string;
  }>;
  abstract get config(): DriverConfig | EmbeddedConfig;
  isConnected(): boolean;
  disconnect(): Promise<void>;
  query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T[]>;
  showChanges<T = unknown>(
    table: string,
    options?: {
      since?: string | number;
      limit?: number;
    },
  ): Promise<T[]>;
  select<T = unknown>(table: string): Promise<T[]>;
  create<T = unknown>(table: string, data: unknown): Promise<T[]>;
  insert<T = unknown>(table: string, data: unknown): Promise<T[]>;
  update<T = unknown>(table: string, data: unknown): Promise<T[]>;
  delete<T = unknown>(table: string): Promise<T[]>;
  upsert<T = unknown>(table: string, data: unknown): Promise<T[]>;
  upsertWhere<T = unknown>(
    table: string,
    whereClause: string,
    data: unknown,
  ): Promise<T[]>;
  relate<T = unknown>(
    from: string,
    edge: string,
    to: string,
    data?: unknown,
  ): Promise<T[]>;
  transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  use(namespace: string, database: string): Promise<void>;
  invalidate(): Promise<void>;
  auth(): Promise<Record<string, unknown> | null>;
  live<T>(
    table: string,
    callback: (data: LiveData<T>) => void,
  ): Promise<string>;
  liveWithOptions<T = unknown>(
    table: string,
    options?: LiveQueryOptions,
  ): Promise<LiveSubscriptionHandle<T>>;
  kill(subscriptionId: string): Promise<void>;
}
//# sourceMappingURL=base-driver.d.ts.map
