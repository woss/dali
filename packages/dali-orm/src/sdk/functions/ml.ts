/**
 * ml::* — SurrealDB machine learning function wrappers.
 *
 * Wraps SurrealQL ML functions for model training and inference.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function mlPredict(model: SqlExpr, input: SqlExpr): SqlExpr {
  return `ml::predict(${model}, ${input})` as SqlExpr;
}

export function mlTrain(
  model: SqlExpr,
  type: SqlExpr,
  input: SqlExpr,
): SqlExpr {
  return `ml::train(${model}, ${type}, ${input})` as SqlExpr;
}
