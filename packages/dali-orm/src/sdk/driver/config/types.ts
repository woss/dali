/**
 * Config Module Types
 *
 * Type definitions for the config file system supporting
 * DaliORM remote connections via configuration files.
 */

// AuthType imported for ValidatedAuth compatibility
import type { AuthType } from '../types.js';

// Inferred types from Valibot schemas (Parse, Don't Validate)
export type { ConfigAuth, DriverOptions, OrmConfig } from './schema.js';

// ============================================================================
// Core Config Types
// ============================================================================

/**
 * Supported config file names (without extension)
 */
export const CONFIG_FILE_NAMES = ['.dali-orm', 'dali-orm.config', 'dali-orm'] as const;

/**
 * Supported config file extensions
 */
export const CONFIG_EXTENSIONS = ['.json', '.jsonc', '.ts'] as const;

/**
 * Driver-specific options for config file
 */
export interface ConfigDriverOptions {
  /** WebSocket driver options */
  ws?: {
    /** Ping interval in milliseconds */
    pingInterval?: number;
    /** Ping timeout in milliseconds */
    pingTimeout?: number;
  };

  /** HTTP driver options */
  http?: {
    /** Enable strict mode for HTTP requests */
    strict?: boolean;
    /** Request timeout in milliseconds */
    timeout?: number;
  };
}

// ============================================================================
// Parsed/Validated Config Types
// ============================================================================

/**
 * Validated auth config with proper typing
 * Used internally after parsing and validation
 * Uses SDK field names: username/password
 */
export interface ValidatedAuth {
  type: AuthType;
  username?: string;
  password?: string;
  namespace?: string;
  database?: string;
  access?: string;
  variables?: Record<string, unknown>;
}

/**
 * Validated driver options
 */
export interface ValidatedDriverOptions {
  ws?: {
    pingInterval?: number;
    pingTimeout?: number;
  };
  http?: {
    strict?: boolean;
    timeout?: number;
  };
}

/**
 * Validated ORM configuration
 * Guaranteed to be well-formed after parsing
 */
export interface ValidatedOrmConfig {
  url: string;
  namespace: string;
  database: string;
  auth?: ValidatedAuth;
  driver?: ValidatedDriverOptions;
  migrations?: {
    dir: string;
    table?: string;
  };
  schema?: {
    dir: string;
    pattern: string;
  };
}

// ============================================================================
// Loader Types
// ============================================================================

/**
 * Options for the config loader
 */
export interface LoadConfigOptions {
  /** Explicit config file path (bypasses search) */
  path?: string;
  /** Working directory to search from (default: process.cwd()) */
  cwd?: string;
  /** Skip config file existence check */
  skipExistenceCheck?: boolean;
}

/**
 * Result of loading a config file
 */
export interface LoadConfigResult {
  /** The loaded and validated config */
  config: ValidatedOrmConfig;
  /** Absolute path to the config file */
  path: string;
  /** Whether config was loaded from cache */
  cached: boolean;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation error with path information
 */
export interface ValidationError {
  /** JSON path to the invalid property */
  path: string;
  /** Error message */
  message: string;
  /** Expected value or constraint */
  expected?: string;
  /** Actual value that failed validation */
  actual?: unknown;
}

/**
 * Result of schema validation
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Whether the data was successfully typed/parsed */
  typed?: boolean;
  /** Validation errors if any */
  errors: ValidationError[];
}

/**
 * Config file format detection result
 */
export interface ConfigFileFormat {
  /** Detected format type */
  type: 'json' | 'jsonc' | 'typescript';
  /** Path to the config file */
  path: string;
  /** Whether the file exists */
  exists: boolean;
}
