/**
 * Condition Functions
 *
 * Re-exports SurrealDB SDK condition functions (eq, gt, etc.) for SDK fluent API compatibility.
 * Also exports simple condition helpers that serialize to SurrealQL strings with parameters.
 */
import type { Expr, ExprCtx, ExprLike } from 'surrealdb';
export { and, contains, containsAll, containsAny, containsNone, 
/** Exact equality — treats the value as a raw SurrealQL expression (no escaping).
 * Unlike `eq()` which escapes/parameterizes the value, `eeq()` passes it
 * through literally. Use for column-to-column comparisons or SurrealQL
 * functions where the right-hand side must not be treated as a string literal. */
eeq, eq, expr, gt, gte, inside, intersects, lt, lte, ne, not, or, outside, raw, } from 'surrealdb';
export type { Expr, ExprCtx, ExprLike };
export type Condition = Expr;
/** Serialized condition with SurrealQL fragment and parameter values */
export interface SerializedCondition {
    sql: string;
    params: Record<string, unknown>;
}
/** Comparison operators supported by SurrealQL */
export type ConditionOp = '=' | '==' | '!=' | '>' | '>=' | '<' | '<=' | 'CONTAINS' | 'CONTAINSANY' | 'CONTAINSALL' | 'CONTAINSNONE' | 'INSIDE' | 'OUTSIDE' | 'INTERSECTS' | 'IN' | '~' | '!~' | '@@' | '@N@';
/**
 * Build a parameterized condition
 */
export declare function buildCondition(field: string, op: ConditionOp, value: unknown, paramPrefix?: string): SerializedCondition;
/**
 * Build an IS NONE condition
 */
export declare function isNull(field: string): SerializedCondition;
/**
 * Build an IS NOT NONE condition
 */
export declare function isNotNull(field: string): SerializedCondition;
/**
 * Combine multiple conditions with AND
 */
export declare function allConditions(...conditions: SerializedCondition[]): SerializedCondition;
/**
 * Combine multiple conditions with OR
 */
export declare function anyConditions(...conditions: SerializedCondition[]): SerializedCondition;
/**
 * Wrap a condition with NOT
 */
export declare function negateCondition(condition: SerializedCondition): SerializedCondition;
/**
 * Build a graph traversal field path for use in conditions.
 * Joins segments as-is (no separator added between segments).
 * Include `.` in segments when accessing nested fields.
 *
 * @example
 * graphFieldPath('->likes->post.title')
 * // Returns: '->likes->post.title'
 *
 * // Dot must be included in the segment:
 * graphFieldPath('->writes.', 'title')
 * // Returns: '->writes.title'
 *
 * // With condition builder:
 * buildCondition(graphFieldPath('->likes->post.', 'status'), '=', 'published')
 * // Produces: `->likes->post.status = $p_...`
 */
export declare function graphFieldPath(...segments: string[]): string;
/**
 * Create a SurrealDB cast expression.
 * SurrealDB uses `<type>value` syntax for type casting.
 *
 * @example
 * cast('int', '$id')     // <int>$id
 * cast('string', 'name') // <string>name
 * cast('decimal', 42)    // <decimal>42
 */
export declare function cast(type: string, expr: string | number): string;
/**
 * Check if a value is a valid SerializedCondition
 */
export declare function isSerializedCondition(value: unknown): value is SerializedCondition;
//# sourceMappingURL=conditions.d.ts.map