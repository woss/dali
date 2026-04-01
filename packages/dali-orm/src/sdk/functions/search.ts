/**
 * search::* — SurrealDB search function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function searchHighlight(excerpt: SqlExpr, fields?: SqlExpr): SqlExpr {
  return fields !== undefined
    ? (`search::highlight(${excerpt}, ${fields})` as SqlExpr)
    : (`search::highlight(${excerpt})` as SqlExpr);
}

export function searchScore(excerpt: SqlExpr): SqlExpr {
  return `search::score(${excerpt})` as SqlExpr;
}
