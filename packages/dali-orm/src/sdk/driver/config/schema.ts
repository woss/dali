/**
 * Schema Validation Utilities
 *
 * Provides validation using Valibot with custom error formatting
 * for clear validation messages.
 */

import {
  boolean,
  type InferInput,
  literal,
  number,
  object,
  optional,
  record,
  safeParse,
  string,
  union,
  unknown,
} from 'valibot';

import type { AuthType } from '../types.js';
import type {
  ValidatedAuth,
  ValidatedDriverOptions,
  ValidatedOrmConfig,
  ValidationError,
  ValidationResult,
} from './types.js';

// ============================================================================
// Valibot Schemas
// ============================================================================

// Auth type union schemas
// Uses username/password to match SurrealDB SDK field names
const RootAuthSchema = object({
  type: literal('root'),
  username: string(),
  password: string(),
});

const NamespaceAuthSchema = object({
  type: literal('namespace'),
  username: string(),
  password: string(),
  namespace: string(),
});

const DatabaseAuthSchema = object({
  type: literal('database'),
  username: string(),
  password: string(),
  namespace: string(),
  database: string(),
});

const RecordAuthSchema = object({
  type: literal('record'),
  namespace: string(),
  database: string(),
  access: string(),
  variables: optional(record(string(), unknown())),
});

// Union of all auth types
const AuthConfigSchema = union([
  RootAuthSchema,
  NamespaceAuthSchema,
  DatabaseAuthSchema,
  RecordAuthSchema,
]);

// WebSocket driver options
const WsOptionsSchema = object({
  pingInterval: optional(number()),
  pingTimeout: optional(number()),
});

// HTTP driver options
const HttpOptionsSchema = object({
  strict: optional(boolean()),
  timeout: optional(number()),
});

// Driver options
const DriverOptionsSchema = object({
  ws: optional(WsOptionsSchema),
  http: optional(HttpOptionsSchema),
});

// Main config schema
const OrmConfigSchema = object({
  url: string(),
  namespace: string(),
  database: string(),
  auth: optional(AuthConfigSchema),
  driver: optional(DriverOptionsSchema),
  migrations: optional(
    object({
      dir: string(),
      table: optional(string()),
    }),
  ),
  schema: optional(
    object({
      dir: string(),
      pattern: string(),
    }),
  ),
});

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Format Valibot issues into readable ValidationError objects
 */
function formatErrors(
  issues: { path?: { key?: unknown }[]; message: string }[],
): ValidationError[] {
  return issues.map((issue) => {
    const segments: string[] = [];
    const pathItems = issue.path ?? [];
    for (const p of pathItems) {
      if (
        p.key !== undefined &&
        (typeof p.key === 'string' || typeof p.key === 'number')
      ) {
        segments.push(String(p.key));
      }
    }

    const path = segments.length > 0 ? `/${segments.join('/')}` : '/';

    return {
      path,
      message: issue.message,
      expected: undefined,
      actual: undefined,
    };
  });
}

/**
 * Validate a raw config object against the Valibot schema
 *
 * @param data - Raw config object to validate
 * @returns Validation result with errors if validation failed
 *
 * @example
 * ```typescript
 * const result = validateConfig({
 *   url: 'ws://localhost:8000',
 *   namespace: 'test',
 *   database: 'test',
 * });
 *
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors);
 * }
 * ```
 */
export function validateConfig(data: unknown): ValidationResult {
  // Early exit: null/undefined input
  if (data === null || data === undefined) {
    return {
      valid: false,
      errors: [
        {
          path: '/',
          message: 'Configuration is required',
          expected: 'OrmConfig object',
          actual: data,
        },
      ],
    };
  }

  // Early exit: not an object
  if (typeof data !== 'object') {
    return {
      valid: false,
      errors: [
        {
          path: '/',
          message: 'Configuration must be an object',
          expected: 'OrmConfig object',
          actual: typeof data,
        },
      ],
    };
  }

  const t = safeParse(OrmConfigSchema, data);
  if (!t.success) {
    return {
      valid: false,
      typed: false,
      errors: formatErrors(t.issues),
    };
  }

  // Validate auth credentials: username/password required for root/namespace/database
  const auth = (data as Record<string, unknown>).auth;
  if (auth && typeof auth === 'object' && auth !== null) {
    const authObj = auth as Record<string, unknown>;
    const authType = authObj.type as string;

    if (
      authType === 'root' ||
      authType === 'namespace' ||
      authType === 'database'
    ) {
      const hasUsername =
        typeof authObj.username === 'string' && authObj.username !== '';
      const hasPassword =
        typeof authObj.password === 'string' && authObj.password !== '';
      if (!hasUsername || !hasPassword) {
        return {
          valid: false,
          typed: false,
          errors: [
            {
              path: '/auth',
              message: `Auth type '${authType}' requires username and password`,
              expected: 'username/password',
              actual: undefined,
            },
          ],
        };
      }
    }
  }

  return { valid: true, typed: true, errors: [] };
}

/**
 * Validate and parse a config object into a ValidatedOrmConfig
 *
 * @param data - Raw config object
 * @returns Parsed and validated config
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * const config = parseConfig({
 *   url: 'ws://localhost:8000',
 *   namespace: 'test',
 *   database: 'test',
 * });
 * ```
 */
export function parseConfig(data: OrmConfig): ValidatedOrmConfig {
  // Guard: Validate first
  const validation = validateConfig(data);

  if (!validation.valid) {
    const errorMessages = validation.errors
      .map((e) => `${e.path}: ${e.message}`)
      .join('; ');
    throw new Error(`Config validation failed: ${errorMessages}`);
  }

  const config = data as OrmConfig;

  // Parse and validate URL
  const url = parseUrl(config.url);

  // Parse auth if provided
  const auth = config.auth ? parseAuth(config.auth) : undefined;

  // Parse driver options if provided
  const driver = config.driver ? parseDriverOptions(config.driver) : undefined;

  return {
    url,
    namespace: config.namespace,
    database: config.database,
    auth,
    driver,
  };
}

// ============================================================================
// Parsing Helpers (Fail Fast)
// ============================================================================

/**
 * Parse and validate URL
 * @throws Error if URL is invalid
 */
export function parseUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Fail fast: only ws/wss/http/https protocols allowed
    if (!['ws:', 'wss:', 'http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(
        `Invalid protocol: ${parsed.protocol}. Must be ws://, wss://, http://, or https://`,
      );
    }

    return url;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid protocol')) {
      throw error;
    }
    throw new Error(`Invalid URL: ${url}`);
  }
}

/**
 * Parse and validate auth configuration
 */
export function parseAuth(auth: ConfigAuth): ValidatedAuth | undefined {
  if (!auth) {
    return undefined;
  }

  const validated: ValidatedAuth = {
    type: auth.type as AuthType,
  };

  switch (auth.type) {
    case 'root':
      validated.username = auth.username;
      validated.password = auth.password;
      break;

    case 'namespace':
      validated.username = auth.username;
      validated.password = auth.password;
      validated.namespace = auth.namespace;
      break;

    case 'database':
      validated.username = auth.username;
      validated.password = auth.password;
      validated.namespace = auth.namespace;
      validated.database = auth.database;
      break;

    case 'record':
      if (auth.namespace) {
        validated.namespace = auth.namespace;
      }
      if (auth.database) {
        validated.database = auth.database;
      }
      if (auth.access) {
        validated.access = auth.access;
      }
      if (auth.variables) {
        validated.variables = auth.variables;
      }
      break;
  }

  return validated;
}

/**
 * Parse and validate driver options
 */
export function parseDriverOptions(
  driver: OrmConfig['driver'],
): ValidatedDriverOptions | undefined {
  if (!driver) {
    return undefined;
  }

  const validated: ValidatedDriverOptions = {};

  if (driver.ws) {
    validated.ws = {};

    if (driver.ws.pingInterval !== undefined) {
      if (driver.ws.pingInterval < 1000) {
        throw new Error('WebSocket pingInterval must be at least 1000ms');
      }
      validated.ws.pingInterval = driver.ws.pingInterval;
    }

    if (driver.ws.pingTimeout !== undefined) {
      if (driver.ws.pingTimeout < 1000) {
        throw new Error('WebSocket pingTimeout must be at least 1000ms');
      }
      validated.ws.pingTimeout = driver.ws.pingTimeout;
    }
  }

  if (driver.http) {
    validated.http = {};

    if (driver.http.strict !== undefined) {
      validated.http.strict = driver.http.strict;
    }

    if (driver.http.timeout !== undefined) {
      if (driver.http.timeout < 1000) {
        throw new Error('HTTP timeout must be at least 1000ms');
      }
      validated.http.timeout = driver.http.timeout;
    }
  }

  return validated;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert validated auth to SurrealDB SDK signin format
 * Maps to SDK field names: username/password
 */
export function toAuthConfig(validated: ValidatedAuth): {
  type?: 'root' | 'namespace' | 'database' | 'record';
  username?: string;
  password?: string;
  namespace?: string;
  database?: string;
  access?: string;
  variables?: Record<string, unknown>;
} {
  return {
    type: validated.type,
    username: validated.username,
    password: validated.password,
    namespace: validated.namespace,
    database: validated.database,
    access: validated.access,
    variables: validated.variables,
  };
}

// ============================================================================
// Inferred Types (Parse, Don't Validate)
// ============================================================================

export type ConfigAuth = InferInput<typeof AuthConfigSchema>;
export type OrmConfig = InferInput<typeof OrmConfigSchema>;
export type DriverOptions = InferInput<typeof DriverOptionsSchema>;
