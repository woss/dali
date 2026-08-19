import type { ColumnConfig, ColumnDefinition, SurrealColumnType } from './types.js';
export type Builder<TType extends SurrealColumnType> = {
    readonly name: string;
    build(tableName?: string, _columnName?: string): ColumnDefinition & {
        config: ColumnConfig & {
            type: TType;
        };
    };
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
export declare function createBuilder<const TType extends SurrealColumnType>(name: string, type: TType): Builder<TType>;
export declare function string(name: string): Builder<"string">;
export declare function int(name: string): Builder<"int">;
export declare function float(name: string): Builder<"float">;
export declare function bool(name: string): Builder<"bool">;
export declare function datetime(name: string): Builder<"datetime">;
export declare function duration(name: string): Builder<"duration">;
export declare function decimal(name: string): Builder<"decimal">;
export declare function array(name: string): Builder<"array">;
export declare function object(name: string): Builder<"object">;
export declare function uuid(name: string): Builder<"uuid">;
/**
 * Create a set builder (unique unordered values, SurrealDB type).
 *
 * @example
 * defineTable('posts', {
 *   tags: set('tags'),
 * })
 */
export declare function set(name: string): Builder<"set">;
/**
 * Create a bytes builder (binary data).
 *
 * @example
 * defineTable('files', {
 *   content: bytes('content'),
 * })
 */
export declare function bytes(name: string): Builder<"bytes">;
/**
 * Create a literal builder (quoted string literal type).
 *
 * @example
 * defineTable('config', {
 *   color: literal('color'),
 * })
 */
export declare function literal(name: string): Builder<"literal">;
//# sourceMappingURL=simple-builders.d.ts.map