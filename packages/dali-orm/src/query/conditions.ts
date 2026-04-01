/**
 * Condition Functions
 *
 * Re-exports SurrealDB SDK condition functions (eq, gt, etc.) for SDK fluent API compatibility.
 * Also exports simple condition helpers that serialize to SurrealQL strings with parameters.
 */

// SDK condition functions - for SDK fluent API compatibility
import type { Expr, ExprCtx, ExprLike } from 'surrealdb';

export {
  and,
  contains,
  containsAll,
  containsAny,
  containsNone,
  eeq,
  eq,
  expr,
  gt,
  gte,
  inside,
  intersects,
  lt,
  lte,
  ne,
  not,
  or,
  outside,
  raw,
} from 'surrealdb';
export type { Expr, ExprCtx, ExprLike };

// Alias for SDK Expr type
export type SurrealCondition = Expr;

// ============================================================================
// Simple Condition Helpers (Serialize to SurrealQL + params)
//
// These generate parameterized SurrealQL fragments for use with driver.query().
// Use these when building raw SurrealQL strings, SDK Expr when using SDK fluent API.
// ============================================================================

/** Serialized condition with SurrealQL fragment and parameter values */
export interface SerializedCondition {
  sql: string;
  params: Record<string, unknown>;
}

/** Comparison operators supported by SurrealQL */
export type ConditionOp =
  | '='
  | '=='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'CONTAINS'
  | 'CONTAINSANY'
  | 'CONTAINSALL'
  | 'CONTAINSNONE'
  | 'INSIDE'
  | 'OUTSIDE'
  | 'INTERSECTS'
  | 'IN'
  | '~'
  | '!~';

/**
 * Build a parameterized condition
 */
export function buildCondition(
  field: string,
  op: ConditionOp,
  value: unknown,
  paramPrefix = 'p',
): SerializedCondition {
  const paramName = `${paramPrefix}_${field.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
  return {
    sql: `${field} ${op} $${paramName}`,
    params: { [paramName]: value },
  };
}

/**
 * Build an IS NONE condition
 */
export function isNull(field: string): SerializedCondition {
  return { sql: `${field} = NONE`, params: {} };
}

/**
 * Build an IS NOT NONE condition
 */
export function isNotNull(field: string): SerializedCondition {
  return { sql: `${field} != NONE`, params: {} };
}

/**
 * Combine multiple conditions with AND
 */
export function allConditions(...conditions: SerializedCondition[]): SerializedCondition {
  if (conditions.length === 0) return { sql: '', params: {} };
  if (conditions.length === 1) return conditions[0];

  const sql = conditions.map((c) => c.sql).join(' AND ');
  const params = conditions.reduce<Record<string, unknown>>(
    (acc, c) => Object.assign(acc, c.params),
    {},
  );
  return { sql, params };
}

/**
 * Combine multiple conditions with OR
 */
export function anyConditions(...conditions: SerializedCondition[]): SerializedCondition {
  if (conditions.length === 0) return { sql: '', params: {} };
  if (conditions.length === 1) return conditions[0];

  const sql = conditions.map((c) => `(${c.sql})`).join(' OR ');
  const params = conditions.reduce<Record<string, unknown>>(
    (acc, c) => Object.assign(acc, c.params),
    {},
  );
  return { sql, params };
}

/**
 * Wrap a condition with NOT
 */
export function negateCondition(condition: SerializedCondition): SerializedCondition {
  return { sql: `NOT (${condition.sql})`, params: condition.params };
}

/**
 * Check if a value is a valid SerializedCondition
 */
export function isSerializedCondition(value: unknown): value is SerializedCondition {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sql' in value &&
    typeof (value as SerializedCondition).sql === 'string' &&
    'params' in value &&
    typeof (value as SerializedCondition).params === 'object' &&
    (value as SerializedCondition).params !== null
  );
}
