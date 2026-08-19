/**
 * Query Builder - Public API
 *
 * Type-safe query builders for SurrealDB operations.
 * Each builder wraps the driver's native SDK methods with fluent chaining.
 *
 * Database function wrappers (count, math::*, string::*, etc.) are
 * available from '@woss/dali-orm/sdk/functions'.
 */
export type { DaliORM } from '../sdk/dali-orm.js';
export type { TableBinding } from './binding.js';
export { bindTable } from './binding.js';
export { Model, createModel } from './model.js';
export { allConditions, and, anyConditions, buildCondition, cast, type ConditionOp, graphFieldPath, contains, containsAll, containsAny, containsNone, type Expr, type ExprCtx, type ExprLike, eeq, eq, expr, gt, gte, inside, intersects, isNotNull, isNull, isSerializedCondition, lt, lte, ne, negateCondition, not, or, outside, raw, type SerializedCondition, type Condition, } from './conditions.js';
export { CreateBuilder, create } from './create.js';
export { DeleteBuilder, delete_ } from './delete.js';
export { andTrees, serializeCondition, serializedConditionToNode } from './serializer.js';
export { InsertBuilder, insert } from './insert.js';
export { LiveQueryBuilder, LiveSubscription, live } from './live.js';
export { GraphPath, GraphPathContinuation, graphPath, RelateBuilder, relate } from './relate.js';
export { SelectBuilder, select, WhereBuilder } from './select.js';
export type { ColumnRef, ColumnsToRecord, ColumnType, InferInsertInput, InferRelateInput, InferRelateResult, InferSelection, InferSelectResult, InferTypedRecord, InferUpdateInput, SelectField, WithGraphAliases, } from './types.js';
export { columnRef, isRelationTable } from './types.js';
export { BeginBuilder, beginTransaction, CancelBuilder, cancelTransaction, CommitBuilder, commitTransaction, DefineParamBuilder, defineParam, InfoBuilder, info, type InfoScope, KillBuilder, kill, LetBuilder, let_, RebuildIndexBuilder, rebuildIndex, ReturnBuilder, return_, ShowChangesBuilder, showChanges, ThrowBuilder, throw_, UseBuilder, use, } from './statements.js';
export { UpdateBuilder, update } from './update.js';
export { UpsertBuilder, upsert } from './upsert.js';
//# sourceMappingURL=index.d.ts.map