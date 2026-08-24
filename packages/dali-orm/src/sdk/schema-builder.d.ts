import type { ColumnConfig } from './schema/column/types.js';
import type { IndexDefinition, TableConfig } from './table.js';
/**
 * SchemaBuilder interface — fluent runtime DDL API.
 *
 * Collects DDL statements and executes them via `orm.query()`
 * without requiring migration files or a journal.
 */
export interface SchemaBuilder {
  defineTable(name: string, config?: TableConfig): SchemaBuilder;
  defineField(table: string, name: string, config: ColumnConfig): SchemaBuilder;
  defineIndex(
    name: string,
    index: Omit<IndexDefinition, 'name'> & {
      table: string;
    },
  ): SchemaBuilder;
  removeTable(name: string): SchemaBuilder;
  removeField(table: string, name: string): SchemaBuilder;
  removeIndex(name: string, table: string): SchemaBuilder;
  raw(sql: string): SchemaBuilder;
  toSQL(): string[];
  execute(): Promise<void>;
}
/**
 * Create a SchemaBuilder bound to a query function.
 *
 * @param queryFn - The function used to execute SQL (typically `orm.query`)
 * @returns A new SchemaBuilder instance
 */
export declare function createSchemaBuilder(
  queryFn: (sql: string) => Promise<unknown>,
): SchemaBuilder;
//# sourceMappingURL=schema-builder.d.ts.map
