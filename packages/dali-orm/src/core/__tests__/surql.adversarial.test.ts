/**
 * Adversarial security tests for surql.ts serialization module.
 *
 * Tests ONLY attack vectors — injection attempts, boundary violations,
 * unicode bypass, encoding tricks. Every test asserts the module is
 * resilient (does not produce unsafe output, does not crash).
 */
import { describe, expect, it } from 'vite-plus/test';
import {
  escapeIdent,
  escapeString,
  quoteString,
  raw,
  isRaw,
  serializeValue,
  surql,
} from '../surql.js';

// =============================================================================
// 1. escapeIdent — injection attacks
// =============================================================================

describe('escapeIdent — adversarial', () => {
  it('escapes backtick + SQL injection: table`; DROP TABLE users; --', () => {
    const input = 'table`; DROP TABLE users; --';
    const result = escapeIdent(input);
    // Must contain escaped backtick, not bare one that could close ident
    expect(result).toBe('`table\\`; DROP TABLE users; --`');
    expect(result.startsWith('`')).toBe(true);
    expect(result.endsWith('`')).toBe(true);
    // Output must contain exactly one backslash-escaped backtick pair
    expect(result).toContain('\\`');
  });

  it('escapes backslash before backtick: test\\`evil', () => {
    // Input: test\`evil — backslash then backtick
    const input = 'test\\`evil';
    const result = escapeIdent(input);
    // Backslash must be escaped first: \\ → then backtick: \`
    // Expected: `test\\\`evil`
    expect(result).toBe('`test\\\\\\`evil`');
    expect(result.startsWith('`')).toBe(true);
    expect(result.endsWith('`')).toBe(true);
  });

  it('handles unicode homoglyphs in idents', () => {
    // Cyrillic 'а' (U+0430) looks like Latin 'a' (U+0061)
    const homoglyph = '\u0430\u0062\u0063'; // аbc with Cyrillic a
    const result = escapeIdent(homoglyph);
    // Should be backtick-wrapped since it contains non-ASCII
    expect(result).toBe(`\`${homoglyph}\``);
    // Verify it's properly wrapped
    expect(result.startsWith('`')).toBe(true);
    expect(result.endsWith('`')).toBe(true);
  });

  it('handles newlines in idents', () => {
    const result = escapeIdent('line1\nline2');
    expect(result).toBe('`line1\nline2`');
    expect(result.startsWith('`')).toBe(true);
    expect(result.endsWith('`')).toBe(true);
  });

  it('handles null byte in idents', () => {
    const input = 'test\x00evil';
    const result = escapeIdent(input);
    expect(result).toBe('`test\x00evil`');
    expect(result.startsWith('`')).toBe(true);
    expect(result.endsWith('`')).toBe(true);
  });

  it('handles very long identifiers (10000+ chars)', () => {
    const long = 'a'.repeat(10001);
    const result = escapeIdent(long);
    expect(result).toBe(long); // plain ident, no wrapping needed
    expect(result.length).toBe(10001);
  });

  it('handles very long identifiers with special chars (10000+ chars)', () => {
    const long = 'a'.repeat(5000) + ' ' + 'b'.repeat(5000);
    const result = escapeIdent(long);
    expect(result.startsWith('`')).toBe(true);
    expect(result.endsWith('`')).toBe(true);
    expect(result.length).toBe(10003); // 10001 + 2 backticks
  });

  it('handles ident with only backticks', () => {
    const input = '````';
    const result = escapeIdent(input);
    // Each backtick becomes \`, plus opening/closing backticks
    expect(result).toBe('`\\`\\`\\`\\``');
    expect(result.startsWith('`')).toBe(true);
    expect(result.endsWith('`')).toBe(true);
  });

  it('handles ident with closing backtick injection: name`', () => {
    const result = escapeIdent('name`');
    expect(result).toBe('`name\\``');
    expect(result.startsWith('`')).toBe(true);
    expect(result.endsWith('`')).toBe(true);
  });

  it('handles ident with multiple backtick injection points', () => {
    const result = escapeIdent('`a``b`');
    expect(result).toBe('`\\`a\\`\\`b\\``');
    expect(result.startsWith('`')).toBe(true);
    expect(result.endsWith('`')).toBe(true);
  });

  it('handles ident with backslash sequences', () => {
    const result = escapeIdent('a\\\\b');
    expect(result).toBe('`a\\\\\\\\b`');
    expect(result.startsWith('`')).toBe(true);
    expect(result.endsWith('`')).toBe(true);
  });
});

// =============================================================================
// 2. escapeString / quoteString — injection attacks
// =============================================================================

describe('escapeString — adversarial', () => {
  it("escapes SQL injection via single quotes: `\\' OR 1=1 --", () => {
    const input = "' OR 1=1 --";
    const result = escapeString(input);
    expect(result).toBe("\\' OR 1=1 --");
    // Every single quote must be preceded by backslash
    expect(result).toMatch(/^[^']*(\\'[^']*)*$/);
  });

  it("escapes backslash escape bypass: test\\' OR \\'1\\'=\\'1", () => {
    // Input: test\' OR '1'='1
    const input = "test\\' OR '1'='1";
    const result = escapeString(input);
    // Backslash gets doubled, quotes get escaped
    expect(result).toBe("test\\\\\\' OR \\'1\\'=\\'1");
    // Every single quote must be preceded by backslash
    expect(result).toMatch(/^[^']*(\\'[^']*)*$/);
  });

  it('escapes RIGHT TO LEFT OVERRIDE character (U+202E)', () => {
    const input = '\u202E'; // RTL override
    const result = escapeString(input);
    expect(result).toBe('\u202E'); // passes through, not a control char
  });

  it('escapes POP DIRECTIONAL FORMATTING (U+202C)', () => {
    const input = '\u202C';
    const result = escapeString(input);
    expect(result).toBe('\u202C');
  });

  it('escapes LEFT-TO-RIGHT OVERRIDE (U+202D)', () => {
    const input = '\u202D';
    const result = escapeString(input);
    expect(result).toBe('\u202D');
  });

  it('escapes zero-width space (U+200B)', () => {
    const input = '\u200B';
    const result = escapeString(input);
    expect(result).toBe('\u200B');
  });

  it('escapes zero-width non-joiner (U+200C)', () => {
    const input = '\u200C';
    const result = escapeString(input);
    expect(result).toBe('\u200C');
  });

  it('escapes zero-width joiner (U+200D)', () => {
    const input = '\u200D';
    const result = escapeString(input);
    expect(result).toBe('\u200D');
  });

  it('escapes all control characters below 0x20', () => {
    for (let code = 0x00; code < 0x20; code++) {
      if (code === 0x0a || code === 0x09 || code === 0x0d) continue; // handled specially
      const input = String.fromCharCode(code);
      const result = escapeString(input);
      const expected = `\\u${code.toString(16).padStart(4, '0')}`;
      expect(result).toBe(expected);
    }
  });

  it('escapes bell (0x07) as \\u0007', () => {
    expect(escapeString('\x07')).toBe('\\u0007');
  });

  it('escapes backspace (0x08) as \\u0008', () => {
    expect(escapeString('\x08')).toBe('\\u0008');
  });

  it('escapes escape character (0x1B) as \\u001b', () => {
    expect(escapeString('\x1B')).toBe('\\u001b');
  });

  it('escapes mixed encoding tricks: null byte + quote + backslash', () => {
    const input = "\x00' OR 1=1 \\ --";
    const result = escapeString(input);
    expect(result).toBe("\\u0000\\' OR 1=1 \\\\ --");
    // Every single quote must be preceded by backslash
    expect(result).toMatch(/^[^']*(\\'[^']*)*$/);
  });

  it('escapes multibyte characters that could confuse escaping', () => {
    // 2-byte UTF-8: é (U+00E9)
    expect(escapeString('\u00E9')).toBe('\u00E9');
    // 3-byte UTF-8: € (U+20AC)
    expect(escapeString('\u20AC')).toBe('\u20AC');
    // 4-byte UTF-8: 🚀 (U+1F680)
    expect(escapeString('\u{1F680}')).toBe('\u{1F680}');
  });

  it('escapes string with only control characters', () => {
    const input = '\x00\x01\x02\x03';
    const result = escapeString(input);
    expect(result).toBe('\\u0000\\u0001\\u0002\\u0003');
  });

  it('escapes string with 1000 consecutive single quotes', () => {
    const input = "'".repeat(1000);
    const result = escapeString(input);
    expect(result.length).toBe(2000); // each ' becomes \'
    // Every single quote must be preceded by backslash
    expect(result).toMatch(/^[^']*(\\'[^']*)*$/);
  });

  it('escapes string with 1000 consecutive backslashes', () => {
    const input = '\\'.repeat(1000);
    const result = escapeString(input);
    expect(result.length).toBe(2000); // each \ becomes \\
    expect(result).toBe('\\\\'.repeat(1000));
  });
});

describe('quoteString — adversarial', () => {
  it('wraps SQL injection payload safely', () => {
    const result = quoteString("'; DROP TABLE users; --");
    expect(result).toBe("'\\'; DROP TABLE users; --'");
  });

  it('wraps backslash + quote bypass attempt', () => {
    const result = quoteString("\\' OR 1=1 --");
    expect(result).toBe("'\\\\\\' OR 1=1 --'");
  });

  it('wraps string with null byte injection', () => {
    const result = quoteString("\x00' OR '1'='1");
    expect(result).toBe("'\\u0000\\' OR \\'1\\'=\\'1'");
  });

  it('wraps string with unicode injection payload', () => {
    const result = quoteString('\u202E' + "' OR 1=1 --");
    expect(result).toBe("'\u202E\\' OR 1=1 --'");
  });

  it('wraps string with 10000 chars of injection payload', () => {
    const payload = "' OR '1'='1".repeat(500);
    const result = quoteString(payload);
    expect(result.startsWith("'")).toBe(true);
    expect(result.endsWith("'")).toBe(true);
    // All internal single quotes must be preceded by backslash
    const inner = result.slice(1, -1);
    expect(inner).toMatch(/^[^']*(\\'[^']*)*$/);
  });
});

// =============================================================================
// 3. serializeValue — injection attacks
// =============================================================================

describe('serializeValue — adversarial', () => {
  it('handles object with __proto__ key', () => {
    // Use Object.create(null) so __proto__ is a regular key, not prototype setter
    const obj = Object.create(null);
    obj.__proto__ = { admin: true };
    const result = serializeValue(obj);
    expect(result).toBe('{ __proto__: { admin: true } }');
  });

  it('handles object with constructor key', () => {
    const obj = { constructor: { prototype: { admin: true } } };
    const result = serializeValue(obj);
    expect(result).toBe('{ constructor: { prototype: { admin: true } } }');
  });

  it('handles object with prototype key', () => {
    const obj = { prototype: { polluted: true } };
    const result = serializeValue(obj);
    expect(result).toBe('{ prototype: { polluted: true } }');
  });

  it('handles Symbol keys (ignored by Object.entries)', () => {
    const sym = Symbol('evil');
    const obj = { [sym]: 'hidden', visible: true } as Record<string | symbol, unknown>;
    const result = serializeValue(obj);
    // Symbol keys are not enumerable via Object.entries
    expect(result).toBe('{ visible: true }');
  });

  it('handles getter that throws', () => {
    const obj = {
      get evil() {
        throw new Error('boo');
      },
      safe: 'value',
    };
    // The getter throws when accessed — serializeValue should propagate the error
    expect(() => serializeValue(obj)).toThrow();
  });

  it('handles circular reference (should throw)', () => {
    const obj: Record<string, unknown> = { name: 'circle' };
    obj.self = obj;
    expect(() => serializeValue(obj)).toThrow();
  });

  it('handles object with toString() that returns malicious string', () => {
    const obj = {
      toString() {
        return "'; DROP TABLE users; --";
      },
    };
    // serializeValue treats this as a plain object (prototype is Object.prototype)
    // and serializes the toString function via String() fallback
    const result = serializeValue(obj);
    // toString is a function, so it hits the fallback String(v) path
    expect(result).toContain('toString');
    expect(result).toContain('return');
  });

  it('handles very deeply nested structures (100 levels)', () => {
    let obj: unknown = { val: 'deep' };
    for (let i = 0; i < 100; i++) {
      obj = { nested: obj };
    }
    const result = serializeValue(obj);
    expect(result).toContain("val: 'deep'");
    expect(result.length).toBeGreaterThan(100);
  });

  it('handles array with 10000 elements', () => {
    const arr = Array.from({ length: 10000 }, (_, i) => i);
    const result = serializeValue(arr);
    expect(result.startsWith('[')).toBe(true);
    expect(result.endsWith(']')).toBe(true);
    expect(result).toContain('9999');
  });

  it('handles Date with invalid value (Invalid Date)', () => {
    const d = new Date('not-a-date');
    // Invalid Date throws on toISOString — serializeValue should propagate
    expect(() => serializeValue(d)).toThrow();
  });

  it('handles array with mixed injection payloads', () => {
    const arr = [
      "'; DROP TABLE users; --",
      '\x00',
      '\u202E',
      { __proto__: { admin: true } },
      ['nested', "' OR 1=1 --"],
    ];
    const result = serializeValue(arr);
    expect(result.startsWith('[')).toBe(true);
    expect(result.endsWith(']')).toBe(true);
    // All quotes should be escaped
    expect(result).not.toContain("''");
  });

  it('handles object with numeric keys', () => {
    const obj = { '123': 'value', '0': 'zero' };
    const result = serializeValue(obj);
    // Numeric keys start with digit, so escapeIdent wraps them in backticks
    // V8 sorts numeric keys: '0' comes before '123'
    expect(result).toBe("{ `0`: 'zero', `123`: 'value' }");
  });

  it('handles object with empty string key', () => {
    const obj = { '': 'empty' };
    const result = serializeValue(obj);
    expect(result).toBe("{ ``: 'empty' }");
  });

  it('handles nested array with null/undefined/NaN', () => {
    const arr = [null, undefined, NaN, Infinity, -Infinity];
    const result = serializeValue(arr);
    expect(result).toBe('[null, NONE, NaN, Infinity, -Infinity]');
  });

  it('handles array with raw() markers containing injection', () => {
    const arr = [raw("'; DROP TABLE users; --")];
    const result = serializeValue(arr);
    // raw() passes through unquoted — this is by design for trusted SQL
    expect(result).toBe("['; DROP TABLE users; --]");
  });

  it('handles deeply nested arrays (10 levels)', () => {
    let arr: unknown = ['deep'];
    for (let i = 0; i < 10; i++) {
      arr = [arr];
    }
    const result = serializeValue(arr);
    expect(result).toContain("'deep'");
  });

  it('handles object with getter that returns malicious value', () => {
    let accessCount = 0;
    const obj: Record<string, unknown> = {};
    Object.defineProperty(obj, 'name', {
      get() {
        accessCount++;
        return "'; DROP TABLE users; --";
      },
      enumerable: true,
    });
    const result = serializeValue(obj);
    expect(result).toBe("{ name: '\\'; DROP TABLE users; --' }");
    expect(accessCount).toBe(1); // getter called exactly once
  });
});

// =============================================================================
// 4. raw() — abuse and safety
// =============================================================================

describe('raw — adversarial', () => {
  it('raw() can be called with arbitrary SQL injection payload', () => {
    const r = raw("'; DROP TABLE users; --");
    expect(r.sql).toBe("'; DROP TABLE users; --");
    expect(r.__surqlRaw).toBe(true);
    // serializeValue passes it through unquoted — this is by design
    expect(serializeValue(r)).toBe("'; DROP TABLE users; --");
  });

  it('raw() with empty string', () => {
    const r = raw('');
    expect(r.sql).toBe('');
    expect(serializeValue(r)).toBe('');
  });

  it('raw() with very long string', () => {
    const long = 'a'.repeat(100000);
    const r = raw(long);
    expect(r.sql.length).toBe(100000);
    expect(serializeValue(r).length).toBe(100000);
  });

  it('multiple raw() objects with same content are not reference-equal', () => {
    const r1 = raw('SELECT 1');
    const r2 = raw('SELECT 1');
    expect(r1).not.toBe(r2);
    expect(r1.sql).toBe(r2.sql);
    expect(isRaw(r1)).toBe(true);
    expect(isRaw(r2)).toBe(true);
  });

  it('raw() with unicode injection payload', () => {
    const r = raw('\u202E' + "' OR 1=1 --");
    expect(serializeValue(r)).toBe('\u202E' + "' OR 1=1 --");
  });

  it('raw() with null byte', () => {
    const r = raw('\x00');
    expect(serializeValue(r)).toBe('\x00');
  });
});

// =============================================================================
// 5. surql template tag — adversarial
// =============================================================================

describe('surql — adversarial', () => {
  it('interpolates SQL injection string safely', () => {
    const r = surql`SELECT * FROM users WHERE name = ${"'; DROP TABLE users; --"}`;
    expect(r.sql).toBe("SELECT * FROM users WHERE name = '\\'; DROP TABLE users; --'");
  });

  it('interpolates null byte string', () => {
    const r = surql`SELECT * FROM users WHERE name = ${'\x00'}`;
    expect(r.sql).toBe("SELECT * FROM users WHERE name = '\\u0000'");
  });

  it('interpolates object with __proto__ key', () => {
    const obj = Object.create(null);
    obj.__proto__ = { admin: true };
    const r = surql`INSERT INTO users ${[obj]}`;
    expect(r.sql).toBe('INSERT INTO users [{ __proto__: { admin: true } }]');
  });

  it('interpolates array with injection payload', () => {
    const r = surql`tags CONTAINSALL ${["'; DROP TABLE users; --"]}`;
    expect(r.sql).toBe("tags CONTAINSALL ['\\'; DROP TABLE users; --']");
  });

  it('interpolates raw() with injection payload', () => {
    const r = surql`${raw("'; DROP TABLE users; --")}`;
    expect(r.sql).toBe("'; DROP TABLE users; --");
  });

  it('handles multiple interpolations with mixed injection', () => {
    const r = surql`SELECT * FROM ${raw('users')} WHERE name = ${"'; DROP TABLE users; --"} AND role = ${'\x00'}`;
    expect(r.sql).toBe(
      "SELECT * FROM users WHERE name = '\\'; DROP TABLE users; --' AND role = '\\u0000'",
    );
  });
});
