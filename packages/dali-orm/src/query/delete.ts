/**
 * Delete Query Builder
 *
 * Type-safe DELETE builder for SurrealDB.
 * Supports deleting all records, a specific record by ID,
 * or with WHERE/LIMIT conditions.
 */

import type { DaliORM } from '../sdk/dali-orm.js';
import type { SurrealDriver } from '../sdk/driver/types.js';
import type { TableDefinition } from '../sdk/table.js';
import { resolveRecordId } from '../utils/record-id.js';
import type { SerializedCondition } from './conditions.js';
import {
  andTrees,
  serializeCondition,
  serializedConditionToNode,
} from './serializer.js';
import type { InferSelectResult } from './types.js';
import { type ConditionNode, WhereBuilder } from './where-builder.js';

export class DeleteBuilder<
  TDef extends TableDefinition,
  TResult = InferSelectResult<TDef>,
> {
  private readonly driver: SurrealDriver;
  private readonly tableDef: TDef;
  private recordId?: string;
  private _whereClause: ConditionNode | null = null;
  private _limit: number | undefined = undefined;

  constructor(orm: DaliORM, tableDef: TDef) {
    if (!orm) throw new Error('DaliORM instance is required');
    if (!tableDef?.name)
      throw new Error('Table definition with name is required');

    this.driver = orm.getDriver();
    this.tableDef = tableDef;
  }

  /** Target specific record by ID */
  id(recordId: string): this {
    if (!recordId || typeof recordId !== 'string')
      throw new Error('Record ID is required');
    this.recordId = recordId;
    return this;
  }

  /**
   * Add WHERE conditions.
   * - Callback form: fluent condition builder
   * - SerializedCondition: pre-built condition
   * - Raw string: literal SurrealQL clause (use with caution)
   */
  where(fn: (w: WhereBuilder) => WhereBuilder): this;
  where(condition: SerializedCondition): this;
  where(rawClause: string): this;
  where(
    fnOrCondition:
      | ((w: WhereBuilder) => WhereBuilder)
      | SerializedCondition
      | string,
  ): this {
    if (typeof fnOrCondition === 'function') {
      const builder = fnOrCondition(new WhereBuilder());
      const node = builder.build();
      this._whereClause = andTrees(this._whereClause, node);
    } else if (typeof fnOrCondition === 'string') {
      this._whereClause = andTrees(this._whereClause, {
        type: 'condition',
        field: `RAW(${fnOrCondition})`,
        op: '=',
        value: true,
      });
    } else {
      const node = serializedConditionToNode(fnOrCondition);
      this._whereClause = andTrees(this._whereClause, node);
    }
    return this;
  }

  /** Add LIMIT clause */
  limit(value: number): this {
    if (!Number.isInteger(value) || value < 0)
      throw new Error('Limit must be a non-negative integer');
    this._limit = value;
    return this;
  }

  /**
   * Compile to SurrealQL string + params.
   * Public for testing and composition.
   */
  toSQL(): { sql: string; params: Record<string, unknown> } {
    const params: Record<string, unknown> = {};
    let paramIndex = 0;

    const nextParam = (value: unknown): string => {
      const name = `p${paramIndex++}`;
      params[name] = value;
      return `$${name}`;
    };

    // Serialize WHERE clause once — reused in both base and subquery paths.
    let whereSql = '';
    if (this._whereClause) {
      const result = serializeCondition(this._whereClause, nextParam);
      if (result.sql) {
        whereSql = result.sql;
        Object.assign(params, result.params);
      }
    }

    let sql: string;

    if (this._limit !== undefined) {
      // SurrealDB DELETE does not support LIMIT clause directly.
      // Wrap in subquery: DELETE FROM (SELECT id FROM <table> WHERE ... LIMIT n)
      sql = `DELETE FROM (SELECT id FROM ${this.tableDef.name}`;
      if (whereSql) {
        sql += ` WHERE ${whereSql}`;
      }
      sql += ` LIMIT ${this._limit})`;
    } else {
      sql = `DELETE FROM ${this.tableDef.name}`;
      if (whereSql) {
        sql += ` WHERE ${whereSql}`;
      }
    }

    return { sql, params };
  }

  /** Execute the DELETE query */
  async execute(): Promise<TResult[]> {
    // Backward compat: .id(recordId) → driver.delete (unchanged)
    if (this.recordId) {
      const table = resolveRecordId(this.recordId, this.tableDef.name);
      return this.driver.delete<TResult>(table);
    }

    // When WHERE or LIMIT is set, use raw SQL query with RETURN AFTER
    // so deleted records are returned.
    if (this._whereClause || this._limit !== undefined) {
      const { sql: baseSql, params } = this.toSQL();
      // SurrealDB DELETE requires RETURN AFTER to return deleted records.
      const sql = `${baseSql} RETURN AFTER`;
      return this.driver.query<TResult>(sql, params);
    }

    // Bare delete: no where, no id → driver.delete (unchanged)
    return this.driver.delete<TResult>(this.tableDef.name);
  }
}

/** Factory function */
export function delete_<TDef extends TableDefinition>(
  orm: DaliORM,
  tableDef: TDef,
): DeleteBuilder<TDef> {
  return new DeleteBuilder(orm, tableDef);
}
