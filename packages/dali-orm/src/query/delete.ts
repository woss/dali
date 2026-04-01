/**
 * Delete Query Builder
 *
 * Type-safe DELETE builder for SurrealDB.
 * Supports deleting all records or a specific record by ID.
 */

import type { SurrealDriver } from '../sdk/driver/types.js';
import type { TableDefinition } from '../sdk/table.js';
import type { InferSelectResult } from './types.js';

export class DeleteBuilder<TDef extends TableDefinition, TResult = InferSelectResult<TDef>> {
  private readonly driver: SurrealDriver;
  private readonly tableDef: TDef;
  private recordId?: string;

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

  /** Execute the DELETE query */
  async execute(): Promise<TResult[]> {
    if (!this.recordId) {
      return this.driver.delete<TResult>(this.tableDef.name);
    }

    // recordId may be a plain ID (abc) or full RecordId (memories:abc)
    const table = this.recordId.includes(':')
      ? this.recordId
      : `${this.tableDef.name}:${this.recordId}`;

    return this.driver.delete<TResult>(table);
  }
}

/** Factory function */
export function delete_<TDef extends TableDefinition>(
  driver: SurrealDriver,
  tableDef: TDef,
): DeleteBuilder<TDef> {
  return new DeleteBuilder(driver, tableDef);
}
