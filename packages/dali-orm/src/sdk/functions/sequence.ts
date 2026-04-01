/**
 * sequence::* — SurrealDB sequence function wrappers.
 *
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function sequenceNext(seq: SqlExpr): SqlExpr {
  return `sequence::next(${seq})` as SqlExpr;
}

export function sequencePeek(seq: SqlExpr): SqlExpr {
  return `sequence::peek(${seq})` as SqlExpr;
}

export function sequenceSet(seq: SqlExpr, val: SqlExpr): SqlExpr {
  return `sequence::set(${seq}, ${val})` as SqlExpr;
}
