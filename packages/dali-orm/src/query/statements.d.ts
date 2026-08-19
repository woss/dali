/**
 * Statement Query Builders
 *
 * SurrealDB statement builders that are NOT table-specific.
 * These take `orm: DaliORM` in the constructor (no TableDefinition).
 * Some wrap driver methods, others build raw SQL strings.
 */
import type { DaliORM } from '../sdk/dali-orm.js';
/** Scope for INFO builder (DB, NS, or TABLE <name>) */
export type InfoScope = 'DB' | 'NS' | `TABLE ${string}`;
/**
 * Kill a live query subscription.
 * Wraps `driver.kill(subscriptionId)`.
 */
export declare class KillBuilder {
    private readonly driver;
    private subscriptionId?;
    constructor(orm: DaliORM);
    /** Set the subscription ID to kill */
    id(subscriptionId: string): this;
    /** Execute the KILL */
    execute(): Promise<void>;
}
/**
 * Rebuild a table index.
 * Builds raw SQL: `REBUILD INDEX {name} ON {table}`.
 */
export declare class RebuildIndexBuilder {
    private readonly driver;
    private indexName?;
    private tableName?;
    constructor(orm: DaliORM);
    /** Set the index name to rebuild */
    name(idxName: string): this;
    /** Set the table the index belongs to */
    on(tableName: string): this;
    /** Execute the REBUILD INDEX statement */
    execute(): Promise<unknown[]>;
}
/**
 * Query database information.
 * Builds raw SQL: `INFO FOR {scope}`.
 */
export declare class InfoBuilder {
    private readonly driver;
    private scope?;
    constructor(orm: DaliORM);
    /** Set the scope (e.g., 'DB', 'NS', 'TABLE user') */
    forScope(scope: InfoScope): this;
    /** Execute the INFO FOR statement */
    execute(): Promise<unknown[]>;
}
/**
 * Show changes for a table since a given point.
 * Wraps `driver.showChanges(table, options)`.
 */
export declare class ShowChangesBuilder {
    private readonly driver;
    private tableName?;
    private sinceValue?;
    private limitValue?;
    constructor(orm: DaliORM);
    /** Set the table to show changes for */
    table(tableName: string): this;
    /** Only show changes since this timestamp or change ID */
    since(value: string | number): this;
    /** Limit the number of changes returned */
    limit(n: number): this;
    /** Execute the SHOW CHANGES */
    execute<T = unknown>(): Promise<T[]>;
}
/**
 * Switch to a different namespace and database.
 * Wraps `driver.use(namespace, database)`.
 */
export declare class UseBuilder {
    private readonly driver;
    private ns?;
    private db?;
    constructor(orm: DaliORM);
    /** Set the namespace to use */
    namespace(ns: string): this;
    /** Set the database to use */
    database(db: string): this;
    /** Execute the USE */
    execute(): Promise<void>;
}
/**
 * Begin a new transaction.
 * Executes raw SQL: `BEGIN TRANSACTION`.
 */
export declare class BeginBuilder {
    private readonly driver;
    constructor(orm: DaliORM);
    /** Execute the BEGIN TRANSACTION statement */
    execute(): Promise<void>;
}
/**
 * Commit the current transaction.
 * Executes raw SQL: `COMMIT TRANSACTION`.
 */
export declare class CommitBuilder {
    private readonly driver;
    constructor(orm: DaliORM);
    /** Execute the COMMIT TRANSACTION statement */
    execute(): Promise<void>;
}
/**
 * Cancel (roll back) the current transaction.
 * SurrealDB uses `CANCEL TRANSACTION` (not `ROLLBACK`).
 * Executes raw SQL: `CANCEL TRANSACTION`.
 */
export declare class CancelBuilder {
    private readonly driver;
    constructor(orm: DaliORM);
    /** Execute the CANCEL TRANSACTION statement */
    execute(): Promise<void>;
}
/**
 * Set a SurrealQL variable.
 * Builds SQL: `LET $varName = $v` using binder parameters.
 */
export declare class LetBuilder {
    private readonly driver;
    private varName?;
    private val?;
    constructor(orm: DaliORM);
    /** Set the variable name (without $ prefix) */
    name(varName: string): this;
    /** Set the variable value */
    value(val: unknown): this;
    /** Execute the LET statement */
    execute(): Promise<unknown[]>;
}
/**
 * Return a value or expression from a SurrealQL query.
 * Supports value mode (binder param) and raw mode (expression interpolation).
 */
export declare class ReturnBuilder {
    private readonly driver;
    private val?;
    private rawExpr?;
    constructor(orm: DaliORM);
    /** Set the value to return (binder parameter) */
    value(val: unknown): this;
    /** Set raw expression to return (interpolated directly — use with caution) */
    raw(expr: string): this;
    /** Execute the RETURN statement */
    execute(): Promise<unknown[]>;
}
/**
 * Throw a custom error in SurrealQL.
 * Supports message mode (binder param) and raw mode (expression interpolation).
 */
export declare class ThrowBuilder {
    private readonly driver;
    private msg?;
    private rawExpr?;
    constructor(orm: DaliORM);
    /** Set the error message */
    message(msg: string): this;
    /** Set raw expression to throw (interpolated directly — use with caution) */
    raw(expr: string): this;
    /** Execute the THROW statement */
    execute(): Promise<unknown[]>;
}
export declare function kill(orm: DaliORM): KillBuilder;
export declare function rebuildIndex(orm: DaliORM): RebuildIndexBuilder;
export declare function info(orm: DaliORM): InfoBuilder;
export declare function showChanges(orm: DaliORM): ShowChangesBuilder;
export declare function use(orm: DaliORM): UseBuilder;
export declare function beginTransaction(orm: DaliORM): BeginBuilder;
export declare function commitTransaction(orm: DaliORM): CommitBuilder;
export declare function cancelTransaction(orm: DaliORM): CancelBuilder;
export declare function let_(orm: DaliORM): LetBuilder;
export declare function return_(orm: DaliORM): ReturnBuilder;
export declare function throw_(orm: DaliORM): ThrowBuilder;
/**
 * Define a SurrealQL parameter.
 * Builds SQL: `DEFINE PARAM $name VALUE $v [TYPE ...] [PERMISSIONS ...]`.
 */
export declare class DefineParamBuilder {
    private readonly driver;
    private paramName?;
    private paramValue?;
    private paramType?;
    private perms?;
    constructor(orm: DaliORM);
    /** Set the parameter name (without $ prefix — builder adds it) */
    name(name: string): this;
    /** Set the parameter's default value */
    value(val: unknown): this;
    /** Set the parameter type (e.g., 'string', 'int', 'float', 'decimal') */
    type(typeStr: string): this;
    /** Set PERMISSIONS clause */
    permissions(perms: string): this;
    /** Execute the DEFINE PARAM statement */
    execute(): Promise<unknown[]>;
}
export declare function defineParam(orm: DaliORM): DefineParamBuilder;
//# sourceMappingURL=statements.d.ts.map