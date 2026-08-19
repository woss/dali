/**
 * Serialize column permissions object to SQL string for ColumnDefinition
 */
export declare function serializeColumnPermissions(perms: {
    select?: string | boolean;
    create?: string | boolean;
    update?: string | boolean;
    delete?: string | boolean;
} | undefined): string | undefined;
/**
 * Normalize SQL for comparison: strip whitespace, sort lines
 */
export declare function normalizeSql(sql: string): string;
//# sourceMappingURL=format-utils.d.ts.map