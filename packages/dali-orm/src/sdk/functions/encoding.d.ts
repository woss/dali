/**
 * encoding::* — SurrealDB encoding function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function encodingBase64Encode(data: SqlExpr): SqlExpr;
export declare function encodingBase64Decode(data: SqlExpr): SqlExpr;
//# sourceMappingURL=encoding.d.ts.map