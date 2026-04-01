/**
 * encoding::* — SurrealDB encoding function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function encodingBase64Encode(data: SqlExpr): SqlExpr {
  return `encoding::base64::encode(${data})` as SqlExpr;
}

export function encodingBase64Decode(data: SqlExpr): SqlExpr {
  return `encoding::base64::decode(${data})` as SqlExpr;
}
