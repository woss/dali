/**
 * bytes::* — SurrealDB bytes function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function bytesLen(data: SqlExpr): SqlExpr {
  return `bytes::len(${data})` as SqlExpr;
}

export function bytesResize(data: SqlExpr, len: SqlExpr): SqlExpr {
  return `bytes::resize(${data}, ${len})` as SqlExpr;
}

export function bytesReverse(data: SqlExpr): SqlExpr {
  return `bytes::reverse(${data})` as SqlExpr;
}

export function bytesToString(data: SqlExpr): SqlExpr {
  return `bytes::to_string(${data})` as SqlExpr;
}

export function bytesXor(a: SqlExpr, b: SqlExpr): SqlExpr {
  return `bytes::xor(${a}, ${b})` as SqlExpr;
}

export function bytesAnd(a: SqlExpr, b: SqlExpr): SqlExpr {
  return `bytes::and(${a}, ${b})` as SqlExpr;
}

export function bytesOr(a: SqlExpr, b: SqlExpr): SqlExpr {
  return `bytes::or(${a}, ${b})` as SqlExpr;
}
