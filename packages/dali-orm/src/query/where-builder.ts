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

// ============================================================================
// ConditionNode
// ============================================================================

/** Condition tree node for WHERE clause building */
export interface ConditionNode {
  type: 'condition' | 'and' | 'or' | 'not';
  field?: string;
  op?: ConditionOp;
  value?: unknown;
  children?: ConditionNode[];
}

// ============================================================================
// WhereBuilder - Fluent Condition Builder
// ============================================================================

export class WhereBuilder {
  private root: ConditionNode = { type: 'and', children: [] };

  /** Resolve field name from string, ColumnRef, or SqlExpr, then push a condition node */
  private pushCondition(
    field: string | ColumnRef | SqlExpr,
    op: ConditionOp,
    value?: unknown,
  ): void {
    const fieldName =
      typeof field === 'string'
        ? field
        : 'name' in field
          ? field.name
          : String(field);
    this.root.children?.push({
      type: 'condition',
      field: fieldName,
      op,
      value,
    });
  }

  eq<K extends string, T>(field: ColumnRef<K, T>, value: T): this;
  eq(field: ColumnRef, value: unknown): this;
  eq(field: string, value: unknown): this;
  eq(field: SqlExpr, value: unknown): this;
  eq(field: string | ColumnRef | SqlExpr, value: unknown): this {
    this.pushCondition(field, '=', value);
    return this;
  }

  ne<K extends string, T>(field: ColumnRef<K, T>, value: T): this;
  ne(field: ColumnRef, value: unknown): this;
  ne(field: string, value: unknown): this;
  ne(field: SqlExpr, value: unknown): this;
  ne(field: string | ColumnRef | SqlExpr, value: unknown): this {
    this.pushCondition(field, '!=', value);
    return this;
  }

  gt<K extends string, T>(field: ColumnRef<K, T>, value: T): this;
  gt(field: ColumnRef, value: unknown): this;
  gt(field: string, value: unknown): this;
  gt(field: SqlExpr, value: unknown): this;
  gt(field: string | ColumnRef | SqlExpr, value: unknown): this {
    this.pushCondition(field, '>', value);
    return this;
  }

  gte<K extends string, T>(field: ColumnRef<K, T>, value: T): this;
  gte(field: ColumnRef, value: unknown): this;
  gte(field: string, value: unknown): this;
  gte(field: SqlExpr, value: unknown): this;
  gte(field: string | ColumnRef | SqlExpr, value: unknown): this {
    this.pushCondition(field, '>=', value);
    return this;
  }

  lt<K extends string, T>(field: ColumnRef<K, T>, value: T): this;
  lt(field: ColumnRef, value: unknown): this;
  lt(field: string, value: unknown): this;
  lt(field: SqlExpr, value: unknown): this;
  lt(field: string | ColumnRef | SqlExpr, value: unknown): this {
    this.pushCondition(field, '<', value);
    return this;
  }

  lte<K extends string, T>(field: ColumnRef<K, T>, value: T): this;
  lte(field: ColumnRef, value: unknown): this;
  lte(field: string, value: unknown): this;
  lte(field: SqlExpr, value: unknown): this;
  lte(field: string | ColumnRef | SqlExpr, value: unknown): this {
    this.pushCondition(field, '<=', value);
    return this;
  }

  contains<K extends string, T>(field: ColumnRef<K, T>, value: T): this;
  contains(field: ColumnRef, value: unknown): this;
  contains(field: string, value: unknown): this;
  contains(field: SqlExpr, value: unknown): this;
  contains(field: string | ColumnRef | SqlExpr, value: unknown): this {
    this.pushCondition(field, 'CONTAINS', value);
    return this;
  }

  inside<K extends string, T>(field: ColumnRef<K, T>, value: T): this;
  inside(field: ColumnRef, value: unknown): this;
  inside(field: string, value: unknown): this;
  inside(field: SqlExpr, value: unknown): this;
  inside(field: string | ColumnRef | SqlExpr, value: unknown): this {
    this.pushCondition(field, 'INSIDE', value);
    return this;
  }

  like<K extends string, T>(field: ColumnRef<K, T>, pattern: string): this;
  like(field: ColumnRef, pattern: string): this;
  like(field: string, pattern: string): this;
  like(field: SqlExpr, pattern: string): this;
  like(field: string | ColumnRef | SqlExpr, pattern: string): this {
    this.pushCondition(field, '~', pattern);
    return this;
  }

  notLike<K extends string, T>(field: ColumnRef<K, T>, pattern: string): this;
  notLike(field: ColumnRef, pattern: string): this;
  notLike(field: string, pattern: string): this;
  notLike(field: SqlExpr, pattern: string): this;
  notLike(field: string | ColumnRef | SqlExpr, pattern: string): this {
    this.pushCondition(field, '!~', pattern);
    return this;
  }

  isNull<K extends string, T>(field: ColumnRef<K, T>): this;
  isNull(field: ColumnRef): this;
  isNull(field: string): this;
  isNull(field: SqlExpr): this;
  isNull(field: string | ColumnRef | SqlExpr): this {
    const fieldName =
      typeof field === 'string'
        ? field
        : 'name' in field
          ? field.name
          : String(field);
    this.root.children?.push({
      type: 'condition',
      field: fieldName,
      op: 'isNone' as ConditionOp,
    });
    return this;
  }

  isNotNull<K extends string, T>(field: ColumnRef<K, T>): this;
  isNotNull(field: ColumnRef): this;
  isNotNull(field: string): this;
  isNotNull(field: SqlExpr): this;
  isNotNull(field: string | ColumnRef | SqlExpr): this {
    const fieldName =
      typeof field === 'string'
        ? field
        : 'name' in field
          ? field.name
          : String(field);
    this.root.children?.push({
      type: 'condition',
      field: fieldName,
      op: 'isNotNull' as ConditionOp,
    });
    return this;
  }

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
  in(
    field: string | ColumnRef | SqlExpr,
    valuesOrSubquery: unknown[] | SelectBuilder<any, any>,
  ): this {
    // Duck-type check: SelectBuilder has toSQL()
    if (
      valuesOrSubquery &&
      typeof valuesOrSubquery === 'object' &&
      'toSQL' in valuesOrSubquery
    ) {
      const fieldName =
        typeof field === 'string'
          ? field
          : 'name' in field
            ? field.name
            : String(field);
      const subResult = (valuesOrSubquery as SelectBuilder<any, any>).toSQL();
      // Store both SQL and params — serializer will remap param names
      this.root.children?.push({
        type: 'condition',
        field: fieldName,
        op: 'IN' as ConditionOp,
        value: {
          __subquery: true,
          sql: `(${subResult.sql})`,
          params: subResult.params,
        },
      });
      return this;
    }
    this.pushCondition(field, 'INSIDE', valuesOrSubquery);
    return this;
  }

  and(fn: (w: WhereBuilder) => WhereBuilder): this;
  and(...conditions: ConditionNode[]): this;
  and(...args: unknown[]): this {
    if (args.length === 1 && typeof args[0] === 'function') {
      const sub = (args[0] as (w: WhereBuilder) => WhereBuilder)(
        new WhereBuilder(),
      );
      this.root.children?.push(sub.build());
    } else {
      this.root.children?.push(...(args as ConditionNode[]));
    }
    return this;
  }

  or(fn: (w: WhereBuilder) => WhereBuilder): this;
  or(...conditions: ConditionNode[]): this;
  or(...args: unknown[]): this {
    const orNode: ConditionNode = { type: 'or', children: [] };
    if (args.length === 1 && typeof args[0] === 'function') {
      const sub = (args[0] as (w: WhereBuilder) => WhereBuilder)(
        new WhereBuilder(),
      );
      orNode.children?.push(sub.build());
    } else {
      orNode.children?.push(...(args as ConditionNode[]));
    }
    this.root.children?.push(orNode);
    return this;
  }

  not(fn: (w: WhereBuilder) => WhereBuilder): this {
    const sub = fn(new WhereBuilder());
    this.root.children?.push({ type: 'not', children: [sub.build()] });
    return this;
  }

  build(): ConditionNode {
    if (this.root.children?.length === 1) {
      return this.root.children?.[0];
    }
    return this.root;
  }
}
