/**
 * SurrealQL DDL Statement Generators
 *
 * Standalone DDL generation functions extracted from SurrealQLGenerator.
 * These are pure functions — no class dependency, all use imported utilities.
 *
 * Each function validates inputs, returns a SurrealQL string.
 */
import { escapeIdent } from '../../core/surql.js';
import type { AnalyzerDefinition, TableConfig } from '../../sdk/table.js';
import type {
  SurrealAccess,
  SurrealEvent,
  SurrealFunction,
  SurrealSequence,
  SurrealView,
} from '../ddl/ddl.js';
import { getSurrealQLType } from '../ddl/types.js';
import { formatDefaultValue } from '../utils/format.js';

/**
 * Generate REMOVE ACCESS statement
 */
export function generateRemoveAccess(accessName: string): string {
  if (!accessName) {
    throw new Error('Access name is required for REMOVE ACCESS');
  }
  return `REMOVE ACCESS IF EXISTS ${accessName} ON DATABASE`;
}

/**
 * Generate DEFINE NAMESPACE statement
 *
 * SurrealQL: DEFINE NAMESPACE [IF NOT EXISTS] <name> [COMMENT '<str>']
 */
export function generateNamespaceDefinition(
  name: string,
  options?: {
    ifNotExists?: boolean;
    comment?: string;
  },
): string {
  if (!name) {
    throw new Error('Namespace name is required for DEFINE NAMESPACE');
  }
  const parts = [
    `DEFINE NAMESPACE${options?.ifNotExists ? ' IF NOT EXISTS' : ''} ${escapeIdent(name)}`,
  ];
  if (options?.comment) {
    parts.push(`COMMENT "${options.comment}"`);
  }
  return parts.join(' ');
}

/**
 * Generate REMOVE NAMESPACE statement
 *
 * SurrealQL: REMOVE NAMESPACE [IF EXISTS] <name>
 */
export function generateRemoveNamespace(
  name: string,
  ifExists?: boolean,
): string {
  if (!name) {
    throw new Error('Namespace name is required for REMOVE NAMESPACE');
  }
  return `REMOVE NAMESPACE${ifExists ? ' IF EXISTS' : ''} ${escapeIdent(name)}`;
}

/**
 * Generate DEFINE DATABASE statement
 *
 * SurrealQL: DEFINE DATABASE [IF NOT EXISTS] <name> [COMMENT '<str>']
 */
export function generateDatabaseDefinition(
  name: string,
  options?: {
    ifNotExists?: boolean;
    comment?: string;
  },
): string {
  if (!name) {
    throw new Error('Database name is required for DEFINE DATABASE');
  }
  const parts = [
    `DEFINE DATABASE${options?.ifNotExists ? ' IF NOT EXISTS' : ''} ${escapeIdent(name)}`,
  ];
  if (options?.comment) {
    parts.push(`COMMENT "${options.comment}"`);
  }
  return parts.join(' ');
}

/**
 * Generate REMOVE DATABASE statement
 *
 * SurrealQL: REMOVE DATABASE [IF EXISTS] <name>
 */
export function generateRemoveDatabase(
  name: string,
  ifExists?: boolean,
): string {
  if (!name) {
    throw new Error('Database name is required for REMOVE DATABASE');
  }
  return `REMOVE DATABASE${ifExists ? ' IF EXISTS' : ''} ${escapeIdent(name)}`;
}

/**
 * Generate DEFINE ACCESS statement from access definition
 *
 * Follows the same pattern as accessToSQL() in sdk/schema.ts
 * but supports configurable level (ROOT/NAMESPACE/DATABASE).
 *
 * @param access - Access definition with name, type, level, and optional auth/JWT fields
 * @returns SurrealQL DEFINE ACCESS statement
 */
export function generateAccessDefinition(access: {
  name: string;
  type: string;
  level?: string;
  table?: string;
  signup?: string;
  signin?: string;
  identifier?: string;
  algorithm?: string;
  key?: string;
  issuer?: string;
  duration?: string;
  tokenDuration?: string;
}): string {
  if (!access.name) {
    throw new Error('Access name is required for DEFINE ACCESS');
  }
  if (!access.type) {
    throw new Error('Access type is required for DEFINE ACCESS');
  }

  const level = access.level ?? 'DATABASE';
  const parts: string[] = [
    `DEFINE ACCESS ${access.name} ON ${level} TYPE ${access.type}`,
  ];

  if (access.signup) {
    parts.push(`SIGNUP (${access.signup})`);
  }

  if (access.signin) {
    parts.push(`SIGNIN (${access.signin})`);
  }

  if (access.algorithm) {
    parts.push(`ALGORITHM ${access.algorithm}`);
  }

  if (access.key) {
    parts.push(`KEY "${access.key}"`);
  }

  if (access.issuer) {
    parts.push(`ISSUER ${access.issuer}`);
  }

  if (access.duration || access.tokenDuration) {
    const durationParts: string[] = [];
    if (access.tokenDuration) {
      durationParts.push(`FOR TOKEN ${access.tokenDuration}`);
    }
    if (access.duration) {
      durationParts.push(`FOR SESSION ${access.duration}`);
    }
    parts.push(`DURATION ${durationParts.join(', ')}`);
  }

  return parts.join(' ');
}

/**
 * Generate access migration SQL
 *
 * Generates DEFINE ACCESS statement
 *
 * @param access - Structured access definition
 * @returns Single SurrealQL statement
 */
export function generateAccessMigration(access: SurrealAccess): string {
  if (!access.name) {
    throw new Error('Access name is required for migration');
  }

  return generateAccessDefinition(access);
}

/**
 * Generate DEFINE EVENT statement from event definition
 *
 * @param event - Event definition with name, what, when, then, and optional async/retry/maxdepth
 * @returns SurrealQL DEFINE EVENT statement
 */
export function generateEventDefinition(event: {
  name: string;
  what: string;
  when: string;
  then: string[];
  comment?: string;
  async?: boolean;
  retry?: number;
  maxdepth?: number;
}): string {
  if (!event.name) {
    throw new Error('Event name is required for DEFINE EVENT');
  }
  if (!event.what) {
    throw new Error('Event table (what) is required for DEFINE EVENT');
  }
  if (!event.when) {
    throw new Error('Event condition (when) is required for DEFINE EVENT');
  }
  if (!event.then || event.then.length === 0) {
    throw new Error('Event action (then) is required for DEFINE EVENT');
  }

  const parts: string[] = [
    `DEFINE EVENT IF NOT EXISTS ${event.name} ON TABLE ${event.what} WHEN (${event.when}) THEN { ${event.then.join('; ')} }`,
  ];

  if (event.comment) {
    parts.push(`COMMENT "${event.comment}"`);
  }

  if (event.async) {
    parts.push('ASYNC');
  }

  if (event.retry !== undefined) {
    parts.push(`RETRY ${event.retry}`);
  }

  if (event.maxdepth !== undefined) {
    parts.push(`MAXDEPTH ${event.maxdepth}`);
  }

  return parts.join(' ');
}

/**
 * Generate REMOVE EVENT statement
 */
export function generateRemoveEvent(
  eventName: string,
  tableName: string,
): string {
  if (!eventName) {
    throw new Error('Event name is required for REMOVE EVENT');
  }
  if (!tableName) {
    throw new Error('Table name is required for REMOVE EVENT');
  }
  return `REMOVE EVENT IF EXISTS ${eventName} ON TABLE ${tableName}`;
}

/**
 * Generate event migration SQL
 *
 * Generates DEFINE EVENT statement
 *
 * @param event - Structured event definition (SurrealEvent type)
 * @returns Single SurrealQL statement
 */
export function generateEventMigration(event: SurrealEvent): string {
  if (!event.name) {
    throw new Error('Event name is required for migration');
  }

  return generateEventDefinition(event);
}

/**
 * Generate DEFINE FUNCTION statement
 */
export function generateFunctionDefinition(func: {
  name: string;
  args?: string[];
  body: string;
  comment?: string;
  permissions?: string;
}): string {
  if (!func.name) {
    throw new Error('Function name is required for DEFINE FUNCTION');
  }
  if (!func.body) {
    throw new Error('Function body is required for DEFINE FUNCTION');
  }

  const parts: string[] = [`DEFINE FUNCTION IF NOT EXISTS ${func.name}`];

  if (func.args && func.args.length > 0) {
    parts.push(`(${func.args.join(', ')})`);
  }

  parts.push(`{ ${func.body} }`);

  if (func.comment) {
    parts.push(`COMMENT "${func.comment}"`);
  }

  if (func.permissions) {
    parts.push(`PERMISSIONS ${func.permissions}`);
  }

  return parts.join(' ');
}

/**
 * Generate REMOVE FUNCTION statement
 */
export function generateRemoveFunction(funcName: string): string {
  if (!funcName) {
    throw new Error('Function name is required for REMOVE FUNCTION');
  }
  return `REMOVE FUNCTION IF EXISTS ${funcName}`;
}

/**
 * Generate function migration SQL
 */
export function generateFunctionMigration(func: SurrealFunction): string {
  if (!func.name) {
    throw new Error('Function name is required for migration');
  }

  return generateFunctionDefinition(func);
}

/**
 * Generate DEFINE VIEW statement
 */
export function generateViewDefinition(view: {
  name: string;
  query: string;
  comment?: string;
}): string {
  if (!view.name) {
    throw new Error('View name is required for DEFINE VIEW');
  }
  if (!view.query) {
    throw new Error('View query is required for DEFINE VIEW');
  }

  const parts: string[] = [
    `DEFINE VIEW IF NOT EXISTS ${view.name} AS ${view.query}`,
  ];

  if (view.comment) {
    parts.push(`COMMENT "${view.comment}"`);
  }

  return parts.join(' ');
}

/**
 * Generate REMOVE VIEW statement
 */
export function generateRemoveView(viewName: string): string {
  if (!viewName) {
    throw new Error('View name is required for REMOVE VIEW');
  }
  return `REMOVE VIEW IF EXISTS ${viewName}`;
}

/**
 * Generate view migration SQL
 */
export function generateViewMigration(view: SurrealView): string {
  if (!view.name) {
    throw new Error('View name is required for migration');
  }

  return generateViewDefinition(view);
}

/**
 * Generate DEFINE SEQUENCE statement
 *
 * SurrealQL: DEFINE SEQUENCE [IF NOT EXISTS] <name> [START <n>] [INCREMENT <n>] [MIN <n>] [MAX <n>] [CACHE <n>] [CYCLE] [COMMENT '<str>']
 */
export function generateSequenceDefinition(seq: SurrealSequence): string {
  if (!seq.name) {
    throw new Error('Sequence name is required for DEFINE SEQUENCE');
  }

  const parts: string[] = [
    `DEFINE SEQUENCE IF NOT EXISTS ${escapeIdent(seq.name)}`,
  ];

  if (seq.start !== undefined) {
    parts.push(`START ${seq.start}`);
  }

  if (seq.increment !== undefined) {
    parts.push(`INCREMENT ${seq.increment}`);
  }

  if (seq.min !== undefined) {
    parts.push(`MIN ${seq.min}`);
  }

  if (seq.max !== undefined) {
    parts.push(`MAX ${seq.max}`);
  }

  if (seq.cache !== undefined) {
    parts.push(`CACHE ${seq.cache}`);
  }

  if (seq.cycle === true) {
    parts.push('CYCLE');
  }

  if (seq.comment) {
    parts.push(`COMMENT "${seq.comment}"`);
  }

  return parts.join(' ');
}

/**
 * Generate REMOVE SEQUENCE statement
 *
 * SurrealQL: REMOVE SEQUENCE [IF EXISTS] <name>
 */
export function generateRemoveSequence(
  seqName: string,
  ifExists?: boolean,
): string {
  if (!seqName) {
    throw new Error('Sequence name is required for REMOVE SEQUENCE');
  }
  return `REMOVE SEQUENCE${ifExists ? ' IF EXISTS' : ''} ${escapeIdent(seqName)}`;
}

/**
 * Generate ALTER FIELD TYPE statement
 */
export function generateAlterFieldType(
  tableName: string,
  fieldName: string,
  newType: string,
): string {
  if (!tableName) {
    throw new Error('Table name is required for ALTER FIELD TYPE');
  }
  if (!fieldName) {
    throw new Error('Field name is required for ALTER FIELD TYPE');
  }
  const typeStr = getSurrealQLType(newType);
  return `ALTER FIELD ${fieldName} ON TABLE ${tableName} TYPE ${typeStr}`;
}

/**
 * Generate ALTER TABLE PERMISSIONS statement
 */
export function generateAlterTablePermissions(
  tableName: string,
  permissions: TableConfig['permissions'],
): string {
  if (!tableName) {
    throw new Error('Table name is required for ALTER TABLE PERMISSIONS');
  }
  if (!permissions) {
    return '';
  }

  const parts: string[] = [];

  if (permissions.select) parts.push(`FOR select ${permissions.select}`);
  if (permissions.create) parts.push(`FOR create ${permissions.create}`);
  if (permissions.update) parts.push(`FOR update ${permissions.update}`);
  if (permissions.delete) parts.push(`FOR delete ${permissions.delete}`);

  if (parts.length === 0) {
    return '';
  }

  return `ALTER TABLE ${tableName} PERMISSIONS ${parts.join(' ')}`;
}

/**
 * Generate ALTER FIELD PERMISSIONS statement
 */
export function generateAlterFieldPermissions(
  tableName: string,
  fieldName: string,
  permissions: string,
): string {
  if (!tableName) {
    throw new Error('Table name is required for ALTER FIELD PERMISSIONS');
  }
  if (!fieldName) {
    throw new Error('Field name is required for ALTER FIELD PERMISSIONS');
  }
  if (!permissions) {
    return '';
  }
  return `ALTER FIELD ${fieldName} ON TABLE ${tableName} PERMISSIONS ${permissions}`;
}

/**
 * Generate ALTER FIELD DEFAULT statement
 *
 * @param defaultRaw - Raw SurrealDB expression (e.g., `crypto::blake3(content)`), takes precedence over defaultValue
 * @param defaultValue - Formatted default value (string/number/boolean), passed through formatDefaultValue
 */
export function generateAlterFieldDefault(
  tableName: string,
  fieldName: string,
  defaultValue?: unknown,
  defaultRaw?: string,
): string {
  if (!tableName) {
    throw new Error('Table name is required for ALTER FIELD DEFAULT');
  }
  if (!fieldName) {
    throw new Error('Field name is required for ALTER FIELD DEFAULT');
  }
  if (defaultRaw !== undefined) {
    return `ALTER FIELD ${fieldName} ON TABLE ${tableName} DEFAULT ${defaultRaw}`;
  }
  if (defaultValue === undefined) {
    return '';
  }
  return `ALTER FIELD ${fieldName} ON TABLE ${tableName} DEFAULT ${formatDefaultValue(defaultValue)}`;
}

/**
 * Generate DEFINE ANALYZER statement
 *
 * SurrealDB 3.0 syntax:
 *   DEFINE ANALYZER [IF NOT EXISTS] @name [TOKENIZERS @t1 [,@tN]] [FILTERS @f1 [,@fN]]
 */
export function generateAnalyzerDefinition(
  analyzer: AnalyzerDefinition,
): string {
  if (!analyzer.name) {
    throw new Error('Analyzer name is required for DEFINE ANALYZER');
  }

  const parts: string[] = [`DEFINE ANALYZER IF NOT EXISTS ${analyzer.name}`];

  if (analyzer.tokenizers) {
    const tokenizers = Array.isArray(analyzer.tokenizers)
      ? analyzer.tokenizers.join(', ')
      : analyzer.tokenizers;
    if (tokenizers === '') {
      throw new Error(
        'Tokenizers list is empty for DEFINE ANALYZER — provide at least one tokenizer',
      );
    }
    parts.push(`TOKENIZERS ${tokenizers}`);
  }

  if (analyzer.filters) {
    const filters = Array.isArray(analyzer.filters)
      ? analyzer.filters.join(', ')
      : analyzer.filters;
    if (filters === '') {
      throw new Error(
        'Filters list is empty for DEFINE ANALYZER — provide at least one filter',
      );
    }
    parts.push(`FILTERS ${filters}`);
  }

  return parts.join(' ');
}

/**
 * Generate REMOVE ANALYZER statement
 */
export function generateRemoveAnalyzer(analyzerName: string): string {
  if (!analyzerName) {
    throw new Error('Analyzer name is required for REMOVE ANALYZER');
  }
  return `REMOVE ANALYZER IF EXISTS ${analyzerName}`;
}
