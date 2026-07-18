import { SurrealQLGenerator } from '../migration/core/generator.js';
import type { TableConfig, IndexDefinition, TableDefinition } from './table.js';
import type { ColumnConfig, ColumnDefinition } from './schema/column/types.js';

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
    index: Omit<IndexDefinition, 'name'> & { table: string },
  ): SchemaBuilder;
  removeTable(name: string): SchemaBuilder;
  removeField(table: string, name: string): SchemaBuilder;
  removeIndex(name: string, table: string): SchemaBuilder;
  raw(sql: string): SchemaBuilder;
  toSQL(): string[];
  execute(): Promise<void>;
}

/** Internal representation of a queued DDL operation */
interface DdlOperation {
  type:
    | 'define-table'
    | 'define-field'
    | 'define-index'
    | 'remove-table'
    | 'remove-field'
    | 'remove-index'
    | 'raw';
  sql?: string;
  tableDef?: TableDefinition;
  fieldDef?: ColumnDefinition;
  indexDef?: IndexDefinition;
  indexTable?: string;
}

/**
 * Create a SchemaBuilder bound to a query function.
 *
 * @param queryFn - The function used to execute SQL (typically `orm.query`)
 * @returns A new SchemaBuilder instance
 */
export function createSchemaBuilder(queryFn: (sql: string) => Promise<unknown>): SchemaBuilder {
  const generator = new SurrealQLGenerator();
  const operations: DdlOperation[] = [];

  function enqueue(op: DdlOperation): SchemaBuilder {
    operations.push(op);
    return builder;
  }

  const builder: SchemaBuilder = {
    defineTable(name: string, config?: TableConfig): SchemaBuilder {
      const tableDef: TableDefinition = {
        name,
        columns: [],
        config: {
          schema: 'full',
          ...config,
          type: config?.type ?? 'normal',
        },
      };
      return enqueue({ type: 'define-table', tableDef });
    },

    defineField(table: string, name: string, config: ColumnConfig): SchemaBuilder {
      const fieldDef: ColumnDefinition = {
        name,
        config,
        tableName: table,
      };
      return enqueue({ type: 'define-field', fieldDef });
    },

    defineIndex(
      name: string,
      index: Omit<IndexDefinition, 'name'> & { table: string },
    ): SchemaBuilder {
      const { table, ...rest } = index;
      const indexDef: IndexDefinition = { ...rest, name };
      return enqueue({ type: 'define-index', indexDef, indexTable: table });
    },

    removeTable(name: string): SchemaBuilder {
      return enqueue({
        type: 'remove-table',
        sql: generator.generateRemoveTable(name),
      });
    },

    removeField(table: string, name: string): SchemaBuilder {
      return enqueue({
        type: 'remove-field',
        sql: generator.generateRemoveField(table, name),
      });
    },

    removeIndex(name: string, table: string): SchemaBuilder {
      return enqueue({
        type: 'remove-index',
        sql: generator.generateRemoveIndex(name, table),
      });
    },

    raw(sql: string): SchemaBuilder {
      return enqueue({ type: 'raw', sql });
    },

    toSQL(): string[] {
      const statements: string[] = [];

      for (const op of operations) {
        if (op.sql !== undefined) {
          statements.push(op.sql);
          continue;
        }

        if (op.type === 'define-table' && op.tableDef) {
          statements.push(generator.generateTableDefinition(op.tableDef));
        } else if (op.type === 'define-field' && op.fieldDef) {
          const sql = generator.generateFieldDefinition(op.fieldDef);
          if (sql) statements.push(sql);
        } else if (op.type === 'define-index' && op.indexDef && op.indexTable) {
          statements.push(generator.generateIndexDefinition(op.indexDef, op.indexTable));
        }
      }

      return statements;
    },

    async execute(): Promise<void> {
      const statements = builder.toSQL();
      for (const sql of statements) {
        await queryFn(sql);
      }
    },
  };

  return builder;
}
