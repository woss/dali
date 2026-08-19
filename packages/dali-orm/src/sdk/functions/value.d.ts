/**
 * value::* — SurrealDB value function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function valueArrays(val: SqlExpr): SqlExpr;
export declare function valueBooleans(val: SqlExpr): SqlExpr;
export declare function valueDatetimes(val: SqlExpr): SqlExpr;
export declare function valueDecimals(val: SqlExpr): SqlExpr;
export declare function valueDurations(val: SqlExpr): SqlExpr;
export declare function valueFloats(val: SqlExpr): SqlExpr;
export declare function valueInts(val: SqlExpr): SqlExpr;
export declare function valueNumbers(val: SqlExpr): SqlExpr;
export declare function valueObjects(val: SqlExpr): SqlExpr;
export declare function valuePoints(val: SqlExpr): SqlExpr;
export declare function valueStrings(val: SqlExpr): SqlExpr;
export declare function valueTable(val: SqlExpr): SqlExpr;
export declare function valueThing(val: SqlExpr): SqlExpr;
//# sourceMappingURL=value.d.ts.map