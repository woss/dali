/**
 * Delete Query Builder
 *
 * Type-safe DELETE builder for SurrealDB.
 * Supports deleting all records, a specific record by ID,
 * or with WHERE/LIMIT conditions.
 */
import type { DaliORM } from '../sdk/dali-orm.js';
import type { TableDefinition } from '../sdk/table.js';
import type { SerializedCondition } from './conditions.js';
import type { InferSelectResult } from './types.js';
import { WhereBuilder } from './where-builder.js';
export declare class DeleteBuilder<TDef extends TableDefinition, TResult = InferSelectResult<TDef>> {
    private readonly driver;
    private readonly tableDef;
    private recordId?;
    private _whereClause;
    private _limit;
    constructor(orm: DaliORM, tableDef: TDef);
    /** Target specific record by ID */
    id(recordId: string): this;
    /**
     * Add WHERE conditions.
     * - Callback form: fluent condition builder
     * - SerializedCondition: pre-built condition
     * - Raw string: literal SurrealQL clause (use with caution)
     */
    where(fn: (w: WhereBuilder) => WhereBuilder): this;
    where(condition: SerializedCondition): this;
    where(rawClause: string): this;
    /** Add LIMIT clause */
    limit(value: number): this;
    /**
     * Compile to SurrealQL string + params.
     * Public for testing and composition.
     */
    toSQL(): {
        sql: string;
        params: Record<string, unknown>;
    };
    /** Execute the DELETE query */
    execute(): Promise<TResult[]>;
}
/** Factory function */
export declare function delete_<TDef extends TableDefinition>(orm: DaliORM, tableDef: TDef): DeleteBuilder<TDef>;
//# sourceMappingURL=delete.d.ts.map