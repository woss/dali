import { describe, expect, it } from 'vitest';
import { SurrealQLGenerator } from '../core/generator.js';
import { createEmptyDdl, type SurrealAccess, type SurrealDbDDL } from '../ddl/ddl.js';
import { ddlDiff } from '../ddl/diff.js';

const generator = new SurrealQLGenerator();

function createDdlWithAccess(access: SurrealAccess[]): SurrealDbDDL {
  const ddl = createEmptyDdl();
  ddl.accessStructured = access;
  return ddl;
}

describe('access DDL diff', () => {
  it('detects new access definition', async () => {
    const current = createDdlWithAccess([]);
    const target = createDdlWithAccess([{ name: 'web_access', type: 'RECORD' }]);

    const result = await ddlDiff(current, target);
    const createStmts = result.statements.filter((s) => s.type === 'create_access');
    expect(createStmts).toHaveLength(1);
    if (createStmts[0].type === 'create_access') {
      expect(createStmts[0].access.name).toBe('web_access');
    }
  });

  it('detects multiple new access definitions', async () => {
    const current = createDdlWithAccess([]);
    const target = createDdlWithAccess([
      { name: 'web_access', type: 'RECORD' },
      { name: 'api_access', type: 'JWT' },
      { name: 'sso_access', type: 'OIDC' },
    ]);

    const result = await ddlDiff(current, target);
    const createStmts = result.statements.filter((s) => s.type === 'create_access');
    expect(createStmts).toHaveLength(3);
  });

  it('does NOT detect removal of access (safety-first)', async () => {
    const current = createDdlWithAccess([{ name: 'web_access', type: 'RECORD' }]);
    const target = createDdlWithAccess([]);

    const result = await ddlDiff(current, target);
    const dropStmts = result.statements.filter((s) => s.type === 'drop_access');
    expect(dropStmts).toHaveLength(0);
  });

  it('does not create duplicate statements for unchanged access', async () => {
    const current = createDdlWithAccess([{ name: 'web_access', type: 'RECORD' }]);
    const target = createDdlWithAccess([{ name: 'web_access', type: 'RECORD' }]);

    const result = await ddlDiff(current, target);
    const createStmts = result.statements.filter((s) => s.type === 'create_access');
    expect(createStmts).toHaveLength(0);
  });

  it('detects only new access when mixing existing and new', async () => {
    const current = createDdlWithAccess([{ name: 'existing_access', type: 'RECORD' }]);
    const target = createDdlWithAccess([
      { name: 'existing_access', type: 'RECORD' },
      { name: 'new_access', type: 'JWT' },
    ]);

    const result = await ddlDiff(current, target);
    const createStmts = result.statements.filter((s) => s.type === 'create_access');
    expect(createStmts).toHaveLength(1);
    if (createStmts[0].type === 'create_access') {
      expect(createStmts[0].access.name).toBe('new_access');
    }
  });
});

describe('access SQL generation', () => {
  it('generates DEFINE ACCESS SQL for RECORD type', () => {
    const sql = generator.generateAccessDefinition({
      name: 'web_access',
      type: 'RECORD',
    });
    expect(sql).toBe('DEFINE ACCESS web_access ON DATABASE TYPE RECORD');
  });

  it('generates DEFINE ACCESS SQL for JWT type', () => {
    const sql = generator.generateAccessDefinition({
      name: 'api_access',
      type: 'JWT',
      algorithm: 'HS256',
      key: 'secret',
    });
    expect(sql).toContain('DEFINE ACCESS api_access ON DATABASE TYPE JWT');
    expect(sql).toContain('ALGORITHM HS256');
    expect(sql).toContain('KEY "secret"');
  });

  it('generates DEFINE ACCESS SQL with SIGNUP/SIGNIN', () => {
    const sql = generator.generateAccessDefinition({
      name: 'web_access',
      type: 'RECORD',
      signup: 'CREATE user SET email = $email',
      signin: 'SELECT * FROM user WHERE email = $email',
    });
    expect(sql).toContain('SIGNUP (CREATE user SET email = $email)');
    expect(sql).toContain('SIGNIN (SELECT * FROM user WHERE email = $email)');
  });

  it('includes DURATION clauses', () => {
    const sql = generator.generateAccessDefinition({
      name: 'session_access',
      type: 'RECORD',
      duration: '7d',
      tokenDuration: '1h',
    });
    expect(sql).toContain('DURATION');
    expect(sql).toContain('FOR TOKEN 1h');
    expect(sql).toContain('FOR SESSION 7d');
  });

  it('includes DURATION with only token duration', () => {
    const sql = generator.generateAccessDefinition({
      name: 'token_only',
      type: 'RECORD',
      tokenDuration: '30m',
    });
    expect(sql).toContain('DURATION');
    expect(sql).toContain('FOR TOKEN 30m');
  });

  it('includes DURATION with only session duration', () => {
    const sql = generator.generateAccessDefinition({
      name: 'session_only',
      type: 'RECORD',
      duration: '24h',
    });
    expect(sql).toContain('DURATION');
    expect(sql).toContain('FOR SESSION 24h');
  });

  it('generates REMOVE ACCESS SQL', () => {
    const sql = generator.generateRemoveAccess('web_access');
    expect(sql).toBe('REMOVE ACCESS IF EXISTS web_access ON DATABASE');
  });

  it('generates access migration up', () => {
    const access: SurrealAccess = { name: 'my_access', type: 'JWT' };
    const sql = generator.generateAccessMigration(access);
    expect(sql).toContain('DEFINE ACCESS my_access ON DATABASE TYPE JWT');
  });

  it('converts statement to SQL via statementToSql', async () => {
    const current = createDdlWithAccess([]);
    const target = createDdlWithAccess([{ name: 'test_access', type: 'RECORD', duration: '1h' }]);

    const result = await ddlDiff(current, target);
    expect(result.sqlStatements.length).toBeGreaterThan(0);

    const accessSql = result.sqlStatements.find((s) => s.includes('DEFINE ACCESS'));
    expect(accessSql).toBeDefined();
    expect(accessSql).toContain('DEFINE ACCESS test_access ON DATABASE TYPE RECORD');
    expect(accessSql).toContain('DURATION FOR SESSION 1h');
  });
});
