/**
 * SqlExpr - Branded string type for SurrealQL expressions.
 *
 * Wrapping strings as SqlExpr at function boundaries (Parse Don't Validate)
 * ensures internal logic receives trusted, typed expressions.
 */

/** Branded string representing a validated SurrealQL expression */
export type SqlExpr = string & { readonly __brand: 'SqlExpr' };

/** Wrap a plain string as SqlExpr */
export function $(str: string): SqlExpr {
  return str as SqlExpr;
}

/** Alias a SQL expression (e.g., `count() AS total`).
 * Named `as_` because `as` is a reserved word. */
export function as_(expr: SqlExpr, alias: string): SqlExpr {
  if (!alias) throw new Error('Alias is required for as_');
  return `${expr} AS ${alias}` as SqlExpr;
}

/** Build a raw SqlExpr from a template literal.
 * Values are embedded directly (no parameterization) — use for static fragments only. */
export function expr(strings: TemplateStringsArray, ...values: unknown[]): SqlExpr {
  if (strings.length === 0) return '' as SqlExpr;
  const result = strings.reduce((acc, str, i) => {
    const val = i < values.length ? String(values[i]) : '';
    return acc + str + val;
  }, '');
  return result as SqlExpr;
}

/** Create a column reference as SqlExpr for use in function arguments */
export function col(name: string): SqlExpr {
  if (!name || typeof name !== 'string') throw new Error('Column name is required');
  return name as SqlExpr;
}
