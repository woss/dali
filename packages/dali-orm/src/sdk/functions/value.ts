/**
 * value::* — SurrealDB value function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function valueArrays(val: SqlExpr): SqlExpr {
  return `value::arrays(${val})` as SqlExpr;
}

export function valueBooleans(val: SqlExpr): SqlExpr {
  return `value::booleans(${val})` as SqlExpr;
}

export function valueDatetimes(val: SqlExpr): SqlExpr {
  return `value::datetimes(${val})` as SqlExpr;
}

export function valueDecimals(val: SqlExpr): SqlExpr {
  return `value::decimals(${val})` as SqlExpr;
}

export function valueDurations(val: SqlExpr): SqlExpr {
  return `value::durations(${val})` as SqlExpr;
}

export function valueFloats(val: SqlExpr): SqlExpr {
  return `value::floats(${val})` as SqlExpr;
}

export function valueInts(val: SqlExpr): SqlExpr {
  return `value::ints(${val})` as SqlExpr;
}

export function valueNumbers(val: SqlExpr): SqlExpr {
  return `value::numbers(${val})` as SqlExpr;
}

export function valueObjects(val: SqlExpr): SqlExpr {
  return `value::objects(${val})` as SqlExpr;
}

export function valuePoints(val: SqlExpr): SqlExpr {
  return `value::points(${val})` as SqlExpr;
}

export function valueStrings(val: SqlExpr): SqlExpr {
  return `value::strings(${val})` as SqlExpr;
}

export function valueTable(val: SqlExpr): SqlExpr {
  return `value::table(${val})` as SqlExpr;
}

export function valueThing(val: SqlExpr): SqlExpr {
  return `value::thing(${val})` as SqlExpr;
}
