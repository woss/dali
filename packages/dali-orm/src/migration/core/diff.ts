/**
 * Schema Diffing
 *
 * Compares two schema states and produces a diff of changes.
 */

import { createDebug as debug } from 'obug';
import type { ColumnDefinition } from '../../sdk/schema/column/types.js';
import type { IndexDefinition, TableDefinition } from '../../sdk/table.js';

const log = debug('dali-orm:migrations:diff');

/**
 * Represents all differences between two schema states
 */
export interface SchemaDiff {
  added: {
    tables: TableDefinition[];
    fields: Array<{ table: string; column: ColumnDefinition }>;
    indexes: Array<{ table: string; index: IndexDefinition }>;
  };
  removed: {
    tables: string[];
    fields: Array<{ table: string; field: string }>;
    indexes: Array<{ table: string; name: string }>;
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
export class SchemaDiffer {
  /**
   * Compare two schemas and produce a diff
   */
  diff(oldSchema: TableDefinition[], newSchema: TableDefinition[]): SchemaDiff {
    const oldTables = new Map(oldSchema.map((t) => [t.name, t]));
    const newTables = new Map(newSchema.map((t) => [t.name, t]));

    const diff: SchemaDiff = {
      added: { tables: [], fields: [], indexes: [] },
      removed: { tables: [], fields: [], indexes: [] },
      changed: { tables: [], fields: [] },
    };

    // Debug: log tables being compared
    log('=== SchemaDiffer Debug ===');
    log('Old schema tables: %O', Array.from(oldTables.keys()));
    log('New schema tables: %O', Array.from(newTables.keys()));
    for (const [name, table] of newTables) {
      const oldTable = oldTables.get(name);
      log(
        'Table %s: oldExists=%s, oldColumns=%d, newColumns=%d',
        name,
        !!oldTable,
        oldTable?.columns.length ?? 0,
        table.columns.length,
      );
    }
    log('===========================');

    // Find added tables
    // KEY FIX: Only add as "new table" if it doesn't exist OR has NO columns in live schema
    // If live table exists but has no columns, and schema has columns -> those are ADDED FIELDS, not tables
    for (const [name, table] of newTables) {
      const oldTable = oldTables.get(name);
      const isNewTable = !oldTable;
      const hasExistingColumns = oldTable && oldTable.columns.length > 0;
      const hasNewColumns = table.columns.length > 0;

      // If table exists in old but has no columns, treat new columns as field additions
      if (oldTable && oldTable.columns.length === 0 && hasNewColumns) {
        log(
          'Table %s: exists with 0 columns, will diff fields instead of marking as added table',
          name,
        );
        // Don't add to diff.added.tables - will handle via field diff below
      } else if (isNewTable) {
        log('Table %s: truly new table', name);
        diff.added.tables.push(table);
      } else if (!hasExistingColumns && !hasNewColumns) {
        // Both have no columns - it's an empty schemaless table, no change needed
        log('Table %s: both schemaless, no change', name);
      }
    }

    // Find removed tables
    for (const [name] of oldTables) {
      if (!newTables.has(name)) {
        diff.removed.tables.push(name);
      }
    }

    // Find changed tables and fields
    for (const [name, newTable] of newTables) {
      const oldTable = oldTables.get(name);
      if (oldTable) {
        const tableDiff = this.diffTable(oldTable, newTable);
        if (tableDiff) {
          diff.changed.tables.push(tableDiff);
        }

        // Field changes
        const fieldChanges = this.diffFields(oldTable, newTable);

        // Added fields
        for (const change of fieldChanges.added) {
          diff.added.fields.push({ table: name, column: change });
        }

        // Removed fields
        for (const fieldName of fieldChanges.removed) {
          diff.removed.fields.push({ table: name, field: fieldName });
        }

        // Changed fields
        diff.changed.fields.push(...fieldChanges.changed);

        // Index changes
        const indexChanges = this.diffIndexes(oldTable, newTable);
        diff.added.indexes.push(
          ...indexChanges.added.map((idx) => ({ table: name, index: idx })),
        );
        diff.removed.indexes.push(
          ...indexChanges.removed.map((idxName) => ({
            table: name,
            name: idxName,
          })),
        );
      }
    }

    return diff;
  }

  /**
   * Check if there are any breaking changes in the diff
   */
  hasBreakingChanges(diff: SchemaDiff): boolean {
    // Check for breaking table changes
    for (const table of diff.changed.tables) {
      if (table.breakingChanges.length > 0) return true;
    }

    // Check for breaking field changes
    for (const field of diff.changed.fields) {
      if (field.breakingChanges.length > 0) return true;
    }

    // Removed tables and fields are potentially breaking
    if (diff.removed.tables.length > 0) return true;
    if (diff.removed.fields.length > 0) return true;

    return false;
  }

  /**
   * Generate human-readable summary of changes
   */
  summarize(diff: SchemaDiff): string {
    const parts: string[] = [];

    if (diff.added.tables.length > 0) {
      parts.push(
        `Added tables: ${diff.added.tables.map((t) => t.name).join(', ')}`,
      );
    }

    if (diff.added.fields.length > 0) {
      parts.push(
        `Added fields: ${diff.added.fields.map((f) => `${f.table}.${f.column.name}`).join(', ')}`,
      );
    }

    if (diff.removed.tables.length > 0) {
      parts.push(`Removed tables: ${diff.removed.tables.join(', ')}`);
    }

    if (diff.removed.fields.length > 0) {
      parts.push(
        `Removed fields: ${diff.removed.fields.map((f) => `${f.table}.${f.field}`).join(', ')}`,
      );
    }

    for (const table of diff.changed.tables) {
      parts.push(
        `Changed table ${table.name}: ${table.breakingChanges.join('; ')}`,
      );
    }

    for (const field of diff.changed.fields) {
      parts.push(
        `Changed field ${field.table}.${field.field}: ${field.breakingChanges.join('; ')}`,
      );
    }

    return parts.length > 0 ? parts.join('\n') : 'No changes';
  }

  // Private methods

  /**
   * Compare two table definitions
   */
  private diffTable(
    oldTable: TableDefinition,
    newTable: TableDefinition,
  ): {
    name: string;
    oldDef: TableDefinition;
    newDef: TableDefinition;
    breakingChanges: string[];
  } | null {
    const breakingChanges: string[] = [];

    // Check schema mode change
    if (oldTable.config.schema !== newTable.config.schema) {
      breakingChanges.push(
        `Schema mode changed from ${oldTable.config.schema} to ${newTable.config.schema}`,
      );
    }

    // Check type change
    if (oldTable.config.type !== newTable.config.type) {
      breakingChanges.push(
        `Table type changed from ${oldTable.config.type} to ${newTable.config.type}`,
      );
    }

    return breakingChanges.length > 0
      ? {
          name: newTable.name,
          oldDef: oldTable,
          newDef: newTable,
          breakingChanges,
        }
      : null;
  }

  /**
   * Compare fields between two tables
   */
  private diffFields(
    oldTable: TableDefinition,
    newTable: TableDefinition,
  ): {
    added: ColumnDefinition[];
    removed: string[];
    changed: Array<{
      table: string;
      field: string;
      oldColumn: ColumnDefinition;
      newColumn: ColumnDefinition;
      breakingChanges: string[];
    }>;
  } {
    const added: ColumnDefinition[] = [];
    const removed: string[] = [];
    const changed: Array<{
      table: string;
      field: string;
      oldColumn: ColumnDefinition;
      newColumn: ColumnDefinition;
      breakingChanges: string[];
    }> = [];

    const oldFields = new Map(oldTable.columns.map((c) => [c.name, c]));
    const newFields = new Map(newTable.columns.map((c) => [c.name, c]));

    // Remove SurrealDB auto-created fields from comparison
    const AUTO_CREATED_FIELDS = ['id'];
    for (const field of AUTO_CREATED_FIELDS) {
      oldFields.delete(field);
      newFields.delete(field);
    }

    // Find added fields
    for (const [name, column] of newFields) {
      if (!oldFields.has(name)) {
        added.push(column);
      }
    }

    // Find removed fields
    for (const [name] of oldFields) {
      if (!newFields.has(name)) {
        removed.push(name);
      }
    }

    // Find changed fields
    for (const [name, newColumn] of newFields) {
      const oldColumn = oldFields.get(name);
      if (oldColumn) {
        const fieldChanges = this.diffColumn(oldColumn, newColumn);
        if (fieldChanges.length > 0) {
          changed.push({
            table: newTable.name,
            field: name,
            oldColumn,
            newColumn,
            breakingChanges: fieldChanges,
          });
        }
      }
    }

    return { added, removed, changed };
  }

  /**
   * Compare indexes between two tables
   */
  private diffIndexes(
    oldTable: TableDefinition,
    newTable: TableDefinition,
  ): {
    added: IndexDefinition[];
    removed: string[];
  } {
    const added: IndexDefinition[] = [];
    const removed: string[] = [];

    const oldIndexes = oldTable.config.indexes ?? [];
    const newIndexes = newTable.config.indexes ?? [];

    const oldIndexMap = new Map(oldIndexes.map((i) => [i.name, i]));
    const newIndexMap = new Map(newIndexes.map((i) => [i.name, i]));

    // Find added indexes
    for (const [name, index] of newIndexMap) {
      if (!oldIndexMap.has(name)) {
        added.push(index);
      }
    }

    // Find removed indexes
    for (const [name] of oldIndexMap) {
      if (!newIndexMap.has(name)) {
        removed.push(name);
      }
    }

    return { added, removed };
  }

  /**
   * Compare two column definitions
   */
  private diffColumn(
    oldColumn: ColumnDefinition,
    newColumn: ColumnDefinition,
  ): string[] {
    const changes: string[] = [];

    // Type change
    if (oldColumn.config.type !== newColumn.config.type) {
      changes.push(
        `Type changed from ${oldColumn.config.type} to ${newColumn.config.type}`,
      );
    }

    // Nullable to non-nullable (breaking)
    if (oldColumn.config.optional && !newColumn.config.optional) {
      changes.push(
        'Field changed from optional to required - may break existing records',
      );
    }

    // Readonly change
    if (!oldColumn.config.readonly && newColumn.config.readonly) {
      changes.push(
        'Field changed to readonly - existing data cannot be updated',
      );
    }

    // Flexible schema change
    if (oldColumn.config.flexible !== newColumn.config.flexible) {
      changes.push(
        `Field flexible mode ${oldColumn.config.flexible ? 'removed' : 'added'}`,
      );
    }

    // Type coercion changes (e.g., int to string could lose precision)
    const coercibleTypes: Record<string, string[]> = {
      int: ['float', 'decimal', 'string'],
      float: ['decimal', 'string'],
      decimal: ['string'],
    };

    if (
      coercibleTypes[oldColumn.config.type]?.includes(newColumn.config.type)
    ) {
      changes.push(`Type widened - may require data migration`);
    }

    // Default value change (compare effective default: defaultRaw takes precedence)
    const oldEffective =
      oldColumn.config.defaultRaw ?? oldColumn.config.default;
    const newEffective =
      newColumn.config.defaultRaw ?? newColumn.config.default;
    if (oldEffective !== newEffective) {
      changes.push(
        `Default changed from '${oldEffective ?? 'NONE'}' to '${newEffective ?? 'NONE'}'`,
      );
    }

    return changes;
  }
}
