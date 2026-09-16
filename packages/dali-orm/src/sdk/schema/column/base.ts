import type {
  ColumnConfig,
  ColumnDefinition,
  SurrealColumnType,
} from './types.js';

/**
 * Base class for all column builders.
 * Consolidates common functionality from the 11 duplicate column type classes.
 */
export abstract class BaseColumnBuilder<T extends BaseColumnBuilder<T>> {
  config: ColumnConfig;

  constructor(
    public readonly name: string,
    columnType: SurrealColumnType,
  ) {
    this.config = { type: columnType };
  }

  /** Returns the column type identifier */
  protected get self(): T {
    return this as unknown as T;
  }

  optional(): T & { _optional: true } {
    this.config = { ...this.config, optional: true };
    return this.self as T & { _optional: true };
  }

  default(value: unknown): T {
    this.config = {
      ...this.config,
      default: value as string | number | boolean,
    };
    return this.self;
  }

  assert(condition: string): T {
    this.config = { ...this.config, assert: condition };
    return this.self;
  }

  readonly(): T {
    this.config = { ...this.config, readonly: true };
    return this.self;
  }

  flexible(): T {
    this.config = { ...this.config, flexible: true };
    return this.self;
  }

  permissions(permissions: string): T {
    this.config = { ...this.config, permissions };
    return this.self;
  }

  unique(): T {
    this.config = { ...this.config, unique: true };
    return this.self;
  }

  build(tableName?: string, columnName?: string): ColumnDefinition {
    return {
      name: columnName ?? this.name,
      config: { ...this.config },
      tableName,
    };
  }
}
