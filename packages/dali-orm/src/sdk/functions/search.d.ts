/**
 * search::* — SurrealDB search function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function searchHighlight(
  excerpt: SqlExpr,
  fields?: SqlExpr,
): SqlExpr;
export declare function searchScore(excerpt: SqlExpr): SqlExpr;
//# sourceMappingURL=search.d.ts.map
