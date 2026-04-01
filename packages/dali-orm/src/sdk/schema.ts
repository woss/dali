import { array, boolean, literal, number, object, optional, string, union } from 'valibot';
import type { TableDefinition } from './table.js';

// =============================================================================
// ACCESS DEFINITION
// =============================================================================

/**
 * Access type for SurrealDB access definitions
 */
export type AccessType = 'RECORD' | 'JWT' | 'OIDC';

/**
 * AccessConfig schema using valibot
 * Defines the configuration structure for access definitions
 */
export const AccessConfigSchema = object({
  name: string(),
  type: union([literal('RECORD'), literal('JWT'), literal('OIDC')]),
  table: optional(string()),
  signup: optional(string()),
  signin: optional(string()),
  identifier: optional(string()),
  algorithm: optional(string()),
  key: optional(string()),
  issuer: optional(string()),
  duration: optional(string()),
  tokenDuration: optional(string()),
});

export type AccessConfig = {
  name: string;
  type: 'RECORD' | 'JWT' | 'OIDC';
  /** Table name to auto-generate signup/signin from */
  table?: string;
  /** Custom signup SQL override */
  signup?: string;
  /** Custom signin SQL override */
  signin?: string;
  /** Custom identifier column for authentication (email, username, phone, etc.) */
  identifier?: string;
  /** JWT algorithm */
  algorithm?: 'HS256' | 'HS512';
  /** JWT key */
  key?: string;
  /** JWT issuer */
  issuer?: string;
  /** Session duration (e.g., '7d', '1h') */
  duration?: string;
  /** Token duration (e.g., '1h', '7d') - for DURATION FOR TOKEN */
  tokenDuration?: string;
};

/**
 * Generate SET clause from table columns for signup
 * Extracts required (non-optional) columns to include in INSERT statement
 */
export function generateSignupFromTable(table: TableDefinition): string {
  if (!table) {
    throw new Error('Table definition is required');
  }

  const requiredColumns = table.columns.filter((col) => {
    if (col.name === 'id') return false;
    if (col.name === 'created_at') return false;
    return !col.config.optional;
  });

  if (requiredColumns.length === 0) {
    throw new Error(`Table '${table.name}' has no required columns for signup`);
  }

  const setParts = requiredColumns.map((col) => {
    // this is a bit of a heuristic to identify password fields - looking for common names like 'password', 'pass', 'password_hash'
    const passwordCol =
      table.columns.find(
        (c) => c.name === 'password_hash' || c.name === 'pass' || c.name === 'password',
      )?.name ?? 'password';
    if (col.name === passwordCol) {
      return `${passwordCol} = crypto::argon2::generate($${passwordCol})`;
    }
    return `${col.name} = $${col.name}`;
  });
  return setParts.join(', ');
}

/**
 * Generate SIGNUP SQL from table
 */
export function generateSignupFromSQL(tableName: string, table: TableDefinition): string {
  const setClause = generateSignupFromTable(table);
  return `CREATE ${tableName} SET ${setClause}`;
}

/**
 * Generate SIGNIN SQL from table
 */
export function generateSigninFromSQL(
  tableName: string,
  table: TableDefinition,
  identifier?: string,
): string {
  if (!table) {
    throw new Error('Table definition is required');
  }

  const passwordCol =
    table.columns.find(
      (c) => c.name === 'password_hash' || c.name === 'pass' || c.name === 'password',
    )?.name ?? 'password';

  const explicitIdentifier = identifier;
  if (explicitIdentifier) {
    return `SELECT * FROM ${tableName} WHERE ${explicitIdentifier} = $${explicitIdentifier} AND crypto::argon2::compare(${passwordCol}, $${passwordCol})`;
  }

  const authColumn = table.columns.find(
    (col) => col.name === 'identifier' || col.name === 'email' || col.name === 'username',
  );

  const identifierCol = authColumn?.name ?? table.columns[0]?.name ?? 'identifier';
  if (!identifierCol) {
    throw new Error(`Table '${tableName}' has no columns for signin identifier`);
  }

  return `SELECT * FROM ${tableName} WHERE ${identifierCol} = $${identifierCol} AND crypto::argon2::compare(${passwordCol}, $${passwordCol})`;
}

/**
 * Generate SQL from AccessConfig
 */
export function accessToSQL(
  config: AccessConfig,
  tables?: Record<string, TableDefinition>,
): string {
  if (!config) {
    throw new Error('AccessConfig is required');
  }

  const parts = [`DEFINE ACCESS ${config.name} ON DATABASE TYPE ${config.type}`];

  let signup = config.signup;
  if (!signup && config.table && tables) {
    const table = tables[config.table];
    if (table) {
      signup = generateSignupFromSQL(config.table, table);
    }
  }
  if (signup) parts.push(`SIGNUP (${signup})`);

  let signin = config.signin;
  if (!signin && config.table && tables) {
    const table = tables[config.table];
    if (table) {
      signin = generateSigninFromSQL(config.table, table, config.identifier);
    }
  }
  if (signin) parts.push(`SIGNIN (${signin})`);

  if (config.algorithm) parts.push(`ALGORITHM ${config.algorithm}`);
  if (config.key) parts.push(`KEY "${config.key}"`);
  if (config.issuer) parts.push(`ISSUER ${config.issuer}`);
  if (config.duration || config.tokenDuration) {
    const durationParts = [];
    if (config.tokenDuration) durationParts.push(`FOR TOKEN ${config.tokenDuration}`);
    if (config.duration) durationParts.push(`FOR SESSION ${config.duration}`);
    parts.push(`DURATION ${durationParts.join(', ')}`);
  }

  return parts.join(' ');
}

// =============================================================================
// FUNCTION DEFINITION
// =============================================================================

/**
 * Function configuration for SurrealDB function definitions
 */
export type FunctionConfig = {
  name: string;
  args?: string[];
  body: string;
  comment?: string;
  permissions?: string;
};

/**
 * FunctionConfig schema using valibot
 * Defines the configuration structure for SurrealDB function definitions
 */
export const FunctionConfigSchema = object({
  name: string(),
  args: optional(array(string())),
  body: string(),
  comment: optional(string()),
  permissions: optional(string()),
});

/**
 * Generate SQL from FunctionConfig
 */
export function functionToSQL(config: FunctionConfig): string {
  if (!config) throw new Error('FunctionConfig is required');
  if (!config.name) throw new Error('Function name is required');
  if (!config.body) throw new Error('Function body is required');

  const parts: string[] = [`DEFINE FUNCTION IF NOT EXISTS ${config.name}`];

  if (config.args && config.args.length > 0) {
    parts.push(`(${config.args.join(', ')})`);
  }

  parts.push(`{ ${config.body} }`);

  if (config.comment) {
    parts.push(`COMMENT "${config.comment}"`);
  }

  if (config.permissions) {
    parts.push(`PERMISSIONS ${config.permissions}`);
  }

  return parts.join(' ');
}

// =============================================================================
// EVENT DEFINITION
// =============================================================================

/**
 * Event configuration for SurrealDB event definitions
 */
export type EventConfig = {
  name: string;
  on: string;
  when: string;
  then: string[];
  comment?: string;
  async?: boolean;
  retry?: number;
  maxdepth?: number;
};

/**
 * EventConfig schema using valibot
 * Defines the configuration structure for SurrealDB event definitions
 */
export const EventConfigSchema = object({
  name: string(),
  on: string(),
  when: string(),
  then: array(string()),
  comment: optional(string()),
  async: optional(boolean()),
  retry: optional(number()),
  maxdepth: optional(number()),
});

/**
 * Generate SQL from EventConfig
 */
export function eventToSQL(config: EventConfig): string {
  if (!config) throw new Error('EventConfig is required');
  if (!config.name) throw new Error('Event name is required');
  if (!config.on) throw new Error('Event table (on) is required');
  if (!config.when) throw new Error('Event condition (when) is required');
  if (!config.then || config.then.length === 0) throw new Error('Event action (then) is required');

  const parts = [
    `DEFINE EVENT IF NOT EXISTS ${config.name} ON TABLE ${config.on} WHEN (${config.when}) THEN { ${config.then.join('; ')} }`,
  ];

  if (config.comment) parts.push(`COMMENT "${config.comment}"`);
  if (config.async) parts.push('ASYNC');
  if (config.retry !== undefined) parts.push(`RETRY ${config.retry}`);
  if (config.maxdepth !== undefined) parts.push(`MAXDEPTH ${config.maxdepth}`);

  return parts.join(' ');
}
