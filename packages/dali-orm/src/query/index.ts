/**
 * Query Builder - Public API
 *
 * Type-safe query builders for SurrealDB operations.
 * Each builder wraps the driver's native SDK methods with fluent chaining.
 *
 * Database function wrappers (count, math::*, string::*, etc.) are
 * available from '@woss/dali-orm/functions'.
 */

// Binding
export type { TableBinding } from './binding.js';
export { bindTable } from './binding.js';

// Conditions
export {
  allConditions,
  and,
  anyConditions,
  buildCondition,
  type ConditionOp,
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
  type SurrealCondition,
} from './conditions.js';
// Create
export { CreateBuilder, create } from './create.js';
// Delete
export { DeleteBuilder, delete_ } from './delete.js';

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
  InferSelection,
  InferSelectResult,
  InferTypedRecord,
  InferUpdateInput,
  SelectField,
  WithGraphAliases,
} from './types.js';
export { columnRef, isRelationTable } from './types.js';
// Update
export { UpdateBuilder, update } from './update.js';
// Upsert
export { UpsertBuilder, upsert } from './upsert.js';
