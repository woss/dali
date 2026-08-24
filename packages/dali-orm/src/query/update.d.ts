/**
 * Update Query Builder
 *
 * Type-safe UPDATE builder for SurrealDB.
 * Supports updating all records, a specific record by ID, or with conditions.
 */
import type { DaliORM } from '../sdk/dali-orm.js';
import type { TableDefinition } from '../sdk/table.js';
import type { InferSelectResult } from './types.js';
export declare class UpdateBuilder<
  TDef extends TableDefinition,
  TResult = InferSelectResult<TDef>,
> {
  private readonly driver;
  private readonly tableDef;
  private recordId?;
  private _data;
  constructor(orm: DaliORM, tableDef: TDef);
  /** Target specific record by ID */
  id(recordId: string): this;
  /** Set a single field value */
  set(field: string, value: unknown): this;
  /** Set all data at once (replaces existing data) */
  data(obj: Record<string, unknown>): this;
  /** Execute the UPDATE query */
  execute(): Promise<TResult[]>;
}
/** Factory function */
export declare function update<TDef extends TableDefinition>(
  orm: DaliORM,
  tableDef: TDef,
): UpdateBuilder<TDef>;
//# sourceMappingURL=update.d.ts.map
