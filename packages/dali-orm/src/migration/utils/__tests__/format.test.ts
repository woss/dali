import { describe, expect, it } from 'vite-plus/test';
import {
  formatDefaultValue,
  isNowVariant,
  normalizeDefault,
  validateChangefeed,
} from '../format.js';

// ---------------------------------------------------------------------------
// isNowVariant
// ---------------------------------------------------------------------------
describe('isNowVariant', () => {
  it('returns true for bare "now"', () => {
    expect(isNowVariant('now')).toBe(true);
  });

  it('returns true for "now()"', () => {
    expect(isNowVariant('now()')).toBe(true);
  });

  it('returns true for "time::now()"', () => {
    expect(isNowVariant('time::now()')).toBe(true);
  });

  it('returns true for uppercased "NOW"', () => {
    expect(isNowVariant('  NOW  ')).toBe(true);
  });

  it('returns false for unrelated string', () => {
    expect(isNowVariant('hello')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isNowVariant('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatDefaultValue
// ---------------------------------------------------------------------------
describe('formatDefaultValue', () => {
  it('formats null as "NULL"', () => {
    expect(formatDefaultValue(null)).toBe('NULL');
  });

  it('formats undefined as "NONE"', () => {
    expect(formatDefaultValue(undefined)).toBe('NONE');
  });

  it('formats now variants as "time::now()"', () => {
    expect(formatDefaultValue('now')).toBe('time::now()');
    expect(formatDefaultValue('now()')).toBe('time::now()');
    expect(formatDefaultValue('time::now()')).toBe('time::now()');
  });

  it('formats string "true" as boolean true literal', () => {
    expect(formatDefaultValue('true')).toBe('true');
  });

  it('formats string "false" as boolean false literal', () => {
    expect(formatDefaultValue('false')).toBe('false');
  });

  it('formats plain strings as quoted values with escaping', () => {
    expect(formatDefaultValue('hello world')).toBe("'hello world'");
  });

  it('escapes single quotes inside string values', () => {
    expect(formatDefaultValue("it's")).toBe("'it\\'s'");
  });

  it('formats boolean true as true', () => {
    expect(formatDefaultValue(true)).toBe(true);
  });

  it('formats boolean false as false', () => {
    expect(formatDefaultValue(false)).toBe(false);
  });

  it('formats numbers as numbers', () => {
    expect(formatDefaultValue(42)).toBe(42);
    expect(formatDefaultValue(3.14)).toBe(3.14);
    expect(formatDefaultValue(0)).toBe(0);
  });

  it('formats objects as JSON', () => {
    expect(formatDefaultValue({ a: 1 })).toBe('{"a":1}');
  });

  it('formats other types via String()', () => {
    expect(formatDefaultValue(Symbol('x'))).toBe('Symbol(x)');
  });
});

// ---------------------------------------------------------------------------
// normalizeDefault
// ---------------------------------------------------------------------------
describe('normalizeDefault', () => {
  it('returns non-string values as-is', () => {
    expect(normalizeDefault(null)).toBe(null);
    expect(normalizeDefault(42)).toBe(42);
    expect(normalizeDefault(true)).toBe(true);
    expect(normalizeDefault(undefined)).toBe(undefined);
  });

  it('strips single quotes from string defaults', () => {
    expect(normalizeDefault("'viewer'")).toBe('viewer');
  });

  it('strips double quotes from string defaults', () => {
    expect(normalizeDefault('"viewer"')).toBe('viewer');
  });

  it('handles escaped single quotes', () => {
    expect(normalizeDefault("'it\\'s'")).toBe("it's");
  });

  it('handles escaped double quotes', () => {
    expect(normalizeDefault('"say \\"hi\\""')).toBe('say "hi"');
  });

  it('normalizes "now" to "now" string', () => {
    expect(normalizeDefault('now')).toBe('now');
  });

  it('normalizes "now()" to "now" string', () => {
    expect(normalizeDefault('now()')).toBe('now');
  });

  it('normalizes "time::now()" to "now" string', () => {
    expect(normalizeDefault('time::now()')).toBe('now');
  });

  it('normalizes "true" string to boolean true', () => {
    expect(normalizeDefault('true')).toBe(true);
  });

  it('normalizes "false" string to boolean false', () => {
    expect(normalizeDefault('false')).toBe(false);
  });

  it('normalizes "null" string to null', () => {
    expect(normalizeDefault('null')).toBe(null);
  });

  it('normalizes "none" string to null', () => {
    expect(normalizeDefault('none')).toBe(null);
  });

  it('returns unmatched string values as-is (no trimming)', () => {
    expect(normalizeDefault('  hello  ')).toBe('  hello  ');
  });

  it('case-insensitive matching for now/true/false/null/none', () => {
    expect(normalizeDefault('NOW')).toBe('now');
    expect(normalizeDefault('TRUE')).toBe(true);
    expect(normalizeDefault('FALSE')).toBe(false);
    expect(normalizeDefault('NULL')).toBe(null);
    expect(normalizeDefault('NONE')).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// validateChangefeed
// ---------------------------------------------------------------------------
describe('validateChangefeed', () => {
  it('is a no-op for undefined', () => {
    expect(() => validateChangefeed(undefined)).not.toThrow();
  });

  it('accepts "7d"', () => {
    expect(() => validateChangefeed('7d')).not.toThrow();
  });

  it('accepts "24h"', () => {
    expect(() => validateChangefeed('24h')).not.toThrow();
  });

  it('accepts "1w"', () => {
    expect(() => validateChangefeed('1w')).not.toThrow();
  });

  it('throws for "abc"', () => {
    expect(() => validateChangefeed('abc')).toThrow(/invalid changefeed duration/i);
  });

  it('throws for "5" (no unit)', () => {
    expect(() => validateChangefeed('5')).toThrow(/invalid changefeed duration/i);
  });

  it('rejects compound durations like "1h30m" (single unit only)', () => {
    expect(() => validateChangefeed('1h30m')).toThrow(/invalid changefeed duration/i);
  });
});
