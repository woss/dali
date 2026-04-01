import { createBuilder } from './simple-builders.js';
import type { ColumnDefinition } from './types.js';

/**
 * Create a record column builder (links to another table).
 *
 * The `targetTable` is the SurrealDB table this record references.
 * The column name is provided by `defineTable` via `build()`'s second parameter.
 *
 * @example
 * defineTable('memories', {
 *   project: record('projects').optional(),
 * })
 */
export function record(targetTable: string) {
  const builder = createBuilder('_', 'record' as const);
  return {
    ...builder,
    build(tableName?: string, columnName?: string): ColumnDefinition {
      const result = builder.build(tableName, columnName);
      result.name = columnName || targetTable || '';
      result.config.recordTable = targetTable;
      return result;
    },
  };
}
