/**
 * vector::* — SurrealDB vector function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function vectorAdd(v1: SqlExpr, v2: SqlExpr): SqlExpr {
  return `vector::add(${v1}, ${v2})` as SqlExpr;
}

export function vectorAngle(v1: SqlExpr, v2: SqlExpr): SqlExpr {
  return `vector::angle(${v1}, ${v2})` as SqlExpr;
}

export function vectorCross(v1: SqlExpr, v2: SqlExpr): SqlExpr {
  return `vector::cross(${v1}, ${v2})` as SqlExpr;
}

export function vectorDistance(v1: SqlExpr, v2: SqlExpr): SqlExpr {
  return `vector::distance(${v1}, ${v2})` as SqlExpr;
}

export function vectorDot(v1: SqlExpr, v2: SqlExpr): SqlExpr {
  return `vector::dot(${v1}, ${v2})` as SqlExpr;
}

export function vectorMagnitude(v: SqlExpr): SqlExpr {
  return `vector::magnitude(${v})` as SqlExpr;
}

export function vectorMultiply(v: SqlExpr, scalar: SqlExpr): SqlExpr {
  return `vector::multiply(${v}, ${scalar})` as SqlExpr;
}

export function vectorNormalize(v: SqlExpr): SqlExpr {
  return `vector::normalize(${v})` as SqlExpr;
}

export function vectorSimilarity(v1: SqlExpr, v2: SqlExpr): SqlExpr {
  return `vector::similarity(${v1}, ${v2})` as SqlExpr;
}
