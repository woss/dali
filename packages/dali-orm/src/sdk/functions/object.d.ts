/**
 * object::* — SurrealDB object function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function objectEntries(obj: SqlExpr): SqlExpr;
export declare function objectExtend(obj: SqlExpr, other: SqlExpr): SqlExpr;
export declare function objectFromEntries(arr: SqlExpr): SqlExpr;
export declare function objectIsEmpty(obj: SqlExpr): SqlExpr;
export declare function objectKeys(obj: SqlExpr): SqlExpr;
export declare function objectLen(obj: SqlExpr): SqlExpr;
export declare function objectRemove(obj: SqlExpr, ...keys: SqlExpr[]): SqlExpr;
export declare function objectValues(obj: SqlExpr): SqlExpr;
//# sourceMappingURL=object.d.ts.map