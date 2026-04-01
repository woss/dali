/**
 * duration::* — SurrealDB duration function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function durationDays(d: SqlExpr): SqlExpr {
  return `duration::days(${d})` as SqlExpr;
}

export function durationHours(d: SqlExpr): SqlExpr {
  return `duration::hours(${d})` as SqlExpr;
}

export function durationMicros(d: SqlExpr): SqlExpr {
  return `duration::micros(${d})` as SqlExpr;
}

export function durationMillis(d: SqlExpr): SqlExpr {
  return `duration::millis(${d})` as SqlExpr;
}

export function durationMins(d: SqlExpr): SqlExpr {
  return `duration::mins(${d})` as SqlExpr;
}

export function durationNanos(d: SqlExpr): SqlExpr {
  return `duration::nanos(${d})` as SqlExpr;
}

export function durationSecs(d: SqlExpr): SqlExpr {
  return `duration::secs(${d})` as SqlExpr;
}

export function durationWeeks(d: SqlExpr): SqlExpr {
  return `duration::weeks(${d})` as SqlExpr;
}

/** duration::max constant for maximum possible duration */
export const DURATION_MAX = 'duration::max' as SqlExpr;
