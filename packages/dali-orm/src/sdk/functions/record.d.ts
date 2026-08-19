/**
 * record::* — SurrealDB record function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function recordId(record: SqlExpr): SqlExpr;
export declare function recordTable(record: SqlExpr): SqlExpr;
//# sourceMappingURL=record.d.ts.map