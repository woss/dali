import { describe, expect, it } from 'vitest';
import { SurrealQLGenerator } from '../core/generator.js';
import { fromSurrealFunction, toSurrealFunction } from '../ddl/convert.js';
import {
  createEmptyDdl,
  type SurrealDbDDL,
  type SurrealFunction,
} from '../ddl/ddl.js';
import { ddlDiff } from '../ddl/diff.js';

const generator = new SurrealQLGenerator();

function createDdlWithFunctions(funcs: SurrealFunction[]): SurrealDbDDL {
  const ddl = createEmptyDdl();
  ddl.functions = funcs;
  return ddl;
}

describe('function DDL diff', () => {
  it('detects new function definition', async () => {
    const current = createDdlWithFunctions([]);
    const target = createDdlWithFunctions([
      { name: 'fn::hello', body: 'RETURN "hello"' },
    ]);

    const result = await ddlDiff(current, target);
    const createStmts = result.statements.filter(
      (s) => s.type === 'create_function',
    );
    expect(createStmts).toHaveLength(1);
    if (createStmts[0].type === 'create_function') {
      expect(createStmts[0].function.name).toBe('fn::hello');
    }
  });

  it('detects multiple new functions', async () => {
    const current = createDdlWithFunctions([]);
    const target = createDdlWithFunctions([
      { name: 'fn::hello', body: 'RETURN "hello"' },
      {
        name: 'fn::greet',
        args: ['$name'],
        body: 'RETURN "Hello, " + $name',
        comment: 'Greets a user',
      },
      { name: 'fn::add', args: ['$a: int', '$b: int'], body: 'RETURN $a + $b' },
    ]);

    const result = await ddlDiff(current, target);
    const createStmts = result.statements.filter(
      (s) => s.type === 'create_function',
    );
    expect(createStmts).toHaveLength(3);
  });

  it('detects changed function (drop + recreate)', async () => {
    const current = createDdlWithFunctions([
      { name: 'fn::hello', body: 'RETURN "hello"' },
    ]);
    const target = createDdlWithFunctions([
      { name: 'fn::hello', body: 'RETURN "hello world"' },
    ]);

    const result = await ddlDiff(current, target);
    const dropStmts = result.statements.filter(
      (s) => s.type === 'drop_function',
    );
    const createStmts = result.statements.filter(
      (s) => s.type === 'create_function',
    );
    expect(dropStmts).toHaveLength(1);
    expect(createStmts).toHaveLength(1);
    if (dropStmts[0].type === 'drop_function') {
      expect(dropStmts[0].name).toBe('fn::hello');
    }
  });

  it('detects changed function by args difference', async () => {
    const current = createDdlWithFunctions([
      { name: 'fn::greet', args: ['$name'], body: 'RETURN "Hello, " + $name' },
    ]);
    const target = createDdlWithFunctions([
      {
        name: 'fn::greet',
        args: ['$first', '$last'],
        body: 'RETURN "Hello, " + $name',
      },
    ]);

    const result = await ddlDiff(current, target);
    const dropStmts = result.statements.filter(
      (s) => s.type === 'drop_function',
    );
    const createStmts = result.statements.filter(
      (s) => s.type === 'create_function',
    );
    expect(dropStmts).toHaveLength(1);
    expect(createStmts).toHaveLength(1);
  });

  it('detects changed function by comment difference', async () => {
    const current = createDdlWithFunctions([
      {
        name: 'fn::greet',
        args: ['$name'],
        body: 'RETURN "Hello, " + $name',
        comment: 'Old comment',
      },
    ]);
    const target = createDdlWithFunctions([
      {
        name: 'fn::greet',
        args: ['$name'],
        body: 'RETURN "Hello, " + $name',
        comment: 'Updated comment',
      },
    ]);

    const result = await ddlDiff(current, target);
    const dropStmts = result.statements.filter(
      (s) => s.type === 'drop_function',
    );
    const createStmts = result.statements.filter(
      (s) => s.type === 'create_function',
    );
    expect(dropStmts).toHaveLength(1);
    expect(createStmts).toHaveLength(1);
  });

  it('detects no changes for identical functions', async () => {
    const func: SurrealFunction = {
      name: 'fn::hello',
      body: 'RETURN "hello"',
    };
    const current = createDdlWithFunctions([func]);
    const target = createDdlWithFunctions([func]);

    const result = await ddlDiff(current, target);
    const createStmts = result.statements.filter(
      (s) => s.type === 'create_function',
    );
    const dropStmts = result.statements.filter(
      (s) => s.type === 'drop_function',
    );
    expect(createStmts).toHaveLength(0);
    expect(dropStmts).toHaveLength(0);
  });

  it('returns empty for empty function arrays', async () => {
    const current = createDdlWithFunctions([]);
    const target = createDdlWithFunctions([]);

    const result = await ddlDiff(current, target);
    const createStmts = result.statements.filter(
      (s) => s.type === 'create_function',
    );
    const dropStmts = result.statements.filter(
      (s) => s.type === 'drop_function',
    );
    expect(createStmts).toHaveLength(0);
    expect(dropStmts).toHaveLength(0);
  });

  it('does NOT detect removal of functions (safety-first)', async () => {
    const current = createDdlWithFunctions([
      { name: 'fn::hello', body: 'RETURN "hello"' },
    ]);
    const target = createDdlWithFunctions([]);

    const result = await ddlDiff(current, target);
    const dropStmts = result.statements.filter(
      (s) => s.type === 'drop_function',
    );
    expect(dropStmts).toHaveLength(0);
  });

  it('detects only new functions when mixing existing and new', async () => {
    const current = createDdlWithFunctions([
      { name: 'fn::existing', body: 'RETURN "existing"' },
    ]);
    const target = createDdlWithFunctions([
      { name: 'fn::existing', body: 'RETURN "existing"' },
      { name: 'fn::new', body: 'RETURN "new"' },
    ]);

    const result = await ddlDiff(current, target);
    const createStmts = result.statements.filter(
      (s) => s.type === 'create_function',
    );
    expect(createStmts).toHaveLength(1);
    if (createStmts[0].type === 'create_function') {
      expect(createStmts[0].function.name).toBe('fn::new');
    }
  });
});

describe('function SQL generation', () => {
  it('generates DEFINE FUNCTION SQL with name and body', () => {
    const sql = generator.generateFunctionDefinition({
      name: 'fn::hello',
      body: 'RETURN "hello"',
    });
    expect(sql).toBe(
      'DEFINE FUNCTION IF NOT EXISTS fn::hello { RETURN "hello" }',
    );
  });

  it('generates DEFINE FUNCTION SQL with args', () => {
    const sql = generator.generateFunctionDefinition({
      name: 'fn::greet',
      args: ['$name'],
      body: 'RETURN "Hello, " + $name',
    });
    expect(sql).toContain('fn::greet');
    expect(sql).toContain('($name)');
    expect(sql).toContain('{ RETURN "Hello, " + $name }');
  });

  it('generates DEFINE FUNCTION SQL with multi-arg', () => {
    const sql = generator.generateFunctionDefinition({
      name: 'fn::add',
      args: ['$a: int', '$b: int'],
      body: 'RETURN $a + $b',
    });
    expect(sql).toContain('($a: int, $b: int)');
  });

  it('generates DEFINE FUNCTION SQL with COMMENT', () => {
    const sql = generator.generateFunctionDefinition({
      name: 'fn::greet',
      args: ['$name'],
      body: 'RETURN "Hello, " + $name',
      comment: 'Greets a user',
    });
    expect(sql).toContain('COMMENT "Greets a user"');
  });

  it('generates DEFINE FUNCTION SQL with PERMISSIONS', () => {
    const sql = generator.generateFunctionDefinition({
      name: 'fn::secure',
      body: 'RETURN $x',
      permissions: 'FOR select FULL',
    });
    expect(sql).toContain('PERMISSIONS FOR select FULL');
  });

  it('generates DEFINE FUNCTION SQL with comment and permissions', () => {
    const sql = generator.generateFunctionDefinition({
      name: 'fn::full',
      args: ['$x'],
      body: 'RETURN $x',
      comment: 'Full function',
      permissions: 'FOR select FULL',
    });
    expect(sql).toContain('COMMENT "Full function"');
    expect(sql).toContain('PERMISSIONS FOR select FULL');
  });

  it('generates REMOVE FUNCTION SQL', () => {
    const sql = generator.generateRemoveFunction('fn::hello');
    expect(sql).toBe('REMOVE FUNCTION IF EXISTS fn::hello');
  });

  it('generates function migration up (DEFINE FUNCTION)', () => {
    const func: SurrealFunction = { name: 'fn::hello', body: 'RETURN "hello"' };
    const sql = generator.generateFunctionMigration(func);
    expect(sql).toContain('DEFINE FUNCTION IF NOT EXISTS fn::hello');
  });
});

describe('function statementToSql', () => {
  it('converts create_function statement to SQL', async () => {
    const current = createDdlWithFunctions([]);
    const target = createDdlWithFunctions([
      { name: 'fn::hello', body: 'RETURN "hello"' },
    ]);

    const result = await ddlDiff(current, target);
    expect(result.sqlStatements.length).toBeGreaterThan(0);

    const funcSql = result.sqlStatements.find((s) =>
      s.includes('DEFINE FUNCTION'),
    );
    expect(funcSql).toBeDefined();
    expect(funcSql).toContain('DEFINE FUNCTION IF NOT EXISTS fn::hello');
    expect(funcSql).toContain('{ RETURN "hello" }');
  });

  it('converts drop_function statement to SQL', async () => {
    const current = createDdlWithFunctions([
      { name: 'fn::hello', body: 'RETURN "hello"' },
    ]);
    const target = createDdlWithFunctions([
      { name: 'fn::hello', body: 'RETURN "hello world"' },
    ]);

    const result = await ddlDiff(current, target);
    const dropSql = result.sqlStatements.find((s) =>
      s.includes('REMOVE FUNCTION'),
    );
    expect(dropSql).toBeDefined();
    expect(dropSql).toBe('REMOVE FUNCTION IF EXISTS fn::hello');
  });

  it('converts both drop and create for changed function', async () => {
    const current = createDdlWithFunctions([
      { name: 'fn::greet', args: ['$name'], body: 'RETURN "Hello, " + $name' },
    ]);
    const target = createDdlWithFunctions([
      { name: 'fn::greet', args: ['$name'], body: 'RETURN "Hi, " + $name' },
    ]);

    const result = await ddlDiff(current, target);
    const dropSql = result.sqlStatements.find((s) =>
      s.includes('REMOVE FUNCTION'),
    );
    const createSql = result.sqlStatements.find((s) =>
      s.includes('DEFINE FUNCTION'),
    );

    expect(dropSql).toBeDefined();
    expect(createSql).toBeDefined();
    expect(dropSql).toBe('REMOVE FUNCTION IF EXISTS fn::greet');
    expect(createSql).toContain('DEFINE FUNCTION IF NOT EXISTS fn::greet');
    expect(createSql).toContain('{ RETURN "Hi, " + $name }');
  });
});

describe('function conversion', () => {
  it('toSurrealFunction converts FunctionConfig to SurrealFunction', () => {
    const result = toSurrealFunction({
      name: 'fn::hello',
      body: 'RETURN "hello"',
    });
    expect(result.name).toBe('fn::hello');
    expect(result.body).toBe('RETURN "hello"');
  });

  it('toSurrealFunction converts with args and comment', () => {
    const result = toSurrealFunction({
      name: 'fn::greet',
      args: ['$name'],
      body: 'RETURN "Hello, " + $name',
      comment: 'Greets a user',
    });
    expect(result.name).toBe('fn::greet');
    expect(result.args).toEqual(['$name']);
    expect(result.body).toBe('RETURN "Hello, " + $name');
    expect(result.comment).toBe('Greets a user');
  });

  it('toSurrealFunction converts with permissions', () => {
    const result = toSurrealFunction({
      name: 'fn::secure',
      body: 'RETURN $x',
      permissions: 'FOR select FULL',
    });
    expect(result.permissions).toBe('FOR select FULL');
  });

  it('fromSurrealFunction converts SurrealFunction to FunctionConfig', () => {
    const result = fromSurrealFunction({
      name: 'fn::hello',
      body: 'RETURN "hello"',
    });
    expect(result.name).toBe('fn::hello');
    expect(result.body).toBe('RETURN "hello"');
  });

  it('fromSurrealFunction handles args and comment', () => {
    const result = fromSurrealFunction({
      name: 'fn::greet',
      args: ['$name'],
      body: 'RETURN "Hello, " + $name',
      comment: 'Greets a user',
    });
    expect(result.args).toEqual(['$name']);
    expect(result.comment).toBe('Greets a user');
  });

  it('fromSurrealFunction handles permissions', () => {
    const result = fromSurrealFunction({
      name: 'fn::secure',
      body: 'RETURN $x',
      permissions: 'FOR select FULL',
    });
    expect(result.permissions).toBe('FOR select FULL');
  });

  it('round-trip: FunctionConfig to SurrealFunction to FunctionConfig preserves fields', () => {
    const config = {
      name: 'fn::hello',
      args: ['$name'],
      body: 'RETURN $name',
      comment: 'Test function',
      permissions: 'FOR select FULL',
    };
    const surrealFunc = toSurrealFunction(config);
    const result = fromSurrealFunction(surrealFunc);

    expect(result.name).toBe(config.name);
    expect(result.args).toEqual(config.args);
    expect(result.body).toBe(config.body);
    expect(result.comment).toBe(config.comment);
    expect(result.permissions).toBe(config.permissions);
  });

  it('round-trip without optional fields', () => {
    const config = {
      name: 'fn::simple',
      body: 'RETURN 42',
    };
    const surrealFunc = toSurrealFunction(config);
    const result = fromSurrealFunction(surrealFunc);

    expect(result.name).toBe(config.name);
    expect(result.body).toBe(config.body);
    expect(result.args).toBeUndefined();
    expect(result.comment).toBeUndefined();
    expect(result.permissions).toBeUndefined();
  });

  it('throws for null/undefined input to toSurrealFunction', () => {
    expect(() =>
      toSurrealFunction(
        null as unknown as Parameters<typeof toSurrealFunction>[0],
      ),
    ).toThrow('FunctionConfig required');
  });

  it('throws for null/undefined input to fromSurrealFunction', () => {
    expect(() =>
      fromSurrealFunction(
        null as unknown as Parameters<typeof fromSurrealFunction>[0],
      ),
    ).toThrow('SurrealFunction required');
  });
});
