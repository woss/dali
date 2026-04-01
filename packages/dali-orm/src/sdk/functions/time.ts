/**
 * time::* — SurrealDB time/date function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function timeNow(): SqlExpr {
  return 'time::now()' as SqlExpr;
}

export function timeDay(date: SqlExpr): SqlExpr {
  return `time::day(${date})` as SqlExpr;
}

export function timeFloor(date: SqlExpr, duration: SqlExpr): SqlExpr {
  return `time::floor(${date}, ${duration})` as SqlExpr;
}

export function timeFormat(date: SqlExpr, format: SqlExpr): SqlExpr {
  return `time::format(${date}, ${format})` as SqlExpr;
}

export function timeGroup(date: SqlExpr, duration: SqlExpr): SqlExpr {
  return `time::group(${date}, ${duration})` as SqlExpr;
}

export function timeHour(date: SqlExpr): SqlExpr {
  return `time::hour(${date})` as SqlExpr;
}

export function timeMicros(date: SqlExpr): SqlExpr {
  return `time::micros(${date})` as SqlExpr;
}

export function timeMillis(date: SqlExpr): SqlExpr {
  return `time::millis(${date})` as SqlExpr;
}

export function timeMinute(date: SqlExpr): SqlExpr {
  return `time::minute(${date})` as SqlExpr;
}

export function timeMonth(date: SqlExpr): SqlExpr {
  return `time::month(${date})` as SqlExpr;
}

export function timeNanos(date: SqlExpr): SqlExpr {
  return `time::nanos(${date})` as SqlExpr;
}

export function timeRound(date: SqlExpr, duration: SqlExpr): SqlExpr {
  return `time::round(${date}, ${duration})` as SqlExpr;
}

export function timeSecond(date: SqlExpr): SqlExpr {
  return `time::second(${date})` as SqlExpr;
}

export function timeTimezone(): SqlExpr {
  return 'time::timezone()' as SqlExpr;
}

export function timeUnix(date: SqlExpr): SqlExpr {
  return `time::unix(${date})` as SqlExpr;
}

export function timeWeekday(date: SqlExpr): SqlExpr {
  return `time::wday(${date})` as SqlExpr;
}

export function timeWeek(date: SqlExpr): SqlExpr {
  return `time::week(${date})` as SqlExpr;
}

export function timeYear(date: SqlExpr): SqlExpr {
  return `time::year(${date})` as SqlExpr;
}
