import { describe, test, expect } from 'vitest';
import { memoriesTable, workspacesTable, usersTable, schema } from '../schema';

describe('memoriesTable schema', () => {
  test('exports memoriesTable without errors', () => {
    expect(memoriesTable.name).toBe('memories');
  });

  test('all columns are present', () => {
    const columnNames = memoriesTable.columns.map((c) => c.name).sort();
    expect(columnNames).toEqual([
      'content',
      'created_at',
      'memory_type',
      'metadata',
      'name',
      'workspace_id',
    ]);
  });
});

describe('workspacesTable schema', () => {
  test('table name is workspaces', () => {
    expect(workspacesTable.name).toBe('workspaces');
  });

  test('has user_id column defined as record(users).optional()', () => {
    const col = workspacesTable.$columns!['user_id'];
    expect(col).toBeDefined();
    expect(col.config.type).toBe('record');
    expect(col.config.recordTable).toBe('users');
    expect(col.config.optional).toBe(true);
  });

  test('all columns are present (backward compatible)', () => {
    const columnNames = workspacesTable.columns.map((c) => c.name).sort();
    expect(columnNames).toEqual([
      'created_at',
      'deleted_at',
      'description',
      'is_personal',
      'name',
      'user_id',
    ]);
  });

  test('existing string columns keep correct types', () => {
    const nameCol = workspacesTable.$columns!['name'];
    expect(nameCol.config.type).toBe('string');
    expect(nameCol.config.optional).toBeUndefined();

    const descCol = workspacesTable.$columns!['description'];
    expect(descCol.config.type).toBe('string');
    expect(descCol.config.optional).toBe(true);

    const isPersonalCol = workspacesTable.$columns!['is_personal'];
    expect(isPersonalCol.config.type).toBe('bool');
    expect(isPersonalCol.config.default).toBe('false');
  });

  test('created_at has defaultNow', () => {
    const col = workspacesTable.$columns!['created_at'];
    expect(col.config.type).toBe('datetime');
    expect(col.config.default).toBe('time::now()');
  });
});

describe('usersTable schema', () => {
  test('table name is users', () => {
    expect(usersTable.name).toBe('users');
  });

  test('has default_workspace_id column defined as record(workspaces).optional()', () => {
    const col = usersTable.$columns!['default_workspace_id'];
    expect(col).toBeDefined();
    expect(col.config.type).toBe('record');
    expect(col.config.recordTable).toBe('workspaces');
    expect(col.config.optional).toBe(true);
  });

  test('all columns are present (backward compatible)', () => {
    const columnNames = usersTable.columns.map((c) => c.name).sort();
    expect(columnNames).toEqual(['created_at', 'default_workspace_id', 'email', 'name', 'pass']);
  });

  test('existing columns keep correct types', () => {
    const emailCol = usersTable.$columns!['email'];
    expect(emailCol.config.type).toBe('string');

    const passCol = usersTable.$columns!['pass'];
    expect(passCol.config.type).toBe('string');

    const nameCol = usersTable.$columns!['name'];
    expect(nameCol.config.type).toBe('string');
    expect(nameCol.config.optional).toBe(true);
  });
});

describe('complete OrmSchema', () => {
  test('schema is created without errors and exports as OrmSchema', () => {
    expect(schema).toBeDefined();
    expect(schema.tableCount).toBe(10);
    expect(schema.getAccess()).toHaveLength(1);
    expect(schema.getAnalyzers()).toHaveLength(1);
  });

  test('schema contains all tables', () => {
    const tableNames = schema
      .getTables()
      .map((t) => t.name)
      .sort();
    expect(tableNames).toEqual([
      'api_keys',
      'embeddings',
      'has_embedding',
      'has_memory',
      'memories',
      'memory_tags',
      'models',
      'tags',
      'users',
      'workspaces',
    ]);
  });

  test('schema includes user_access record access definition', () => {
    const accessConfigs = schema.getAccess();
    expect(accessConfigs).toHaveLength(1);
    expect(accessConfigs[0].name).toBe('user_access');
  });

  test('schema includes fts_ascii analyzer', () => {
    const analyzers = schema.getAnalyzers();
    expect(analyzers).toHaveLength(1);
    expect(analyzers[0].name).toBe('fts_ascii');
  });

  test('workspaces and users tables are reachable via schema.getTable', () => {
    const ws = schema.getTable('workspaces');
    expect(ws).toBeDefined();
    expect(ws!.columns.find((c) => c.name === 'user_id')!.config.type).toBe('record');

    const us = schema.getTable('users');
    expect(us).toBeDefined();
    expect(us!.columns.find((c) => c.name === 'default_workspace_id')!.config.type).toBe('record');
  });
});
