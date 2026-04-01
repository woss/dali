/**
 * set::* — SurrealDB set function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function setAdd(set: SqlExpr, value: SqlExpr): SqlExpr {
  return `set::add(${set}, ${value})` as SqlExpr;
}

export function setDifference(set1: SqlExpr, set2: SqlExpr): SqlExpr {
  return `set::difference(${set1}, ${set2})` as SqlExpr;
}

export function setIntersect(set1: SqlExpr, set2: SqlExpr): SqlExpr {
  return `set::intersect(${set1}, ${set2})` as SqlExpr;
}

export function setIsEmpty(set: SqlExpr): SqlExpr {
  return `set::is::empty(${set})` as SqlExpr;
}

export function setIsEqual(set1: SqlExpr, set2: SqlExpr): SqlExpr {
  return `set::is::equal(${set1}, ${set2})` as SqlExpr;
}

export function setLen(set: SqlExpr): SqlExpr {
  return `set::len(${set})` as SqlExpr;
}

export function setRemove(set: SqlExpr, value: SqlExpr): SqlExpr {
  return `set::remove(${set}, ${value})` as SqlExpr;
}

export function setSort(set: SqlExpr): SqlExpr {
  return `set::sort(${set})` as SqlExpr;
}

export function setUnion(set1: SqlExpr, set2: SqlExpr): SqlExpr {
  return `set::union(${set1}, ${set2})` as SqlExpr;
}
