/**
 * Select Query Builder
 *
 * Type-safe SELECT builder for SurrealDB.
 * Generates SurrealQL with parameterized queries for filtered/graph queries.
 * Falls back to native driver.select() for simple unfiltered queries.
 */
import type { DaliORM } from '../sdk/dali-orm.js';
import type { SqlExpr } from '../sdk/functions/sql.js';
import type { TableDefinition } from '../sdk/table.js';
import type { SerializedCondition } from './conditions.js';
import type { ColumnRef, InferSelection, InferSelectResult } from './types.js';
import { WhereBuilder } from './where-builder.js';
type Direction = 'ASC' | 'DESC';
type GraphDirection = 'out' | 'in';
/** Column name from a TableDefinition — for field-level autocomplete */
type FieldNameOf<TDef extends TableDefinition> = TDef['columns'][number]['name'] & string;
/** Record-type field name from a TableDefinition — for FETCH autocomplete */
type RecordFieldNameOf<TDef extends TableDefinition> = keyof {
    [K in TDef['columns'][number] as K['config']['type'] extends 'record' ? K['name'] : never]: true;
} & string;
export declare class SelectBuilder<TDef extends TableDefinition, TResult = InferSelectResult<TDef>> {
    private readonly driver;
    private readonly tableDef;
    private _fields;
    private whereTree;
    private orderByClauses;
    private limitValue?;
    private startValue?;
    private fetchTables;
    private graphTraversals;
    private groupByFields?;
    private timeoutValue?;
    private _parallel;
    private setOperations;
    private _cteQueries?;
    private omitFields?;
    private splitFields?;
    private indexHint?;
    private _tempfiles?;
    private versionValue?;
    private _explain;
    private _explainFull;
    constructor(orm: DaliORM, tableDef: TDef);
    /** Select specific fields with autocomplete (replaces default '*') */
    fields<K extends keyof TResult>(...names: (K | SqlExpr)[]): SelectBuilder<TDef, Pick<TResult, K | (keyof TResult & 'id')>>;
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
    columns<TSelection extends Record<string, ColumnRef>>(selection: TSelection): SelectBuilder<TDef, InferSelection<TSelection> & {
        id: string;
    }>;
    /**
     * Add WHERE conditions.
     * - Callback form: fluent condition builder
     * - SerializedCondition: pre-built condition
     * - Raw string: literal SurrealQL clause (use with caution)
     */
    where(fn: (w: WhereBuilder) => WhereBuilder): this;
    where(condition: SerializedCondition): this;
    where(rawClause: string): this;
    /** Add ORDER BY clause with typed field name autocomplete */
    orderBy<K extends FieldNameOf<TDef>>(field: K, direction?: Direction): this;
    /** Add ORDER BY clause (string fallback) */
    orderBy(field: string, direction?: Direction): this;
    /** Add LIMIT clause */
    limit(value: number): this;
    /** Add START clause for pagination */
    start(value: number): this;
    /** Add FETCH clause with record field name autocomplete */
    fetch<K extends RecordFieldNameOf<TDef>>(...tables: K[]): this;
    /** Add FETCH clauses for eager loading related tables (string fallback) */
    fetch(...tables: string[]): this;
    /**
     * Simple graph traversal: traverse('out', 'wrote', 'posts')
     * Generates: ->wrote->posts.* AS posts
     */
    traverse(direction: GraphDirection, edge: string, alias: string): this;
    traverse(direction: GraphDirection, edge: string, alias: string, options: {
        depth?: {
            min: number;
            max?: number;
        };
    }): this;
    traverse(direction: GraphDirection, edge: string, target: string, alias: string): this;
    traverse(direction: GraphDirection, edge: string, target: string, alias: string, options: {
        depth?: {
            min: number;
            max?: number;
        };
    }): this;
    /** Add GROUP BY clause with typed field name autocomplete */
    groupBy<K extends FieldNameOf<TDef>>(...fieldNames: K[]): this;
    /** Add GROUP BY clause (string fallback) */
    groupBy(...fieldNames: string[]): this;
    /** Add TIMEOUT clause */
    timeout(duration: string): this;
    /** Enable PARALLEL execution */
    parallel(): this;
    /** Add OMIT clause to exclude fields from results */
    omit(...fields: string[]): this;
    /** Add SPLIT clause to split array fields into separate records */
    split(...fields: string[]): this;
    /** Use WITH NOINDEX hint */
    withNoindex(): this;
    /** Use WITH INDEX hint for specific indexes */
    withIndex(...names: string[]): this;
    /** Enable or disable TEMPFILES */
    tempfiles(enable: boolean): this;
    /** Add VERSION clause */
    version(value: string): this;
    /** Add EXPLAIN clause (optionally FULL) */
    explain(full?: boolean): this;
    /** Execute the query and return results */
    execute(): Promise<TResult[]>;
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
    subquery(alias?: string): SqlExpr;
    /** Combine with another SELECT using UNION (deduplicates) */
    union(query: SelectBuilder<any, any>): this;
    /** Combine with another SELECT using UNION ALL (keeps duplicates) */
    unionAll(query: SelectBuilder<any, any>): this;
    /** Intersect with another SELECT */
    intersect(query: SelectBuilder<any, any>): this;
    /** Except/minus with another SELECT */
    except(query: SelectBuilder<any, any>): this;
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
    with(ctes: Record<string, SelectBuilder<any, any>>): this;
    /**
     * Compile to SurrealQL string + params.
     * Public for subquery/CTE composition.
     */
    toSQL(): {
        sql: string;
        params: Record<string, unknown>;
    };
    /** Check if this is a simple select that can use native driver.select() */
    isSimpleSelect(): boolean;
}
export { WhereBuilder } from './where-builder.js';
/** Create a new SelectBuilder for the given table definition */
export declare function select<TDef extends TableDefinition>(orm: DaliORM, tableDef: TDef): SelectBuilder<TDef>;
//# sourceMappingURL=select.d.ts.map