/**
 * array::* — SurrealDB array function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function arrayAdd(arr: SqlExpr, value: SqlExpr): SqlExpr;
export declare function arrayAppend(arr: SqlExpr, value: SqlExpr): SqlExpr;
export declare function arrayConcat(arr1: SqlExpr, arr2: SqlExpr): SqlExpr;
export declare function arrayContains(arr: SqlExpr, value: SqlExpr): SqlExpr;
export declare function arrayDifference(arr1: SqlExpr, arr2: SqlExpr): SqlExpr;
export declare function arrayDistinct(arr: SqlExpr): SqlExpr;
export declare function arrayFilter(arr: SqlExpr, predicate: SqlExpr): SqlExpr;
export declare function arrayFind(arr: SqlExpr, predicate: SqlExpr): SqlExpr;
export declare function arrayFirst(arr: SqlExpr): SqlExpr;
export declare function arrayFlatten(arr: SqlExpr): SqlExpr;
export declare function arrayGroup(arr: SqlExpr): SqlExpr;
export declare function arrayIntersect(arr1: SqlExpr, arr2: SqlExpr): SqlExpr;
export declare function arrayIsEmpty(arr: SqlExpr): SqlExpr;
export declare function arrayJoin(arr: SqlExpr, separator: SqlExpr): SqlExpr;
export declare function arrayLast(arr: SqlExpr): SqlExpr;
export declare function arrayLen(arr: SqlExpr): SqlExpr;
export declare function arrayMap(arr: SqlExpr, mapper: SqlExpr): SqlExpr;
export declare function arrayMax(arr: SqlExpr): SqlExpr;
export declare function arrayMin(arr: SqlExpr): SqlExpr;
export declare function arrayPop(arr: SqlExpr): SqlExpr;
export declare function arrayPrepend(arr: SqlExpr, value: SqlExpr): SqlExpr;
export declare function arrayPush(arr: SqlExpr, value: SqlExpr): SqlExpr;
export declare function arrayRemove(arr: SqlExpr, value: SqlExpr): SqlExpr;
export declare function arrayReverse(arr: SqlExpr): SqlExpr;
export declare function arrayShuffle(arr: SqlExpr): SqlExpr;
export declare function arraySlice(arr: SqlExpr, start: SqlExpr, end?: SqlExpr): SqlExpr;
export declare function arraySort(arr: SqlExpr, order?: SqlExpr): SqlExpr;
export declare function arrayStringJoin(arr: SqlExpr, separator: SqlExpr): SqlExpr;
export declare function arraySum(arr: SqlExpr): SqlExpr;
export declare function arrayUnion(arr1: SqlExpr, arr2: SqlExpr): SqlExpr;
export declare function arrayUnique(arr: SqlExpr): SqlExpr;
//# sourceMappingURL=array.d.ts.map