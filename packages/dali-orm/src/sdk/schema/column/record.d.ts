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
export declare function record(targetTable: string): {
  build(tableName?: string, columnName?: string): ColumnDefinition;
  reference(opts: { onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' }): {
    build(tableName?: string, columnName?: string): ColumnDefinition;
    reference(opts: {
      onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT';
    }): /*elided*/ any;
    name: string;
    optional(): import('./simple-builders.js').Builder<'record'>;
    default(
      value: string | boolean | number,
    ): import('./simple-builders.js').Builder<'record'>;
    defaultRaw(expr: string): import('./simple-builders.js').Builder<'record'>;
    defaultNow(): import('./simple-builders.js').Builder<'record'>;
    unique(): import('./simple-builders.js').Builder<'record'>;
    flexible(): import('./simple-builders.js').Builder<'record'>;
    readonly(): import('./simple-builders.js').Builder<'record'>;
    assert(expr: string): import('./simple-builders.js').Builder<'record'>;
    permissions(
      perms: string,
    ): import('./simple-builders.js').Builder<'record'>;
  };
  name: string;
  optional(): import('./simple-builders.js').Builder<'record'>;
  default(
    value: string | boolean | number,
  ): import('./simple-builders.js').Builder<'record'>;
  defaultRaw(expr: string): import('./simple-builders.js').Builder<'record'>;
  defaultNow(): import('./simple-builders.js').Builder<'record'>;
  unique(): import('./simple-builders.js').Builder<'record'>;
  flexible(): import('./simple-builders.js').Builder<'record'>;
  readonly(): import('./simple-builders.js').Builder<'record'>;
  assert(expr: string): import('./simple-builders.js').Builder<'record'>;
  permissions(perms: string): import('./simple-builders.js').Builder<'record'>;
};
//# sourceMappingURL=record.d.ts.map
