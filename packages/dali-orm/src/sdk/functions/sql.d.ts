/**
 * SqlExpr - Branded string type for SurrealQL expressions.
 *
 * Wrapping strings as SqlExpr at function boundaries (Parse Don't Validate)
 * ensures internal logic receives trusted, typed expressions.
 */
/** Branded string representing a validated SurrealQL expression */
export type SqlExpr = string & {
    readonly __brand: 'SqlExpr';
};
/** Wrap a plain string as SqlExpr */
export declare function $(str: string): SqlExpr;
/** Alias a SQL expression (e.g., `count() AS total`).
 * Named `as_` because `as` is a reserved word. */
export declare function as_(expr: SqlExpr, alias: string): SqlExpr;
/** Build a raw SqlExpr from a template literal.
 * Values are embedded directly (no parameterization) — use for static fragments only. */
export declare function expr(strings: TemplateStringsArray, ...values: unknown[]): SqlExpr;
/** Create a column reference as SqlExpr for use in function arguments */
export declare function col(name: string): SqlExpr;
//# sourceMappingURL=sql.d.ts.map