/**
 * rand::* — SurrealDB random function wrappers + bare rand().
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function rand(): SqlExpr {
  return 'rand()' as SqlExpr;
}

export function randBool(): SqlExpr {
  return 'rand::bool()' as SqlExpr;
}

export function randEnum(...values: SqlExpr[]): SqlExpr {
  return `rand::enum(${values.join(', ')})` as SqlExpr;
}

export function randFloat(min?: SqlExpr, max?: SqlExpr): SqlExpr {
  if (min !== undefined && max !== undefined) {
    return `rand::float(${min}, ${max})` as SqlExpr;
  }
  if (min !== undefined) {
    return `rand::float(${min})` as SqlExpr;
  }
  return 'rand::float()' as SqlExpr;
}

export function randGuid(): SqlExpr {
  return 'rand::guid()' as SqlExpr;
}

export function randInt(min?: SqlExpr, max?: SqlExpr): SqlExpr {
  if (min !== undefined && max !== undefined) {
    return `rand::int(${min}, ${max})` as SqlExpr;
  }
  if (min !== undefined) {
    return `rand::int(${min})` as SqlExpr;
  }
  return 'rand::int()' as SqlExpr;
}

export function randString(len?: SqlExpr): SqlExpr {
  return len !== undefined
    ? (`rand::string(${len})` as SqlExpr)
    : ('rand::string()' as SqlExpr);
}

export function randUuidV4(): SqlExpr {
  return 'rand::uuid::v4()' as SqlExpr;
}

export function randUuidV7(): SqlExpr {
  return 'rand::uuid::v7()' as SqlExpr;
}
