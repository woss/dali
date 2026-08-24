/**
 * Statement rendering utilities for SurrealDB DDL
 *
 * Converts SurrealStatement objects into SQL strings.
 * Extracted from diff.ts to keep files under 500 lines.
 */
import type { TablePermissions } from '../../sdk/table.js';
import type { SurrealStatement } from './ddl.js';
/**
 * Serialize SurrealPermissions object to SQL string for field permissions
 */
export declare function serializePermissions(perms: {
  select?: string | boolean;
  create?: string | boolean;
  update?: string | boolean;
  delete?: string | boolean;
}): string;
/**
 * Order statements following Drizzle's pattern
 */
export declare function orderStatements(
  statements: SurrealStatement[],
): SurrealStatement[];
/**
 * Group statements by type
 */
export declare function groupStatements(
  statements: SurrealStatement[],
): Record<string, SurrealStatement[]>;
/**
 * Convert statement to SQL string
 */
export declare function statementToSql(stmt: SurrealStatement): string;
export declare function getDefaultPermissions(): TablePermissions;
//# sourceMappingURL=statement-renderer.d.ts.map
