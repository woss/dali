import {
  array,
  boolean,
  literal,
  number,
  object,
  optional,
  string,
  union,
} from 'valibot';
import { SurrealQLGenerator } from '../migration/core/generator.js';
import type { SurrealSequence } from '../migration/ddl/ddl.js';
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
        (c) =>
          c.name === 'password_hash' ||
          c.name === 'pass' ||
          c.name === 'password',
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
export function generateSignupFromSQL(
  tableName: string,
  table: TableDefinition,
): string {
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
      (c) =>
        c.name === 'password_hash' ||
        c.name === 'pass' ||
        c.name === 'password',
    )?.name ?? 'password';

  const explicitIdentifier = identifier;
  if (explicitIdentifier) {
    return `SELECT * FROM ${tableName} WHERE ${explicitIdentifier} = $${explicitIdentifier} AND crypto::argon2::compare(${passwordCol}, $${passwordCol})`;
  }

  const authColumn = table.columns.find(
    (col) =>
      col.name === 'identifier' ||
      col.name === 'email' ||
      col.name === 'username',
  );

  const identifierCol =
    authColumn?.name ?? table.columns[0]?.name ?? 'identifier';
  if (!identifierCol) {
    throw new Error(
      `Table '${tableName}' has no columns for signin identifier`,
    );
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

  const parts = [
    `DEFINE ACCESS ${config.name} ON DATABASE TYPE ${config.type}`,
  ];

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
    if (config.tokenDuration)
      durationParts.push(`FOR TOKEN ${config.tokenDuration}`);
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
  if (!config.then || config.then.length === 0)
    throw new Error('Event action (then) is required');

  const parts = [
    `DEFINE EVENT IF NOT EXISTS ${config.name} ON TABLE ${config.on} WHEN (${config.when}) THEN { ${config.then.join('; ')} }`,
  ];

  if (config.comment) parts.push(`COMMENT "${config.comment}"`);
  if (config.async) parts.push('ASYNC');
  if (config.retry !== undefined) parts.push(`RETRY ${config.retry}`);
  if (config.maxdepth !== undefined) parts.push(`MAXDEPTH ${config.maxdepth}`);

  return parts.join(' ');
}

// =============================================================================
// FLUENT BUILDERS
// =============================================================================

export type AccessBuilder = ReturnType<typeof defineAccess>;

export function defineAccess(name: string) {
  if (!name) throw new Error('Access name is required');

  let config: {
    type?: 'RECORD' | 'JWT' | 'OIDC';
    table?: string;
    signup?: string;
    signin?: string;
    identifier?: string;
    algorithm?: 'HS256' | 'HS512';
    key?: string;
    issuer?: string;
    duration?: string;
    tokenDuration?: string;
  } = { type: 'RECORD' };

  return {
    get name() {
      return name;
    },
    type(type: AccessType) {
      config = { ...config, type };
      return this;
    },
    table(tableName: string) {
      config = { ...config, table: tableName };
      return this;
    },
    signup(sql: string) {
      config = { ...config, signup: sql };
      return this;
    },
    signin(sql: string) {
      config = { ...config, signin: sql };
      return this;
    },
    identifier(column: string) {
      config = { ...config, identifier: column };
      return this;
    },
    algorithm(algo: 'HS256' | 'HS512') {
      config = { ...config, algorithm: algo };
      return this;
    },
    key(key: string) {
      config = { ...config, key };
      return this;
    },
    issuer(issuer: string) {
      config = { ...config, issuer };
      return this;
    },
    duration(duration: string) {
      config = { ...config, duration };
      return this;
    },
    tokenDuration(duration: string) {
      config = { ...config, tokenDuration: duration };
      return this;
    },
    build(): AccessConfig {
      return { name, ...config, type: config.type ?? 'RECORD' };
    },
    toSQL(): string {
      return new SurrealQLGenerator().generateAccessDefinition(this.build());
    },
  };
}

export type EventBuilder = ReturnType<typeof defineEvent>;

export function defineEvent(name: string) {
  if (!name) throw new Error('Event name is required');

  let config: {
    on?: string;
    when?: string;
    then?: string[];
    comment?: string;
    async?: boolean;
    retry?: number;
    maxdepth?: number;
  } = {};

  return {
    get name() {
      return name;
    },
    on(tableName: string) {
      config = { ...config, on: tableName };
      return this;
    },
    when(condition: string) {
      config = { ...config, when: condition };
      return this;
    },
    then(sql: string) {
      config = { ...config, then: [...(config.then ?? []), sql] };
      return this;
    },
    comment(text: string) {
      config = { ...config, comment: text };
      return this;
    },
    async() {
      config = { ...config, async: true };
      return this;
    },
    retry(count: number) {
      config = { ...config, retry: count };
      return this;
    },
    maxdepth(depth: number) {
      config = { ...config, maxdepth: depth };
      return this;
    },
    build(): EventConfig {
      const on = config.on;
      if (!on) throw new Error('Table name is required (use .on())');
      const when = config.when;
      if (!when) throw new Error('WHEN condition is required (use .when())');
      const then = config.then;
      if (!then || then.length === 0) {
        throw new Error(
          'At least one THEN statement is required (use .then())',
        );
      }
      return {
        name,
        on,
        when,
        then,
        comment: config.comment,
        async: config.async,
        retry: config.retry,
        maxdepth: config.maxdepth,
      };
    },
    toSQL(): string {
      const built = this.build();
      return new SurrealQLGenerator().generateEventDefinition({
        ...built,
        what: built.on,
      });
    },
  };
}

// =============================================================================
// SEQUENCE DEFINITION
// =============================================================================

export type SequenceBuilder = ReturnType<typeof defineSequence>;

/**
 * Sequence configuration for SurrealDB sequence definitions
 *
 * SurrealDB syntax: DEFINE SEQUENCE [IF NOT EXISTS] <name>
 *   [START <n>] [INCREMENT <n>] [MIN <n>] [MAX <n>] [CACHE <n>] [CYCLE]
 *   [COMMENT '<str>']
 */
export type SequenceConfig = {
  name: string;
  start?: number;
  increment?: number;
  min?: number;
  max?: number;
  cache?: number;
  cycle?: boolean;
  comment?: string;
};

/**
 * Create a DEFINE SEQUENCE fluent builder
 *
 * @example
 * defineSequence('my_seq')
 *   .start(1)
 *   .increment(2)
 *   .cycle()
 *   .toSQL()
 * // → DEFINE SEQUENCE IF NOT EXISTS `my_seq` START 1 INCREMENT 2 CYCLE
 */
export function defineSequence(name: string) {
  if (!name) throw new Error('Sequence name is required');

  let config: SequenceConfig = { name };

  return {
    get name() {
      return name;
    },
    start(n: number) {
      config = { ...config, start: n };
      return this;
    },
    increment(n: number) {
      config = { ...config, increment: n };
      return this;
    },
    min(n: number) {
      config = { ...config, min: n };
      return this;
    },
    max(n: number) {
      config = { ...config, max: n };
      return this;
    },
    cache(n: number) {
      config = { ...config, cache: n };
      return this;
    },
    cycle() {
      config = { ...config, cycle: true };
      return this;
    },
    comment(text: string) {
      config = { ...config, comment: text };
      return this;
    },
    build(): SurrealSequence {
      return { ...config };
    },
    toSQL(): string {
      return new SurrealQLGenerator().generateSequenceDefinition(this.build());
    },
  };
}

// =============================================================================
// NAMESPACE DEFINITION
// =============================================================================

// =============================================================================
// DATABASE DEFINITION
// =============================================================================

export type DatabaseBuilder = ReturnType<typeof defineDatabase>;

/**
 * Create a DEFINE DATABASE fluent builder
 *
 * SurrealDB syntax: DEFINE DATABASE [IF NOT EXISTS] <name> [COMMENT '<str>']
 *
 * @example
 * defineDatabase('testdb')
 *   .comment('Test database')
 *   .toSQL()
 * // → DEFINE DATABASE `testdb` COMMENT "Test database"
 */
export function defineDatabase(name: string) {
  if (!name) throw new Error('Database name is required');

  let config: {
    comment?: string;
    ifNotExists?: boolean;
  } = {};

  return {
    get name() {
      return name;
    },
    comment(text: string) {
      config = { ...config, comment: text };
      return this;
    },
    ifNotExists() {
      config = { ...config, ifNotExists: true };
      return this;
    },
    build() {
      return { name, ...config };
    },
    toSQL(): string {
      return new SurrealQLGenerator().generateDatabaseDefinition(name, config);
    },
  };
}

export type NamespaceBuilder = ReturnType<typeof defineNamespace>;

/**
 * Create a DEFINE NAMESPACE fluent builder
 *
 * SurrealDB syntax: DEFINE NAMESPACE [IF NOT EXISTS] <name> [COMMENT '<str>']
 *
 * @example
 * defineNamespace('production')
 *   .comment('Production namespace')
 *   .toSQL()
 * // → DEFINE NAMESPACE `production` COMMENT "Production namespace"
 */
export function defineNamespace(name: string) {
  if (!name) throw new Error('Namespace name is required');

  let config: {
    comment?: string;
    ifNotExists?: boolean;
  } = {};

  return {
    get name() {
      return name;
    },
    comment(text: string) {
      config = { ...config, comment: text };
      return this;
    },
    ifNotExists() {
      config = { ...config, ifNotExists: true };
      return this;
    },
    build() {
      return { name, ...config };
    },
    toSQL(): string {
      return new SurrealQLGenerator().generateNamespaceDefinition(name, config);
    },
  };
}
