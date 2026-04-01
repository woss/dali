import { describe, expect, it } from 'vite-plus/test';
import { defineFunction } from '../schema/function-builder.js';

describe('defineFunction builder', () => {
  it('creates function with name and body', () => {
    const fn = defineFunction('fn::hello').body('RETURN "hello"').build();

    expect(fn.name).toBe('fn::hello');
    expect(fn.body).toBe('RETURN "hello"');
  });

  it('sets args', () => {
    const fn = defineFunction('fn::hello').args('$name').body('RETURN $name').build();
    expect(fn.args).toEqual(['$name']);
  });

  it('sets multiple args', () => {
    const fn = defineFunction('fn::add').args('$a: int', '$b: int').body('RETURN $a + $b').build();
    expect(fn.args).toEqual(['$a: int', '$b: int']);
  });

  it('sets comment', () => {
    const fn = defineFunction('fn::hello').body('RETURN "hello"').comment('Says hello').build();
    expect(fn.comment).toBe('Says hello');
  });

  it('sets permissions', () => {
    const fn = defineFunction('fn::hello').body('RETURN $x').permissions('FOR select FULL').build();
    expect(fn.permissions).toBe('FOR select FULL');
  });

  it('generates DEFINE FUNCTION SQL via toSQL()', () => {
    const sql = defineFunction('fn::hello')
      .args('$name: string')
      .body('RETURN $name')
      .comment('Greets a user')
      .permissions('FOR select FULL')
      .toSQL();

    expect(sql).toContain('DEFINE FUNCTION IF NOT EXISTS fn::hello');
    expect(sql).toContain('($name: string)');
    expect(sql).toContain('{ RETURN $name }');
    expect(sql).toContain('COMMENT "Greets a user"');
    expect(sql).toContain('PERMISSIONS FOR select FULL');
  });

  it('generates SQL without args', () => {
    const sql = defineFunction('fn::hello').body('RETURN "world"').toSQL();
    expect(sql).toBe('DEFINE FUNCTION IF NOT EXISTS fn::hello { RETURN "world" }');
  });

  it('generates SQL with multi-arg', () => {
    const sql = defineFunction('fn::add').args('$a: int', '$b: int').body('RETURN $a + $b').toSQL();
    expect(sql).toContain('($a: int, $b: int)');
  });

  it('generates SQL with comment only', () => {
    const sql = defineFunction('fn::hello').body('RETURN $a + $b').comment('Adds numbers').toSQL();
    expect(sql).toContain('COMMENT "Adds numbers"');
  });

  it('generates SQL with permissions only', () => {
    const sql = defineFunction('fn::hello')
      .body('RETURN $x')
      .permissions('FOR select FULL')
      .toSQL();
    expect(sql).toContain('PERMISSIONS FOR select FULL');
  });

  it('throws on empty name', () => {
    expect(() => defineFunction('').build()).toThrow('Function name is required');
  });

  it('throws on empty body in build()', () => {
    expect(() => defineFunction('fn::hello').build()).toThrow('Function body is required');
  });

  it('chains all properties', () => {
    const fn = defineFunction('fn::full')
      .args('$a', '$b')
      .body('RETURN $a + $b')
      .comment('Full chain')
      .permissions('FOR select FULL')
      .build();

    expect(fn.name).toBe('fn::full');
    expect(fn.args).toEqual(['$a', '$b']);
    expect(fn.body).toBe('RETURN $a + $b');
    expect(fn.comment).toBe('Full chain');
    expect(fn.permissions).toBe('FOR select FULL');
  });

  it('produces different instances from same factory', () => {
    const builder1 = defineFunction('fn::a').body('RETURN 1');
    const builder2 = defineFunction('fn::b').body('RETURN 1');

    expect(builder1.build().name).toBe('fn::a');
    expect(builder2.build().name).toBe('fn::b');
    expect(builder1).not.toBe(builder2);
  });
});
