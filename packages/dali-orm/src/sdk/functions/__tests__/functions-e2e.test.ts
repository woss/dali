/**
 * End-to-end tests for SurrealDB Function Wrappers.
 *
 * Execute functions against real embedded SurrealDB.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { select } from '../../../query/select.js';
import type { DaliORM } from '../../dali-orm.js';
import { EmbeddedDriver } from '../../driver/embedded-driver.js';
import { array, bool, float, int, string } from '../../schema/column/index.js';
import { defineTable } from '../../table.js';
import {
  $,
  as_,
  count,
  cryptoMd5,
  cryptoSha256,
  geoDistance,
  mathAbs,
  mathCeil,
  mathFloor,
  mathMax,
  mathMean,
  mathMin,
  mathRandom,
  mathRound,
  mathSqrt,
  mathSum,
  metaId,
  metaTable,
  recordId,
  recordTable,
  stringConcat,
  stringIsAlphanum,
  stringIsUrl,
  stringIsUuid,
  stringLen,
  stringLowercase,
  stringRepeat,
  stringReplace,
  stringReverse,
  stringSlice,
  stringSplit,
  stringTrim,
  stringUppercase,
  timeDay,
  timeHour,
  timeMinute,
  timeMonth,
  timeNow,
  timeSecond,
  timeUnix,
  timeWeekday,
  timeYear,
  typeBool,
  typeInt,
  typeString,
} from '../index.js';
import { stringIsEmail } from '../string.js';

// ============================================================================
// Table Definitions
// ============================================================================

const users = defineTable('user', {
  name: string('name'),
  email: string('email'),
  age: int('age'),
  score: float('score'),
  active: bool('active'),
  tags: array('tags'),
});

// ============================================================================
// End-to-End Tests — Execute functions against real SurrealDB
// ============================================================================

describe('End-to-end function tests', () => {
  let driver: EmbeddedDriver;
  let orm: DaliORM;

  /** Define user table schema in SurrealDB */
  async function defineUserTable(): Promise<void> {
    await driver.query('DEFINE TABLE user SCHEMAFULL');
    await driver.query('DEFINE FIELD name ON user TYPE string');
    await driver.query('DEFINE FIELD email ON user TYPE option<string>');
    await driver.query('DEFINE FIELD age ON user TYPE option<int>');
    await driver.query('DEFINE FIELD score ON user TYPE option<float>');
    await driver.query('DEFINE FIELD active ON user TYPE option<bool>');
    await driver.query('DEFINE FIELD tags ON user TYPE option<array>');
  }

  beforeEach(async () => {
    driver = new EmbeddedDriver({
      driver: 'embedded',
      namespace: 'test_ns',
      database: 'test_db',
      mode: 'memory',
    });
    orm = { getDriver: () => driver } as unknown as DaliORM;
    await driver.connect();
    await defineUserTable();

    // Seed 3 user records
    await driver.query(
      "CREATE user:1 SET name = 'Alice', email = 'alice@test.com', age = 25, score = 3.7, active = true, tags = ['dev', 'admin']",
    );
    await driver.query(
      "CREATE user:2 SET name = 'Bob', email = 'bob@test.com', age = 30, score = 8.2, active = true, tags = ['dev']",
    );
    await driver.query(
      "CREATE user:3 SET name = 'Charlie', email = 'charlie@test.com', age = 35, score = 5.1, active = false, tags = ['qa']",
    );
  });

  afterEach(async () => {
    await driver.disconnect();
  });

  // ==================================================================
  // count()
  // ==================================================================

  describe('count()', () => {
    it('verify 3 records exist', async () => {
      const result = await select(orm, users).execute();
      expect(result).toHaveLength(3);
    });

    it('count function wrapper produces count()', () => {
      expect(count()).toBe('count()');
      expect(count($('age'))).toBe('count(age)');
    });
  });

  // ==================================================================
  // math functions
  // ==================================================================

  describe('math functions', () => {
    it('mathRound rounds values', async () => {
      const result = await select(orm, users)
        .fields(as_(mathRound($('score')), 'rounded'))
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect(Number((result[0] as Record<string, unknown>).rounded)).toBe(4);
    });

    it('mathFloor floors values', async () => {
      const result = await select(orm, users)
        .fields(as_(mathFloor($('score')), 'floored'))
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect(Number((result[0] as Record<string, unknown>).floored)).toBe(3);
    });

    it('mathCeil ceils values', async () => {
      const result = await select(orm, users)
        .fields(as_(mathCeil($('score')), 'ceiled'))
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect(Number((result[0] as Record<string, unknown>).ceiled)).toBe(4);
    });

    it('mathAbs returns absolute value', async () => {
      await driver.query(
        "CREATE user:neg SET name = 'Neg', email = 'neg@test.com', age = 20, score = -5.5, active = false",
      );

      const result = await select(orm, users)
        .fields(as_(mathAbs($('score')), 'abs_val'))
        .where((w) => w.eq('name', 'Neg'))
        .execute();

      expect(Number((result[0] as Record<string, unknown>).abs_val)).toBe(5.5);
    });

    it('mathSqrt computes square root', async () => {
      const result = await select(orm, users)
        .fields(as_(mathSqrt($('age')), 'sqrt_age'))
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect(Number((result[0] as Record<string, unknown>).sqrt_age)).toBe(5);
    });

    it('mathSum per row returns single element array value', async () => {
      // math::sum([age]) returns the single element of the array per row
      const result = await select(orm, users)
        .fields(as_(mathSum($('age')), 'sum_age'))
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect(Number((result[0] as Record<string, unknown>).sum_age)).toBe(25);
    });

    it('mathMax per row returns single element array value', async () => {
      const result = await select(orm, users)
        .fields(as_(mathMax($('age')), 'max_age'))
        .where((w) => w.eq('name', 'Bob'))
        .execute();

      expect(Number((result[0] as Record<string, unknown>).max_age)).toBe(30);
    });

    it('mathMin per row returns single element array value', async () => {
      const result = await select(orm, users)
        .fields(as_(mathMin($('age')), 'min_age'))
        .where((w) => w.eq('name', 'Bob'))
        .execute();

      expect(Number((result[0] as Record<string, unknown>).min_age)).toBe(30);
    });

    it('mathMean per row returns single element array value', async () => {
      const result = await select(orm, users)
        .fields(as_(mathMean($('age')), 'mean_age'))
        .where((w) => w.eq('name', 'Bob'))
        .execute();

      expect(Number((result[0] as Record<string, unknown>).mean_age)).toBe(30);
    });

    it('mathRandom returns a number', async () => {
      const result = await select(orm, users)
        .fields(as_(mathRandom(), 'r'))
        .limit(1)
        .execute();

      const record = result[0] as Record<string, unknown>;
      expect(record.r).toBeDefined();
      expect(typeof record.r).toBe('number');
    });
  });

  // ==================================================================
  // string functions
  // ==================================================================

  describe('string functions', () => {
    it('stringLowercase transforms to lowercase', async () => {
      const result = await select(orm, users)
        .fields(as_(stringLowercase($('name')), 'lowered'))
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect((result[0] as Record<string, unknown>).lowered).toBe('alice');
    });

    it('stringUppercase transforms to uppercase', async () => {
      const result = await select(orm, users)
        .fields(as_(stringUppercase($('name')), 'uppered'))
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect((result[0] as Record<string, unknown>).uppered).toBe('ALICE');
    });

    it('stringLen returns string length', async () => {
      const result = await select(orm, users)
        .fields(as_(stringLen($('name')), 'len'))
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect(Number((result[0] as Record<string, unknown>).len)).toBe(5);
    });

    it('stringConcat concatenates values', async () => {
      const result = await select(orm, users)
        .fields(as_(stringConcat($('name'), $("' - '"), $('email')), 'joined'))
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect((result[0] as Record<string, unknown>).joined).toBe(
        'Alice - alice@test.com',
      );
    });

    it('stringContains filters records in WHERE', async () => {
      const result = await select(orm, users)
        .where("string::contains(email, 'alice')")
        .execute();

      expect(result).toHaveLength(1);
      expect((result[0] as Record<string, unknown>).name).toBe('Alice');
    });

    it('stringStartsWith filters records in WHERE', async () => {
      const result = await select(orm, users)
        .where("string::starts_with(name, 'A')")
        .execute();

      expect(result).toHaveLength(1);
      expect((result[0] as Record<string, unknown>).name).toBe('Alice');
    });

    it('stringEndsWith filters records in WHERE', async () => {
      const result = await select(orm, users)
        .where("string::ends_with(name, 'e')")
        .execute();

      // Alice and Charlie both end with 'e'
      expect(result).toHaveLength(2);
      const names = result.map((r) => (r as Record<string, unknown>).name);
      expect(names).toContain('Alice');
      expect(names).toContain('Charlie');
    });

    it('stringJoin joins array column', async () => {
      // Use array::join directly for array columns
      const result = await driver.query(
        "SELECT array::join(tags, ', ') AS joined FROM user WHERE name = 'Alice'",
      );

      expect(String((result[0] as Record<string, unknown>).joined)).toBe(
        'dev, admin',
      );
    });

    it('stringTrim removes whitespace', async () => {
      await driver.query(
        "CREATE user:pad SET name = '  padded  ', email = 'pad@test.com', active = true",
      );

      const result = await select(orm, users)
        .fields(as_(stringTrim($('name')), 'trimmed'))
        .where((w) => w.eq('name', '  padded  '))
        .execute();

      expect((result[0] as Record<string, unknown>).trimmed).toBe('padded');
    });

    it('stringReverse reverses string', async () => {
      const result = await select(orm, users)
        .fields(as_(stringReverse($("'abc'")), 'reversed'))
        .limit(1)
        .execute();

      expect((result[0] as Record<string, unknown>).reversed).toBe('cba');
    });

    it('stringRepeat repeats string', async () => {
      const result = await select(orm, users)
        .fields(as_(stringRepeat($("'ab'"), $('3')), 'repeated'))
        .limit(1)
        .execute();

      expect((result[0] as Record<string, unknown>).repeated).toBe('ababab');
    });

    it('stringReplace substitutes text', async () => {
      const result = await select(orm, users)
        .fields(
          as_(
            stringReplace($("'hello world'"), $("'world'"), $("'there'")),
            'replaced',
          ),
        )
        .limit(1)
        .execute();

      expect((result[0] as Record<string, unknown>).replaced).toBe(
        'hello there',
      );
    });

    it('stringSlice extracts substring', async () => {
      const result = await select(orm, users)
        .fields(as_(stringSlice($('name'), $('1'), $('3')), 'sliced'))
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      // string::slice is 0-indexed, end exclusive in SurrealDB
      // slice('Alice', 1, 3) → characters at index 1 and 2 → 'li'
      expect((result[0] as Record<string, unknown>).sliced).toBe('li');
    });

    it('stringSplit splits by delimiter', async () => {
      const result = await select(orm, users)
        .fields(as_(stringSplit($("'a,b,c'"), $("','")), 'split'))
        .limit(1)
        .execute();

      const val = (result[0] as Record<string, unknown>).split;
      expect(Array.isArray(val)).toBe(true);
      expect(val).toEqual(['a', 'b', 'c']);
    });

    it('stringIsEmail validates email', async () => {
      const result = await select(orm, users)
        .fields(as_(stringIsEmail($('email')), 'is_email'))
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect((result[0] as Record<string, unknown>).is_email).toBe(true);
    });

    it('stringIsUrl validates url', async () => {
      const result = await select(orm, users)
        .fields(as_(stringIsUrl($("'https://example.com'")), 'is_url'))
        .limit(1)
        .execute();

      expect((result[0] as Record<string, unknown>).is_url).toBe(true);
    });

    it('stringIsUuid validates uuid', async () => {
      const result = await select(orm, users)
        .fields(
          as_(
            stringIsUuid($("'550e8400-e29b-41d4-a716-446655440000'")),
            'is_uuid',
          ),
        )
        .limit(1)
        .execute();

      expect((result[0] as Record<string, unknown>).is_uuid).toBe(true);
    });

    it('stringIsAlphanum validates alphanumeric', async () => {
      const result = await select(orm, users)
        .fields(as_(stringIsAlphanum($('name')), 'is_alphanum'))
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect((result[0] as Record<string, unknown>).is_alphanum).toBe(true);
    });
  });

  // ==================================================================
  // time functions
  // ==================================================================

  describe('time functions', () => {
    it('timeNow returns current datetime', async () => {
      const result = await select(orm, users)
        .fields(as_(timeNow(), 'now'))
        .limit(1)
        .execute();

      const val = (result[0] as Record<string, unknown>).now;
      expect(val).toBeDefined();
      // Should be a Date or string representation of a date
      expect(new Date(String(val)).getTime()).not.toBeNaN();
    });

    it('timeYear extracts year from datetime', async () => {
      const result = await select(orm, users)
        .fields(as_(timeYear($("d'2024-01-15T10:30:00Z'")), 'y'))
        .limit(1)
        .execute();

      expect(Number((result[0] as Record<string, unknown>).y)).toBe(2024);
    });

    it('timeMonth extracts month from datetime', async () => {
      const result = await select(orm, users)
        .fields(as_(timeMonth($("d'2024-01-15T10:30:00Z'")), 'm'))
        .limit(1)
        .execute();

      expect(Number((result[0] as Record<string, unknown>).m)).toBe(1);
    });

    it('timeDay extracts day from datetime', async () => {
      const result = await select(orm, users)
        .fields(as_(timeDay($("d'2024-01-15T10:30:00Z'")), 'd'))
        .limit(1)
        .execute();

      expect(Number((result[0] as Record<string, unknown>).d)).toBe(15);
    });

    it('timeHour extracts hour from datetime', async () => {
      const result = await select(orm, users)
        .fields(as_(timeHour($("d'2024-01-15T10:30:00Z'")), 'h'))
        .limit(1)
        .execute();

      expect(Number((result[0] as Record<string, unknown>).h)).toBe(10);
    });

    it('timeMinute extracts minute from datetime', async () => {
      const result = await select(orm, users)
        .fields(as_(timeMinute($("d'2024-01-15T10:30:00Z'")), 'min'))
        .limit(1)
        .execute();

      expect(Number((result[0] as Record<string, unknown>).min)).toBe(30);
    });

    it('timeSecond extracts second from datetime', async () => {
      const result = await select(orm, users)
        .fields(as_(timeSecond($("d'2024-01-15T10:30:00Z'")), 's'))
        .limit(1)
        .execute();

      expect(Number((result[0] as Record<string, unknown>).s)).toBe(0);
    });

    it('timeUnix returns unix timestamp', async () => {
      const result = await select(orm, users)
        .fields(as_(timeUnix($("d'2024-01-15T10:30:00Z'")), 'ts'))
        .limit(1)
        .execute();

      const ts = Number((result[0] as Record<string, unknown>).ts);
      expect(ts).toBeGreaterThan(0);
      // 2024-01-15T10:30:00Z = 1705314600
      expect(ts).toBe(1_705_314_600);
    });

    it('timeWeekday returns weekday number', async () => {
      // 2024-01-15 is a Monday
      const result = await select(orm, users)
        .fields(as_(timeWeekday($("d'2024-01-15T10:30:00Z'")), 'wd'))
        .limit(1)
        .execute();

      // SurrealDB: Monday=1, Tuesday=2, etc.
      expect(Number((result[0] as Record<string, unknown>).wd)).toBe(1);
    });
  });

  // ==================================================================
  // crypto functions
  // ==================================================================

  describe('crypto functions', () => {
    it('cryptoMd5 produces correct MD5 hash', async () => {
      const result = await select(orm, users)
        .fields(as_(cryptoMd5($("'hello'")), 'hash'))
        .limit(1)
        .execute();

      expect((result[0] as Record<string, unknown>).hash).toBe(
        '5d41402abc4b2a76b9719d911017c592',
      );
    });

    it('cryptoSha256 produces correct SHA-256 hash', async () => {
      const result = await select(orm, users)
        .fields(as_(cryptoSha256($("'hello'")), 'hash'))
        .limit(1)
        .execute();

      expect((result[0] as Record<string, unknown>).hash).toBe(
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      );
    });
  });

  // ==================================================================
  // geo functions
  // ==================================================================

  describe('geo functions', () => {
    it('geoDistance calculates distance between points', async () => {
      // Distance between (0,0) and (0,1) in degrees ≈ 111km
      const result = await select(orm, users)
        .fields(as_(geoDistance($('(0, 0)'), $('(0, 1)')), 'dist'))
        .limit(1)
        .execute();

      const dist = Number((result[0] as Record<string, unknown>).dist);
      expect(dist).toBeGreaterThan(0);
      // Should be roughly 111km (111195 meters)
      expect(dist).toBeGreaterThan(100_000);
      expect(dist).toBeLessThan(120_000);
    });
  });

  // ==================================================================
  // type conversion functions
  // ==================================================================

  describe('type conversion functions', () => {
    it('typeInt converts string to integer', async () => {
      const result = await select(orm, users)
        .fields(as_(typeInt($("'42'")), 'val'))
        .limit(1)
        .execute();

      expect(Number((result[0] as Record<string, unknown>).val)).toBe(42);
    });

    it('typeString converts number to string', async () => {
      const result = await select(orm, users)
        .fields(as_(typeString($('42')), 'val'))
        .limit(1)
        .execute();

      expect(String((result[0] as Record<string, unknown>).val)).toBe('42');
    });

    it('typeBool converts to boolean', async () => {
      const result = await select(orm, users)
        .fields(as_(typeBool($("'true'")), 'val'))
        .limit(1)
        .execute();

      expect((result[0] as Record<string, unknown>).val).toBe(true);
    });
  });

  // ==================================================================
  // record / meta functions
  // ==================================================================

  describe('record and meta functions', () => {
    it('recordId extracts string ID from record', async () => {
      const result = await select(orm, users)
        .fields(as_(recordId($('id')), 'rid'))
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect(String((result[0] as Record<string, unknown>).rid)).toBe('1');
    });

    it('recordTable extracts table name from record', async () => {
      const result = await select(orm, users)
        .fields(as_(recordTable($('id')), 'tbl'))
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect(String((result[0] as Record<string, unknown>).tbl)).toBe('user');
    });

    it('metaId extracts string ID from record', async () => {
      const result = await select(orm, users)
        .fields(as_(metaId($('id')), 'mid'))
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect(String((result[0] as Record<string, unknown>).mid)).toBe('1');
    });

    it('metaTable extracts table name from record', async () => {
      const result = await select(orm, users)
        .fields(as_(metaTable($('id')), 'mtbl'))
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect(String((result[0] as Record<string, unknown>).mtbl)).toBe('user');
    });
  });

  // ==================================================================
  // Builder integration
  // ==================================================================

  describe('builder integration', () => {
    it('functions used with .fields() and .where() together', async () => {
      // Query: users with score above average math::mean
      const result = await select(orm, users)
        .fields('name', as_(mathRound($('score')), 'rounded_score'))
        .where('score > 5')
        .execute();

      expect(result.length).toBeGreaterThan(0);
      for (const row of result) {
        const r = row as Record<string, unknown>;
        expect(r.name).toBeDefined();
        expect(Number(r.rounded_score)).toBeGreaterThan(0);
      }
    });

    it('multiple function wrappers compose in single query', async () => {
      const result = await select(orm, users)
        .fields(
          'name',
          as_(stringUppercase($('name')), 'upper_name'),
          as_(mathRound($('score')), 'rounded_score'),
        )
        .where((w) => w.eq('name', 'Alice'))
        .execute();

      expect(result).toHaveLength(1);
      const record = result[0] as Record<string, unknown>;
      expect(record.upper_name).toBe('ALICE');
      expect(Number(record.rounded_score)).toBe(4);
    });
  });
});
