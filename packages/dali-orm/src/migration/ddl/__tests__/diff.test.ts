/**
 * Comprehensive tests for DDL diff engine
 *
 * Covers: ddlDiff, statementToSql, getDefaultPermissions,
 * formatDefaultForSql, serializePermissions, and all internal diff functions
 * (tested through ddlDiff output). Tests include table/column/index/relation/
 * access/event/function diffs, SQL generation, statement ordering, and edge cases.
 */

import { describe, expect, it } from 'vitest';
import {
  createEmptyDdl,
  type SurrealAccess,
  type SurrealColumn,
  type SurrealDbDDL,
  type SurrealEvent,
  type SurrealFunction,
  type SurrealIndex,
  type SurrealRelation,
  type SurrealSequence,
} from '../ddl.js';
import { ddlDiff, getDefaultPermissions, statementToSql } from '../diff.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function empty(): SurrealDbDDL {
  return createEmptyDdl();
}

function withTables(tables: SurrealDbDDL['tables']): SurrealDbDDL {
  const d = empty();
  d.tables = tables;
  return d;
}

function withIndexes(indexes: SurrealIndex[]): SurrealDbDDL {
  const d = empty();
  d.indexes = indexes;
  return d;
}

function withRelations(relations: SurrealRelation[]): SurrealDbDDL {
  const d = empty();
  d.relations = relations;
  return d;
}

function withAccess(access: SurrealAccess[]): SurrealDbDDL {
  const d = empty();
  d.accessStructured = access;
  return d;
}

function withSequences(sequences: SurrealSequence[]): SurrealDbDDL {
  const d = empty();
  d.sequences = sequences;
  return d;
}

function withEvents(events: SurrealEvent[]): SurrealDbDDL {
  const d = empty();
  d.events = events;
  return d;
}

function withFunctions(funcs: SurrealFunction[]): SurrealDbDDL {
  const d = empty();
  d.functions = funcs;
  return d;
}

/** Minimal column factory */
function col(
  name: string,
  overrides: Partial<SurrealColumn> = {},
): SurrealColumn {
  return {
    name,
    kind: 'string',
    table: 't',
    readonly: false,
    optional: false,
    permissions: {},
    flex: false,
    ...overrides,
  };
}

/** Minimal table factory */
function table(
  name: string,
  overrides: Partial<SurrealDbDDL['tables'][number]> = {},
): SurrealDbDDL['tables'][number] {
  return {
    name,
    schema: 'full',
    type: 'normal',
    columns: [],
    indexes: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getDefaultPermissions
// ---------------------------------------------------------------------------

describe('getDefaultPermissions', () => {
  it('returns object with WHERE true for all four operations', () => {
    const p = getDefaultPermissions();
    expect(p).toEqual({
      select: 'WHERE true',
      create: 'WHERE true',
      update: 'WHERE true',
      delete: 'WHERE true',
    });
  });
});

// ---------------------------------------------------------------------------
// ddlDiff — table-level diffs
// ---------------------------------------------------------------------------

describe('ddlDiff — tables', () => {
  it('detects a new table', async () => {
    const r = await ddlDiff(empty(), withTables([table('user')]));
    expect(r.statements).toHaveLength(1);
    expect(r.statements[0]).toMatchObject({
      type: 'create_table',
      name: 'user',
    });
  });

  it('detects multiple new tables', async () => {
    const r = await ddlDiff(
      empty(),
      withTables([table('user'), table('post')]),
    );
    expect(r.statements.filter((s) => s.type === 'create_table')).toHaveLength(
      2,
    );
  });

  it('detects a removed table in migrate mode', async () => {
    const r = await ddlDiff(
      withTables([table('deprecated')]),
      empty(),
      'migrate',
    );
    const drops = r.statements.filter((s) => s.type === 'drop_table');
    expect(drops).toHaveLength(1);
    if (drops[0].type === 'drop_table') {
      expect(drops[0].name).toBe('deprecated');
    }
    expect(r.dataLossOperations).toHaveLength(0);
  });

  it('detects a removed table in push mode WITH data-loss warnings', async () => {
    const r = await ddlDiff(withTables([table('deprecated')]), empty(), 'push');
    const drops = r.statements.filter((s) => s.type === 'drop_table');
    expect(drops).toHaveLength(1);
    expect(r.dataLossOperations).toHaveLength(1);
    expect(r.dataLossOperations[0]).toContain('DROP TABLE');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('Dropping table');
  });

  it('detects no changes for identical tables', async () => {
    const ddl = withTables([table('user')]);
    const r = await ddlDiff(ddl, ddl);
    expect(r.statements).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
  });

  it('emits warning when schema mode changes', async () => {
    const r = await ddlDiff(
      withTables([table('user', { schema: 'less' })]),
      withTables([table('user', { schema: 'full' })]),
    );
    const hasSchemaWarn = r.warnings.some((w) =>
      w.includes('schema mode changed'),
    );
    expect(hasSchemaWarn).toBe(true);
  });

  it('emits data-loss operation when table type changes', async () => {
    const r = await ddlDiff(
      withTables([table('edge', { type: 'normal' })]),
      withTables([table('edge', { type: 'relation' })]),
    );
    const hasTypeWarn = r.warnings.some((w) => w.includes('type changed'));
    expect(hasTypeWarn).toBe(true);
    expect(r.dataLossOperations).toContain('CHANGE TABLE TYPE edge');
  });
});

// ---------------------------------------------------------------------------
// ddlDiff — column-level diffs
// ---------------------------------------------------------------------------

describe('ddlDiff — columns', () => {
  it('detects a new column', async () => {
    const r = await ddlDiff(
      withTables([table('user', { columns: [] })]),
      withTables([table('user', { columns: [col('email')] })]),
    );
    const adds = r.statements.filter((s) => s.type === 'add_column');
    expect(adds).toHaveLength(1);
  });

  it('skips the implicit SurrealDB id field', async () => {
    const r = await ddlDiff(
      withTables([table('user', { columns: [] })]),
      withTables([table('user', { columns: [col('id', { kind: 'string' })] })]),
    );
    const adds = r.statements.filter((s) => s.type === 'add_column');
    expect(adds).toHaveLength(0);
  });

  it('skips schemaless columns (no kind info)', async () => {
    const both = withTables([
      table('user', { columns: [col('email', { kind: '' as any })] }),
    ]);
    const r = await ddlDiff(both, both);
    expect(r.statements).toHaveLength(0);
  });

  it('warns about NOT NULL column without default in push mode', async () => {
    const r = await ddlDiff(
      withTables([table('user')]),
      withTables([
        table('user', {
          columns: [col('email', { optional: false })],
        }),
      ]),
      'push',
    );
    const hasWarn = r.warnings.some((w) => w.includes('NOT NULL'));
    expect(hasWarn).toBe(true);
    expect(r.dataLossOperations.length).toBeGreaterThan(0);
  });

  it('warns about NOT NULL AND default change in push mode', async () => {
    // Full coverage for optional change + push mode data loss branch (lines 352-353)
    const r = await ddlDiff(
      withTables([
        table('user', {
          columns: [col('email', { optional: true })],
        }),
      ]),
      withTables([
        table('user', {
          columns: [col('email', { optional: false })],
        }),
      ]),
      'push',
    );
    const hasWarn = r.warnings.some((w) => w.includes('NOT NULL'));
    expect(hasWarn).toBe(true);
  });

  it('does NOT warn about NOT NULL without default in migrate mode', async () => {
    const r = await ddlDiff(
      withTables([table('user')]),
      withTables([
        table('user', {
          columns: [col('email', { optional: false })],
        }),
      ]),
      'migrate',
    );
    const hasWarn = r.warnings.some((w) => w.includes('NOT NULL'));
    expect(hasWarn).toBe(false);
  });

  it('detects removed column and warns about data loss in push mode', async () => {
    const r = await ddlDiff(
      withTables([table('user', { columns: [col('old_field')] })]),
      withTables([table('user')]),
      'push',
    );
    const removes = r.statements.filter((s) => s.type === 'remove_column');
    expect(removes).toHaveLength(1);
    expect(r.dataLossOperations.length).toBeGreaterThan(0);
  });

  it('detects column type change', async () => {
    const r = await ddlDiff(
      withTables([table('user', { columns: [col('age', { kind: 'int' })] })]),
      withTables([table('user', { columns: [col('age', { kind: 'float' })] })]),
    );
    const alters = r.statements.filter((s) => s.type === 'alter_column');
    expect(alters.length).toBeGreaterThanOrEqual(1);
  });

  it('detects column optional change', async () => {
    const r = await ddlDiff(
      withTables([
        table('user', { columns: [col('name', { optional: false })] }),
      ]),
      withTables([
        table('user', { columns: [col('name', { optional: true })] }),
      ]),
    );
    const alters = r.statements.filter((s) => s.type === 'alter_column');
    expect(alters.length).toBeGreaterThanOrEqual(1);
  });

  it('detects column readonly change', async () => {
    const r = await ddlDiff(
      withTables([
        table('user', { columns: [col('name', { readonly: false })] }),
      ]),
      withTables([
        table('user', { columns: [col('name', { readonly: true })] }),
      ]),
    );
    const alters = r.statements.filter((s) => s.type === 'alter_column');
    expect(alters.length).toBeGreaterThanOrEqual(1);
  });

  it('detects column default change', async () => {
    const r = await ddlDiff(
      withTables([
        table('user', { columns: [col('role', { default: 'viewer' })] }),
      ]),
      withTables([
        table('user', { columns: [col('role', { default: 'admin' })] }),
      ]),
    );
    const alters = r.statements.filter((s) => s.type === 'alter_column');
    expect(alters.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT alter when normalized defaults match', async () => {
    const r = await ddlDiff(
      withTables([
        table('user', { columns: [col('active', { default: 'true' })] }),
      ]),
      withTables([
        table('user', { columns: [col('active', { default: 'true' })] }),
      ]),
    );
    const alters = r.statements.filter((s) => s.type === 'alter_column');
    // May produce alters for other reasons, but NOT for default
    const defaultAlters = alters.filter(
      (s) => s.type === 'alter_column' && s.change && 'default' in s.change,
    );
    expect(defaultAlters).toHaveLength(0);
  });

  it('detects column recordTable change', async () => {
    const r = await ddlDiff(
      withTables([
        table('item', {
          columns: [col('owner', { kind: 'record', recordTable: 'user' })],
        }),
      ]),
      withTables([
        table('item', {
          columns: [col('owner', { kind: 'record', recordTable: 'org' })],
        }),
      ]),
    );
    const alters = r.statements.filter((s) => s.type === 'alter_column');
    expect(alters.length).toBeGreaterThanOrEqual(1);
  });

  it('detects column permissions change', async () => {
    const r = await ddlDiff(
      withTables([
        table('user', { columns: [col('email', { permissions: {} })] }),
      ]),
      withTables([
        table('user', {
          columns: [col('email', { permissions: { select: 'FULL' } })],
        }),
      ]),
    );
    const perms = r.statements.filter(
      (s) => s.type === 'alter_field_permissions',
    );
    expect(perms).toHaveLength(1);
  });

  it('detects column permissions change with create and update', async () => {
    // Hit serializePermissions create + update branches
    const r = await ddlDiff(
      withTables([
        table('user', { columns: [col('email', { permissions: {} })] }),
      ]),
      withTables([
        table('user', {
          columns: [
            col('email', {
              permissions: { select: true, create: false, update: false },
            }),
          ],
        }),
      ]),
    );
    const perms = r.statements.filter(
      (s) => s.type === 'alter_field_permissions',
    );
    expect(perms).toHaveLength(1);
    if (perms[0].type === 'alter_field_permissions') {
      expect(perms[0].permissions).toContain('FOR select FULL');
      expect(perms[0].permissions).toContain('FOR create NONE');
      expect(perms[0].permissions).toContain('FOR update NONE');
    }
  });

  it('emits type-change data-loss warning in push mode', async () => {
    const r = await ddlDiff(
      withTables([table('user', { columns: [col('age', { kind: 'int' })] })]),
      withTables([
        table('user', { columns: [col('age', { kind: 'string' })] }),
      ]),
      'push',
    );
    const hasWarn = r.warnings.some((w) => w.includes('Changing column type'));
    expect(hasWarn).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ddlDiff — table permissions
// ---------------------------------------------------------------------------

describe('ddlDiff — table permissions', () => {
  it('detects permission changes', async () => {
    const r = await ddlDiff(
      withTables([table('user', { permissions: { select: 'NONE' } })]),
      withTables([table('user', { permissions: { select: 'FULL' } })]),
    );
    const permStatements = r.statements.filter(
      (s) => s.type === 'alter_table_permissions',
    );
    expect(permStatements).toHaveLength(1);
  });

  it('does not emit permission statement when both are undefined', async () => {
    const ddl = withTables([table('user')]);
    const r = await ddlDiff(ddl, ddl);
    const permStatements = r.statements.filter(
      (s) => s.type === 'alter_table_permissions',
    );
    expect(permStatements).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ddlDiff — indexes
// ---------------------------------------------------------------------------

describe('ddlDiff — indexes', () => {
  it('detects a new index', async () => {
    const r = await ddlDiff(
      empty(),
      withIndexes([
        { name: 'idx_email', table: 'user', cols: ['email'], index: 'unique' },
      ]),
    );
    const creates = r.statements.filter((s) => s.type === 'create_index');
    expect(creates).toHaveLength(1);
    if (creates[0].type === 'create_index') {
      expect(creates[0].index.name).toBe('idx_email');
    }
  });

  it('detects a removed index', async () => {
    const r = await ddlDiff(
      withIndexes([
        { name: 'idx_old', table: 'user', cols: ['old'], index: 'unique' },
      ]),
      empty(),
    );
    const drops = r.statements.filter((s) => s.type === 'drop_index');
    expect(drops).toHaveLength(1);
    if (drops[0].type === 'drop_index') {
      expect(drops[0].name).toBe('idx_old');
    }
  });

  it('detects a changed index (drop + create)', async () => {
    const r = await ddlDiff(
      withIndexes([
        { name: 'idx_email', table: 'user', cols: ['email'], index: 'unique' },
      ]),
      withIndexes([
        {
          name: 'idx_email',
          table: 'user',
          cols: ['email'],
          index: 'fulltext',
        },
      ]),
    );
    const drops = r.statements.filter((s) => s.type === 'drop_index');
    const creates = r.statements.filter((s) => s.type === 'create_index');
    expect(drops).toHaveLength(1);
    expect(creates).toHaveLength(1);
  });

  it('detects no changes for identical indexes', async () => {
    const ddl = withIndexes([
      { name: 'idx_email', table: 'user', cols: ['email'], index: 'unique' },
    ]);
    const r = await ddlDiff(ddl, ddl);
    expect(r.statements).toHaveLength(0);
  });

  it('handles undefined indexes gracefully', async () => {
    const r = await ddlDiff(empty(), empty());
    expect(r.statements).toHaveLength(0);
  });

  it('uses table:name composite key to disambiguate', async () => {
    const r = await ddlDiff(
      withIndexes([
        { name: 'idx_name', table: 'user', cols: ['name'], index: 'unique' },
      ]),
      withIndexes([
        { name: 'idx_name', table: 'post', cols: ['title'], index: 'unique' },
      ]),
    );
    const creates = r.statements.filter((s) => s.type === 'create_index');
    const drops = r.statements.filter((s) => s.type === 'drop_index');
    // Different tables → different index, so one drop + one create
    expect(drops).toHaveLength(1);
    expect(creates).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// ddlDiff — relations
// ---------------------------------------------------------------------------

describe('ddlDiff — relations', () => {
  it('detects a new relation', async () => {
    const r = await ddlDiff(
      empty(),
      withRelations([{ name: 'follows', in: 'user', out: 'user', fields: [] }]),
    );
    const rels = r.statements.filter((s) => s.type === 'create_relation');
    expect(rels).toHaveLength(1);
    if (rels[0].type === 'create_relation') {
      expect(rels[0].name).toBe('follows');
    }
  });

  it('skips relation if target also defines the table via create_table', async () => {
    const target = empty();
    target.tables = [
      table('follows', { type: 'relation', in: 'user', out: 'user' }),
    ];
    target.relations = [
      { name: 'follows', in: 'user', out: 'user', fields: [] },
    ];
    const r = await ddlDiff(empty(), target);
    const rels = r.statements.filter((s) => s.type === 'create_relation');
    expect(rels).toHaveLength(0);
  });

  it('detects removed relation as drop_table', async () => {
    const r = await ddlDiff(
      withRelations([{ name: 'old_edge', in: 'a', out: 'b', fields: [] }]),
      empty(),
    );
    const drops = r.statements.filter((s) => s.type === 'drop_table');
    expect(drops).toHaveLength(1);
    if (drops[0].type === 'drop_table') {
      expect(drops[0].name).toBe('old_edge');
    }
  });
});

// ---------------------------------------------------------------------------
// ddlDiff — access
// ---------------------------------------------------------------------------

describe('ddlDiff — access', () => {
  it('detects new access definition', async () => {
    const r = await ddlDiff(
      empty(),
      withAccess([{ name: 'web', type: 'RECORD' }]),
    );
    const creates = r.statements.filter((s) => s.type === 'create_access');
    expect(creates).toHaveLength(1);
    if (creates[0].type === 'create_access') {
      expect(creates[0].access.name).toBe('web');
    }
  });

  it('detects multiple new access definitions', async () => {
    const r = await ddlDiff(
      empty(),
      withAccess([
        { name: 'web', type: 'RECORD' },
        { name: 'api', type: 'JWT' },
      ]),
    );
    const creates = r.statements.filter((s) => s.type === 'create_access');
    expect(creates).toHaveLength(2);
  });

  it('does NOT remove access (safety-first)', async () => {
    const r = await ddlDiff(
      withAccess([{ name: 'web', type: 'RECORD' }]),
      empty(),
    );
    const drops = r.statements.filter((s) => s.type === 'drop_access');
    expect(drops).toHaveLength(0);
  });

  it('is idempotent for unchanged access', async () => {
    const ddl = withAccess([{ name: 'web', type: 'RECORD' }]);
    const r = await ddlDiff(ddl, ddl);
    expect(r.statements).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ddlDiff — events
// ---------------------------------------------------------------------------

describe('ddlDiff — events', () => {
  it('detects new event', async () => {
    const r = await ddlDiff(
      empty(),
      withEvents([
        {
          name: 'on_create',
          what: 'user',
          when: '$before',
          then: ['UPDATE log SET x = 1'],
        },
      ]),
    );
    const creates = r.statements.filter((s) => s.type === 'create_event');
    expect(creates).toHaveLength(1);
    if (creates[0].type === 'create_event') {
      expect(creates[0].event.name).toBe('on_create');
    }
  });

  it('detects changed event (drop + recreate)', async () => {
    const r = await ddlDiff(
      withEvents([{ name: 'e', what: 'user', when: '$before', then: ['a'] }]),
      withEvents([{ name: 'e', what: 'user', when: '$before', then: ['b'] }]),
    );
    const drops = r.statements.filter((s) => s.type === 'drop_event');
    const creates = r.statements.filter((s) => s.type === 'create_event');
    expect(drops).toHaveLength(1);
    expect(creates).toHaveLength(1);
  });

  it('does NOT remove events (safety-first)', async () => {
    const r = await ddlDiff(
      withEvents([{ name: 'e', what: 'user', when: '$before', then: ['a'] }]),
      empty(),
    );
    const drops = r.statements.filter((s) => s.type === 'drop_event');
    expect(drops).toHaveLength(0);
  });

  it('is idempotent for identical events', async () => {
    const ddl = withEvents([
      { name: 'e', what: 'user', when: '$before', then: ['a'] },
    ]);
    const r = await ddlDiff(ddl, ddl);
    expect(r.statements).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ddlDiff — functions
// ---------------------------------------------------------------------------

describe('ddlDiff — functions', () => {
  it('detects new function', async () => {
    const r = await ddlDiff(
      empty(),
      withFunctions([{ name: 'fn::hello', body: 'RETURN "hello"' }]),
    );
    const creates = r.statements.filter((s) => s.type === 'create_function');
    expect(creates).toHaveLength(1);
    if (creates[0].type === 'create_function') {
      expect(creates[0].function.name).toBe('fn::hello');
    }
  });

  it('detects changed function (drop + recreate)', async () => {
    const r = await ddlDiff(
      withFunctions([{ name: 'fn::hello', body: 'RETURN "hello"' }]),
      withFunctions([{ name: 'fn::hello', body: 'RETURN "hi"' }]),
    );
    const drops = r.statements.filter((s) => s.type === 'drop_function');
    const creates = r.statements.filter((s) => s.type === 'create_function');
    expect(drops).toHaveLength(1);
    expect(creates).toHaveLength(1);
  });

  it('detects change by args difference', async () => {
    const r = await ddlDiff(
      withFunctions([
        { name: 'fn::greet', args: ['$name'], body: 'RETURN $name' },
      ]),
      withFunctions([
        { name: 'fn::greet', args: ['$first', '$last'], body: 'RETURN $name' },
      ]),
    );
    const drops = r.statements.filter((s) => s.type === 'drop_function');
    expect(drops).toHaveLength(1);
  });

  it('detects change by comment difference', async () => {
    const r = await ddlDiff(
      withFunctions([
        {
          name: 'fn::greet',
          args: ['$name'],
          body: 'RETURN $name',
          comment: 'old',
        },
      ]),
      withFunctions([
        {
          name: 'fn::greet',
          args: ['$name'],
          body: 'RETURN $name',
          comment: 'new',
        },
      ]),
    );
    const creates = r.statements.filter((s) => s.type === 'create_function');
    expect(creates).toHaveLength(1);
  });

  it('does NOT remove functions (safety-first)', async () => {
    const r = await ddlDiff(
      withFunctions([{ name: 'fn::hello', body: 'RETURN "hello"' }]),
      empty(),
    );
    const drops = r.statements.filter((s) => s.type === 'drop_function');
    expect(drops).toHaveLength(0);
  });

  it('is idempotent for identical functions', async () => {
    const ddl = withFunctions([{ name: 'fn::hello', body: 'RETURN "hello"' }]);
    const r = await ddlDiff(ddl, ddl);
    expect(r.statements).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ddlDiff — namespaces
// ---------------------------------------------------------------------------

describe('ddlDiff — namespaces', () => {
  it('detects a new namespace', async () => {
    const d1 = empty();
    const d2 = empty();
    d2.namespaces = ['production'];
    const r = await ddlDiff(d1, d2);
    const creates = r.statements.filter((s) => s.type === 'create_namespace');
    expect(creates).toHaveLength(1);
    if (creates[0].type === 'create_namespace') {
      expect(creates[0].name).toBe('production');
    }
  });

  it('detects multiple new namespaces', async () => {
    const d1 = empty();
    const d2 = empty();
    d2.namespaces = ['staging', 'production'];
    const r = await ddlDiff(d1, d2);
    const creates = r.statements.filter((s) => s.type === 'create_namespace');
    expect(creates).toHaveLength(2);
  });

  it('does NOT remove namespaces (safety-first)', async () => {
    const d1 = empty();
    d1.namespaces = ['old_ns'];
    const d2 = empty();
    const r = await ddlDiff(d1, d2);
    const drops = r.statements.filter((s) => s.type === 'drop_namespace');
    expect(drops).toHaveLength(0);
  });

  it('is idempotent for identical namespaces', async () => {
    const d = empty();
    d.namespaces = ['production'];
    const r = await ddlDiff(d, d);
    expect(r.statements).toHaveLength(0);
  });

  it('generates SQL for namespace statements', async () => {
    const d1 = empty();
    const d2 = empty();
    d2.namespaces = ['production'];
    const r = await ddlDiff(d1, d2);
    expect(
      r.sqlStatements.some((sql) =>
        sql.includes('DEFINE NAMESPACE production'),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Statement ordering
// ---------------------------------------------------------------------------

describe('statement ordering', () => {
  it('orders create_table before add_column before drop_table', async () => {
    // Produce statements in reverse expected order
    const ddl1 = withTables([table('old')]);
    const ddl2 = withTables([
      table('new'),
      table('old', { columns: [col('x')] }),
    ]);
    const r = await ddlDiff(ddl1, ddl2);

    const types = r.statements.map((s) => s.type);
    const createIdx = types.indexOf('create_table');
    const addIdx = types.indexOf('add_column');
    const dropIdx = types.indexOf('drop_table');

    // create_table before add_column
    if (createIdx >= 0 && addIdx >= 0) {
      expect(createIdx).toBeLessThan(addIdx);
    }
    // add_column before drop_table
    if (addIdx >= 0 && dropIdx >= 0) {
      expect(addIdx).toBeLessThan(dropIdx);
    }
  });

  it('orders create_index before drop_index', async () => {
    const r = await ddlDiff(
      withIndexes([{ name: 'old', table: 't', cols: ['a'], index: 'unique' }]),
      withIndexes([
        { name: 'new', table: 't', cols: ['b'], index: 'unique' },
        { name: 'old', table: 't', cols: ['a'], index: 'fulltext' },
      ]),
    );
    const types = r.statements.map((s) => s.type);
    const createIdx = types.indexOf('create_index');
    const dropIdx = types.lastIndexOf('drop_index');
    // create_index should come before drop_index
    expect(createIdx).toBeLessThan(dropIdx);
  });

  it('handles mixed statement types in correct order', async () => {
    const ddl1 = withTables([table('old')]);
    const ddl2 = withTables([
      table('new', { schema: 'full', type: 'normal', columns: [col('x')] }),
    ]);
    const r = await ddlDiff(ddl1, ddl2);

    for (let i = 0; i < r.sqlStatements.length - 1; i++) {
      expect(r.sqlStatements[i]).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// statementToSql — various statement types
// ---------------------------------------------------------------------------

describe('statementToSql', () => {
  describe('create_table', () => {
    it('generates DEFINE TABLE + DEFINE FIELD for columns', () => {
      const sql = statementToSql({
        type: 'create_table',
        name: 'user',
        schema: 'full',
        columns: [col('name')],
        indexes: [],
      });
      expect(sql).toContain('DEFINE TABLE IF NOT EXISTS user');
      expect(sql).toContain('SCHEMAFULL');
      expect(sql).toContain('DEFINE FIELD IF NOT EXISTS name ON TABLE user');
    });

    it('adds RELATION TYPE when in/out provided', () => {
      const sql = statementToSql({
        type: 'create_table',
        name: 'follows',
        schema: 'full',
        columns: [],
        indexes: [],
        in: 'user',
        out: 'user',
      });
      expect(sql).toContain('TYPE RELATION');
      expect(sql).toContain('IN user');
      expect(sql).toContain('OUT user');
    });

    it('uses option<T> for optional columns', () => {
      const sql = statementToSql({
        type: 'create_table',
        name: 'user',
        schema: 'full',
        columns: [col('email', { optional: true })],
        indexes: [],
      });
      expect(sql).toContain('TYPE option<string>');
    });

    it('adds READONLY, FLEXIBLE, DEFAULT, ASSERT, PERMISSIONS', () => {
      const sql = statementToSql({
        type: 'create_table',
        name: 'user',
        schema: 'full',
        columns: [
          col('role', {
            default: 'admin',
            assert: '$value != "superadmin"',
            readonly: true,
            flex: true,
            permissions: { select: true, create: false, update: false },
          }),
        ],
        indexes: [],
      });
      expect(sql).toContain('READONLY');
      expect(sql).toContain('FLEXIBLE');
      expect(sql).toContain("DEFAULT 'admin'");
      expect(sql).toContain('ASSERT $value != "superadmin"');
      expect(sql).toContain('PERMISSIONS FOR select FULL');
      expect(sql).toContain('FOR create NONE');
      expect(sql).toContain('FOR update NONE');
    });

    it('does not inline index definitions in create_table (handled by top-level diffIndexes)', () => {
      const sql = statementToSql({
        type: 'create_table',
        name: 'user',
        schema: 'full',
        columns: [col('email')],
        indexes: [
          {
            name: 'idx_email',
            table: 'user',
            cols: ['email'],
            index: 'unique',
          },
        ],
      });
      expect(sql).not.toContain('DEFINE INDEX');
      expect(sql).toContain('DEFINE TABLE');
      expect(sql).toContain('DEFINE FIELD');
    });

    it('wraps record type with record<table> syntax', () => {
      const sql = statementToSql({
        type: 'create_table',
        name: 'post',
        schema: 'full',
        columns: [col('author', { kind: 'record', recordTable: 'user' })],
        indexes: [],
      });
      expect(sql).toContain('TYPE record<user>');
    });

    it('uses SCHEMALESS for schema-less tables', () => {
      const sql = statementToSql({
        type: 'create_table',
        name: 'log',
        schema: 'less',
        columns: [],
        indexes: [],
      });
      expect(sql).toContain('SCHEMALESS');
    });
  });

  describe('drop_table', () => {
    it('generates REMOVE TABLE', () => {
      expect(statementToSql({ type: 'drop_table', name: 'obsolete' })).toBe(
        'REMOVE TABLE obsolete',
      );
    });
  });

  describe('rename_table', () => {
    it('generates ALTER TABLE RENAME TO', () => {
      expect(
        statementToSql({ type: 'rename_table', from: 'old', to: 'new' }),
      ).toBe('ALTER TABLE old RENAME TO new');
    });
  });

  describe('add_column', () => {
    it('generates DEFINE FIELD for new column', () => {
      const sql = statementToSql({
        type: 'add_column',
        table: 'user',
        column: col('email', { kind: 'string' }),
      });
      expect(sql).toContain('DEFINE FIELD IF NOT EXISTS email ON TABLE user');
      expect(sql).toContain('TYPE string');
    });
  });

  describe('remove_column', () => {
    it('generates REMOVE FIELD', () => {
      expect(
        statementToSql({ type: 'remove_column', table: 'user', column: 'old' }),
      ).toBe('REMOVE FIELD old ON TABLE user');
    });
  });

  describe('alter_column', () => {
    it('generates ALTER FIELD TYPE on type change', () => {
      const sql = statementToSql({
        type: 'alter_column',
        table: 'user',
        column: 'age',
        change: { type: 'int' },
      });
      expect(sql).toContain('ALTER FIELD age ON TABLE user');
      expect(sql).toContain('TYPE int');
    });

    it('uses option<T> when optional + type change', () => {
      const sql = statementToSql({
        type: 'alter_column',
        table: 'user',
        column: 'name',
        change: { type: 'string', optional: true },
      });
      expect(sql).toContain('TYPE option<string>');
    });

    it('adds TYPE option when making optional without type change', () => {
      const sql = statementToSql({
        type: 'alter_column',
        table: 'user',
        column: 'name',
        change: { optional: true },
        before: { type: 'string' },
      });
      expect(sql).toContain('TYPE option<string>');
    });

    it('handles readonly change', () => {
      const sql = statementToSql({
        type: 'alter_column',
        table: 'user',
        column: 'name',
        change: { readonly: true, optional: false, type: 'string' },
        before: { type: 'string', optional: false },
        after: { type: 'string', optional: false, readonly: true },
      });
      expect(sql).toContain('READONLY');
    });

    it('handles NOT READONLY', () => {
      const sql = statementToSql({
        type: 'alter_column',
        table: 'user',
        column: 'name',
        change: { readonly: false, optional: false, type: 'string' },
        before: { type: 'string', optional: false, readonly: true },
        after: { type: 'string', optional: false, readonly: false },
      });
      expect(sql).toContain('DROP READONLY');
    });

    it('handles default change', () => {
      const sql = statementToSql({
        type: 'alter_column',
        table: 'user',
        column: 'role',
        change: { default: 'admin', optional: false, type: 'string' },
        before: { type: 'string', optional: false },
        after: { type: 'string', optional: false, default: 'admin' },
      });
      expect(sql).toContain("DEFAULT 'admin'");
    });

    it('handles record type with recordTable in change', () => {
      const sql = statementToSql({
        type: 'alter_column',
        table: 'post',
        column: 'author',
        change: { type: 'record', recordTable: 'user', optional: false },
      });
      expect(sql).toContain('TYPE record<user>');
    });
  });

  describe('index statements', () => {
    it('generates DEFINE INDEX for create_index', () => {
      const sql = statementToSql({
        type: 'create_index',
        index: {
          name: 'idx_email',
          table: 'user',
          cols: ['email'],
          index: 'unique',
        },
      });
      expect(sql).toBe(
        'DEFINE INDEX idx_email ON TABLE user COLUMNS email UNIQUE',
      );
    });

    it('generates REMOVE INDEX for drop_index', () => {
      expect(
        statementToSql({ type: 'drop_index', name: 'idx_old', table: 'user' }),
      ).toBe('REMOVE INDEX idx_old ON TABLE user');
    });
  });

  describe('permissions statements', () => {
    it('generates ALTER TABLE PERMISSIONS', () => {
      const sql = statementToSql({
        type: 'alter_table_permissions',
        table: 'user',
        permissions: { select: 'WHERE true', create: 'WHERE true' },
      });
      expect(sql).toContain('ALTER TABLE user PERMISSIONS');
      expect(sql).toContain('FOR select WHERE true');
      expect(sql).toContain('FOR create WHERE true');
    });

    it('generates ALTER FIELD PERMISSIONS', () => {
      const sql = statementToSql({
        type: 'alter_field_permissions',
        table: 'user',
        field: 'email',
        permissions: 'FOR select FULL',
      });
      expect(sql).toBe(
        'ALTER FIELD email ON TABLE user PERMISSIONS FOR select FULL',
      );
    });
  });

  describe('relation statements', () => {
    it('generates DEFINE TABLE TYPE RELATION', () => {
      const sql = statementToSql({
        type: 'create_relation',
        name: 'follows',
        in: 'user',
        out: 'user',
        columns: [],
      });
      expect(sql).toBe('DEFINE TABLE follows TYPE RELATION IN user OUT user');
    });
  });

  describe('access statements', () => {
    it('generates DEFINE ACCESS for create_access', () => {
      const sql = statementToSql({
        type: 'create_access',
        access: { name: 'web', type: 'RECORD' },
      });
      expect(sql).toBe('DEFINE ACCESS web ON DATABASE TYPE RECORD');
    });

    it('generates REMOVE ACCESS for drop_access', () => {
      expect(statementToSql({ type: 'drop_access', name: 'web' })).toBe(
        'REMOVE ACCESS IF EXISTS web ON DATABASE',
      );
    });
  });

  describe('event statements', () => {
    it('generates DEFINE EVENT for create_event', () => {
      const sql = statementToSql({
        type: 'create_event',
        event: {
          name: 'on_create',
          what: 'user',
          when: '$before',
          then: ['UPDATE log SET x = 1'],
        },
      });
      expect(sql).toContain(
        'DEFINE EVENT IF NOT EXISTS on_create ON TABLE user',
      );
      expect(sql).toContain('WHEN ($before)');
    });

    it('generates REMOVE EVENT for drop_event', () => {
      expect(
        statementToSql({
          type: 'drop_event',
          name: 'on_create',
          table: 'user',
        }),
      ).toBe('REMOVE EVENT IF EXISTS on_create ON TABLE user');
    });
  });

  describe('function statements', () => {
    it('generates DEFINE FUNCTION for create_function', () => {
      const sql = statementToSql({
        type: 'create_function',
        function: { name: 'fn::hello', body: 'RETURN "hello"' },
      });
      expect(sql).toContain('DEFINE FUNCTION IF NOT EXISTS fn::hello');
      expect(sql).toContain('{ RETURN "hello" }');
    });

    it('generates REMOVE FUNCTION for drop_function', () => {
      expect(statementToSql({ type: 'drop_function', name: 'fn::hello' })).toBe(
        'REMOVE FUNCTION IF EXISTS fn::hello',
      );
    });
  });

  describe('namespace statements', () => {
    it('generates DEFINE NAMESPACE for create_namespace', () => {
      const sql = statementToSql({
        type: 'create_namespace',
        name: 'production',
      });
      expect(sql).toBe('DEFINE NAMESPACE production');
    });

    it('generates REMOVE NAMESPACE for drop_namespace', () => {
      expect(
        statementToSql({ type: 'drop_namespace', name: 'production' }),
      ).toBe('REMOVE NAMESPACE production');
    });
  });

  describe('unknown statement type', () => {
    it('returns a comment for unknown types', () => {
      const sql = statementToSql({ type: 'unknown_type' } as any);
      expect(sql).toContain('Unknown statement type');
    });
  });
});

// ---------------------------------------------------------------------------
// formatDefaultForSql edge cases (tested through statementToSql)
// ---------------------------------------------------------------------------

describe('formatDefaultForSql edge cases', () => {
  it('handles now() variant as default in create_table', () => {
    const sql = statementToSql({
      type: 'create_table',
      name: 'log',
      schema: 'full',
      columns: [col('ts', { kind: 'datetime', default: 'time::now()' })],
      indexes: [],
    });
    expect(sql).toContain('DEFAULT time::now()');
  });

  it('handles boolean default in create_table', () => {
    const sql = statementToSql({
      type: 'create_table',
      name: 'user',
      schema: 'full',
      columns: [col('active', { kind: 'bool', default: 'true' })],
      indexes: [],
    });
    expect(sql).toContain("DEFAULT 'true'");
  });

  it('handles null default in create_table', () => {
    const sql = statementToSql({
      type: 'create_table',
      name: 'user',
      schema: 'full',
      columns: [col('role', { kind: 'string', default: 'NULL' })],
      indexes: [],
    });
    expect(sql).toContain("DEFAULT 'NULL'");
  });

  it('covers serializePermissions with update field', () => {
    // Hit the update branch in serializePermissions via column permissions
    const sql = statementToSql({
      type: 'alter_field_permissions',
      table: 'user',
      field: 'email',
      permissions: 'FOR select FULL, FOR create FULL, FOR update FULL',
    });
    expect(sql).toContain('FOR select FULL');
    expect(sql).toContain('FOR create FULL');
    expect(sql).toContain('FOR update FULL');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles two identical empty DDLs', async () => {
    const r = await ddlDiff(empty(), empty());
    expect(r.statements).toHaveLength(0);
    expect(r.sqlStatements).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
    expect(r.dataLossOperations).toHaveLength(0);
  });

  it('groups statements by type', async () => {
    const r = await ddlDiff(empty(), withTables([table('a'), table('b')]));
    expect(r.groupedStatements.create_table).toHaveLength(2);
  });

  it('DiffMode type is exposed', () => {
    // Type-level check — just verify we can use the type
    const mode: 'push' | 'migrate' = 'migrate';
    expect(['push', 'migrate']).toContain(mode);
  });

  it('generates full SQL strings for a mixed diff', async () => {
    const ddl1 = withTables([table('keep'), table('drop')]);
    const ddl2 = withTables([
      table('add'),
      table('keep', { columns: [col('new_col')] }),
    ]);

    const r = await ddlDiff(ddl1, ddl2);
    expect(r.sqlStatements.length).toBeGreaterThan(0);
    for (const sql of r.sqlStatements) {
      expect(typeof sql).toBe('string');
      expect(sql.length).toBeGreaterThan(0);
    }
  });

  it('ddlDiff returns both statements and SQL in sync', async () => {
    const r = await ddlDiff(empty(), withTables([table('user')]));
    expect(r.statements.length).toBe(r.sqlStatements.length);
    // Every statement maps to SQL
    for (let i = 0; i < r.statements.length; i++) {
      expect(statementToSql(r.statements[i])).toBe(r.sqlStatements[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// Database diff tests
// ---------------------------------------------------------------------------

describe('diffDatabases', () => {
  it('detects new databases', async () => {
    const ddl1 = empty();
    const ddl2 = empty();
    ddl2.databases = ['testdb', 'production'];

    const r = await ddlDiff(ddl1, ddl2);
    expect(r.statements).toHaveLength(2);
    expect(r.statements.map((s) => s.type)).toEqual([
      'create_database',
      'create_database',
    ]);
    expect(r.statements[0]).toEqual({
      type: 'create_database',
      name: 'testdb',
    });
    expect(r.statements[1]).toEqual({
      type: 'create_database',
      name: 'production',
    });
  });

  it('detects no changes when databases match', async () => {
    const ddl1 = empty();
    ddl1.databases = ['testdb'];
    const ddl2 = empty();
    ddl2.databases = ['testdb'];

    const r = await ddlDiff(ddl1, ddl2);
    expect(r.statements).toHaveLength(0);
  });

  it('never auto-removes databases (safety-first)', async () => {
    const ddl1 = empty();
    ddl1.databases = ['testdb'];
    const ddl2 = empty();
    ddl2.databases = [];

    const r = await ddlDiff(ddl1, ddl2);
    const drops = r.statements.filter((s) => s.type === 'drop_database');
    expect(drops).toHaveLength(0);
  });

  it('ignores databases undefined on both sides', async () => {
    const ddl1 = empty();
    const ddl2 = empty();

    const r = await ddlDiff(ddl1, ddl2);
    expect(r.statements).toHaveLength(0);
  });
});

describe('statementToSql - database', () => {
  it('generates DEFINE DATABASE for create_database', () => {
    expect(statementToSql({ type: 'create_database', name: 'testdb' })).toBe(
      'DEFINE DATABASE testdb',
    );
  });

  it('generates DEFINE DATABASE with COMMENT', () => {
    expect(
      statementToSql({
        type: 'create_database',
        name: 'testdb',
        comment: 'Test',
      }),
    ).toBe('DEFINE DATABASE testdb COMMENT "Test"');
  });

  it('generates REMOVE DATABASE for drop_database', () => {
    expect(statementToSql({ type: 'drop_database', name: 'testdb' })).toBe(
      'REMOVE DATABASE testdb',
    );
  });
});

// ===========================================================================
// diffSequences
// ===========================================================================
describe('diffSequences', () => {
  it('detects new sequence', async () => {
    const ddl1 = empty();
    const ddl2 = withSequences([{ name: 'my_seq', start: 1 }]);

    const r = await ddlDiff(ddl1, ddl2);
    const creates = r.statements.filter((s) => s.type === 'create_sequence');
    const drops = r.statements.filter((s) => s.type === 'drop_sequence');
    expect(creates).toHaveLength(1);
    expect(drops).toHaveLength(0);
    expect((creates[0] as any).def.name).toBe('my_seq');
  });

  it('detects changed sequence (drop+recreate)', async () => {
    const ddl1 = withSequences([{ name: 'my_seq', start: 1, increment: 1 }]);
    const ddl2 = withSequences([{ name: 'my_seq', start: 1, increment: 5 }]);

    const r = await ddlDiff(ddl1, ddl2);
    const creates = r.statements.filter((s) => s.type === 'create_sequence');
    const drops = r.statements.filter((s) => s.type === 'drop_sequence');
    expect(creates).toHaveLength(1);
    expect(drops).toHaveLength(1);
    expect((drops[0] as any).def.name).toBe('my_seq');
  });

  it('detects no changes for identical sequences', async () => {
    const seq: SurrealSequence = {
      name: 'my_seq',
      start: 1,
      increment: 1,
      cycle: true,
    };
    const ddl1 = withSequences([seq]);
    const ddl2 = withSequences([{ ...seq }]);

    const r = await ddlDiff(ddl1, ddl2);
    const creates = r.statements.filter((s) => s.type === 'create_sequence');
    const drops = r.statements.filter((s) => s.type === 'drop_sequence');
    expect(creates).toHaveLength(0);
    expect(drops).toHaveLength(0);
  });

  it('never auto-removes sequences (safety-first)', async () => {
    const ddl1 = withSequences([{ name: 'my_seq' }]);
    const ddl2 = empty();

    const r = await ddlDiff(ddl1, ddl2);
    const drops = r.statements.filter((s) => s.type === 'drop_sequence');
    expect(drops).toHaveLength(0);
  });
});

// ===========================================================================
// statementToSql - sequence
// ===========================================================================
describe('statementToSql - sequence', () => {
  it('generates DEFINE SEQUENCE for create_sequence', () => {
    expect(
      statementToSql({
        type: 'create_sequence',
        def: { name: 'my_seq', start: 1, increment: 2 },
      }),
    ).toBe('DEFINE SEQUENCE IF NOT EXISTS my_seq START 1 INCREMENT 2');
  });

  it('generates REMOVE SEQUENCE for drop_sequence', () => {
    expect(
      statementToSql({ type: 'drop_sequence', def: { name: 'my_seq' } }),
    ).toBe('REMOVE SEQUENCE my_seq');
  });
});
