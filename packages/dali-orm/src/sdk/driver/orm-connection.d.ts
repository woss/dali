import type { DriverConfig, EmbeddedConfig, SurrealDriver } from './types.js';
/**
 * Resolve driver options from config and explicit options
 * Priority: explicit options > config file
 */
export declare function resolveDriverOptions(
  explicitOptions: DriverConfig | EmbeddedConfig,
  configFromFile:
    | {
        url: string;
        namespace: string;
        database: string;
        auth?: unknown;
      }
    | undefined,
): DriverConfig | EmbeddedConfig;
/**
 * Connect and return SurrealDriver directly
 */
export declare function connect(
  config: import('./orm-interfaces.js').SurrealORMConfig,
): Promise<SurrealDriver>;
/**
 * Execute a query object (with toSQL/toParams) and return results
 */
export declare function execute(
  driver: SurrealDriver,
  queryObj: {
    toSQL(): string;
    toParams?(): Record<string, unknown>;
  },
): Promise<unknown[]>;
/**
 * Show changes for a table since a given point
 */
export declare function showChanges<T = unknown>(
  driver: SurrealDriver,
  table: string,
  options?: {
    since?: string | number;
    limit?: number;
  },
): Promise<T[]>;
//# sourceMappingURL=orm-connection.d.ts.map
