import type { TableDefinition } from '../../sdk/table.js';
import type { ColumnDefinition } from '../../sdk/schema/column/types.js';
import type { AccessConfig, EventConfig, FunctionConfig } from '../../sdk/schema.js';
import type { AnalyzerDefinition } from '../../sdk/table.js';
import type { SerializedAccess, SerializedEvent, SerializedFunction, SerializedAnalyzer } from '../core/snapshot.js';
/**
 * Print a summary of schema changes
 */
export interface NonTableChangeCounts {
    added: number;
    removed: number;
}
export declare function getNonTableChanges(current: {
    access?: AccessConfig[];
    events?: EventConfig[];
    functions?: FunctionConfig[];
    analyzers?: AnalyzerDefinition[];
}, last: {
    access: SerializedAccess[];
    events: SerializedEvent[];
    functions: SerializedFunction[];
    analyzers: SerializedAnalyzer[];
}): NonTableChangeCounts;
export declare function printDiffSummary(diff: {
    added: {
        tables: TableDefinition[];
        fields: Array<{
            table: string;
            column: ColumnDefinition;
        }>;
        indexes: Array<{
            table: string;
            index: {
                name: string;
            };
        }>;
    };
    removed: {
        tables: string[];
        fields: Array<{
            table: string;
            field: string;
        }>;
        indexes: Array<{
            table: string;
            name: string;
        }>;
    };
    changed: {
        tables: Array<{
            name: string;
        }>;
        fields: Array<{
            table: string;
            field: string;
        }>;
    };
}, _currentAccess?: any[], _lastAccess?: {
    name: string;
}[], nonTable?: NonTableChangeCounts): void;
/**
 * Detect section category for a SurrealQL statement
 */
export declare function detectSection(stmt: string): string;
/**
 * Insert section separator comments between statement categories
 */
export declare function addSectionSeparators(statements: string[]): string[];
//# sourceMappingURL=diff-summary.d.ts.map