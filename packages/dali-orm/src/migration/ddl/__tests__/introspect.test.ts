/**
 * Unit tests for parseFunctionSQL
 */
import { describe, expect, it } from 'vite-plus/test';
import { parseFunctionSQL } from '../introspect.js';

describe('parseFunctionSQL', () => {
  it('extracts simple function body (no nesting)', () => {
    const sql = 'DEFINE FUNCTION fn_add($a: int, $b: int) { RETURN $a + $b; }';
    const result = parseFunctionSQL('fn_add', sql);
    expect(result.body).toBe('RETURN $a + $b;');
  });

  it('extracts nested braces (IF inside function)', () => {
    const sql =
      'DEFINE FUNCTION fn_if($x: int) { IF $x > 0 THEN { RETURN $x; } ELSE { RETURN 0; } END }';
    const result = parseFunctionSQL('fn_if', sql);
    expect(result.body).toBe('IF $x > 0 THEN { RETURN $x; } ELSE { RETURN 0; } END');
  });

  it('extracts deeply nested braces (FOR inside IF)', () => {
    const sql =
      'DEFINE FUNCTION fn_deep($a: int) { IF $a > 0 THEN { FOR $i IN 1..$a { RETURN $i; } } END }';
    const result = parseFunctionSQL('fn_deep', sql);
    expect(result.body).toBe('IF $a > 0 THEN { FOR $i IN 1..$a { RETURN $i; } } END');
  });

  it('handles empty body', () => {
    const sql = 'DEFINE FUNCTION fn_empty() { }';
    const result = parseFunctionSQL('fn_empty', sql);
    expect(result.body).toBe('');
  });

  it('extracts name, args, comment, permissions correctly with nested-brace body', () => {
    const sql =
      'DEFINE FUNCTION fn_if($x: int) { IF $x > 0 THEN { RETURN $x; } ELSE { RETURN 0; } END } COMMENT "test" PERMISSIONS FULL';
    const result = parseFunctionSQL('fn_if', sql);
    expect(result.name).toBe('fn_if');
    expect(result.args).toEqual(['$x: int']);
    expect(result.body).toBe('IF $x > 0 THEN { RETURN $x; } ELSE { RETURN 0; } END');
    expect(result.comment).toBe('test');
    expect(result.permissions).toBe('FULL');
  });

  it('extracts function body with nested braces and COMMENT/PERMISSIONS after', () => {
    const sql =
      'DEFINE FUNCTION fn_complex($a: int) { IF $a > 0 THEN { RETURN $a; } END } COMMENT "complex fn" PERMISSIONS WHERE $auth.id = 1';
    const result = parseFunctionSQL('fn_complex', sql);
    expect(result.body).toBe('IF $a > 0 THEN { RETURN $a; } END');
    expect(result.comment).toBe('complex fn');
    expect(result.permissions).toBe('WHERE $auth.id = 1');
  });

  it('extracts IF NOT EXISTS, name, body, and arg', () => {
    const sql = `DEFINE FUNCTION IF NOT EXISTS fn_greet($name: string) { RETURN 'Hello, ' + $name; } COMMENT "Greeting function" PERMISSIONS FULL`;
    const result = parseFunctionSQL('fn_greet', sql);
    expect(result.name).toBe('fn_greet');
    expect(result.args).toEqual(['$name: string']);
    expect(result.body).toBe("RETURN 'Hello, ' + $name;");
    expect(result.comment).toBe('Greeting function');
    expect(result.permissions).toBe('FULL');
  });
});
