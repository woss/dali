/**
 * SQL output tests for crypto, geo, type, record/meta, SqlExpr helpers, and sleep namespaces.
 *
 * Pure string output — no DB needed.
 */

import { describe, expect, it } from 'vitest';
import {
  $,
  as_,
  col,
  cryptoArgon2Compare,
  cryptoArgon2Generate,
  cryptoBcryptCompare,
  cryptoBcryptGenerate,
  cryptoBlake3,
  cryptoJoaat,
  cryptoMd5,
  cryptoPbkdf2Compare,
  cryptoPbkdf2Generate,
  cryptoScryptCompare,
  cryptoScryptGenerate,
  cryptoSha1,
  cryptoSha256,
  cryptoSha512,
  cryptoUuidV4,
  cryptoUuidV7,
  expr,
  geoArea,
  geoBearing,
  geoCentroid,
  geoDistance,
  geoHashDecode,
  geoHashEncode,
  geoIsValid,
  geoWithin,
  metaId,
  metaTable,
  metaTb,
  recordId,
  recordTable,
  sleep,
  typeBool,
  typeDatetime,
  typeDecimal,
  typeDuration,
  typeField,
  typeFloat,
  typeInt,
  typeIsArray,
  typeIsBool,
  typeIsDatetime,
  typeIsDecimal,
  typeIsDuration,
  typeIsFloat,
  typeIsInt,
  typeIsNumber,
  typeIsObject,
  typeIsPoint,
  typeIsRecord,
  typeIsString,
  typeNumber,
  typePoint,
  typeRecord,
  typeString,
  typeThing,
} from '../index.js';

// --- crypto ---
describe('crypto', () => {
  it('cryptoMd5()', () => {
    expect(cryptoMd5($('s'))).toBe('crypto::md5(s)');
  });

  it('cryptoSha256()', () => {
    expect(cryptoSha256($('s'))).toBe('crypto::sha256(s)');
  });

  it('cryptoSha1()', () => {
    expect(cryptoSha1($('s'))).toBe('crypto::sha1(s)');
  });

  it('cryptoSha512()', () => {
    expect(cryptoSha512($('s'))).toBe('crypto::sha512(s)');
  });

  it('cryptoArgon2Generate()', () => {
    expect(cryptoArgon2Generate($('pw'))).toBe('crypto::argon2::generate(pw)');
  });

  it('cryptoArgon2Compare()', () => {
    expect(cryptoArgon2Compare($('pw'), $('hash'))).toBe(
      'crypto::argon2::compare(pw, hash)',
    );
  });

  it('cryptoBlake3()', () => {
    expect(cryptoBlake3($('data'))).toBe('crypto::blake3(data)');
  });

  it('cryptoJoaat()', () => {
    expect(cryptoJoaat($('data'))).toBe('crypto::joaat(data)');
  });

  it('cryptoBcryptGenerate()', () => {
    expect(cryptoBcryptGenerate($('pw'))).toBe('crypto::bcrypt::generate(pw)');
  });

  it('cryptoBcryptCompare()', () => {
    expect(cryptoBcryptCompare($('pw'), $('hash'))).toBe(
      'crypto::bcrypt::compare(pw, hash)',
    );
  });

  it('cryptoScryptGenerate()', () => {
    expect(cryptoScryptGenerate($('pw'))).toBe('crypto::scrypt::generate(pw)');
  });

  it('cryptoScryptCompare()', () => {
    expect(cryptoScryptCompare($('pw'), $('hash'))).toBe(
      'crypto::scrypt::compare(pw, hash)',
    );
  });

  it('cryptoPbkdf2Generate()', () => {
    expect(cryptoPbkdf2Generate($('pw'), $('key'))).toBe(
      'crypto::pbkdf2::generate(pw, key)',
    );
  });

  it('cryptoPbkdf2Compare()', () => {
    expect(cryptoPbkdf2Compare($('pw'), $('hash'))).toBe(
      'crypto::pbkdf2::compare(pw, hash)',
    );
  });

  it('cryptoUuidV4()', () => {
    expect(cryptoUuidV4()).toBe('crypto::uuid::v4()');
  });

  it('cryptoUuidV7()', () => {
    expect(cryptoUuidV7()).toBe('crypto::uuid::v7()');
  });
});

// --- geo ---
describe('geo', () => {
  it('geoDistance()', () => {
    expect(geoDistance($('a'), $('b'))).toBe('geo::distance(a, b)');
  });

  it('geoArea()', () => {
    expect(geoArea($('geom'))).toBe('geo::area(geom)');
  });

  it('geoBearing()', () => {
    expect(geoBearing($('from'), $('to'))).toBe('geo::bearing(from, to)');
  });

  it('geoCentroid()', () => {
    expect(geoCentroid($('geom'))).toBe('geo::centroid(geom)');
  });

  it('geoHashDecode()', () => {
    expect(geoHashDecode($('hash'))).toBe('geo::hash::decode(hash)');
  });

  it('geoHashEncode() without len', () => {
    expect(geoHashEncode($('lng'), $('lat'))).toBe(
      'geo::hash::encode(lng, lat)',
    );
  });

  it('geoHashEncode() with len', () => {
    expect(geoHashEncode($('lng'), $('lat'), $('5'))).toBe(
      'geo::hash::encode(lng, lat, 5)',
    );
  });

  it('geoIsValid()', () => {
    expect(geoIsValid($('geom'))).toBe('geo::is::valid(geom)');
  });

  it('geoWithin()', () => {
    expect(geoWithin($('geom'), $('region'))).toBe('geo::within(geom, region)');
  });
});

// --- type conversion ---
describe('type', () => {
  it('typeInt()', () => {
    expect(typeInt($('x'))).toBe('type::int(x)');
  });

  it('typeString()', () => {
    expect(typeString($('x'))).toBe('type::string(x)');
  });

  it('typeBool()', () => {
    expect(typeBool($('x'))).toBe('type::bool(x)');
  });

  it('typeDatetime()', () => {
    expect(typeDatetime($('x'))).toBe('type::datetime(x)');
  });

  it('typeDecimal()', () => {
    expect(typeDecimal($('x'))).toBe('type::decimal(x)');
  });

  it('typeDuration()', () => {
    expect(typeDuration($('x'))).toBe('type::duration(x)');
  });

  it('typeFloat()', () => {
    expect(typeFloat($('x'))).toBe('type::float(x)');
  });

  it('typeNumber()', () => {
    expect(typeNumber($('x'))).toBe('type::number(x)');
  });

  it('typePoint()', () => {
    expect(typePoint($('lng'), $('lat'))).toBe('type::point(lng, lat)');
  });

  it('typeThing()', () => {
    expect(typeThing($('tbl'), $('id'))).toBe('type::thing(tbl, id)');
  });

  it('typeField()', () => {
    expect(typeField($('name'))).toBe('type::field(name)');
  });

  it('typeRecord()', () => {
    expect(typeRecord($('tb'), $('id'))).toBe('type::record(tb, id)');
  });

  it('typeIsArray()', () => {
    expect(typeIsArray($('val'))).toBe('type::is_array(val)');
  });

  it('typeIsBool()', () => {
    expect(typeIsBool($('val'))).toBe('type::is_bool(val)');
  });

  it('typeIsDatetime()', () => {
    expect(typeIsDatetime($('val'))).toBe('type::is_datetime(val)');
  });

  it('typeIsDecimal()', () => {
    expect(typeIsDecimal($('val'))).toBe('type::is_decimal(val)');
  });

  it('typeIsDuration()', () => {
    expect(typeIsDuration($('val'))).toBe('type::is_duration(val)');
  });

  it('typeIsFloat()', () => {
    expect(typeIsFloat($('val'))).toBe('type::is_float(val)');
  });

  it('typeIsInt()', () => {
    expect(typeIsInt($('val'))).toBe('type::is_int(val)');
  });

  it('typeIsNumber()', () => {
    expect(typeIsNumber($('val'))).toBe('type::is_number(val)');
  });

  it('typeIsObject()', () => {
    expect(typeIsObject($('val'))).toBe('type::is_object(val)');
  });

  it('typeIsPoint()', () => {
    expect(typeIsPoint($('val'))).toBe('type::is_point(val)');
  });

  it('typeIsRecord()', () => {
    expect(typeIsRecord($('val'))).toBe('type::is_record(val)');
  });

  it('typeIsString()', () => {
    expect(typeIsString($('val'))).toBe('type::is_string(val)');
  });
});

// --- record / meta ---
describe('record and meta', () => {
  it('recordId()', () => {
    expect(recordId($('r'))).toBe('record::id(r)');
  });

  it('recordTable()', () => {
    expect(recordTable($('r'))).toBe('record::table(r)');
  });

  it('metaId()', () => {
    expect(metaId($('r'))).toBe('meta::id(r)');
  });

  it('metaTable()', () => {
    expect(metaTable($('r'))).toBe('meta::tb(r)');
  });

  it('metaTb()', () => {
    expect(metaTb($('r'))).toBe('meta::tb(r)');
  });
});

// --- SqlExpr helpers ---
describe('SqlExpr helpers', () => {
  it('$() wraps string as SqlExpr', () => {
    const expr = $('age');
    expect(expr).toBe('age');
  });

  it('as_() aliases expression', () => {
    expect(as_($('count()'), 'total')).toBe('count() AS total');
  });

  it('as_() throws without alias', () => {
    expect(() => as_($('count()'), '')).toThrow('Alias is required');
  });

  it('col() creates column reference', () => {
    expect(col('name')).toBe('name');
  });

  it('col() throws without name', () => {
    expect(() => col('')).toThrow('Column name is required');
  });

  it('expr() creates raw expression from template', () => {
    expect(expr`${$('age')} + 1`).toBe('age + 1');
  });
});

// --- sleep ---
describe('sleep', () => {
  it('sleep()', () => {
    expect(sleep($('1s'))).toBe('sleep(1s)');
  });
});
