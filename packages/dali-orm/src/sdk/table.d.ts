import type {
  ColumnConfig,
  ColumnDefinition,
  SurrealColumnType,
} from './schema/column/types.js';

export type { ColumnConfig, ColumnDefinition, SurrealColumnType };
export interface TableConfig {
  schema?: 'full' | 'less';
  type?: 'normal' | 'relation';
  in?: string | string[];
  out?: string | string[];
  indexes?: IndexDefinition[];
  permissions?: TablePermissions;
  changefeed?: string;
}
export interface AnalyzerDefinition {
  name: string;
  /** Tokenizers for text analysis (e.g., 'class', 'blank', 'punctuation'). Can be a single string or array. */
  tokenizers: string | string[];
  /** Filters to apply after tokenization (e.g., 'lowercase', 'snowball'). Optional. */
  filters?: string | string[];
}
export interface IndexDefinition {
  name: string;
  fields: string[];
  type?: 'unique' | 'fulltext' | 'hnsw';
  analyzer?: string;
  dimension?: number;
  vectorType?: 'float' | 'float32' | 'float64';
  distance?: 'COSINE' | 'EUCLIDEAN' | 'MANHATTAN' | 'MINKOWSKI';
}
export interface TablePermissions {
  select?: string;
  create?: string;
  update?: string;
  delete?: string;
}
export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  config: TableConfig;
  $columns?: Record<string, ColumnDefinition>;
}
export interface RelationTableConfig extends TableConfig {
  type: 'relation';
  in: string | string[];
  out: string | string[];
}
/**
 * Column builder interface - anything with a build() method
 */
export interface ColumnBuilder<
  out TType extends SurrealColumnType = SurrealColumnType,
> {
  name: string;
  build(
    tableName?: string,
    columnName?: string,
  ): ColumnDefinition & {
    config: ColumnConfig & {
      type: TType;
    };
  };
}
/**
 * Columns object for defineTable - maps column names to builders
 */
export type TableColumns = Record<string, ColumnBuilder>;
/**
 * Defines a normal table with columns and optional config
 */
export declare function defineTable<
  const TColumns extends Record<string, ColumnBuilder>,
>(
  name: string,
  columns: TColumns,
  config?: Omit<TableConfig, 'type'>,
): TableDefinition & {
  _columns: TColumns;
  $id(id: string | number): string;
};
/**
 * Defines a relation table with columns and relation config
 */
export declare function defineRelationTable<
  const TColumns extends Record<string, ColumnBuilder>,
>(
  name: string,
  columns: TColumns,
  config: {
    in: string | string[];
    out: string | string[];
  } & Omit<TableConfig, 'type'>,
): TableDefinition & {
  _columns: TColumns;
  $id(id: string | number): string;
};
//# sourceMappingURL=table.d.ts.map
