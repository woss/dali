/**
 * file::* — SurrealDB file system function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function filesGet(path: SqlExpr): SqlExpr;
export declare function filesPut(path: SqlExpr, data: SqlExpr): SqlExpr;
export declare function filesList(path: SqlExpr): SqlExpr;
export declare function filesDelete(path: SqlExpr): SqlExpr;
export declare function filesExists(path: SqlExpr): SqlExpr;
export declare function filesInfo(path: SqlExpr): SqlExpr;
//# sourceMappingURL=files.d.ts.map