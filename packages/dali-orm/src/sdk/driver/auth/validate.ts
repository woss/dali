/**
 * Auth Validation
 *
 * Validation logic for auth configuration using valibot.
 * Follows Parse, Don't Validate principle - parses at boundary
 * into trusted typed output.
 */

import {
  literal,
  object,
  optional,
  parse,
  record,
  string,
  union,
  unknown,
} from 'valibot';

// ============================================================================
// Valibot Schemas for Each Auth Type
// ============================================================================

/**
 * Root auth schema - full access to all namespaces/databases
 */
const RootAuthSchema = object({
  type: literal('root'),
  username: string('Root auth requires username field'),
  password: string('Root auth requires password field'),
});

/**
 * Namespace auth schema - access to all databases in a namespace
 */
const NamespaceAuthSchema = object({
  type: literal('namespace'),
  username: string('Namespace auth requires username field'),
  password: string('Namespace auth requires password field'),
  namespace: string('Namespace auth requires namespace field'),
});

/**
 * Database auth schema - access scoped to a specific database
 */
const DatabaseAuthSchema = object({
  type: literal('database'),
  username: string('Database auth requires username field'),
  password: string('Database auth requires password field'),
  namespace: string('Database auth requires namespace field'),
  database: string('Database auth requires database field'),
});

/**
 * Record auth schema - access through a defined access method
 */
const RecordAuthSchema = object({
  type: literal('record'),
  namespace: string('Record auth requires namespace field'),
  database: string('Record auth requires database field'),
  access: string('Record auth requires access field'),
  variables: optional(record(string(), unknown())),
});

export const AuthConfigSchema = union([
  RootAuthSchema,
  NamespaceAuthSchema,
  DatabaseAuthSchema,
  RecordAuthSchema,
]);

export type ValidatedAuthConfig =
  | { type: 'root'; username: string; password: string }
  | { type: 'namespace'; username: string; password: string; namespace: string }
  | {
      type: 'database';
      username: string;
      password: string;
      namespace: string;
      database: string;
    }
  | {
      type: 'record';
      namespace: string;
      database: string;
      access: string;
      variables?: Record<string, unknown>;
    };

// ============================================================================
// Validation Result
// ============================================================================

/**
 * Validation error detail
 */
export interface AuthValidationErrorDetail {
  field: string;
  message: string;
  expected?: string;
}

/**
 * Result of auth config validation
 */
export interface AuthValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Parsed and validated auth config */
  data?: ValidatedAuthConfig;
  /** Validation errors if failed */
  errors?: AuthValidationErrorDetail[];
}

// ============================================================================
// Validation Function
// ============================================================================

/**
 * Determine auth type from config based on fields present
 * Defaults to 'root' if type not specified
 */
export function determineAuthType(config: unknown): string {
  if (typeof config !== 'object' || config === null) {
    return 'root';
  }

  const obj = config as Record<string, unknown>;

  if (obj.type === undefined || obj.type === null) {
    // Infer type from fields present
    if (typeof obj.access === 'string' && obj.access.trim() !== '') {
      return 'record';
    }
    if (typeof obj.database === 'string' && obj.database.trim() !== '') {
      return 'database';
    }
    if (typeof obj.namespace === 'string' && obj.namespace.trim() !== '') {
      return 'namespace';
    }
    return 'root';
  }

  return typeof obj.type === 'string' ? obj.type : String(obj.type as string);
}

/**
 * Add default type to config if not present
 */
export function normalizeConfig(config: unknown): Record<string, unknown> {
  if (typeof config !== 'object' || config === null) {
    return { type: 'root' };
  }

  const obj = config as Record<string, unknown>;

  // If type is already specified, return as-is
  if (obj.type !== undefined && obj.type !== null) {
    return obj;
  }

  // Determine and add default type
  const determinedType = determineAuthType(config);
  return { ...obj, type: determinedType };
}

/**
 * Validate and parse auth configuration using valibot.
 * Follows Parse, Don't Validate - parses unknown input into
 * typed/validated ValidatedAuthConfig.
 *
 * @param config - Unknown input to validate
 * @returns Validation result with parsed data or errors
 *
 * @example
 * ```typescript
 * const result = validateAuthConfig({ type: 'root', username: 'root', password: 'secret' });
 * if (result.valid) {
 *   console.log('Valid auth config:', result.data);
 * } else {
 *   console.error('Validation failed:', result.errors);
 * }
 * ```
 */
export function validateAuthConfig(config: unknown): AuthValidationResult {
  // Guard: null/undefined input
  if (config === null || config === undefined) {
    return {
      valid: false,
      errors: [
        {
          field: 'config',
          message: 'Auth config is required',
          expected: 'object with auth credentials',
        },
      ],
    };
  }

  try {
    // Normalize: add default type if not specified
    const normalizedConfig = normalizeConfig(config) as Record<string, unknown>;
    const parsed = parse(AuthConfigSchema, normalizedConfig);
    return { valid: true, data: parsed as ValidatedAuthConfig };
  } catch (error) {
    const errors = convertValibotErrors(error);
    return { valid: false, errors };
  }
}

/**
 * Convert valibot error to our format
 */
export function convertValibotErrors(
  error: unknown,
): AuthValidationErrorDetail[] {
  if (!(error instanceof Error)) {
    return [{ field: 'unknown', message: String(error) }];
  }

  const errorMessage = error.message;

  // Valibot errors contain path and message
  // Format: "Validation failed: At path X, ..."
  const errors: AuthValidationErrorDetail[] = [];
  const pathMatch = errorMessage.match(/at path "([^"]+)"/i);

  if (pathMatch) {
    const field = pathMatch[1];
    errors.push({
      field,
      message: extractMessage(errorMessage, field),
    });
  } else {
    // If no path found, return generic error
    errors.push({
      field: 'config',
      message: errorMessage,
    });
  }

  return errors;
}

/**
 * Extract clean error message from valibot output
 */
function extractMessage(fullMessage: string, field: string): string {
  // Try to extract the specific error message after the path
  const pathIndex = fullMessage
    .toLowerCase()
    .indexOf(`at path "${field}"`.toLowerCase());
  if (pathIndex === -1) {
    return fullMessage;
  }

  // Find the next period or end of message
  const afterPath = fullMessage.substring(pathIndex);
  const periodIndex = afterPath.indexOf('. ');
  if (periodIndex === -1) {
    return fullMessage;
  }

  const message = afterPath.substring(periodIndex + 1).trim();
  return message || fullMessage;
}
