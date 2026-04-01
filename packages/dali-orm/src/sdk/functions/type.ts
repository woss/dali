/**
 * type::* — SurrealDB type conversion function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function typeBool(expr: SqlExpr): SqlExpr {
  return `type::bool(${expr})` as SqlExpr;
}

export function typeDatetime(expr: SqlExpr): SqlExpr {
  return `type::datetime(${expr})` as SqlExpr;
}

export function typeDecimal(expr: SqlExpr): SqlExpr {
  return `type::decimal(${expr})` as SqlExpr;
}

export function typeDuration(expr: SqlExpr): SqlExpr {
  return `type::duration(${expr})` as SqlExpr;
}

export function typeFloat(expr: SqlExpr): SqlExpr {
  return `type::float(${expr})` as SqlExpr;
}

export function typeInt(expr: SqlExpr): SqlExpr {
  return `type::int(${expr})` as SqlExpr;
}

export function typeNumber(expr: SqlExpr): SqlExpr {
  return `type::number(${expr})` as SqlExpr;
}

export function typePoint(lng: SqlExpr, lat: SqlExpr): SqlExpr {
  return `type::point(${lng}, ${lat})` as SqlExpr;
}

export function typeString(expr: SqlExpr): SqlExpr {
  return `type::string(${expr})` as SqlExpr;
}

export function typeThing(table: SqlExpr, id: SqlExpr): SqlExpr {
  return `type::thing(${table}, ${id})` as SqlExpr;
}

export function typeField(name: SqlExpr): SqlExpr {
  return `type::field(${name})` as SqlExpr;
}

export function typeRecord(tb: SqlExpr, id: SqlExpr): SqlExpr {
  return `type::record(${tb}, ${id})` as SqlExpr;
}

// ============================================================================
// Type inspection
// ============================================================================

export function typeIsArray(val: SqlExpr): SqlExpr {
  return `type::is_array(${val})` as SqlExpr;
}

export function typeIsBool(val: SqlExpr): SqlExpr {
  return `type::is_bool(${val})` as SqlExpr;
}

export function typeIsDatetime(val: SqlExpr): SqlExpr {
  return `type::is_datetime(${val})` as SqlExpr;
}

export function typeIsDecimal(val: SqlExpr): SqlExpr {
  return `type::is_decimal(${val})` as SqlExpr;
}

export function typeIsDuration(val: SqlExpr): SqlExpr {
  return `type::is_duration(${val})` as SqlExpr;
}

export function typeIsFloat(val: SqlExpr): SqlExpr {
  return `type::is_float(${val})` as SqlExpr;
}

export function typeIsInt(val: SqlExpr): SqlExpr {
  return `type::is_int(${val})` as SqlExpr;
}

export function typeIsNumber(val: SqlExpr): SqlExpr {
  return `type::is_number(${val})` as SqlExpr;
}

export function typeIsObject(val: SqlExpr): SqlExpr {
  return `type::is_object(${val})` as SqlExpr;
}

export function typeIsPoint(val: SqlExpr): SqlExpr {
  return `type::is_point(${val})` as SqlExpr;
}

export function typeIsRecord(val: SqlExpr): SqlExpr {
  return `type::is_record(${val})` as SqlExpr;
}

export function typeIsString(val: SqlExpr): SqlExpr {
  return `type::is_string(${val})` as SqlExpr;
}
