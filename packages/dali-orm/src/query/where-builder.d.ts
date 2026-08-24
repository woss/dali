/**
 * WhereBuilder - Fluent Condition Builder
 *
 * Extracted from select.ts (Task 6.3) to reduce file size.
 * Builds a ConditionNode tree via a chainable fluent API.
 */

import type { SqlExpr } from '../sdk/functions/sql.js';
import type { ConditionOp } from './conditions.js';
import type { SelectBuilder } from './select.js';
import type { ColumnRef } from './types.js';
/** Condition tree node for WHERE clause building */
export interface ConditionNode {
  type: 'condition' | 'and' | 'or' | 'not';
  field?: string;
  op?: ConditionOp;
  value?: unknown;
  children?: ConditionNode[];
}
export declare class WhereBuilder {
  private root;
  /** Resolve field name from string, ColumnRef, or SqlExpr, then push a condition node */
  private pushCondition;
  eq<K extends string, T>(field: ColumnRef<K, T>, value: T): this;
  eq(field: ColumnRef, value: unknown): this;
  eq(field: string, value: unknown): this;
  eq(field: SqlExpr, value: unknown): this;
  ne<K extends string, T>(field: ColumnRef<K, T>, value: T): this;
  ne(field: ColumnRef, value: unknown): this;
  ne(field: string, value: unknown): this;
  ne(field: SqlExpr, value: unknown): this;
  gt<K extends string, T>(field: ColumnRef<K, T>, value: T): this;
  gt(field: ColumnRef, value: unknown): this;
  gt(field: string, value: unknown): this;
  gt(field: SqlExpr, value: unknown): this;
  gte<K extends string, T>(field: ColumnRef<K, T>, value: T): this;
  gte(field: ColumnRef, value: unknown): this;
  gte(field: string, value: unknown): this;
  gte(field: SqlExpr, value: unknown): this;
  lt<K extends string, T>(field: ColumnRef<K, T>, value: T): this;
  lt(field: ColumnRef, value: unknown): this;
  lt(field: string, value: unknown): this;
  lt(field: SqlExpr, value: unknown): this;
  lte<K extends string, T>(field: ColumnRef<K, T>, value: T): this;
  lte(field: ColumnRef, value: unknown): this;
  lte(field: string, value: unknown): this;
  lte(field: SqlExpr, value: unknown): this;
  contains<K extends string, T>(field: ColumnRef<K, T>, value: T): this;
  contains(field: ColumnRef, value: unknown): this;
  contains(field: string, value: unknown): this;
  contains(field: SqlExpr, value: unknown): this;
  inside<K extends string, T>(field: ColumnRef<K, T>, value: T): this;
  inside(field: ColumnRef, value: unknown): this;
  inside(field: string, value: unknown): this;
  inside(field: SqlExpr, value: unknown): this;
  like<K extends string, T>(field: ColumnRef<K, T>, pattern: string): this;
  like(field: ColumnRef, pattern: string): this;
  like(field: string, pattern: string): this;
  like(field: SqlExpr, pattern: string): this;
  notLike<K extends string, T>(field: ColumnRef<K, T>, pattern: string): this;
  notLike(field: ColumnRef, pattern: string): this;
  notLike(field: string, pattern: string): this;
  notLike(field: SqlExpr, pattern: string): this;
  isNull<K extends string, T>(field: ColumnRef<K, T>): this;
  isNull(field: ColumnRef): this;
  isNull(field: string): this;
  isNull(field: SqlExpr): this;
  isNotNull<K extends string, T>(field: ColumnRef<K, T>): this;
  isNotNull(field: ColumnRef): this;
  isNotNull(field: string): this;
  isNotNull(field: SqlExpr): this;
  /** Typed array overload: field INSIDE [...values] */
  in<K extends string, T>(field: ColumnRef<K, T>, values: T[]): this;
  /** Array overload: field INSIDE [...values] */
  in(field: ColumnRef, values: unknown[]): this;
  in(field: string, values: unknown[]): this;
  in(field: SqlExpr, values: unknown[]): this;
  /** Subquery overload: field IN (SELECT ...) */
  in(field: ColumnRef, subquery: SelectBuilder<any, any>): this;
  in(field: string, subquery: SelectBuilder<any, any>): this;
  in(field: SqlExpr, subquery: SelectBuilder<any, any>): this;
  and(fn: (w: WhereBuilder) => WhereBuilder): this;
  and(...conditions: ConditionNode[]): this;
  or(fn: (w: WhereBuilder) => WhereBuilder): this;
  or(...conditions: ConditionNode[]): this;
  not(fn: (w: WhereBuilder) => WhereBuilder): this;
  build(): ConditionNode;
}
//# sourceMappingURL=where-builder.d.ts.map
