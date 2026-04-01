/**
 * api::* — SurrealDB API function wrappers.
 *
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function apiTimeout(duration: SqlExpr): SqlExpr {
  return `api::timeout(${duration})` as SqlExpr;
}
