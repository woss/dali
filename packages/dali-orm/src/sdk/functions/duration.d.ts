/**
 * duration::* — SurrealDB duration function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function durationDays(d: SqlExpr): SqlExpr;
export declare function durationHours(d: SqlExpr): SqlExpr;
export declare function durationMicros(d: SqlExpr): SqlExpr;
export declare function durationMillis(d: SqlExpr): SqlExpr;
export declare function durationMins(d: SqlExpr): SqlExpr;
export declare function durationNanos(d: SqlExpr): SqlExpr;
export declare function durationSecs(d: SqlExpr): SqlExpr;
export declare function durationWeeks(d: SqlExpr): SqlExpr;
/** duration::max constant for maximum possible duration */
export declare const DURATION_MAX: SqlExpr;
//# sourceMappingURL=duration.d.ts.map
