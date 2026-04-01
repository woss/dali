/**
 * Insert Query Builder
 *
 * Type-safe INSERT builder for SurrealDB.
 * Supports single, multiple, or bulk record insertion.
 */

import type { SurrealDriver } from '../sdk/driver/types.js';
import type { TableDefinition } from '../sdk/table.js';
import type { InferSelectResult } from './types.js';

export class InsertBuilder<TDef extends TableDefinition, TResult = InferSelectResult<TDef>> {
  private readonly driver: SurrealDriver;
  private readonly tableDef: TDef;
  private _records: Record<string, unknown>[] = [];
  private _ignoreDuplicates = false;

  constructor(driver: SurrealDriver, tableDef: TDef) {
    if (!driver) throw new Error('Driver is required');
    if (!tableDef?.name) throw new Error('Table definition with name is required');

    this.driver = driver;
    this.tableDef = tableDef;
  }

  /** Add a single record */
  one(data: Record<string, unknown>): this;
  one(data: Record<string, unknown>): this {
    if (!data || typeof data !== 'object') throw new Error('Data object is required');
    this._records.push({ ...data });
    return this;
  }

  /** Add multiple records */
  many(data: Record<string, unknown>[]): this;
  many(data: Record<string, unknown>[]): this {
    if (!Array.isArray(data) || data.length === 0)
      throw new Error('Data array with at least one record is required');
    this._records.push(...data.map((d) => ({ ...d })));
    return this;
  }

  /** Set all records (replaces existing) */
  records(data: Record<string, unknown>[]): this;
  records(data: Record<string, unknown>[]): this {
    if (!Array.isArray(data)) throw new Error('Data array is required');
    this._records = data.map((d) => ({ ...d }));
    return this;
  }

  /** Ignore duplicates (ON DUPLICATE KEY UPDATE NONE) */
  ignoreDuplicates(): this {
    this._ignoreDuplicates = true;
    return this;
  }

  /** Execute the INSERT query */
  async execute(): Promise<TResult[]> {
    if (this._records.length === 0) {
      throw new Error(
        'Cannot insert with empty records - use .one(), .many(), or .records() first',
      );
    }

    if (this._ignoreDuplicates) {
      // Use VALUES syntax (SurrealDB object literal [ { ... } ] not supported with ON DUPLICATE KEY UPDATE)
      const fields = [...new Set(this._records.flatMap((r) => Object.keys(r)))];
      const values = this._records
        .map((r) => `(${fields.map((f) => this.serializeValue(r[f])).join(', ')})`)
        .join(', ');
      const sql = `INSERT INTO ${this.tableDef.name} (${fields.join(', ')}) VALUES ${values} ON DUPLICATE KEY UPDATE id = id`;
      return this.driver.query<TResult>(sql);
    }

    // Use native driver.insert()
    return this.driver.insert<TResult>(this.tableDef.name, this._records);
  }

  /** Serialize a value to SurrealQL */
  private serializeValue(value: unknown): string {
    if (value === null || value === undefined) return 'NONE';
    if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (Array.isArray(value)) return `[ ${value.map((v) => this.serializeValue(v)).join(', ')} ]`;
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${this.serializeValue(v)}`)
        .join(', ');
      return `{ ${entries} }`;
    }
    return JSON.stringify(value);
  }
}

/** Factory function */
export function insert<TDef extends TableDefinition>(
  driver: SurrealDriver,
  tableDef: TDef,
): InsertBuilder<TDef> {
  return new InsertBuilder(driver, tableDef);
}
