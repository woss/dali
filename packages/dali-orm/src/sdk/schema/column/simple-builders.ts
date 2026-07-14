import type { ColumnConfig, ColumnDefinition, SurrealColumnType } from './types.js';

export type Builder<TType extends SurrealColumnType> = {
  readonly name: string;
  build(
    tableName?: string,
    _columnName?: string,
  ): ColumnDefinition & { config: ColumnConfig & { type: TType } };
  optional(): Builder<TType>;
  default(value: string | boolean | number): Builder<TType>;
  defaultRaw(expr: string): Builder<TType>;
  defaultNow(): Builder<TType>;
  unique(): Builder<TType>;
  flexible(): Builder<TType>;
  readonly(): Builder<TType>;
  assert(expr: string): Builder<TType>;
  permissions(perms: string): Builder<TType>;
};

export function createBuilder<const TType extends SurrealColumnType>(
  name: string,
  type: TType,
): Builder<TType> {
  type ConfigT = ColumnConfig & { type: TType };
  let config: ConfigT = { type } as ConfigT;

  return {
    get name() {
      return name;
    },
    build(tableName?: string, _columnName?: string): ColumnDefinition & { config: ConfigT } {
      return { name, config: { ...config }, tableName } as ColumnDefinition & { config: ConfigT };
    },
    optional(): Builder<TType> {
      config = { ...config, optional: true } as ConfigT;
      return this as unknown as Builder<TType>;
    },
    default(value: string | boolean | number): Builder<TType> {
      config = { ...config, default: String(value) } as ConfigT;
      return this as unknown as Builder<TType>;
    },
    /** Set raw SurrealDB expression as DEFAULT, emitted unquoted (e.g., `crypto::blake3(content)`) */
    defaultRaw(expr: string): Builder<TType> {
      config = { ...config, defaultRaw: expr } as ConfigT;
      return this as unknown as Builder<TType>;
    },
    defaultNow(): Builder<TType> {
      config = { ...config, default: 'time::now()' } as ConfigT;
      return this as unknown as Builder<TType>;
    },
    unique(): Builder<TType> {
      config = { ...config, unique: true } as ConfigT;
      return this as unknown as Builder<TType>;
    },
    flexible(): Builder<TType> {
      config = { ...config, flexible: true } as ConfigT;
      return this as unknown as Builder<TType>;
    },
    readonly(): Builder<TType> {
      config = { ...config, readonly: true } as ConfigT;
      return this as unknown as Builder<TType>;
    },
    assert(expr: string): Builder<TType> {
      config = { ...config, assert: expr } as ConfigT;
      return this as unknown as Builder<TType>;
    },
    permissions(perms: string): Builder<TType> {
      config = { ...config, permissions: perms } as ConfigT;
      return this as unknown as Builder<TType>;
    },
  };
}

export function string(name: string) {
  return createBuilder(name, 'string');
}
export function int(name: string) {
  return createBuilder(name, 'int');
}
export function float(name: string) {
  return createBuilder(name, 'float');
}
export function bool(name: string) {
  return createBuilder(name, 'bool');
}
export function datetime(name: string) {
  return createBuilder(name, 'datetime');
}
export function duration(name: string) {
  return createBuilder(name, 'duration');
}
export function decimal(name: string) {
  return createBuilder(name, 'decimal');
}
export function array(name: string) {
  return createBuilder(name, 'array');
}
export function object(name: string) {
  return createBuilder(name, 'object');
}
export function uuid(name: string) {
  return createBuilder(name, 'uuid');
}

/**
 * Create a set builder (unique unordered values, SurrealDB type).
 *
 * @example
 * defineTable('posts', {
 *   tags: set('tags'),
 * })
 */
export function set(name: string) {
  return createBuilder(name, 'set');
}

/**
 * Create a bytes builder (binary data).
 *
 * @example
 * defineTable('files', {
 *   content: bytes('content'),
 * })
 */
export function bytes(name: string) {
  return createBuilder(name, 'bytes');
}

/**
 * Create a literal builder (quoted string literal type).
 *
 * @example
 * defineTable('config', {
 *   color: literal('color'),
 * })
 */
export function literal(name: string) {
  return createBuilder(name, 'literal');
}
