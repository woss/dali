/**
 * Select Query Builder
 *
 * Type-safe SELECT builder for SurrealDB.
 * Generates SurrealQL with parameterized queries for filtered/graph queries.
 * Falls back to native driver.select() for simple unfiltered queries.
 */

import type { SurrealDriver } from '../sdk/driver/types.js';
import type { SqlExpr } from '../sdk/functions/sql.js';
import type { TableDefinition } from '../sdk/table.js';
import type { ConditionOp, SerializedCondition } from './conditions.js';
import type { ColumnRef, InferSelection, InferSelectResult } from './types.js';

// ============================================================================
// Types
// ============================================================================

type Direction = 'ASC' | 'DESC';
type GraphDirection = 'out' | 'in';

/** Column name from a TableDefinition — for field-level autocomplete */
type FieldNameOf<TDef extends TableDefinition> = TDef['columns'][number]['name'] & string;

/** Record-type field name from a TableDefinition — for FETCH autocomplete */
type RecordFieldNameOf<TDef extends TableDefinition> = keyof {
  [K in TDef['columns'][number] as K['config']['type'] extends 'record' ? K['name'] : never]: true;
} &
  string;

interface GraphTraversal {
  direction: GraphDirection;
  edge: string;
  target: string;
  alias: string;
}

/** Condition tree node for WHERE clause building */
interface ConditionNode {
  type: 'condition' | 'and' | 'or' | 'not';
  field?: string;
  op?: ConditionOp;
  value?: unknown;
  children?: ConditionNode[];
}

// ============================================================================
// SelectBuilder
// ============================================================================

export class SelectBuilder<TDef extends TableDefinition, TResult = InferSelectResult<TDef>> {
  private readonly driver: SurrealDriver;
  private readonly tableDef: TDef;
  private _fields: string[] = ['*'];
  private whereTree: ConditionNode | null = null;
  private orderByClauses: { field: string; direction: Direction }[] = [];
  private limitValue?: number;
  private startValue?: number;
  private fetchTables: string[] = [];
  private graphTraversals: GraphTraversal[] = [];
  private groupByFields?: string[];
  private timeoutValue?: string;
  private _parallel = false;
  private setOperations: {
    type: 'UNION' | 'UNION ALL' | 'INTERSECT' | 'EXCEPT';
    query: SelectBuilder<any, any>;
  }[] = [];
  private _cteQueries?: { name: string; query: SelectBuilder<any, any> }[];

  constructor(driver: SurrealDriver, tableDef: TDef) {
    if (!driver) throw new Error('Driver is required');
    if (!tableDef?.name) throw new Error('Table definition with name is required');

    this.driver = driver;
    this.tableDef = tableDef;
  }

  // ==================== Field Selection ====================

  /** Select specific fields with autocomplete (replaces default '*') */
  fields<K extends keyof TResult>(
    ...names: (K | SqlExpr)[]
  ): SelectBuilder<TDef, Pick<TResult, K | (keyof TResult & 'id')>> {
    if (names.length === 0) throw new Error('At least one field name is required');
    this._fields = names.map((n) => String(n));
    return this as unknown as SelectBuilder<TDef, Pick<TResult, K | (keyof TResult & 'id')>>;
  }

  /**
   * Drizzle-style object column selection.
   *
   * Select specific columns by passing a Record of ColumnRefs.
   * Result type is inferred from the ColumnRef types.
   *
   * @example
   * ```typescript
   * const cols = {
   *   name: columnRef<'name', string>('name', '' as string, 'user'),
   *   age: columnRef<'age', number>('age', 0 as number, 'user'),
   * };
   *
   * select(driver, users)
   *   .columns({ userName: cols.name, userAge: cols.age })
   *   .execute();
   * // Result type: { userName: string; userAge: number; id: string }
   * ```
   */
  columns<TSelection extends Record<string, ColumnRef>>(
    selection: TSelection,
  ): SelectBuilder<TDef, InferSelection<TSelection> & { id: string }> {
    const names = Object.values(selection).map((ref) => ref.name);
    if (names.length === 0) throw new Error('At least one column is required');
    this._fields = names;
    return this as unknown as SelectBuilder<TDef, InferSelection<TSelection> & { id: string }>;
  }

  // ==================== WHERE Clause ====================

  /**
   * Add WHERE conditions.
   * - Callback form: fluent condition builder
   * - SerializedCondition: pre-built condition
   * - Raw string: literal SurrealQL clause (use with caution)
   */
  where(fn: (w: WhereBuilder) => WhereBuilder): this;
  where(condition: SerializedCondition): this;
  where(rawClause: string): this;
  where(fnOrCondition: ((w: WhereBuilder) => WhereBuilder) | SerializedCondition | string): this {
    if (typeof fnOrCondition === 'function') {
      const builder = fnOrCondition(new WhereBuilder());
      const node = builder.build();
      this.whereTree = this.andTrees(this.whereTree, node);
    } else if (typeof fnOrCondition === 'string') {
      // Raw SurrealQL - wrap as a condition node
      const _rawNode: ConditionNode = {
        type: 'condition',
        field: fnOrCondition,
        op: '=',
        value: true,
      };
      // Special handling: use raw SQL directly
      this.whereTree = this.andTrees(this.whereTree, {
        type: 'condition',
        field: `RAW(${fnOrCondition})`,
        op: '=',
        value: true,
      });
    } else {
      // SerializedCondition - convert to condition nodes with params tracking
      const node = this.serializedConditionToNode(fnOrCondition);
      this.whereTree = this.andTrees(this.whereTree, node);
    }
    return this;
  }

  // ==================== ORDER BY ====================

  /** Add ORDER BY clause with typed field name autocomplete */
  orderBy<K extends FieldNameOf<TDef>>(field: K, direction?: Direction): this;
  /** Add ORDER BY clause (string fallback) */
  orderBy(field: string, direction?: Direction): this;
  /** Add ORDER BY clause */
  orderBy(field: string, direction: Direction = 'ASC'): this {
    if (!field || typeof field !== 'string') throw new Error('Field name is required for orderBy');
    this.orderByClauses.push({ field, direction });
    return this;
  }

  // ==================== LIMIT ====================

  /** Add LIMIT clause */
  limit(value: number): this {
    if (!Number.isInteger(value) || value < 0)
      throw new Error('Limit must be a non-negative integer');
    this.limitValue = value;
    return this;
  }

  // ==================== START (pagination offset) ====================

  /** Add START clause for pagination */
  start(value: number): this {
    if (!Number.isInteger(value) || value < 0)
      throw new Error('Start must be a non-negative integer');
    this.startValue = value;
    return this;
  }

  // ==================== FETCH (eager load) ====================

  /** Add FETCH clause with record field name autocomplete */
  fetch<K extends RecordFieldNameOf<TDef>>(...tables: K[]): this;
  /** Add FETCH clauses for eager loading related tables (string fallback) */
  fetch(...tables: string[]): this;
  /** Add FETCH clauses for eager loading related tables */
  fetch(...tables: string[]): this {
    if (tables.length === 0) throw new Error('At least one table name is required for fetch');
    this.fetchTables.push(...tables);
    return this;
  }

  // ==================== Graph Traversal ====================

  /**
   * Simple graph traversal: traverse('out', 'wrote', 'posts')
   * Generates: ->wrote->posts.* AS posts
   */
  traverse(direction: GraphDirection, edge: string, alias: string): this;
  traverse(direction: GraphDirection, edge: string, target: string, alias: string): this;
  traverse(direction: GraphDirection, edge: string, targetOrAlias: string, alias?: string): this {
    if (!edge || typeof edge !== 'string') throw new Error('Edge name is required for traverse');
    if (!targetOrAlias) throw new Error('Target or alias is required for traverse');

    const target = alias ? targetOrAlias : '';
    const actualAlias = alias ?? targetOrAlias;

    this.graphTraversals.push({ direction, edge, target, alias: actualAlias });
    return this;
  }

  // ==================== GROUP BY ====================

  /** Add GROUP BY clause with typed field name autocomplete */
  groupBy<K extends FieldNameOf<TDef>>(...fieldNames: K[]): this;
  /** Add GROUP BY clause (string fallback) */
  groupBy(...fieldNames: string[]): this;
  /** Add GROUP BY clause */
  groupBy(...fieldNames: string[]): this {
    if (fieldNames.length === 0) throw new Error('At least one field is required for groupBy');
    this.groupByFields = fieldNames;
    return this;
  }

  // ==================== TIMEOUT ====================

  /** Add TIMEOUT clause */
  timeout(duration: string): this {
    if (!duration || typeof duration !== 'string') throw new Error('Duration string is required');
    this.timeoutValue = duration;
    return this;
  }

  // ==================== PARALLEL ====================

  /** Enable PARALLEL execution */
  parallel(): this {
    this._parallel = true;
    return this;
  }

  // ==================== Execute ====================

  /** Execute the query and return results */
  async execute(): Promise<TResult[]> {
    const isSimple = this.isSimpleSelect();

    if (isSimple) {
      return this.driver.select<TResult>(this.tableDef.name);
    }

    const { sql, params } = this.toSQL();
    return this.driver.query<TResult>(sql, params);
  }

  // ==================== Subquery ====================

  /**
   * Wrap this query as a subquery expression.
   * Useful in WHERE clauses, FROM clauses, and field selections.
   *
   * @example
   * ```typescript
   * const avgAge = select(driver, users).fields(count().as_('avg'));
   * // In WHERE:
   * .where(w => w.gt('age', avgAge.subquery()))
   * ```
   */
  subquery(alias?: string): SqlExpr {
    const { sql } = this.toSQL();
    const inner = `(${sql})`;
    return (alias ? `${inner} AS ${alias}` : inner) as SqlExpr;
  }

  // ==================== Set Operations ====================

  /** Combine with another SELECT using UNION (deduplicates) */
  union(query: SelectBuilder<any, any>): this {
    if (!query) throw new Error('Query is required for union');
    this.setOperations.push({ type: 'UNION', query });
    return this;
  }

  /** Combine with another SELECT using UNION ALL (keeps duplicates) */
  unionAll(query: SelectBuilder<any, any>): this {
    if (!query) throw new Error('Query is required for unionAll');
    this.setOperations.push({ type: 'UNION ALL', query });
    return this;
  }

  /** Intersect with another SELECT */
  intersect(query: SelectBuilder<any, any>): this {
    if (!query) throw new Error('Query is required for intersect');
    this.setOperations.push({ type: 'INTERSECT', query });
    return this;
  }

  /** Except/minus with another SELECT */
  except(query: SelectBuilder<any, any>): this {
    if (!query) throw new Error('Query is required for except');
    this.setOperations.push({ type: 'EXCEPT', query });
    return this;
  }

  // ==================== CTE (WITH clause) ====================

  /**
   * Add CTE definitions to this query.
   *
   * @example
   * ```typescript
   * select(driver, users)
   *   .with({ activeUsers: select(driver, users).where(w => w.eq('active', true)) })
   *   .execute();
   * ```
   */
  with(ctes: Record<string, SelectBuilder<any, any>>): this {
    const entries = Object.entries(ctes);
    if (entries.length === 0) throw new Error('At least one CTE definition is required');
    this._cteQueries = entries.map(([name, query]) => ({ name, query }));
    return this;
  }

  // ==================== Public: Build SQL ====================

  /**
   * Compile to SurrealQL string + params.
   * Public for subquery/CTE composition.
   */
  toSQL(): { sql: string; params: Record<string, unknown> } {
    const params: Record<string, unknown> = {};
    let paramIndex = 0;

    const nextParam = (value: unknown): string => {
      const name = `p${paramIndex++}`;
      params[name] = value;
      return `$${name}`;
    };

    // SELECT clause
    let fieldsStr = this._fields.join(', ');

    // Add graph traversal fields
    for (const traversal of this.graphTraversals) {
      const arrow =
        traversal.direction === 'out'
          ? `->${traversal.edge}->${traversal.target || traversal.alias}`
          : `<-${traversal.edge}<-${traversal.target || traversal.alias}`;
      fieldsStr += `, ${arrow}.* AS ${traversal.alias}`;
    }

    let sql = '';

    // CTE prefix (WITH clause) - generate with param remapping to avoid collisions
    if (this._cteQueries && this._cteQueries.length > 0) {
      const cteParts: string[] = [];
      for (let i = 0; i < this._cteQueries.length; i++) {
        const cte: { name: string; query: SelectBuilder<any, any> } = this._cteQueries[i];
        const childSQL: { sql: string; params: Record<string, unknown> } = cte.query.toSQL();
        const prefix = `c${i}_`;
        let remappedSQL = childSQL.sql;
        // Sort keys longest-first so c0_p10 replaced before c0_p1
        const sortedKeys: string[] = Object.keys(childSQL.params).sort(
          (a, b) => b.length - a.length,
        );
        for (const key of sortedKeys) {
          const newKey = `${prefix}${key}`;
          params[newKey] = childSQL.params[key];
          remappedSQL = remappedSQL.replaceAll(`$${key}`, `$${newKey}`);
        }
        cteParts.push(`${cte.name} AS (${remappedSQL})`);
      }
      sql += `WITH\n  ${cteParts.join(',\n  ')}\n`;
    }

    sql += `SELECT ${fieldsStr} FROM ${this.tableDef.name}`;

    // WHERE
    if (this.whereTree) {
      const { sql: whereSql, params: whereParams } = this.serializeCondition(
        this.whereTree,
        nextParam,
      );
      if (whereSql) {
        sql += ` WHERE ${whereSql}`;
        Object.assign(params, whereParams);
      }
    }

    // GROUP BY
    if (this.groupByFields && this.groupByFields.length > 0) {
      sql += ` GROUP BY ${this.groupByFields.join(', ')}`;
    }

    // ORDER BY
    if (this.orderByClauses.length > 0) {
      const parts = this.orderByClauses.map((o) => `${o.field} ${o.direction}`);
      sql += ` ORDER BY ${parts.join(', ')}`;
    }

    // START
    if (this.startValue) {
      sql += ` START ${this.startValue}`;
    }

    // LIMIT
    if (this.limitValue) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    // FETCH
    if (this.fetchTables.length > 0) {
      sql += ` FETCH ${this.fetchTables.join(', ')}`;
    }

    // TIMEOUT
    if (this.timeoutValue) {
      sql += ` TIMEOUT ${this.timeoutValue}`;
    }

    // PARALLEL
    if (this._parallel) {
      sql += ' PARALLEL';
    }

    // Set operations (UNION / INTERSECT / EXCEPT)
    // Remap child param names to avoid collisions with main query params
    for (let i = 0; i < this.setOperations.length; i++) {
      const op = this.setOperations[i];
      const childSQL = op.query.toSQL();
      const prefix = `s${i}_`;
      let remappedSQL = childSQL.sql;
      const remappedParams: Record<string, unknown> = {};
      // Sort keys longest-first so $p10 is replaced before $p1
      const sortedKeys = Object.keys(childSQL.params).sort((a, b) => b.length - a.length);
      for (const key of sortedKeys) {
        const newKey = `${prefix}${key}`;
        remappedParams[newKey] = childSQL.params[key];
        remappedSQL = remappedSQL.replaceAll(`$${key}`, `$${newKey}`);
      }
      sql += ` ${op.type} ${remappedSQL}`;
      Object.assign(params, remappedParams);
    }

    return { sql, params };
  }

  // ==================== Private ====================

  /** Check if this is a simple select that can use native driver.select() */
  private isSimpleSelect(): boolean {
    return (
      !this.whereTree &&
      this.graphTraversals.length === 0 &&
      this.orderByClauses.length === 0 &&
      !this.limitValue &&
      !this.startValue &&
      this.groupByFields === undefined &&
      !this.timeoutValue &&
      !this._parallel &&
      this._fields.length === 1 &&
      this._fields[0] === '*' &&
      !this._cteQueries &&
      this.setOperations.length === 0
    );
  }

  /** Combine two condition trees with AND */
  private andTrees(a: ConditionNode | null, b: ConditionNode): ConditionNode {
    if (!a) return b;
    return {
      type: 'and',
      children: [a, b],
    };
  }

  /** Convert a SerializedCondition to a special raw condition node */
  private serializedConditionToNode(condition: SerializedCondition): ConditionNode {
    // Store serialized condition as a special node for later SQL generation
    return {
      type: 'condition',
      field: `_serialized_${condition.sql}`,
      op: '=',
      value: condition,
    };
  }

  /** Serialize a condition tree to SurrealQL + params */
  private serializeCondition(
    node: ConditionNode,
    nextParam: (value: unknown) => string,
  ): { sql: string; params: Record<string, unknown> } {
    switch (node.type) {
      case 'condition': {
        // Check for serialized condition stored as special node
        const fieldStr = node.field ?? '';
        if (fieldStr.startsWith('_serialized_')) {
          const stored = node.value as SerializedCondition;
          // Replace parameter placeholders with new ones
          let sql = stored.sql;
          const newParams: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(stored.params)) {
            const newName = nextParam(value);
            sql = sql.replace(`$${key}`, newName);
          }
          return { sql, params: newParams };
        }

        // Check for raw SQL
        if (fieldStr.startsWith('RAW(')) {
          const rawSql = fieldStr.slice(4, -1);
          return { sql: rawSql, params: {} };
        }

        // IN subquery: value contains SQL + params from subquery toSQL()
        if (
          node.op === 'IN' &&
          typeof node.value === 'object' &&
          node.value !== null &&
          (node.value as Record<string, unknown>).__subquery
        ) {
          const info = node.value as { sql: string; params: Record<string, unknown> };
          let subSQL = info.sql;
          const newParams: Record<string, unknown> = {};
          // Remap subquery param names to avoid collisions with main query
          const sortedKeys = Object.keys(info.params).sort((a, b) => b.length - a.length);
          for (const key of sortedKeys) {
            const newName = nextParam(info.params[key]);
            subSQL = subSQL.replaceAll(`$${key}`, `$${newName}`);
          }
          return { sql: `${node.field} ${node.op} ${subSQL}`, params: newParams };
        }

        // Standard condition
        if (node.op === ('isNone' as ConditionOp))
          return { sql: `${node.field} = NONE`, params: {} };
        if (node.op === ('isNotNull' as ConditionOp))
          return { sql: `${node.field} != NONE`, params: {} };

        const op = node.op ?? '=';
        const param = node.value !== undefined ? nextParam(node.value) : 'true';
        return { sql: `${node.field} ${op} ${param}`, params: {} };
      }

      case 'and': {
        const parts: string[] = [];
        const allParams: Record<string, unknown> = {};
        for (const child of node.children ?? []) {
          const { sql, params } = this.serializeCondition(child, nextParam);
          if (sql) {
            parts.push(sql);
            Object.assign(allParams, params);
          }
        }
        return { sql: parts.join(' AND '), params: allParams };
      }

      case 'or': {
        const parts: string[] = [];
        const allParams: Record<string, unknown> = {};
        for (const child of node.children ?? []) {
          const { sql, params } = this.serializeCondition(child, nextParam);
          if (sql) {
            parts.push(`(${sql})`);
            Object.assign(allParams, params);
          }
        }
        return { sql: parts.join(' OR '), params: allParams };
      }

      case 'not': {
        const child = node.children?.[0];
        if (!child) return { sql: 'true', params: {} };
        const { sql, params } = this.serializeCondition(child, nextParam);
        return { sql: `NOT (${sql})`, params };
      }

      default:
        return { sql: 'true', params: {} };
    }
  }
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
      typeof field === 'string' ? field : 'name' in field ? field.name : String(field);
    this.root.children?.push({ type: 'condition', field: fieldName, op, value });
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
      typeof field === 'string' ? field : 'name' in field ? field.name : String(field);
    this.root.children?.push({ type: 'condition', field: fieldName, op: 'isNone' as ConditionOp });
    return this;
  }

  isNotNull<K extends string, T>(field: ColumnRef<K, T>): this;
  isNotNull(field: ColumnRef): this;
  isNotNull(field: string): this;
  isNotNull(field: SqlExpr): this;
  isNotNull(field: string | ColumnRef | SqlExpr): this {
    const fieldName =
      typeof field === 'string' ? field : 'name' in field ? field.name : String(field);
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
    if (valuesOrSubquery && typeof valuesOrSubquery === 'object' && 'toSQL' in valuesOrSubquery) {
      const fieldName =
        typeof field === 'string' ? field : 'name' in field ? field.name : String(field);
      const subResult = (valuesOrSubquery as SelectBuilder<any, any>).toSQL();
      // Store both SQL and params — serializer will remap param names
      this.root.children?.push({
        type: 'condition',
        field: fieldName,
        op: 'IN' as ConditionOp,
        value: { __subquery: true, sql: `(${subResult.sql})`, params: subResult.params },
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
      const sub = (args[0] as (w: WhereBuilder) => WhereBuilder)(new WhereBuilder());
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
      const sub = (args[0] as (w: WhereBuilder) => WhereBuilder)(new WhereBuilder());
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

// ============================================================================
// Factory Function
// ============================================================================

/** Create a new SelectBuilder for the given table definition */
export function select<TDef extends TableDefinition>(
  driver: SurrealDriver,
  tableDef: TDef,
): SelectBuilder<TDef> {
  return new SelectBuilder(driver, tableDef);
}
