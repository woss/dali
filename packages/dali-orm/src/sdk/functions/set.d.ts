/**
 * set::* — SurrealDB set function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function setAdd(set: SqlExpr, value: SqlExpr): SqlExpr;
export declare function setDifference(set1: SqlExpr, set2: SqlExpr): SqlExpr;
export declare function setIntersect(set1: SqlExpr, set2: SqlExpr): SqlExpr;
export declare function setIsEmpty(set: SqlExpr): SqlExpr;
export declare function setIsEqual(set1: SqlExpr, set2: SqlExpr): SqlExpr;
export declare function setLen(set: SqlExpr): SqlExpr;
export declare function setRemove(set: SqlExpr, value: SqlExpr): SqlExpr;
export declare function setSort(set: SqlExpr): SqlExpr;
export declare function setUnion(set1: SqlExpr, set2: SqlExpr): SqlExpr;
//# sourceMappingURL=set.d.ts.map
