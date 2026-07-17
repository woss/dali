/**
 * Query Builder - Public API
 *
 * Type-safe query builders for SurrealDB operations.
 * Each builder wraps the driver's native SDK methods with fluent chaining.
 *
 * Database function wrappers (count, math::*, string::*, etc.) are
 * available from '@woss/dali-orm/sdk/functions'.
 */

// Re-exports
export type { DaliORM } from '../sdk/dali-orm.js';

// Binding
export type { TableBinding } from './binding.js';
export { bindTable } from './binding.js';

// Model
export { Model, createModel } from './model.js';

// Conditions
export {
  allConditions,
  and,
  anyConditions,
  buildCondition,
  cast,
  type ConditionOp,
  graphFieldPath,
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
  type Condition,
} from './conditions.js';
// Create
export { CreateBuilder, create } from './create.js';
// Delete
export { DeleteBuilder, delete_ } from './delete.js';

// Serializer (shared condition serialization utilities)
export { andTrees, serializeCondition, serializedConditionToNode } from './serializer.js';

// Insert
export { InsertBuilder, insert } from './insert.js';
// Live
export { LiveQueryBuilder, LiveSubscription, live } from './live.js';
// Relate + GraphPath
export { GraphPath, GraphPathContinuation, graphPath, RelateBuilder, relate } from './relate.js';
// Select
export { SelectBuilder, select, WhereBuilder } from './select.js';
// Types
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
// Statements
export {
  BeginBuilder,
  beginTransaction,
  CancelBuilder,
  cancelTransaction,
  CommitBuilder,
  commitTransaction,
  DefineParamBuilder,
  defineParam,
  InfoBuilder,
  info,
  type InfoScope,
  KillBuilder,
  kill,
  LetBuilder,
  let_,
  RebuildIndexBuilder,
  rebuildIndex,
  ReturnBuilder,
  return_,
  ShowChangesBuilder,
  showChanges,
  ThrowBuilder,
  throw_,
  UseBuilder,
  use,
} from './statements.js';

// Update
export { UpdateBuilder, update } from './update.js';
// Upsert
export { UpsertBuilder, upsert } from './upsert.js';
