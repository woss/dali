/**
 * array::* — SurrealDB array function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function arrayAdd(arr: SqlExpr, value: SqlExpr): SqlExpr {
  return `array::add(${arr}, ${value})` as SqlExpr;
}

export function arrayAppend(arr: SqlExpr, value: SqlExpr): SqlExpr {
  return `array::append(${arr}, ${value})` as SqlExpr;
}

export function arrayConcat(arr1: SqlExpr, arr2: SqlExpr): SqlExpr {
  return `array::concat(${arr1}, ${arr2})` as SqlExpr;
}

export function arrayContains(arr: SqlExpr, value: SqlExpr): SqlExpr {
  return `array::contains(${arr}, ${value})` as SqlExpr;
}

export function arrayDifference(arr1: SqlExpr, arr2: SqlExpr): SqlExpr {
  return `array::difference(${arr1}, ${arr2})` as SqlExpr;
}

export function arrayDistinct(arr: SqlExpr): SqlExpr {
  return `array::distinct(${arr})` as SqlExpr;
}

export function arrayFilter(arr: SqlExpr, predicate: SqlExpr): SqlExpr {
  return `array::filter(${arr}, ${predicate})` as SqlExpr;
}

export function arrayFind(arr: SqlExpr, predicate: SqlExpr): SqlExpr {
  return `array::find(${arr}, ${predicate})` as SqlExpr;
}

export function arrayFirst(arr: SqlExpr): SqlExpr {
  return `array::first(${arr})` as SqlExpr;
}

export function arrayFlatten(arr: SqlExpr): SqlExpr {
  return `array::flatten(${arr})` as SqlExpr;
}

export function arrayGroup(arr: SqlExpr): SqlExpr {
  return `array::group(${arr})` as SqlExpr;
}

export function arrayIntersect(arr1: SqlExpr, arr2: SqlExpr): SqlExpr {
  return `array::intersect(${arr1}, ${arr2})` as SqlExpr;
}

export function arrayIsEmpty(arr: SqlExpr): SqlExpr {
  return `array::is_empty(${arr})` as SqlExpr;
}

export function arrayJoin(arr: SqlExpr, separator: SqlExpr): SqlExpr {
  return `array::join(${arr}, ${separator})` as SqlExpr;
}

export function arrayLast(arr: SqlExpr): SqlExpr {
  return `array::last(${arr})` as SqlExpr;
}

export function arrayLen(arr: SqlExpr): SqlExpr {
  return `array::len(${arr})` as SqlExpr;
}

export function arrayMap(arr: SqlExpr, mapper: SqlExpr): SqlExpr {
  return `array::map(${arr}, ${mapper})` as SqlExpr;
}

export function arrayMax(arr: SqlExpr): SqlExpr {
  return `array::max(${arr})` as SqlExpr;
}

export function arrayMin(arr: SqlExpr): SqlExpr {
  return `array::min(${arr})` as SqlExpr;
}

export function arrayPop(arr: SqlExpr): SqlExpr {
  return `array::pop(${arr})` as SqlExpr;
}

export function arrayPrepend(arr: SqlExpr, value: SqlExpr): SqlExpr {
  return `array::prepend(${arr}, ${value})` as SqlExpr;
}

export function arrayPush(arr: SqlExpr, value: SqlExpr): SqlExpr {
  return `array::push(${arr}, ${value})` as SqlExpr;
}

export function arrayRemove(arr: SqlExpr, value: SqlExpr): SqlExpr {
  return `array::remove(${arr}, ${value})` as SqlExpr;
}

export function arrayReverse(arr: SqlExpr): SqlExpr {
  return `array::reverse(${arr})` as SqlExpr;
}

export function arrayShuffle(arr: SqlExpr): SqlExpr {
  return `array::shuffle(${arr})` as SqlExpr;
}

export function arraySlice(arr: SqlExpr, start: SqlExpr, end?: SqlExpr): SqlExpr {
  return end
    ? (`array::slice(${arr}, ${start}, ${end})` as SqlExpr)
    : (`array::slice(${arr}, ${start})` as SqlExpr);
}

export function arraySort(arr: SqlExpr, order?: SqlExpr): SqlExpr {
  return order ? (`array::sort(${arr}, ${order})` as SqlExpr) : (`array::sort(${arr})` as SqlExpr);
}

export function arrayStringJoin(arr: SqlExpr, separator: SqlExpr): SqlExpr {
  return `array::string_join(${arr}, ${separator})` as SqlExpr;
}

export function arraySum(arr: SqlExpr): SqlExpr {
  return `array::sum(${arr})` as SqlExpr;
}

export function arrayUnion(arr1: SqlExpr, arr2: SqlExpr): SqlExpr {
  return `array::union(${arr1}, ${arr2})` as SqlExpr;
}

export function arrayUnique(arr: SqlExpr): SqlExpr {
  return `array::distinct(${arr})` as SqlExpr;
}
