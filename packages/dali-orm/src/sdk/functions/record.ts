/**
 * record::* — SurrealDB record function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function recordId(record: SqlExpr): SqlExpr {
  return `record::id(${record})` as SqlExpr;
}

export function recordTable(record: SqlExpr): SqlExpr {
  return `record::table(${record})` as SqlExpr;
}
