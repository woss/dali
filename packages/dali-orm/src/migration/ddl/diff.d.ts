/**
 * Delta Generation for SurrealDB
 *
 * Implements ddlDiff function that computes schema deltas between two DDL states.
 * Generates ordered statement list following Drizzle's pattern.
 */
import type { DdlDiffResult, SurrealDbDDL } from './ddl.js';
export { statementToSql, getDefaultPermissions } from './statement-renderer.js';
/**
 * Diff mode - push vs migrate determines certain behaviors
 */
export type DiffMode = 'push' | 'migrate';
/**
 * Generate schema delta between two DDL states
 */
export declare function ddlDiff(ddl1: SurrealDbDDL, ddl2: SurrealDbDDL, mode?: DiffMode): Promise<DdlDiffResult>;
//# sourceMappingURL=diff.d.ts.map