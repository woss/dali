/**
 * http::* — SurrealDB HTTP function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function httpGet(url: SqlExpr, headers?: SqlExpr): SqlExpr;
export declare function httpHead(url: SqlExpr, headers?: SqlExpr): SqlExpr;
export declare function httpPatch(url: SqlExpr, data: SqlExpr, headers?: SqlExpr): SqlExpr;
export declare function httpPost(url: SqlExpr, data: SqlExpr, headers?: SqlExpr): SqlExpr;
export declare function httpPut(url: SqlExpr, data: SqlExpr, headers?: SqlExpr): SqlExpr;
export declare function httpDelete(url: SqlExpr, headers?: SqlExpr): SqlExpr;
//# sourceMappingURL=http.d.ts.map