/**
 * Upsert Query Builder
 *
 * Type-safe UPSERT builder for SurrealDB.
 * Creates or replaces a record by ID.
 */
import type { DaliORM } from '../sdk/dali-orm.js';
import type { TableDefinition } from '../sdk/table.js';
import type { InferSelectResult } from './types.js';
export declare class UpsertBuilder<TDef extends TableDefinition, TResult = InferSelectResult<TDef>> {
    private readonly driver;
    private readonly tableDef;
    private _data;
    constructor(orm: DaliORM, tableDef: TDef);
    /** Set a single field value */
    set(field: string, value: unknown): this;
    /** Set all data at once (replaces existing data) */
    data(obj: Record<string, unknown>): this;
    /** Execute the UPSERT query with a target record ID */
    execute(id: string): Promise<TResult[]>;
}
/** Factory function */
export declare function upsert<TDef extends TableDefinition>(orm: DaliORM, tableDef: TDef): UpsertBuilder<TDef>;
//# sourceMappingURL=upsert.d.ts.map