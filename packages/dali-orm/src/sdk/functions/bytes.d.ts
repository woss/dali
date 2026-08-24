/**
 * bytes::* — SurrealDB bytes function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function bytesLen(data: SqlExpr): SqlExpr;
export declare function bytesResize(data: SqlExpr, len: SqlExpr): SqlExpr;
export declare function bytesReverse(data: SqlExpr): SqlExpr;
export declare function bytesToString(data: SqlExpr): SqlExpr;
export declare function bytesXor(a: SqlExpr, b: SqlExpr): SqlExpr;
export declare function bytesAnd(a: SqlExpr, b: SqlExpr): SqlExpr;
export declare function bytesOr(a: SqlExpr, b: SqlExpr): SqlExpr;
//# sourceMappingURL=bytes.d.ts.map
