import type { ColumnConfig, ColumnDefinition, SurrealColumnType } from './types.js';
/**
 * Base class for all column builders.
 * Consolidates common functionality from the 11 duplicate column type classes.
 */
export declare abstract class BaseColumnBuilder<T extends BaseColumnBuilder<T>> {
    readonly name: string;
    config: ColumnConfig;
    constructor(name: string, columnType: SurrealColumnType);
    /** Returns the column type identifier */
    protected get self(): T;
    optional(): T & {
        _optional: true;
    };
    default(value: unknown): T;
    assert(condition: string): T;
    readonly(): T;
    flexible(): T;
    permissions(permissions: string): T;
    unique(): T;
    build(tableName?: string, columnName?: string): ColumnDefinition;
    /** Formats the default value for this column type.
     * Default implementation converts value to string.
     * Override in subclasses for custom formatting (e.g., string needs quotes). */
    protected formatDefault(value: unknown): string;
}
//# sourceMappingURL=base.d.ts.map