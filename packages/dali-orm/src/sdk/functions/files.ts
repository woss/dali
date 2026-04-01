/**
 * files::* — SurrealDB file system function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function filesGet(path: SqlExpr): SqlExpr {
  return `files::get(${path})` as SqlExpr;
}

export function filesPut(path: SqlExpr, data: SqlExpr): SqlExpr {
  return `files::put(${path}, ${data})` as SqlExpr;
}

export function filesList(path: SqlExpr): SqlExpr {
  return `files::list(${path})` as SqlExpr;
}

export function filesDelete(path: SqlExpr): SqlExpr {
  return `files::delete(${path})` as SqlExpr;
}

export function filesExists(path: SqlExpr): SqlExpr {
  return `files::exists(${path})` as SqlExpr;
}

export function filesInfo(path: SqlExpr): SqlExpr {
  return `files::info(${path})` as SqlExpr;
}
