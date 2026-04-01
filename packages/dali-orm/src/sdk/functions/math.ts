/**
 * math::* — SurrealDB math function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function mathAbs(expr: SqlExpr): SqlExpr {
  return `math::abs(${expr})` as SqlExpr;
}

export function mathAcos(expr: SqlExpr): SqlExpr {
  return `math::acos(${expr})` as SqlExpr;
}

export function mathAsin(expr: SqlExpr): SqlExpr {
  return `math::asin(${expr})` as SqlExpr;
}

export function mathAtan(expr: SqlExpr): SqlExpr {
  return `math::atan(${expr})` as SqlExpr;
}

export function mathAtan2(y: SqlExpr, x: SqlExpr): SqlExpr {
  return `math::atan2(${y}, ${x})` as SqlExpr;
}

export function mathCeil(expr: SqlExpr): SqlExpr {
  return `math::ceil(${expr})` as SqlExpr;
}

export function mathCos(expr: SqlExpr): SqlExpr {
  return `math::cos(${expr})` as SqlExpr;
}

export function mathDeg(radians: SqlExpr): SqlExpr {
  return `math::deg(${radians})` as SqlExpr;
}

export function mathExp(expr: SqlExpr): SqlExpr {
  return `math::exp(${expr})` as SqlExpr;
}

export function mathFixed(expr: SqlExpr, decimals: SqlExpr): SqlExpr {
  return `math::fixed(${expr}, ${decimals})` as SqlExpr;
}

export function mathFloor(expr: SqlExpr): SqlExpr {
  return `math::floor(${expr})` as SqlExpr;
}

export function mathLog(expr: SqlExpr): SqlExpr {
  return `math::log(${expr})` as SqlExpr;
}

export function mathLog10(expr: SqlExpr): SqlExpr {
  return `math::log10(${expr})` as SqlExpr;
}

export function mathLog2(expr: SqlExpr): SqlExpr {
  return `math::log2(${expr})` as SqlExpr;
}

export function mathMax(...exprs: SqlExpr[]): SqlExpr {
  return `math::max([${exprs.join(', ')}])` as SqlExpr;
}

export function mathMean(...exprs: SqlExpr[]): SqlExpr {
  return `math::mean([${exprs.join(', ')}])` as SqlExpr;
}

export function mathMedian(...exprs: SqlExpr[]): SqlExpr {
  return `math::median([${exprs.join(', ')}])` as SqlExpr;
}

export function mathMin(...exprs: SqlExpr[]): SqlExpr {
  return `math::min([${exprs.join(', ')}])` as SqlExpr;
}

export function mathProduct(...exprs: SqlExpr[]): SqlExpr {
  return `math::product([${exprs.join(', ')}])` as SqlExpr;
}

export function mathRad(degrees: SqlExpr): SqlExpr {
  return `math::rad(${degrees})` as SqlExpr;
}

export function mathRandom(): SqlExpr {
  return 'rand()' as SqlExpr;
}

export function mathRound(expr: SqlExpr): SqlExpr {
  return `math::round(${expr})` as SqlExpr;
}

export function mathSin(expr: SqlExpr): SqlExpr {
  return `math::sin(${expr})` as SqlExpr;
}

export function mathSqrt(expr: SqlExpr): SqlExpr {
  return `math::sqrt(${expr})` as SqlExpr;
}

export function mathStddev(...exprs: SqlExpr[]): SqlExpr {
  return `math::stddev([${exprs.join(', ')}])` as SqlExpr;
}

export function mathSum(...exprs: SqlExpr[]): SqlExpr {
  return `math::sum([${exprs.join(', ')}])` as SqlExpr;
}

export function mathTan(expr: SqlExpr): SqlExpr {
  return `math::tan(${expr})` as SqlExpr;
}

export function mathTrunc(expr: SqlExpr): SqlExpr {
  return `math::trunc(${expr})` as SqlExpr;
}

export function mathVariance(...exprs: SqlExpr[]): SqlExpr {
  return `math::variance([${exprs.join(', ')}])` as SqlExpr;
}
