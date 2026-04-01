/**
 * session::* — SurrealDB session function wrappers.
 *
 * All are no-arg functions returning session metadata.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function sessionExpiry(): SqlExpr {
  return 'session::expiry()' as SqlExpr;
}

export function sessionId(): SqlExpr {
  return 'session::id()' as SqlExpr;
}

export function sessionOrigin(): SqlExpr {
  return 'session::origin()' as SqlExpr;
}

export function sessionSc(): SqlExpr {
  return 'session::sc()' as SqlExpr;
}

export function sessionToken(): SqlExpr {
  return 'session::token()' as SqlExpr;
}

export function sessionUser(): SqlExpr {
  return 'session::user()' as SqlExpr;
}
