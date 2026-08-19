/**
 * count() / countAll() — SurrealDB aggregate function wrappers.
 *
 * All functions return SqlExpr for composition with other builders.
 */
import type { SqlExpr } from './sql.js';
/** Count records, optionally counting a specific expression */
export declare function count(expr?: SqlExpr): SqlExpr;
/** Alias: count all records */
export declare function countAll(): SqlExpr;
//# sourceMappingURL=count.d.ts.map