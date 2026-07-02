/**
 * Upsert Query Builder
 *
 * Type-safe UPSERT builder for SurrealDB.
 * Creates or replaces a record by ID.
 */

import type { SurrealDriver } from '../sdk/driver/types.js';
import type { DaliORM } from '../sdk/dali-orm.js';
import type { TableDefinition } from '../sdk/table.js';
import type { InferSelectResult } from './types.js';

export class UpsertBuilder<TDef extends TableDefinition, TResult = InferSelectResult<TDef>> {
  private readonly driver: SurrealDriver;
  private readonly tableDef: TDef;
  private _data: Record<string, unknown> = {};

  constructor(orm: DaliORM, tableDef: TDef) {
    if (!orm) throw new Error('DaliORM instance is required');
    if (!tableDef?.name) throw new Error('Table definition with name is required');

    this.driver = orm.getDriver();
    this.tableDef = tableDef;
  }

  /** Set a single field value */
  set(field: string, value: unknown): this;
  set(field: string, value: unknown): this {
    if (!field || typeof field !== 'string') throw new Error('Field name is required');
    this._data[field] = value;
    return this;
  }

  /** Set all data at once (replaces existing data) */
  data(obj: Record<string, unknown>): this;
  data(obj: Record<string, unknown>): this {
    if (!obj || typeof obj !== 'object') throw new Error('Data object is required');
    this._data = { ...obj };
    return this;
  }

  /** Execute the UPSERT query with a target record ID */
  async execute(id: string): Promise<TResult[]> {
    if (!id) throw new Error('Record ID is required for upsert');
    if (Object.keys(this._data).length === 0) {
      throw new Error('Cannot upsert with empty data - use .data() or .set() first');
    }

    return this.driver.upsert<TResult>(`${this.tableDef.name}:${id}`, this._data);
  }
}

/** Factory function */
export function upsert<TDef extends TableDefinition>(
  orm: DaliORM,
  tableDef: TDef,
): UpsertBuilder<TDef> {
  return new UpsertBuilder(orm, tableDef);
}
