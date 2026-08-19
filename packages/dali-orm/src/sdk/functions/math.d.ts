/**
 * math::* — SurrealDB math function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function mathAbs(expr: SqlExpr): SqlExpr;
export declare function mathAcos(expr: SqlExpr): SqlExpr;
export declare function mathAsin(expr: SqlExpr): SqlExpr;
export declare function mathAtan(expr: SqlExpr): SqlExpr;
export declare function mathAtan2(y: SqlExpr, x: SqlExpr): SqlExpr;
export declare function mathCeil(expr: SqlExpr): SqlExpr;
export declare function mathCos(expr: SqlExpr): SqlExpr;
export declare function mathDeg(radians: SqlExpr): SqlExpr;
export declare function mathExp(expr: SqlExpr): SqlExpr;
export declare function mathFixed(expr: SqlExpr, decimals: SqlExpr): SqlExpr;
export declare function mathFloor(expr: SqlExpr): SqlExpr;
export declare function mathLog(expr: SqlExpr): SqlExpr;
export declare function mathLog10(expr: SqlExpr): SqlExpr;
export declare function mathLog2(expr: SqlExpr): SqlExpr;
export declare function mathMax(...exprs: SqlExpr[]): SqlExpr;
export declare function mathMean(...exprs: SqlExpr[]): SqlExpr;
export declare function mathMedian(...exprs: SqlExpr[]): SqlExpr;
export declare function mathMin(...exprs: SqlExpr[]): SqlExpr;
export declare function mathProduct(...exprs: SqlExpr[]): SqlExpr;
export declare function mathRad(degrees: SqlExpr): SqlExpr;
export declare function mathRandom(): SqlExpr;
export declare function mathRound(expr: SqlExpr): SqlExpr;
export declare function mathSin(expr: SqlExpr): SqlExpr;
export declare function mathSqrt(expr: SqlExpr): SqlExpr;
export declare function mathStddev(...exprs: SqlExpr[]): SqlExpr;
export declare function mathSum(...exprs: SqlExpr[]): SqlExpr;
export declare function mathTan(expr: SqlExpr): SqlExpr;
export declare function mathTrunc(expr: SqlExpr): SqlExpr;
export declare function mathVariance(...exprs: SqlExpr[]): SqlExpr;
//# sourceMappingURL=math.d.ts.map