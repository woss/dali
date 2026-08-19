/**
 * sequence::* — SurrealDB sequence function wrappers.
 *
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function sequenceNext(seq: SqlExpr): SqlExpr;
export declare function sequencePeek(seq: SqlExpr): SqlExpr;
export declare function sequenceSet(seq: SqlExpr, val: SqlExpr): SqlExpr;
//# sourceMappingURL=sequence.d.ts.map