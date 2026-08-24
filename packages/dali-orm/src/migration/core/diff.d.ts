/**
 * Schema Diffing
 *
 * Compares two schema states and produces a diff of changes.
 */
import type { ColumnDefinition } from '../../sdk/schema/column/types.js';
import type { IndexDefinition, TableDefinition } from '../../sdk/table.js';
/**
 * Represents all differences between two schema states
 */
export interface SchemaDiff {
  added: {
    tables: TableDefinition[];
    fields: Array<{
      table: string;
      column: ColumnDefinition;
    }>;
    indexes: Array<{
      table: string;
      index: IndexDefinition;
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
      oldDef: TableDefinition;
      newDef: TableDefinition;
      breakingChanges: string[];
    }>;
    fields: Array<{
      table: string;
      field: string;
      oldColumn: ColumnDefinition;
      newColumn: ColumnDefinition;
      breakingChanges: string[];
    }>;
  };
}
/**
 * Schema Differ
 *
 * Compares two schema states and produces a detailed diff of changes.
 * Identifies breaking changes that may require data migration or cause issues.
 */
export declare class SchemaDiffer {
  /**
   * Compare two schemas and produce a diff
   */
  diff(oldSchema: TableDefinition[], newSchema: TableDefinition[]): SchemaDiff;
  /**
   * Check if there are any breaking changes in the diff
   */
  hasBreakingChanges(diff: SchemaDiff): boolean;
  /**
   * Generate human-readable summary of changes
   */
  summarize(diff: SchemaDiff): string;
  /**
   * Compare two table definitions
   */
  private diffTable;
  /**
   * Compare fields between two tables
   */
  private diffFields;
  /**
   * Compare indexes between two tables
   */
  private diffIndexes;
  /**
   * Compare two column definitions
   */
  private diffColumn;
}
//# sourceMappingURL=diff.d.ts.map
