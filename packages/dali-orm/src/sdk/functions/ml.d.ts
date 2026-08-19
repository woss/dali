/**
 * ml::* — SurrealDB machine learning function wrappers.
 *
 * Wraps SurrealQL ML functions for model training and inference.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function mlPredict(model: SqlExpr, input: SqlExpr): SqlExpr;
export declare function mlTrain(model: SqlExpr, type: SqlExpr, input: SqlExpr): SqlExpr;
//# sourceMappingURL=ml.d.ts.map