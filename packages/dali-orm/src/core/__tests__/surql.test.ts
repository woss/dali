import { describe, expect, it } from 'vite-plus/test';
import {
  escapeIdent,
  escapeString,
  formatDefault,
  isRaw,
  quoteString,
  raw,
  serializePermissionsFragment,
  serializeValue,
  surql,
} from '../surql.js';

// =============================================================================
// 1. escapeIdent
// =============================================================================

describe('escapeIdent', () => {
  it('passes through plain lowercase idents', () => {
    expect(escapeIdent('foo')).toBe('foo');
  });

  it('passes through idents with underscore prefix', () => {
    expect(escapeIdent('_bar')).toBe('_bar');
    expect(escapeIdent('_123')).toBe('_123');
  });

  it('passes through idents with alphanumeric mix', () => {
    expect(escapeIdent('a1b2c3')).toBe('a1b2c3');
  });

  it('wraps idents containing spaces in backticks', () => {
    expect(escapeIdent('my field')).toBe('`my field`');
  });

  it('wraps idents containing dots in backticks', () => {
    expect(escapeIdent('field.name')).toBe('`field.name`');
  });

  it('wraps idents containing hyphens in backticks', () => {
    expect(escapeIdent('my-field')).toBe('`my-field`');
  });

  it('wraps idents starting with digit in backticks', () => {
    expect(escapeIdent('123abc')).toBe('`123abc`');
  });

  it('wraps idents with dollar sign in backticks', () => {
    expect(escapeIdent('$param')).toBe('`$param`');
  });

  it('escapes backticks inside ident', () => {
    // Input: a + backtick + b → output: `a + escaped backtick + b`
    expect(escapeIdent('a' + '\x60' + 'b')).toBe('`a\\`b`');
  });

  it('escapes backslashes inside ident', () => {
    // Input: a\b → output: `a\\b`
    expect(escapeIdent('a\\b')).toBe('`a\\\\b`');
  });

  it('escapes backslash before backtick correctly', () => {
    // Input: a\`b → escape backslashes first: a\\ → then backticks: \` → a\\\`b → `a\\\`b`
    const input = 'a' + '\\' + '\x60' + 'b';
    const expected = '`a' + '\\\\' + '\\' + '\x60' + 'b`';
    expect(escapeIdent(input)).toBe(expected);
  });

  it('handles multiple backticks', () => {
    expect(escapeIdent('a' + '\x60' + 'b' + '\x60' + 'c')).toBe('`a\\`b\\`c`');
  });

  it('handles multiple backslashes', () => {
    // Input: a\\b → two backslashes become \\\\ → `a\\\\b`
    expect(escapeIdent('a\\\\b')).toBe('`a\\\\\\\\b`');
  });

  it('escapes backtick injection attempt: foo`', () => {
    expect(escapeIdent('foo' + '\x60')).toBe('`foo\\``');
  });

  it('escapes backtick + SQL fragment injection', () => {
    expect(escapeIdent('foo' + '\x60; DROP TABLE user')).toBe('`foo\\`; DROP TABLE user`');
  });

  it('escapes closing backtick injection', () => {
    expect(escapeIdent('name' + '\x60')).toBe('`name\\``');
  });

  it('returns empty string for empty input', () => {
    expect(escapeIdent('')).toBe('``');
  });

  it('handles unicode characters', () => {
    expect(escapeIdent('caf\u00e9')).toBe('`caf\u00e9`');
  });

  it('handles emoji in ident', () => {
    expect(escapeIdent('status\u{1F680}')).toBe('`status\u{1F680}`');
  });

  it('handles single character idents', () => {
    expect(escapeIdent('a')).toBe('a');
    expect(escapeIdent('1')).toBe('`1`');
    expect(escapeIdent('_')).toBe('_');
  });

  it('passes through numeric-only idents when prefixed with underscore', () => {
    expect(escapeIdent('_1')).toBe('_1');
  });

  it('handles ident with only special characters', () => {
    expect(escapeIdent('!@#$%')).toBe('`!@#$%`');
  });
});

// =============================================================================
// 2. escapeString
// =============================================================================

describe('escapeString', () => {
  it('passes through plain text unchanged', () => {
    expect(escapeString('hello')).toBe('hello');
  });

  it('passes through alphanumeric text', () => {
    expect(escapeString('abc123')).toBe('abc123');
  });

  it('escapes single backslash', () => {
    // Input: \ → output: \\
    expect(escapeString('\\')).toBe('\\\\');
  });

  it('escapes double backslash', () => {
    // Input: \\ → output: \\\\
    expect(escapeString('\\\\')).toBe('\\\\\\\\');
  });

  it('escapes consecutive backslashes', () => {
    // Input: \\\ → output: \\\\\\
    expect(escapeString('\\\\\\')).toBe('\\\\\\\\\\\\');
  });

  it('escapes single quote', () => {
    expect(escapeString("it's")).toBe("it\\'s");
  });

  it('escapes multiple single quotes', () => {
    expect(escapeString("'a' 'b'")).toBe("\\'a\\' \\'b\\'");
  });

  it('escapes newline to \\n', () => {
    expect(escapeString('a\nb')).toBe('a\\nb');
  });

  it('escapes tab to \\t', () => {
    expect(escapeString('a\tb')).toBe('a\\tb');
  });

  it('escapes carriage return to \\r', () => {
    expect(escapeString('a\rb')).toBe('a\\rb');
  });

  it('escapes multiple consecutive newlines', () => {
    expect(escapeString('\n\n')).toBe('\\n\\n');
  });

  it('escapes null byte (0x00) as \\u0000', () => {
    expect(escapeString('\x00')).toBe('\\u0000');
  });

  it('escapes bell (0x07) as \\u0007', () => {
    expect(escapeString('\x07')).toBe('\\u0007');
  });

  it('escapes vertical tab (0x0B) as \\u000b', () => {
    expect(escapeString('\x0B')).toBe('\\u000b');
  });

  it('escapes form feed (0x0C) as \\u000c', () => {
    expect(escapeString('\x0C')).toBe('\\u000c');
  });

  it('escapes escape character (0x1B) as \\u001b', () => {
    expect(escapeString('\x1B')).toBe('\\u001b');
  });

  it('escapes character at boundary 0x1F as \\u001f', () => {
    expect(escapeString('\x1F')).toBe('\\u001f');
  });

  it('escapes mixed quotes and backslashes', () => {
    // Input: it\'s (backslash + single-quote)
    // Output: it\\\'s (double backslash + escaped quote)
    const input = 'it\\' + "'s";
    const expected = 'it\\\\' + "\\'s";
    expect(escapeString(input)).toBe(expected);
  });

  it('handles empty string', () => {
    expect(escapeString('')).toBe('');
  });

  it('handles unicode characters', () => {
    expect(escapeString('caf\u00e9 \u{1F30D}')).toBe('caf\u00e9 \u{1F30D}');
  });

  it('passes through regular spaces', () => {
    expect(escapeString('hello world')).toBe('hello world');
  });
});

// =============================================================================
// 3. quoteString
// =============================================================================

describe('quoteString', () => {
  it('wraps simple string in single quotes', () => {
    expect(quoteString('hello')).toBe("'hello'");
  });

  it('escapes and wraps strings with single quotes', () => {
    expect(quoteString("it's")).toBe("'it\\'s'");
  });

  it('escapes and wraps strings with backslashes', () => {
    expect(quoteString('a\\b')).toBe("'a\\\\b'");
  });

  it('wraps empty string in quotes', () => {
    expect(quoteString('')).toBe("''");
  });

  it('wraps strings with newlines', () => {
    expect(quoteString('a\nb')).toBe("'a\\nb'");
  });

  it('wraps unicode strings', () => {
    expect(quoteString('caf\u00e9')).toBe("'caf\u00e9'");
  });

  it('handles injection payload in quoted string', () => {
    expect(quoteString("'; DROP TABLE user; --")).toBe("'\\'; DROP TABLE user; --'");
  });
});

// =============================================================================
// 4. raw / isRaw
// =============================================================================

describe('raw', () => {
  it('creates object with __surqlRaw brand and sql property', () => {
    const r = raw('time::now()');
    expect(r.__surqlRaw).toBe(true);
    expect(r.sql).toBe('time::now()');
  });

  it('preserves SQL string unchanged', () => {
    const sql = '1 + 2 * 3';
    expect(raw(sql).sql).toBe(sql);
  });

  it('handles empty string', () => {
    const r = raw('');
    expect(r.__surqlRaw).toBe(true);
    expect(r.sql).toBe('');
  });

  it('multiple calls create independent objects', () => {
    const r1 = raw('foo');
    const r2 = raw('foo');
    expect(r1).not.toBe(r2);
    expect(r1.sql).toBe(r2.sql);
  });

  it('handles complex SQL expressions', () => {
    expect(raw('array::sort(<json>[1, 3, 2])').sql).toBe('array::sort(<json>[1, 3, 2])');
  });
});

describe('isRaw', () => {
  it('returns true for raw() object', () => {
    expect(isRaw(raw('test'))).toBe(true);
  });

  it('returns false for null', () => {
    expect(isRaw(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isRaw(undefined)).toBe(false);
  });

  it('returns false for plain string', () => {
    expect(isRaw('test')).toBe(false);
  });

  it('returns false for plain number', () => {
    expect(isRaw(42)).toBe(false);
  });

  it('returns false for boolean', () => {
    expect(isRaw(true)).toBe(false);
  });

  it('returns false for array', () => {
    expect(isRaw([1, 2, 3])).toBe(false);
  });

  it('returns false for plain object without brand', () => {
    expect(isRaw({ sql: 'test' })).toBe(false);
  });

  it('returns false for object with wrong brand value', () => {
    expect(isRaw({ __surqlRaw: false, sql: 'test' })).toBe(false);
  });

  it('returns false for object with __surqlRaw as non-boolean truthy', () => {
    expect(isRaw({ __surqlRaw: 1, sql: 'test' })).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isRaw({})).toBe(false);
  });

  it('returns false for function', () => {
    const fn = () => {};
    expect(isRaw(fn)).toBe(false);
  });
});

// =============================================================================
// 5. serializeValue
// =============================================================================

describe('serializeValue', () => {
  it('passes RawSurql through unquoted', () => {
    expect(serializeValue(raw('time::now()'))).toBe('time::now()');
  });

  it('quotes string values', () => {
    expect(serializeValue('hello')).toBe("'hello'");
  });

  it('escapes quotes inside strings', () => {
    expect(serializeValue("it's")).toBe("'it\\'s'");
  });

  it('serializes empty string', () => {
    expect(serializeValue('')).toBe("''");
  });

  it('serializes positive integer', () => {
    expect(serializeValue(42)).toBe('42');
  });

  it('serializes zero', () => {
    expect(serializeValue(0)).toBe('0');
  });

  it('serializes negative number', () => {
    expect(serializeValue(-3.14)).toBe('-3.14');
  });

  it('serializes NaN', () => {
    expect(serializeValue(NaN)).toBe('NaN');
  });

  it('serializes Infinity', () => {
    expect(serializeValue(Infinity)).toBe('Infinity');
  });

  it('serializes true', () => {
    expect(serializeValue(true)).toBe('true');
  });

  it('serializes false', () => {
    expect(serializeValue(false)).toBe('false');
  });

  it('serializes null as null', () => {
    expect(serializeValue(null)).toBe('null');
  });

  it('serializes undefined as NONE', () => {
    expect(serializeValue(undefined)).toBe('NONE');
  });

  it('serializes Date as datetime literal', () => {
    const d = new Date('2024-01-15T10:30:00.000Z');
    expect(serializeValue(d)).toBe("d'2024-01-15T10:30:00.000Z'");
  });

  it('serializes Date with milliseconds', () => {
    const d = new Date('2024-06-01T12:00:00.123Z');
    expect(serializeValue(d)).toBe("d'2024-06-01T12:00:00.123Z'");
  });

  it('serializes BigInt', () => {
    expect(serializeValue(BigInt(9007199254740991))).toBe('9007199254740991');
  });

  it('serializes negative BigInt', () => {
    expect(serializeValue(BigInt(-123))).toBe('-123');
  });

  it('serializes empty array', () => {
    expect(serializeValue([])).toBe('[]');
  });

  it('serializes number array', () => {
    expect(serializeValue([1, 2, 3])).toBe('[1, 2, 3]');
  });

  it('serializes string array with quoted elements', () => {
    expect(serializeValue(['a', 'b'])).toBe("['a', 'b']");
  });

  it('serializes mixed array', () => {
    expect(serializeValue([1, 'hello', true, null])).toBe("[1, 'hello', true, null]");
  });

  it('serializes nested array', () => {
    expect(
      serializeValue([
        [1, 2],
        [3, 4],
      ]),
    ).toBe('[[1, 2], [3, 4]]');
  });

  it('serializes array with raw markers', () => {
    expect(serializeValue([raw('NOW()'), raw('time::now()')])).toBe('[NOW(), time::now()]');
  });

  it('serializes empty object', () => {
    expect(serializeValue({})).toBe('{  }');
  });

  it('serializes flat object with escaped keys', () => {
    const result = serializeValue({ name: 'Alice', age: 30 });
    expect(result).toBe("{ name: 'Alice', age: 30 }");
  });

  it('serializes object with special chars in key', () => {
    const result = serializeValue({ 'my field': 'val' });
    expect(result).toBe("{ `my field`: 'val' }");
  });

  it('serializes nested object', () => {
    const result = serializeValue({ user: { name: 'Alice' } });
    expect(result).toBe("{ user: { name: 'Alice' } }");
  });

  it('serializes object with null value', () => {
    expect(serializeValue({ x: null })).toBe('{ x: null }');
  });

  it('serializes object with undefined value', () => {
    expect(serializeValue({ x: undefined })).toBe('{ x: NONE }');
  });

  it('serializes object with Date value', () => {
    const d = new Date('2024-01-01T00:00:00.000Z');
    expect(serializeValue({ created: d })).toBe("{ created: d'2024-01-01T00:00:00.000Z' }");
  });

  it('serializes array of objects', () => {
    const result = serializeValue([{ a: 1 }, { a: 2 }]);
    expect(result).toBe('[{ a: 1 }, { a: 2 }]');
  });

  it('serializes object with array values', () => {
    const result = serializeValue({ tags: ['x', 'y'] });
    expect(result).toBe("{ tags: ['x', 'y'] }");
  });

  it('serializes class instance via String() fallback', () => {
    class MyClass {}
    const instance = new MyClass();
    expect(serializeValue(instance)).toBe('[object Object]');
  });

  it('serializes Map via fallback', () => {
    const m = new Map([['key', 'val']]);
    expect(serializeValue(m)).toBe('[object Map]');
  });

  it('serializes Set via fallback', () => {
    const s = new Set([1, 2, 3]);
    expect(serializeValue(s)).toBe('[object Set]');
  });

  it('serializes object with toString key (prototype pollution attempt)', () => {
    const result = serializeValue({ toString: { admin: true } });
    expect(result).toBe('{ toString: { admin: true } }');
  });

  it('serializes object with constructor key', () => {
    const result = serializeValue({ constructor: { prototype: 'polluted' } });
    expect(result).toBe("{ constructor: { prototype: 'polluted' } }");
  });

  it('serializes deeply nested object (10 levels)', () => {
    const obj = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: 'deep' } } } } } } } } } };
    const result = serializeValue(obj);
    expect(result).toContain("j: 'deep'");
  });

  it('serializes array with injection payload', () => {
    const result = serializeValue(["'; DROP TABLE user; --"]);
    expect(result).toBe("['\\'; DROP TABLE user; --']");
  });
});

// =============================================================================
// 6. formatDefault
// =============================================================================

describe('formatDefault', () => {
  it('delegates to serializeValue for strings', () => {
    expect(formatDefault('hello')).toBe("'hello'");
  });

  it('delegates to serializeValue for numbers', () => {
    expect(formatDefault(42)).toBe('42');
  });

  it('delegates to serializeValue for boolean', () => {
    expect(formatDefault(true)).toBe('true');
  });

  it('delegates to serializeValue for null', () => {
    expect(formatDefault(null)).toBe('null');
  });

  it('delegates to serializeValue for undefined', () => {
    expect(formatDefault(undefined)).toBe('NONE');
  });

  it('delegates to serializeValue for raw marker', () => {
    expect(formatDefault(raw('time::now()'))).toBe('time::now()');
  });

  it('delegates to serializeValue for Date', () => {
    const d = new Date('2024-06-15T08:30:00.000Z');
    expect(formatDefault(d)).toBe("d'2024-06-15T08:30:00.000Z'");
  });

  it('delegates to serializeValue for array', () => {
    expect(formatDefault([1, 2, 3])).toBe('[1, 2, 3]');
  });

  it('does NOT heuristically detect function-like strings', () => {
    expect(formatDefault('time::now()')).toBe("'time::now()'");
  });

  it('produces same output as serializeValue for identical input', () => {
    const inputs: unknown[] = ['hello', 42, true, null, undefined, raw('NOW()'), [1, 2]];
    for (const v of inputs) {
      expect(formatDefault(v)).toBe(serializeValue(v));
    }
  });
});

// =============================================================================
// 7. surql (tagged template)
// =============================================================================

describe('surql', () => {
  it('concatenates static strings', () => {
    expect(surql`SELECT * FROM user`.sql).toBe('SELECT * FROM user');
  });

  it('interpolates a raw() marker unquoted', () => {
    expect(surql`${raw('NOW()')}`.sql).toBe('NOW()');
  });

  it('quotes string interpolation', () => {
    expect(surql`name = ${'Alice'}`.sql).toBe("name = 'Alice'");
  });

  it('interpolates number', () => {
    expect(surql`age > ${25}`.sql).toBe('age > 25');
  });

  it('interpolates boolean', () => {
    expect(surql`active = ${true}`.sql).toBe('active = true');
  });

  it('interpolates null', () => {
    expect(surql`deleted = ${null}`.sql).toBe('deleted = null');
  });

  it('interpolates undefined as NONE', () => {
    expect(surql`deleted = ${undefined}`.sql).toBe('deleted = NONE');
  });

  it('interpolates Date as datetime literal', () => {
    const d = new Date('2024-01-01T00:00:00.000Z');
    expect(surql`created > ${d}`.sql).toBe("created > d'2024-01-01T00:00:00.000Z'");
  });

  it('interpolates arrays', () => {
    expect(surql`tags CONTAINSALL ${['a', 'b']}`.sql).toBe("tags CONTAINSALL ['a', 'b']");
  });

  it('handles no interpolations', () => {
    expect(surql`SELECT *`.sql).toBe('SELECT *');
  });

  it('handles interpolation at start', () => {
    expect(surql`${raw('NOW()')}`.sql).toBe('NOW()');
  });

  it('handles interpolation at end', () => {
    expect(surql`age > ${25}`.sql).toBe('age > 25');
  });

  it('handles multiple interpolations', () => {
    const result = surql`SELECT * FROM ${raw('user')} WHERE name = ${'Alice'} AND age > ${25}`.sql;
    expect(result).toBe("SELECT * FROM user WHERE name = 'Alice' AND age > 25");
  });

  it('returns a RawSurql branded object', () => {
    const r = surql`SELECT 1`;
    expect(r.__surqlRaw).toBe(true);
    expect(isRaw(r)).toBe(true);
  });

  it('handles empty template', () => {
    expect(surql``.sql).toBe('');
  });
});

// =============================================================================
// 8. serializePermissionsFragment
// =============================================================================

describe('serializePermissionsFragment', () => {
  it('returns empty string for empty object', () => {
    expect(serializePermissionsFragment({})).toBe('');
  });

  it('serializes select: true as FOR select FULL', () => {
    expect(serializePermissionsFragment({ select: true })).toBe('FOR select FULL');
  });

  it('serializes select: false as FOR select NONE', () => {
    expect(serializePermissionsFragment({ select: false })).toBe('FOR select NONE');
  });

  it('serializes select: string as FOR select WHERE expr', () => {
    expect(serializePermissionsFragment({ select: 'age > 18' })).toBe('FOR select WHERE age > 18');
  });

  it('serializes create: true as FOR create FULL', () => {
    expect(serializePermissionsFragment({ create: true })).toBe('FOR create FULL');
  });

  it('serializes update: true as FOR update FULL', () => {
    expect(serializePermissionsFragment({ update: true })).toBe('FOR update FULL');
  });

  it('serializes delete: true as FOR delete FULL', () => {
    expect(serializePermissionsFragment({ delete: true })).toBe('FOR delete FULL');
  });

  it('joins multiple ops with spaces (not commas)', () => {
    const result = serializePermissionsFragment({ select: true, delete: false });
    expect(result).toBe('FOR select FULL FOR delete NONE');
  });

  it('serializes all four ops with different values', () => {
    const result = serializePermissionsFragment({
      select: true,
      create: false,
      update: 'role = "admin"',
      delete: false,
    });
    expect(result).toBe(
      'FOR select FULL FOR create NONE FOR update WHERE role = "admin" FOR delete NONE',
    );
  });

  it('omits undefined keys from output', () => {
    const result = serializePermissionsFragment({ select: true, create: undefined });
    expect(result).toBe('FOR select FULL');
  });

  it('handles only string-based permissions', () => {
    const result = serializePermissionsFragment({
      select: 'id = $auth.id',
      update: 'created_by = $auth.id',
    });
    expect(result).toBe('FOR select WHERE id = $auth.id FOR update WHERE created_by = $auth.id');
  });

  it('handles combination of FULL and WHERE', () => {
    const result = serializePermissionsFragment({
      select: true,
      update: 'role = "admin"',
    });
    expect(result).toBe('FOR select FULL FOR update WHERE role = "admin"');
  });

  it('handles combination of NONE and WHERE', () => {
    const result = serializePermissionsFragment({
      create: false,
      update: 'role = "admin"',
    });
    expect(result).toBe('FOR create NONE FOR update WHERE role = "admin"');
  });

  it('includes delete in permission ops', () => {
    const result = serializePermissionsFragment({ delete: true });
    expect(result).toBe('FOR delete FULL');
  });
});
