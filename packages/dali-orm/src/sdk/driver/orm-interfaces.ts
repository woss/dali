/**
 * SurrealORM Interfaces and Types
 */

import type { CodecOptions, ReconnectOptions } from './types.js';

/**
 * Check if the URL is using HTTP (not WebSocket)
 * HTTP connections do not support transactions or live queries
 */
export function isHttpProtocol(url: string | undefined): boolean {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Configuration for creating a SurrealORM instance
 */
export interface SurrealORMConfig {
  /** Node driver configuration (remote connection) */
  nodeDriver?: import('./types.js').DriverConfig;

  /** Embedded driver configuration (in-process SurrealDB) */
  embeddedDriver?: import('./types.js').EmbeddedConfig;

  /** Configuration file loading options */
  config?: boolean | string | import('./config/types.js').OrmConfig;

  /** Codec options for value encoding/decoding */
  codecOptions?: CodecOptions;

  /** Reconnect options for automatic reconnection */
  reconnect?: boolean | ReconnectOptions;

  /** Schema definition for table/column metadata */
  schema?: import('../orm-schema.js').OrmSchema;
}
