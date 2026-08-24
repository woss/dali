/**
 * Tests for SchemaDiffer
 *
 * Covers: diff(), hasBreakingChanges(), summarize()
 * All private methods tested through public API.
 */

import { describe, expect, it } from 'vitest';
import type { ColumnConfig, ColumnDefinition } from '../../../sdk/schema/column/types.js';
import type { IndexDefinition, TableConfig, TableDefinition } from '../../../sdk/table.js';
import type { SchemaDiff } from '../diff.js';
import { SchemaDiffer } from '../diff.js';

// ============================================================================
// Helpers
// ============================================================================

const differ = new SchemaDiffer();

function col(name: string, overrides: Partial<ColumnConfig> = {}): ColumnDefinition {
  return {
    name,
    config: { type: 'string', ...overrides },
    tableName: 't',
  };
}

function table(
  name: string,
  columns: ColumnDefinition[] = [],
  overrides: Partial<TableConfig> = {},
): TableDefinition {
  return {
    name,
    columns,
    config: { schema: 'full', type: 'normal', ...overrides },
  };
}

function index(
  name: string,
  fields: string[],
  type?: 'unique' | 'fulltext' | 'hnsw',
): IndexDefinition {
  return { name, fields, type };
}

function emptyDiff(): SchemaDiff {
  return {
    added: { tables: [], fields: [], indexes: [] },
    removed: { tables: [], fields: [], indexes: [] },
    changed: { tables: [], fields: [] },
  };
}

// ============================================================================
// SchemaDiffer.diff()
// ============================================================================

describe('SchemaDiffer.diff', () => {
  // ============================================================================
  // Empty / no-change cases
  // ============================================================================

  it('returns empty diff for empty schemas', () => {
    const result = differ.diff([], []);
    expect(result).toEqual(emptyDiff());
  });

  it('returns empty diff for identical schemas', () => {
    const oldSchema = [table('user', [col('name'), col('email')])];
    const newSchema = [table('user', [col('name'), col('email')])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result).toEqual(emptyDiff());
  });

  it('returns empty diff for identical schemas with no columns', () => {
    const oldSchema = [table('user')];
    const newSchema = [table('user')];
    const result = differ.diff(oldSchema, newSchema);
    expect(result).toEqual(emptyDiff());
  });

  // ============================================================================
  // Added tables
  // ============================================================================

  it('detects truly new table', () => {
    const oldSchema: TableDefinition[] = [];
    const newSchema = [table('user', [col('name')])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.added.tables).toHaveLength(1);
    expect(result.added.tables[0].name).toBe('user');
    expect(result.added.fields).toHaveLength(0);
  });

  it('treats existing table with no columns in old as field additions, not new table', () => {
    // Table exists in DB but has no columns (schemaless or just created)
    const oldSchema = [table('existing_table')];
    const newSchema = [table('existing_table', [col('name'), col('email')])];
    const result = differ.diff(oldSchema, newSchema);

    // NOT added as a new table
    expect(result.added.tables).toHaveLength(0);

    // Fields should be added
    expect(result.added.fields).toHaveLength(2);
  });

  it('treats both schemas with no columns as no change', () => {
    const oldSchema = [table('empty_table')];
    const newSchema = [table('empty_table')];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.added.tables).toHaveLength(0);
    expect(result.removed.tables).toHaveLength(0);
    expect(result.changed.tables).toHaveLength(0);
  });

  // ============================================================================
  // Removed tables
  // ============================================================================

  it('detects removed table', () => {
    const oldSchema = [table('user', [col('name')])];
    const newSchema: TableDefinition[] = [];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.removed.tables).toHaveLength(1);
    expect(result.removed.tables[0]).toBe('user');
  });

  // ============================================================================
  // Changed tables
  // ============================================================================

  it('detects schema mode change (breaking)', () => {
    const oldSchema = [table('user', [], { schema: 'less' })];
    const newSchema = [table('user', [], { schema: 'full' })];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.changed.tables).toHaveLength(1);
    expect(result.changed.tables[0].breakingChanges[0]).toContain('Schema mode changed');
  });

  it('detects table type change (breaking)', () => {
    const oldSchema = [table('user', [], { type: 'normal' })];
    const newSchema = [table('user', [], { type: 'relation' })];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.changed.tables).toHaveLength(1);
    expect(result.changed.tables[0].breakingChanges[0]).toContain('Table type changed');
  });

  it('detects both schema mode and type changes', () => {
    const oldSchema = [table('user', [], { schema: 'less', type: 'normal' })];
    const newSchema = [table('user', [], { schema: 'full', type: 'relation' })];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.changed.tables).toHaveLength(1);
    expect(result.changed.tables[0].breakingChanges).toHaveLength(2);
  });

  it('no table-level changes when only columns changed', () => {
    const oldSchema = [table('user', [col('name')])];
    const newSchema = [table('user', [col('name'), col('email')])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.changed.tables).toHaveLength(0);
    expect(result.added.fields).toHaveLength(1);
  });

  // ============================================================================
  // Field additions
  // ============================================================================

  it('detects added field', () => {
    const oldSchema = [table('user', [col('name')])];
    const newSchema = [table('user', [col('name'), col('email')])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.added.fields).toHaveLength(1);
    expect(result.added.fields[0].table).toBe('user');
    expect(result.added.fields[0].column.name).toBe('email');
  });

  it('detects multiple added fields', () => {
    const oldSchema = [table('user', [col('name')])];
    const newSchema = [table('user', [col('name'), col('email'), col('age', { type: 'int' })])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.added.fields).toHaveLength(2);
  });

  // ============================================================================
  // Field removals
  // ============================================================================

  it('detects removed field', () => {
    const oldSchema = [table('user', [col('name'), col('email')])];
    const newSchema = [table('user', [col('name')])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.removed.fields).toHaveLength(1);
    expect(result.removed.fields[0].table).toBe('user');
    expect(result.removed.fields[0].field).toBe('email');
  });

  it('detects multiple removed fields', () => {
    const oldSchema = [table('user', [col('name'), col('email'), col('age', { type: 'int' })])];
    const newSchema = [table('user', [col('name')])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.removed.fields).toHaveLength(2);
  });

  // ============================================================================
  // Field changes
  // ============================================================================

  it('detects field type change', () => {
    const oldSchema = [table('user', [col('age', { type: 'int' })])];
    const newSchema = [table('user', [col('age', { type: 'string' })])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.changed.fields).toHaveLength(1);
    expect(result.changed.fields[0].field).toBe('age');
    expect(result.changed.fields[0].breakingChanges[0]).toContain('Type changed');
  });

  it('detects optional to required change (breaking)', () => {
    const oldSchema = [table('user', [col('name', { optional: true })])];
    const newSchema = [table('user', [col('name', { optional: false })])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.changed.fields).toHaveLength(1);
    expect(
      result.changed.fields[0].breakingChanges.some((b) => b.includes('optional to required')),
    ).toBe(true);
  });

  it('detects readonly change', () => {
    const oldSchema = [table('user', [col('name', { readonly: false })])];
    const newSchema = [table('user', [col('name', { readonly: true })])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.changed.fields).toHaveLength(1);
    expect(result.changed.fields[0].breakingChanges.some((b) => b.includes('readonly'))).toBe(true);
  });

  it('no change from readonly true to false (not tracked as breaking)', () => {
    const oldSchema = [table('user', [col('name', { readonly: true })])];
    const newSchema = [table('user', [col('name', { readonly: false })])];
    const result = differ.diff(oldSchema, newSchema);
    // The check is: !old.readonly && new.readonly → not triggered here
    expect(result.changed.fields).toHaveLength(0);
  });

  it('detects flexible mode change', () => {
    const oldSchema = [table('user', [col('name', { flexible: true })])];
    const newSchema = [table('user', [col('name', { flexible: false })])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.changed.fields).toHaveLength(1);
    expect(result.changed.fields[0].breakingChanges.some((b) => b.includes('flexible'))).toBe(true);
  });

  it('detects default value change', () => {
    const oldSchema = [table('user', [col('status', { default: "'active'" })])];
    const newSchema = [table('user', [col('status', { default: "'inactive'" })])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.changed.fields).toHaveLength(1);
    expect(
      result.changed.fields[0].breakingChanges.some((b) => b.includes('Default changed')),
    ).toBe(true);
  });

  it('detects default changed from value to no default', () => {
    const oldSchema = [table('user', [col('status', { default: "'active'" })])];
    const newSchema = [table('user', [col('status')])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.changed.fields).toHaveLength(1);
    expect(result.changed.fields[0].breakingChanges[0]).toContain("'active'");
    expect(result.changed.fields[0].breakingChanges[0]).toContain('NONE');
  });

  it('detects coercible type widening (int to float)', () => {
    const oldSchema = [table('user', [col('score', { type: 'int' })])];
    const newSchema = [table('user', [col('score', { type: 'float' })])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.changed.fields).toHaveLength(1);
    expect(result.changed.fields[0].breakingChanges.some((b) => b.includes('data migration'))).toBe(
      true,
    );
  });

  it('detects int to string type widening', () => {
    const oldSchema = [table('user', [col('score', { type: 'int' })])];
    const newSchema = [table('user', [col('score', { type: 'string' })])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.changed.fields).toHaveLength(1);
    expect(result.changed.fields[0].field).toBe('score');
    expect(result.changed.fields[0].breakingChanges.some((b) => b.includes('data migration'))).toBe(
      true,
    );
  });

  it('detects multiple changes on same field', () => {
    const oldSchema = [
      table('user', [col('name', { type: 'int', optional: true, default: "'0'" })]),
    ];
    const newSchema = [table('user', [col('name', { type: 'string', optional: false })])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.changed.fields).toHaveLength(1);
    // Should have at least type change + optional→required + maybe widening
    expect(result.changed.fields[0].breakingChanges.length).toBeGreaterThanOrEqual(2);
  });

  // ============================================================================
  // Auto-created field filtering
  // ============================================================================

  it('filters "id" field from comparison (auto-created by SurrealDB)', () => {
    // Both have an 'id' column with different types — should be ignored
    const oldSchema = [table('user', [col('id', { type: 'string' }), col('name')])];
    const newSchema = [table('user', [col('id', { type: 'int' }), col('name')])];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.changed.fields).toHaveLength(0);
    expect(result.added.fields).toHaveLength(0);
    expect(result.removed.fields).toHaveLength(0);
  });

  it('does not filter non-id fields', () => {
    const oldSchema = [table('user', [col('name')])];
    const newSchema = [table('user', [col('name'), col('id_str', { type: 'int' })])];
    const result = differ.diff(oldSchema, newSchema);
    // 'id_str' is not in the auto-created list
    expect(result.added.fields).toHaveLength(1);
    expect(result.added.fields[0].column.name).toBe('id_str');
  });

  // ============================================================================
  // Index changes
  // ============================================================================

  it('detects added index', () => {
    const oldSchema = [table('user', [col('email')], { indexes: [] })];
    const newSchema = [
      table('user', [col('email')], { indexes: [index('idx_email', ['email'], 'unique')] }),
    ];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.added.indexes).toHaveLength(1);
    expect(result.added.indexes[0].table).toBe('user');
    expect(result.added.indexes[0].index.name).toBe('idx_email');
  });

  it('detects removed index', () => {
    const oldSchema = [
      table('user', [col('email')], { indexes: [index('idx_email', ['email'], 'unique')] }),
    ];
    const newSchema = [table('user', [col('email')], { indexes: [] })];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.removed.indexes).toHaveLength(1);
    expect(result.removed.indexes[0].table).toBe('user');
    expect(result.removed.indexes[0].name).toBe('idx_email');
  });

  it('handles undefined indexes in old config', () => {
    const oldSchema = [table('user', [col('name')])]; // indexes not set
    const newSchema = [table('user', [col('name')], { indexes: [index('idx_name', ['name'])] })];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.added.indexes).toHaveLength(1);
  });

  it('handles undefined indexes in new config', () => {
    const oldSchema = [table('user', [col('name')], { indexes: [index('idx_name', ['name'])] })];
    const newSchema = [table('user', [col('name')])]; // indexes not set
    const result = differ.diff(oldSchema, newSchema);
    expect(result.removed.indexes).toHaveLength(1);
  });

  it('detects no index changes when same indexes', () => {
    const idx = index('idx_name', ['name']);
    const oldSchema = [table('user', [col('name')], { indexes: [idx] })];
    const newSchema = [table('user', [col('name')], { indexes: [idx] })];
    const result = differ.diff(oldSchema, newSchema);
    expect(result.added.indexes).toHaveLength(0);
    expect(result.removed.indexes).toHaveLength(0);
  });

  // ============================================================================
  // Combined scenarios
  // ============================================================================

  it('handles add, remove, and change simultaneously', () => {
    const oldSchema = [table('a', [col('name')]), table('b', [col('x')]), table('c', [col('z')])];
    const newSchema = [
      table('a', [col('name'), col('email')]), // added field
      table('b', [col('y')]), // changed field (x → y)
      table('d', [col('p')]), // new table
    ];

    const result = differ.diff(oldSchema, newSchema);
    expect(result.added.tables).toHaveLength(1);
    expect(result.added.tables[0].name).toBe('d');
    expect(result.added.fields.length).toBeGreaterThanOrEqual(1);
    expect(result.removed.tables).toHaveLength(1);
    expect(result.removed.tables[0]).toBe('c');
  });
});

// ============================================================================
// SchemaDiffer.hasBreakingChanges()
// ============================================================================

describe('SchemaDiffer.hasBreakingChanges', () => {
  it('returns false for empty diff', () => {
    expect(differ.hasBreakingChanges(emptyDiff())).toBe(false);
  });

  it('returns false for only added items', () => {
    const diff: SchemaDiff = {
      added: {
        tables: [table('user')],
        fields: [{ table: 'user', column: col('name') }],
        indexes: [],
      },
      removed: { tables: [], fields: [], indexes: [] },
      changed: { tables: [], fields: [] },
    };
    expect(differ.hasBreakingChanges(diff)).toBe(false);
  });

  it('returns true when changed tables have breaking changes', () => {
    const diff: SchemaDiff = {
      added: { tables: [], fields: [], indexes: [] },
      removed: { tables: [], fields: [], indexes: [] },
      changed: {
        tables: [
          {
            name: 'user',
            oldDef: table('user', [], { schema: 'less' }),
            newDef: table('user', [], { schema: 'full' }),
            breakingChanges: ['Schema mode changed from less to full'],
          },
        ],
        fields: [],
      },
    };
    expect(differ.hasBreakingChanges(diff)).toBe(true);
  });

  it('returns true when changed fields have breaking changes', () => {
    const diff: SchemaDiff = {
      added: { tables: [], fields: [], indexes: [] },
      removed: { tables: [], fields: [], indexes: [] },
      changed: {
        tables: [],
        fields: [
          {
            table: 'user',
            field: 'name',
            oldColumn: col('name', { type: 'int' }),
            newColumn: col('name', { type: 'string' }),
            breakingChanges: ['Type changed from int to string'],
          },
        ],
      },
    };
    expect(differ.hasBreakingChanges(diff)).toBe(true);
  });

  it('returns true when tables are removed', () => {
    const diff: SchemaDiff = {
      added: { tables: [], fields: [], indexes: [] },
      removed: { tables: ['user'], fields: [], indexes: [] },
      changed: { tables: [], fields: [] },
    };
    expect(differ.hasBreakingChanges(diff)).toBe(true);
  });

  it('returns true when fields are removed', () => {
    const diff: SchemaDiff = {
      added: { tables: [], fields: [], indexes: [] },
      removed: { tables: [], fields: [{ table: 'user', field: 'name' }], indexes: [] },
      changed: { tables: [], fields: [] },
    };
    expect(differ.hasBreakingChanges(diff)).toBe(true);
  });
});

// ============================================================================
// SchemaDiffer.summarize()
// ============================================================================

describe('SchemaDiffer.summarize', () => {
  it('returns "No changes" for empty diff', () => {
    expect(differ.summarize(emptyDiff())).toBe('No changes');
  });

  it('includes added tables', () => {
    const diff: SchemaDiff = {
      added: { tables: [table('user'), table('post')], fields: [], indexes: [] },
      removed: { tables: [], fields: [], indexes: [] },
      changed: { tables: [], fields: [] },
    };
    const summary = differ.summarize(diff);
    expect(summary).toContain('Added tables: user, post');
  });

  it('includes added fields', () => {
    const diff: SchemaDiff = {
      added: { tables: [], fields: [{ table: 'user', column: col('email') }], indexes: [] },
      removed: { tables: [], fields: [], indexes: [] },
      changed: { tables: [], fields: [] },
    };
    const summary = differ.summarize(diff);
    expect(summary).toContain('Added fields: user.email');
  });

  it('includes removed tables', () => {
    const diff: SchemaDiff = {
      added: { tables: [], fields: [], indexes: [] },
      removed: { tables: ['old_table'], fields: [], indexes: [] },
      changed: { tables: [], fields: [] },
    };
    const summary = differ.summarize(diff);
    expect(summary).toContain('Removed tables: old_table');
  });

  it('includes removed fields', () => {
    const diff: SchemaDiff = {
      added: { tables: [], fields: [], indexes: [] },
      removed: { tables: [], fields: [{ table: 'user', field: 'old_field' }], indexes: [] },
      changed: { tables: [], fields: [] },
    };
    const summary = differ.summarize(diff);
    expect(summary).toContain('Removed fields: user.old_field');
  });

  it('includes changed table breaking changes', () => {
    const diff: SchemaDiff = {
      added: { tables: [], fields: [], indexes: [] },
      removed: { tables: [], fields: [], indexes: [] },
      changed: {
        tables: [
          {
            name: 'user',
            oldDef: table('user', [], { schema: 'less' }),
            newDef: table('user', [], { schema: 'full' }),
            breakingChanges: ['Schema mode changed from less to full'],
          },
        ],
        fields: [],
      },
    };
    const summary = differ.summarize(diff);
    expect(summary).toContain('Changed table user');
    expect(summary).toContain('Schema mode changed');
  });

  it('includes changed field breaking changes', () => {
    const diff: SchemaDiff = {
      added: { tables: [], fields: [], indexes: [] },
      removed: { tables: [], fields: [], indexes: [] },
      changed: {
        tables: [],
        fields: [
          {
            table: 'user',
            field: 'name',
            oldColumn: col('name', { type: 'int' }),
            newColumn: col('name', { type: 'string' }),
            breakingChanges: ['Type changed from int to string'],
          },
        ],
      },
    };
    const summary = differ.summarize(diff);
    expect(summary).toContain('Changed field user.name');
    expect(summary).toContain('Type changed');
  });

  it('joins multiple sections with newlines', () => {
    const diff: SchemaDiff = {
      added: {
        tables: [table('post')],
        fields: [{ table: 'post', column: col('title') }],
        indexes: [],
      },
      removed: { tables: ['legacy'], fields: [{ table: 'legacy', field: 'data' }], indexes: [] },
      changed: { tables: [], fields: [] },
    };
    const summary = differ.summarize(diff);
    const lines = summary.split('\n');
    expect(lines.length).toBeGreaterThan(1);
  });

  it('handles empty columns map safely', () => {
    // Regression: when column arrays are empty, no crash
    const oldSchema = [table('user')];
    const newSchema = [table('user', [col('name')])];
    const result = differ.diff(oldSchema, newSchema);
    // Table exists but old has 0 columns — field additions only
    expect(result.added.tables).toHaveLength(0);
    expect(result.added.fields).toHaveLength(1);
  });
});
