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
export {
  allConditions,
  and,
  anyConditions,
  buildCondition,
  type Condition,
  type ConditionOp,
  cast,
  contains,
  containsAll,
  containsAny,
  containsNone,
  type Expr,
  type ExprCtx,
  type ExprLike,
  eeq,
  eq,
  expr,
  graphFieldPath,
  gt,
  gte,
  inside,
  intersects,
  isNotNull,
  isNull,
  isSerializedCondition,
  lt,
  lte,
  ne,
  negateCondition,
  not,
  or,
  outside,
  raw,
  type SerializedCondition,
} from './conditions.js';
export { CreateBuilder, create } from './create.js';
export { DeleteBuilder, delete_ } from './delete.js';
export { InsertBuilder, insert } from './insert.js';
export { LiveQueryBuilder, LiveSubscription, live } from './live.js';
export { createModel, Model } from './model.js';
export {
  GraphPath,
  GraphPathContinuation,
  graphPath,
  RelateBuilder,
  relate,
} from './relate.js';
export { SelectBuilder, select, WhereBuilder } from './select.js';
export {
  andTrees,
  serializeCondition,
  serializedConditionToNode,
} from './serializer.js';
export {
  BeginBuilder,
  beginTransaction,
  CancelBuilder,
  CommitBuilder,
  cancelTransaction,
  commitTransaction,
  DefineParamBuilder,
  defineParam,
  InfoBuilder,
  type InfoScope,
  info,
  KillBuilder,
  kill,
  LetBuilder,
  let_,
  RebuildIndexBuilder,
  ReturnBuilder,
  rebuildIndex,
  return_,
  ShowChangesBuilder,
  showChanges,
  ThrowBuilder,
  throw_,
  UseBuilder,
  use,
} from './statements.js';
export type {
  ColumnRef,
  ColumnsToRecord,
  ColumnType,
  InferInsertInput,
  InferRelateInput,
  InferRelateResult,
  InferSelection,
  InferSelectResult,
  InferTypedRecord,
  InferUpdateInput,
  SelectField,
  WithGraphAliases,
} from './types.js';
export { columnRef, isRelationTable } from './types.js';
export { UpdateBuilder, update } from './update.js';
export { UpsertBuilder, upsert } from './upsert.js';
//# sourceMappingURL=index.d.ts.map
