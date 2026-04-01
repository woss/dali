/**
 * Upsert Query Builder
 *
 * Type-safe UPSERT builder for SurrealDB.
 * Creates or replaces a record by ID.
 */

import type { SurrealDriver } from '../sdk/driver/types.js';
import type { TableDefinition } from '../sdk/table.js';
import type { InferSelectResult } from './types.js';

export class UpsertBuilder<TDef extends TableDefinition, TResult = InferSelectResult<TDef>> {
  private readonly driver: SurrealDriver;
  private readonly tableDef: TDef;
  private recordId?: string;
  private _data: Record<string, unknown> = {};

  constructor(driver: SurrealDriver, tableDef: TDef) {
    if (!driver) throw new Error('Driver is required');
    if (!tableDef?.name) throw new Error('Table definition with name is required');

    this.driver = driver;
    this.tableDef = tableDef;
  }

  /** Target specific record by ID */
  id(recordId: string): this {
    if (!recordId || typeof recordId !== 'string') throw new Error('Record ID is required');
    this.recordId = recordId;
    return this;
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

  /** Execute the UPSERT query */
  async execute(): Promise<TResult[]> {
    if (Object.keys(this._data).length === 0) {
      throw new Error('Cannot upsert with empty data - use .data() or .set() first');
    }

    if (!this.recordId) {
      throw new Error('Upsert requires a record ID - use .id() to specify the target record');
    }

    const table = `${this.tableDef.name}:${this.recordId}`;
    return this.driver.upsert<TResult>(table, this._data);
  }
}

/** Factory function */
export function upsert<TDef extends TableDefinition>(
  driver: SurrealDriver,
  tableDef: TDef,
): UpsertBuilder<TDef> {
  return new UpsertBuilder(driver, tableDef);
}
