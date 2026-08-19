/**
 * rand::* — SurrealDB random function wrappers + bare rand().
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function rand(): SqlExpr;
export declare function randBool(): SqlExpr;
export declare function randEnum(...values: SqlExpr[]): SqlExpr;
export declare function randFloat(min?: SqlExpr, max?: SqlExpr): SqlExpr;
export declare function randGuid(): SqlExpr;
export declare function randInt(min?: SqlExpr, max?: SqlExpr): SqlExpr;
export declare function randString(len?: SqlExpr): SqlExpr;
export declare function randUuidV4(): SqlExpr;
export declare function randUuidV7(): SqlExpr;
//# sourceMappingURL=rand.d.ts.map