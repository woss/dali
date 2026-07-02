/**
 * Node.js Driver for SurrealDB
 *
 * Extends BaseDriver with remote connection capabilities using @surrealdb/node.
 * Handles connection lifecycle, authentication, and environment configuration.
 */
import { createDebug as debug } from 'obug';

import {
  type AccessRecordAuth,
  type AnyAuth,
  createRemoteEngines,
  type DatabaseAuth,
  type NamespaceAuth,
  type RootAuth,
  type SystemAuth,
  Surreal,
} from 'surrealdb';
import { BaseDriver } from './base-driver.js';
import type { ConfigAuth } from './config/types.js';
import type { DriverConfig } from './types.js';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_URL = process.env.SURREALDB_URL || '';
const DEFAULT_NAMESPACE = process.env.SURREALDB_NAMESPACE || 'test';
const DEFAULT_DATABASE = process.env.SURREALDB_DATABASE || 'test';

const log = debug('dali-orm:kit:driver:node');
const connectLog = log.extend('connect');

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a SurrealDB client instance.
 * Injectable for testing via constructor parameter.
 */
export function createSurrealClient(): Surreal {
  return new Surreal({
    engines: createRemoteEngines(),
  });
}

/**
 * Internal config type with defaults applied
 */
interface NodeDriverConfig {
  driver: 'node';
  url: string;
  namespace: string;
  database: string;
  auth: ConfigAuth | undefined;
  debug: boolean;
  reconnect?: boolean | import('./types.js').ReconnectOptions;
}

/**
 * Type for injectable SurrealDB client factory
 */
export type SurrealClientFactory = () => Surreal;

export class NodeDriver extends BaseDriver {
  // Satisfies BaseDriver's `protected abstract db: Surreal`
  protected db: Surreal;

  private readonly _config: NodeDriverConfig;
  private accessToken: string | null = null;

  /**
   * Get the driver configuration
   */
  get config(): DriverConfig {
    return this._config;
  }

  /**
   * Get the stored access token
   */
  getToken(): string | null {
    return this.accessToken;
  }

  /**
   * Create a new NodeDriver instance
   *
   * Configuration priority:
   * 1. Explicit config value
   * 2. Environment variable (SURREALDB_*)
   * 3. Default value
   */
  constructor(
    config: DriverConfig = { driver: 'node' },
    clientFactory: SurrealClientFactory = createSurrealClient,
  ) {
    super();

    const envUser = process.env.SURREALDB_USER;
    const envPass = process.env.SURREALDB_PASS;
    const envNamespace = process.env.SURREALDB_NAMESPACE;
    const envDatabase = process.env.SURREALDB_DATABASE;

    let auth: ConfigAuth | undefined = config.auth;
    if (!auth && (envUser || envPass)) {
      auth = {
        type: 'root',
        username: envUser ?? '',
        password: envPass ?? '',
      };
    }

    const url = config.url ?? process.env.SURREALDB_URL ?? DEFAULT_URL;

    if (!url) {
      throw new Error(
        'SURREALDB_URL is required. Pass via config.url or set SURREALDB_URL environment variable.',
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid SURREALDB_URL: ${url}. Must be a valid URL.`);
    }

    this._config = {
      driver: 'node',
      url,
      namespace: config.namespace ?? envNamespace ?? DEFAULT_NAMESPACE,
      database: config.database ?? envDatabase ?? DEFAULT_DATABASE,
      auth,
      debug: config.debug ?? false,
      reconnect: config.reconnect,
    };

    this.db = clientFactory();
  }

  /**
   * Establish connection to the SurrealDB instance
   */
  async connect(): Promise<void> {
    if (this.connected) {
      connectLog('Already connected');
      return;
    }

    try {
      // Ensure WebSocket URL has /rpc suffix for SurrealDB protocol
      let connectUrl = this._config.url;
      if (connectUrl.startsWith('ws://') || connectUrl.startsWith('wss://')) {
        if (!connectUrl.endsWith('/rpc')) {
          connectUrl = `${connectUrl.replace(/\/$/, '')}/rpc`;
        }
      }

      const auth = this._config.auth;
      const authType = auth?.type;
      const isSystemAuth =
        authType === 'root' || authType === 'namespace' || authType === 'database';

      // Build connect options with defaults
      const opts: Record<string, unknown> = {
        namespace: this._config.namespace,
        database: this._config.database,
      };

      // Forward reconnect config (if explicitly set)
      if (this._config.reconnect !== undefined) {
        opts.reconnect = this._config.reconnect;
      }

      // For system auth: pass authentication directly in connect options
      // This persists across SDK auto-reconnections (session-level signin() does NOT)
      if (isSystemAuth && auth) {
        opts.authentication = this.buildSystemAuth(auth);
      }

      await this.db.connect(connectUrl, opts);
      await this.db.ready;

      if (isSystemAuth && auth) {
        // Auth handled via ConnectOptions — SDK manages token internally
        this.accessToken = null;
      } else if (authType === 'record' && auth) {
        // Record auth: must use NS/DB first, then signin
        await this.db.use({
          namespace: this._config.namespace,
          database: this._config.database,
        });
        const tokens = await this.db.signin(this.buildSigninObject(auth));
        this.accessToken = tokens.access ?? null;
      } else if (!auth) {
        // No auth: NS/DB already set via connect options, nothing else needed
        // SDK manages connection without auth
      }

      this.connected = true;
      connectLog(
        'Connected to SurrealDB at %s (namespace: %s, database: %s)',
        this._config.url,
        this._config.namespace,
        this._config.database,
      );
    } catch (error) {
      this.connected = false;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to connect to SurrealDB at ${this._config.url}: ${message}`);
    }
  }

  getUrl(): string {
    return this._config.url;
  }

  /**
   * Sign in with credentials
   */
  async signin(credentials: unknown): Promise<string> {
    if (!this.connected) {
      throw new Error('Not connected to SurrealDB');
    }

    const tokens = await this.db.signin(this.buildSigninObject(credentials));
    this.accessToken = tokens.access ?? null;
    return tokens.access;
  }

  /**
   * Sign up for a new user account (record auth only)
   */
  async signup(credentials: unknown): Promise<string> {
    if (!this.connected) {
      throw new Error('Not connected to SurrealDB');
    }

    const tokens = await this.db.signup(this.buildSigninObject(credentials) as AccessRecordAuth);
    return tokens.access;
  }

  /**
   * Authenticate with an existing token
   */
  async authenticate(
    token: string | { access: string; refresh?: string },
  ): Promise<{ access: string; refresh?: string }> {
    if (!this.connected) {
      throw new Error('Not connected to SurrealDB');
    }

    try {
      const result = await this.db.authenticate(token as never);
      return result as { access: string; refresh?: string };
    } catch (error) {
      throw new Error(
        `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Convert ConfigAuth to SDK SystemAuth for ConnectOptions.authentication.
   * Strips the 'type' discriminator to match RootAuth | NamespaceAuth | DatabaseAuth.
   */
  private buildSystemAuth(auth: ConfigAuth): SystemAuth {
    switch (auth.type) {
      case 'root':
        return { username: auth.username, password: auth.password };
      case 'namespace':
        return { namespace: auth.namespace, username: auth.username, password: auth.password };
      case 'database':
        return {
          namespace: auth.namespace,
          database: auth.database,
          username: auth.username,
          password: auth.password,
        };
      default:
        throw new Error(`Unsupported system auth type: ${auth.type}`);
    }
  }

  /**
   * Build signin object based on auth type.
   * Falls back to driver config for namespace/database when not provided.
   */
  private buildSigninObject(auth: unknown): AnyAuth {
    const a = auth as Record<string, unknown>;

    switch (a.type) {
      case 'root': {
        return {
          username: a.username as string,
          password: a.password as string,
        } satisfies RootAuth;
      }

      case 'namespace': {
        return {
          namespace: a.namespace as string,
          username: a.username as string,
          password: a.password as string,
        } satisfies NamespaceAuth;
      }

      case 'database': {
        return {
          namespace: a.namespace as string,
          database: a.database as string,
          username: a.username as string,
          password: a.password as string,
        } satisfies DatabaseAuth;
      }

      case 'record': {
        return {
          namespace: (a.namespace as string) ?? this._config.namespace,
          database: (a.database as string) ?? this._config.database,
          access: a.access as string,
          variables: (a.variables as Record<string, unknown>) ?? {},
        } satisfies AccessRecordAuth;
      }
    }

    throw new Error(`Unknown auth type: ${(auth as { type: string }).type}`);
  }
}
