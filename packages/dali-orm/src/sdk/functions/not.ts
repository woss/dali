/**
 * not() — SurrealDB logical negation function wrapper.
 *
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function not(val: SqlExpr): SqlExpr {
  return `not(${val})` as SqlExpr;
}
