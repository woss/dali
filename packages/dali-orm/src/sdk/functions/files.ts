/**
 * file::* — SurrealDB file system function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function filesGet(path: SqlExpr): SqlExpr {
  return `file::get(${path})` as SqlExpr;
}

export function filesPut(path: SqlExpr, data: SqlExpr): SqlExpr {
  return `file::put(${path}, ${data})` as SqlExpr;
}

export function filesList(path: SqlExpr): SqlExpr {
  return `file::list(${path})` as SqlExpr;
}

export function filesDelete(path: SqlExpr): SqlExpr {
  return `file::delete(${path})` as SqlExpr;
}

export function filesExists(path: SqlExpr): SqlExpr {
  return `file::exists(${path})` as SqlExpr;
}

export function filesInfo(path: SqlExpr): SqlExpr {
  return `file::info(${path})` as SqlExpr;
}
