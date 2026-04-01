/**
 * meta::* — SurrealDB metadata function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function metaId(record: SqlExpr): SqlExpr {
  return `meta::id(${record})` as SqlExpr;
}

export function metaTable(record: SqlExpr): SqlExpr {
  return `meta::tb(${record})` as SqlExpr;
}

export function metaTb(record: SqlExpr): SqlExpr {
  return `meta::tb(${record})` as SqlExpr;
}
