// Column type definitions for type inference
export type SurrealColumnType =
  | 'string'
  | 'int'
  | 'float'
  | 'bool'
  | 'datetime'
  | 'duration'
  | 'decimal'
  | 'array'
  | 'object'
  | 'geometry'
  | 'bytes'
  | 'record'
  | 'tuple'
  | 'any'
  | 'null'
  | 'number'
  | 'point'
  | 'uuid'
  | 'function'
  | 'set'
  | 'regex'
  | 'range'
  | 'table'
  | 'file'
  | 'literal';

export interface ElementConfig {
  type: SurrealColumnType;
  assert?: string;
}

/** Assertion for the entire tuple/array, applied at the array level */
export type ArrayAssertType = 'all' | 'any' | 'none';

export interface TupleArrayAssert {
  type: ArrayAssertType;
  expression: string;
}

export interface ColumnConfig {
  type: SurrealColumnType;
  optional?: boolean;
  default?: string;
  /** Raw SurrealDB expression for DEFAULT, emitted unquoted (e.g., `crypto::blake3(content)`).
   * Takes precedence over `default` in DDL generation. */
  defaultRaw?: string;
  assert?: string;
  readonly?: boolean;
  permissions?: string;
  flexible?: boolean;
  unique?: boolean;
  indexType?: 'unique' | 'fulltext' | 'hnsw';
  linksTo?: string;
  /** Used to specify the record type (e.g., record<user>) */
  recordTable?: string;
  /** REFERENCE ON DELETE action for record columns */
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  /** Size for tuple/fixed-size arrays */
  size?: number;
  /** Element configurations for tuple arrays */
  elements?: ElementConfig[];
  /** Array-level assertion for tuples */
  arrayAssert?: TupleArrayAssert;
}

export interface ColumnDefinition {
  name: string;
  config: ColumnConfig;
  tableName?: string;
}
