/**
 * session::* — SurrealDB session function wrappers.
 *
 * All are no-arg functions returning session metadata.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function sessionExpiry(): SqlExpr;
export declare function sessionId(): SqlExpr;
export declare function sessionOrigin(): SqlExpr;
export declare function sessionSc(): SqlExpr;
export declare function sessionToken(): SqlExpr;
export declare function sessionUser(): SqlExpr;
//# sourceMappingURL=session.d.ts.map
