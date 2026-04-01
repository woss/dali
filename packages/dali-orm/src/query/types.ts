/**
 * Query Type Inference Utilities
 *
 * Derive TypeScript result/input types from TableDefinition generics.
 * Parse at boundary, trust internally.
 */

import type { ColumnConfig } from '../sdk/schema/column/types.js';
import type {
  ColumnBuilder,
  RelationTableConfig,
  TableConfig,
  TableDefinition,
} from '../sdk/table.js';

// ============================================================================
// ColumnRef - Branded Field References
// ============================================================================

/**
 * Branded column reference for typed WHERE/SELECT operations.
 *
 * Carries the column name and TypeScript type for type-safe query building.
 * Use `columnRef()` factory to create instances.
 *
 * @example
 * ```typescript
 * const nameCol = columnRef<'name', string>('name', '' as string, 'user');
 * // nameCol.name === 'name'
 * // nameCol._type === string
 * ```
 */
export interface ColumnRef<K extends string = string, T = unknown> {
  readonly _brand: 'ColumnRef';
  readonly name: K;
  readonly _type: T;
  readonly tableName: string;
}

/**
 * Factory to create a ColumnRef instance.
 * Must return a plain object (not class instance) for structural typing.
 */
export function columnRef<K extends string, T>(
  name: K,
  type: T,
  tableName: string,
): ColumnRef<K, T> {
  return { _brand: 'ColumnRef' as const, name, _type: type, tableName };
}

/**
 * Construct a SurrealDB record ID string in `table:id` format.
 *
 * Handles both plain IDs and already-formatted record IDs:
 * - `recordId(sessionsSchema, 'abc-123')` → `"sessions:abc-123"`
 * - `recordId('sessions', 'abc-123')` → `"sessions:abc-123"`
 * - `recordId(sessionsSchema, 'sessions:abc-123')` → `"sessions:abc-123"` (no double-prefix)
 *
 * @param table - TableDefinition (from defineTable) or table name string
 * @param id - Record ID (plain UUID, string ID, or already in table:id format)
 * @returns Record ID string in `table:id` format
 */
export function recordId(table: { name: string } | string, id: string): string {
  const tableName = typeof table === 'string' ? table : table.name;
  if (!id) throw new Error('Record ID is required');

  // If already in table:id format, return as-is
  if (id.includes(':')) return id;

  return `${tableName}:${id}`;
}

/** Convenience alias - a ColumnRef is a valid select field */
export type SelectField = ColumnRef;

/**
 * Infer result type from a Drizzle-style Record<string, ColumnRef> selection.
 *
 * @example
 * ```typescript
 * const selection = { userName: nameCol, userAge: ageCol };
 * // InferSelection<typeof selection> => { userName: string; userAge: number }
 * ```
 */
export type InferSelection<TSelection extends Record<string, SelectField>> = {
  [K in keyof TSelection]: TSelection[K] extends ColumnRef<string, infer T> ? T : unknown;
};

/**
 * Map a TableDefinition's columns to a typed Record of ColumnRefs.
 * Useful for generating typed column references from a table def.
 *
 * @example
 * ```typescript
 * type UserColumns = ColumnsToRecord<typeof users>;
 * // { name: ColumnRef<'name', string>; age: ColumnRef<'age', number>; ... }
 * ```
 */
export type ColumnsToRecord<TDef extends TableDefinition> = {
  [K in TDef['columns'][number] as K['name']]: K extends { config: infer C extends ColumnConfig }
    ? ColumnRef<K['name'], ColumnType<C>>
    : ColumnRef<K['name'], unknown>;
};

// ============================================================================
// Type Inference
// ============================================================================

/** Infer select result type from TableDefinition columns */
export type InferSelectResult<TDef extends TableDefinition> = InferTypedRecord<TDef>;

/** Infer insert input type (partial of columns, no id required) */
export type InferInsertInput<TDef extends TableDefinition> = Partial<InferTypedRecord<TDef>>;

/** Infer update input type (partial, no id) */
export type InferUpdateInput<TDef extends TableDefinition> = Partial<InferTypedRecord<TDef>>;

/** Graph traversal result type with aliased fields */
export type WithGraphAliases<TBase, TAliases> = TBase & TAliases;

// ============================================================================
// Column Type Mapping
// ============================================================================

/** Map column config to TypeScript type */
export type ColumnType<TConfig extends ColumnConfig> = TConfig['type'] extends 'string'
  ? string
  : TConfig['type'] extends 'int' | 'float' | 'decimal' | 'number'
    ? number
    : TConfig['type'] extends 'bool'
      ? boolean
      : TConfig['type'] extends 'datetime'
        ? Date | string
        : TConfig['type'] extends 'duration'
          ? string
          : TConfig['type'] extends 'array'
            ? unknown[]
            : TConfig['type'] extends 'object'
              ? Record<string, unknown>
              : TConfig['type'] extends 'record'
                ? string
                : TConfig['type'] extends 'null'
                  ? null
                  : unknown;

/** Extract ColumnConfig from a ColumnBuilder's build() return type */
type BuilderColumnConfig<T extends ColumnBuilder> =
  ReturnType<T['build']> extends {
    config: infer C extends ColumnConfig;
  }
    ? C
    : never;

/** Build typed record from TableDefinition columns */
export type InferTypedRecord<TDef extends TableDefinition> = TDef extends {
  _columns: infer TCols extends Record<string, ColumnBuilder>;
}
  ? {
      [K in keyof TCols as K extends string
        ? K extends `${string}.*${string}`
          ? never
          : K
        : K]: TCols[K] extends { _optional: true }
        ? ColumnType<BuilderColumnConfig<TCols[K]>> | undefined
        : ColumnType<BuilderColumnConfig<TCols[K]>>;
    } & { id: string }
  : {
      [K in TDef['columns'][number] as K['name'] extends `${string}.*${string}`
        ? never
        : K['name']]: K extends {
        config: infer C extends ColumnConfig;
      }
        ? C['optional'] extends true
          ? ColumnType<C> | undefined
          : ColumnType<C>
        : unknown;
    } & { id: string };

// ============================================================================
// Relation / Edge Types
// ============================================================================

/**
 * Infer edge input fields from a relation table definition.
 * Omits 'id' since edge IDs are auto-generated by SurrealDB.
 * Use for typed RelateBuilder.set() and .data() parameters.
 */
export type InferRelateInput<TDef extends TableDefinition> = TDef extends {
  _columns: infer TCols extends Record<string, ColumnBuilder>;
}
  ? Omit<
      {
        [K in keyof TCols as K extends string
          ? K extends `${string}.*${string}`
            ? never
            : K
          : K]: TCols[K] extends { _optional: true }
          ? ColumnType<BuilderColumnConfig<TCols[K]>> | undefined
          : ColumnType<BuilderColumnConfig<TCols[K]>>;
      },
      never
    >
  : Record<string, unknown>;

/**
 * Infer relate result type from an edge table definition.
 * Extends InferTypedRecord with SurrealDB's standard 'in' and 'out' relation fields.
 */
export type InferRelateResult<TDef extends TableDefinition> = InferTypedRecord<TDef> & {
  in: string;
  out: string;
};

// ============================================================================
// Type Guards
// ============================================================================

/** Check if table config is a relation table */
export function isRelationTable(config: TableConfig): config is RelationTableConfig {
  return config.type === 'relation' && 'in' in config && 'out' in config;
}
