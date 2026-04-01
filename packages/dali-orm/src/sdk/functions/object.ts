/**
 * object::* — SurrealDB object function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function objectEntries(obj: SqlExpr): SqlExpr {
  return `object::entries(${obj})` as SqlExpr;
}

export function objectExtend(obj: SqlExpr, other: SqlExpr): SqlExpr {
  return `object::extend(${obj}, ${other})` as SqlExpr;
}

export function objectFromEntries(arr: SqlExpr): SqlExpr {
  return `object::from_entries(${arr})` as SqlExpr;
}

export function objectIsEmpty(obj: SqlExpr): SqlExpr {
  return `object::is_empty(${obj})` as SqlExpr;
}

export function objectKeys(obj: SqlExpr): SqlExpr {
  return `object::keys(${obj})` as SqlExpr;
}

export function objectLen(obj: SqlExpr): SqlExpr {
  return `object::len(${obj})` as SqlExpr;
}

export function objectRemove(obj: SqlExpr, ...keys: SqlExpr[]): SqlExpr {
  return `object::remove(${obj}, ${keys.join(', ')})` as SqlExpr;
}

export function objectValues(obj: SqlExpr): SqlExpr {
  return `object::values(${obj})` as SqlExpr;
}
