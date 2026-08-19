/**
 * Insert Query Builder
 *
 * Type-safe INSERT builder for SurrealDB.
 * Supports single, multiple, or bulk record insertion.
 */
import type { DaliORM } from '../sdk/dali-orm.js';
import type { TableDefinition } from '../sdk/table.js';
import type { InferSelectResult } from './types.js';
export declare class InsertBuilder<TDef extends TableDefinition, TResult = InferSelectResult<TDef>> {
    private readonly driver;
    private readonly tableDef;
    private _records;
    private _ignoreDuplicates;
    constructor(orm: DaliORM, tableDef: TDef);
    /** Add a single record */
    one(data: Record<string, unknown>): this;
    /** Add multiple records */
    many(data: Record<string, unknown>[]): this;
    /** Set all records (replaces existing) */
    records(data: Record<string, unknown>[]): this;
    /** Ignore duplicates (ON DUPLICATE KEY UPDATE NONE) */
    ignoreDuplicates(): this;
    /** Execute the INSERT query */
    execute(): Promise<TResult[]>;
    /** Serialize a value to SurrealQL — delegates to canonical serializer */
    private serializeValue;
}
/** Factory function */
export declare function insert<TDef extends TableDefinition>(orm: DaliORM, tableDef: TDef): InsertBuilder<TDef>;
//# sourceMappingURL=insert.d.ts.map