/**
 * count() / countAll() — SurrealDB aggregate function wrappers.
 *
 * All functions return SqlExpr for composition with other builders.
 */

import type { SqlExpr } from './sql.js';

/** Count records, optionally counting a specific expression */
export function count(expr?: SqlExpr): SqlExpr {
  return expr ? (`count(${expr})` as SqlExpr) : ('count()' as SqlExpr);
}

/** Alias: count all records */
export function countAll(): SqlExpr {
  return 'count()' as SqlExpr;
}
