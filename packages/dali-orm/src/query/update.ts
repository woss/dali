/**
 * Update Query Builder
 *
 * Type-safe UPDATE builder for SurrealDB.
 * Supports updating all records, a specific record by ID, or with conditions.
 */

import type { SurrealDriver } from '../sdk/driver/types.js';
import type { TableDefinition } from '../sdk/table.js';
import type { InferSelectResult } from './types.js';

export class UpdateBuilder<TDef extends TableDefinition, TResult = InferSelectResult<TDef>> {
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

  /** Execute the UPDATE query */
  async execute(): Promise<TResult[]> {
    if (Object.keys(this._data).length === 0) {
      throw new Error('Cannot update with empty data - use .data() or .set() first');
    }

    const table = this.recordId ? `${this.tableDef.name}:${this.recordId}` : this.tableDef.name;

    return this.driver.update<TResult>(table, this._data);
  }
}

/** Factory function */
export function update<TDef extends TableDefinition>(
  driver: SurrealDriver,
  tableDef: TDef,
): UpdateBuilder<TDef> {
  return new UpdateBuilder(driver, tableDef);
}
