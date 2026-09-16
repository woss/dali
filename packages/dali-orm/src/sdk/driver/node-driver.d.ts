import { Surreal } from 'surrealdb';
import { BaseDriver } from './base-driver.js';
import type { DriverConfig } from './types.js';
/**
 * Create a SurrealDB client instance.
 * Injectable for testing via constructor parameter.
 */
export declare function createSurrealClient(): Surreal;
/**
 * Type for injectable SurrealDB client factory
 */
export type SurrealClientFactory = () => Surreal;
export declare class NodeDriver extends BaseDriver {
  protected db: Surreal;
  private readonly _config;
  private accessToken;
  /**
   * Get the driver configuration
   */
  get config(): DriverConfig;
  /**
   * Get the stored access token
   */
  getToken(): string | null;
  /**
   * Create a new NodeDriver instance
   *
   * Configuration priority:
   * 1. Explicit config value
   * 2. Environment variable (SURREALDB_*)
   * 3. Default value
   */
  constructor(config?: DriverConfig, clientFactory?: SurrealClientFactory);
  /**
   * Establish connection to the SurrealDB instance
   */
  connect(): Promise<void>;
  getUrl(): string;
  /**
   * Sign in with credentials
   */
  signin(credentials: unknown): Promise<string>;
  /**
   * Sign up for a new user account (record auth only)
   */
  signup(credentials: unknown): Promise<string>;
  /**
   * Authenticate with an existing token
   */
  authenticate(
    token:
      | string
      | {
          access: string;
          refresh?: string;
        },
  ): Promise<{
    access: string;
    refresh?: string;
  }>;
  /**
   * Convert ConfigAuth to SDK SystemAuth for ConnectOptions.authentication.
   * Strips the 'type' discriminator to match RootAuth | NamespaceAuth | DatabaseAuth.
   */
  private buildSystemAuth;
  /**
   * Build signin object based on auth type.
   * Falls back to driver config for namespace/database when not provided.
   */
  private buildSigninObject;
}
//# sourceMappingURL=node-driver.d.ts.map
