/**
 * Create Query Builder
 *
 * Type-safe CREATE builder for SurrealDB.
 * Supports optional record ID and field-by-field data setting.
 */
import type { DaliORM } from '../sdk/dali-orm.js';
import type { TableDefinition } from '../sdk/table.js';
import type { InferSelectResult } from './types.js';
export declare class CreateBuilder<
  TDef extends TableDefinition,
  TResult = InferSelectResult<TDef>,
> {
  private readonly driver;
  private readonly tableDef;
  private recordId?;
  private _data;
  constructor(orm: DaliORM, tableDef: TDef);
  /** Set record ID (e.g., "john" → "user:john") */
  id(recordId: string): this;
  /** Set a single field value */
  set(field: string, value: unknown): this;
  /** Set all data at once (replaces existing data) */
  data(obj: Record<string, unknown>): this;
  /** Execute the CREATE query */
  execute(): Promise<TResult[]>;
}
/** Factory function */
export declare function create<TDef extends TableDefinition>(
  orm: DaliORM,
  tableDef: TDef,
): CreateBuilder<TDef>;
//# sourceMappingURL=create.d.ts.map
