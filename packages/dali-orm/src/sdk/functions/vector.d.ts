/**
 * vector::* — SurrealDB vector function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function vectorAdd(v1: SqlExpr, v2: SqlExpr): SqlExpr;
export declare function vectorAngle(v1: SqlExpr, v2: SqlExpr): SqlExpr;
export declare function vectorCross(v1: SqlExpr, v2: SqlExpr): SqlExpr;
export declare function vectorDistance(v1: SqlExpr, v2: SqlExpr): SqlExpr;
export declare function vectorDot(v1: SqlExpr, v2: SqlExpr): SqlExpr;
export declare function vectorMagnitude(v: SqlExpr): SqlExpr;
export declare function vectorMultiply(v: SqlExpr, scalar: SqlExpr): SqlExpr;
export declare function vectorNormalize(v: SqlExpr): SqlExpr;
export declare function vectorSimilarity(v1: SqlExpr, v2: SqlExpr): SqlExpr;
//# sourceMappingURL=vector.d.ts.map
