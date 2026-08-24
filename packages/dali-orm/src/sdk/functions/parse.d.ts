/**
 * parse::* — SurrealDB parse function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function parseEmailHost(email: SqlExpr): SqlExpr;
export declare function parseEmailUser(email: SqlExpr): SqlExpr;
export declare function parseUrlDomain(url: SqlExpr): SqlExpr;
export declare function parseUrlFragment(url: SqlExpr): SqlExpr;
export declare function parseUrlHost(url: SqlExpr): SqlExpr;
export declare function parseUrlPath(url: SqlExpr): SqlExpr;
export declare function parseUrlPort(url: SqlExpr): SqlExpr;
export declare function parseUrlQuery(url: SqlExpr): SqlExpr;
export declare function parseUrlScheme(url: SqlExpr): SqlExpr;
//# sourceMappingURL=parse.d.ts.map
