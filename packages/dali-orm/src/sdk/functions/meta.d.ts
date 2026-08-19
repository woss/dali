/**
 * meta::* — SurrealDB metadata function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function metaId(record: SqlExpr): SqlExpr;
export declare function metaTable(record: SqlExpr): SqlExpr;
export declare function metaTb(record: SqlExpr): SqlExpr;
//# sourceMappingURL=meta.d.ts.map