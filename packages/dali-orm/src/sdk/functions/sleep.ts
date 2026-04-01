/**
 * sleep() — SurrealDB sleep function wrapper.
 *
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function sleep(duration: SqlExpr): SqlExpr {
  return `sleep(${duration})` as SqlExpr;
}
