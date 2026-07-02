/**
 * Integration tests for SurrealDB Function Wrappers
 *
 * Two categories:
 * 1. SQL output tests — verify wrappers produce correct SurrealQL strings
 * 2. End-to-end tests — execute functions against real embedded SurrealDB
 */

import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { select } from '../../../query/select.js';
import { EmbeddedDriver } from '../../driver/embedded-driver.js';
import type { DaliORM } from '../../dali-orm.js';
import { array, bool, float, int, string } from '../../schema/column/index.js';
import { defineTable } from '../../table.js';
import {
  $,
  // api functions
  apiTimeout,
  // array functions
  arrayAdd,
  arrayAppend,
  arrayConcat,
  arrayContains,
  arrayDifference,
  arrayDistinct,
  arrayFilter,
  arrayFind,
  arrayFirst,
  arrayFlatten,
  arrayGroup,
  arrayIntersect,
  arrayIsEmpty,
  arrayJoin,
  arrayLast,
  arrayLen,
  arrayMap,
  arrayMax,
  arrayMin,
  arrayPop,
  arrayPrepend,
  arrayPush,
  arrayRemove,
  arrayReverse,
  arrayShuffle,
  arraySlice,
  arraySort,
  arrayStringJoin,
  arraySum,
  arrayUnion,
  arrayUnique,
  as_,
  // bytes functions
  bytesAnd,
  bytesLen,
  bytesOr,
  bytesResize,
  bytesReverse,
  bytesToString,
  bytesXor,
  col,
  count,
  countAll,
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
  // duration functions
  DURATION_MAX,
  durationDays,
  durationHours,
  durationMicros,
  durationMillis,
  durationMins,
  durationNanos,
  durationSecs,
  durationWeeks,
  // encoding functions
  encodingBase64Decode,
  encodingBase64Encode,
  expr,
  // files functions
  filesDelete,
  filesExists,
  filesGet,
  filesInfo,
  filesList,
  filesPut,
  geoArea,
  geoBearing,
  geoCentroid,
  geoDistance,
  geoHashDecode,
  geoHashEncode,
  geoIsValid,
  geoWithin,
  // http functions
  httpDelete,
  httpGet,
  httpHead,
  httpPatch,
  httpPost,
  httpPut,
  mathAbs,
  mathAcos,
  mathAsin,
  mathAtan,
  mathAtan2,
  mathCeil,
  mathCos,
  mathDeg,
  mathExp,
  mathFixed,
  mathFloor,
  mathLog,
  mathLog2,
  mathLog10,
  mathMax,
  mathMean,
  mathMedian,
  mathMin,
  mathProduct,
  mathRad,
  mathRandom,
  mathRound,
  mathSin,
  mathSqrt,
  mathStddev,
  mathSum,
  mathTan,
  mathTrunc,
  mathVariance,
  metaId,
  metaTable,
  metaTb,
  // not
  not,
  // object functions
  objectEntries,
  objectExtend,
  objectFromEntries,
  objectIsEmpty,
  objectKeys,
  objectLen,
  objectRemove,
  objectValues,
  // parse functions
  parseEmailHost,
  parseEmailUser,
  parseUrlDomain,
  parseUrlFragment,
  parseUrlHost,
  parseUrlPath,
  parseUrlPort,
  parseUrlQuery,
  parseUrlScheme,
  // rand functions
  rand,
  randBool,
  randEnum,
  randFloat,
  randGuid,
  randInt,
  randString,
  randUuidV4,
  randUuidV7,
  recordId,
  recordTable,
  // search functions
  searchHighlight,
  searchScore,
  // session functions
  sessionExpiry,
  sessionId,
  sessionOrigin,
  sessionSc,
  sessionToken,
  sessionUser,
  // sequence functions
  sequenceNext,
  sequencePeek,
  sequenceSet,
  // set functions
  setAdd,
  setDifference,
  setIntersect,
  setIsEmpty,
  setIsEqual,
  setLen,
  setRemove,
  setSort,
  setUnion,
  // sleep
  sleep,
  stringConcat,
  stringContains,
  stringDistance,
  stringEndsWith,
  stringHtmlEncode,
  stringHtmlSanitize,
  stringIsAlphanum,
  stringIsUrl,
  stringIsUuid,
  stringJoin,
  stringLen,
  stringLowercase,
  stringRepeat,
  stringReplace,
  stringReverse,
  stringSimilarity,
  stringSlice,
  stringSplit,
  stringStartsWith,
  stringTrim,
  stringUppercase,
  timeDay,
  timeFloor,
  timeFormat,
  timeGroup,
  timeHour,
  timeMicros,
  timeMillis,
  timeMinute,
  timeMonth,
  timeNanos,
  timeNow,
  timeRound,
  timeSecond,
  timeTimezone,
  timeUnix,
  timeWeek,
  timeWeekday,
  timeYear,
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
  // value functions
  valueArrays,
  valueBooleans,
  valueDatetimes,
  valueDecimals,
  valueDurations,
  valueFloats,
  valueInts,
  valueNumbers,
  valueObjects,
  valuePoints,
  valueStrings,
  valueTable,
  valueThing,
  // vector functions
  vectorAdd,
  vectorAngle,
  vectorCross,
  vectorDistance,
  vectorDot,
  vectorMagnitude,
  vectorMultiply,
  vectorNormalize,
  vectorSimilarity,
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
// 1. SQL Output — Verify function wrappers produce correct SurrealQL
// ============================================================================

describe('Function SQL output', () => {
  // --- count ---
  describe('count', () => {
    it('count()', () => {
      expect(count()).toBe('count()');
    });

    it('count(expr)', () => {
      expect(count($('age'))).toBe('count(age)');
    });

    it('countAll()', () => {
      expect(countAll()).toBe('count()');
    });
  });

  // --- math ---
  describe('math', () => {
    it('mathRound()', () => {
      expect(mathRound($('score'))).toBe('math::round(score)');
    });

    it('mathFloor()', () => {
      expect(mathFloor($('score'))).toBe('math::floor(score)');
    });

    it('mathCeil()', () => {
      expect(mathCeil($('score'))).toBe('math::ceil(score)');
    });

    it('mathAbs()', () => {
      expect(mathAbs($('score'))).toBe('math::abs(score)');
    });

    it('mathSqrt()', () => {
      expect(mathSqrt($('x'))).toBe('math::sqrt(x)');
    });

    it('mathSum()', () => {
      expect(mathSum($('a'), $('b'))).toBe('math::sum([a, b])');
    });

    it('mathMax()', () => {
      expect(mathMax($('a'), $('b'))).toBe('math::max([a, b])');
    });

    it('mathMin()', () => {
      expect(mathMin($('a'), $('b'))).toBe('math::min([a, b])');
    });

    it('mathMean()', () => {
      expect(mathMean($('a'), $('b'))).toBe('math::mean([a, b])');
    });

    it('mathRandom()', () => {
      expect(mathRandom()).toBe('rand()');
    });

    it('mathAcos()', () => {
      expect(mathAcos($('x'))).toBe('math::acos(x)');
    });

    it('mathAsin()', () => {
      expect(mathAsin($('x'))).toBe('math::asin(x)');
    });

    it('mathAtan()', () => {
      expect(mathAtan($('x'))).toBe('math::atan(x)');
    });

    it('mathAtan2()', () => {
      expect(mathAtan2($('y'), $('x'))).toBe('math::atan2(y, x)');
    });

    it('mathCos()', () => {
      expect(mathCos($('x'))).toBe('math::cos(x)');
    });

    it('mathSin()', () => {
      expect(mathSin($('x'))).toBe('math::sin(x)');
    });

    it('mathTan()', () => {
      expect(mathTan($('x'))).toBe('math::tan(x)');
    });

    it('mathDeg()', () => {
      expect(mathDeg($('rad'))).toBe('math::deg(rad)');
    });

    it('mathRad()', () => {
      expect(mathRad($('deg'))).toBe('math::rad(deg)');
    });

    it('mathExp()', () => {
      expect(mathExp($('x'))).toBe('math::exp(x)');
    });

    it('mathFixed()', () => {
      expect(mathFixed($('x'), $('2'))).toBe('math::fixed(x, 2)');
    });

    it('mathLog()', () => {
      expect(mathLog($('x'))).toBe('math::log(x)');
    });

    it('mathLog10()', () => {
      expect(mathLog10($('x'))).toBe('math::log10(x)');
    });

    it('mathLog2()', () => {
      expect(mathLog2($('x'))).toBe('math::log2(x)');
    });

    it('mathMedian()', () => {
      expect(mathMedian($('a'), $('b'))).toBe('math::median([a, b])');
    });

    it('mathProduct()', () => {
      expect(mathProduct($('a'), $('b'))).toBe('math::product([a, b])');
    });

    it('mathStddev()', () => {
      expect(mathStddev($('a'), $('b'))).toBe('math::stddev([a, b])');
    });

    it('mathTrunc()', () => {
      expect(mathTrunc($('x'))).toBe('math::trunc(x)');
    });

    it('mathVariance()', () => {
      expect(mathVariance($('a'), $('b'))).toBe('math::variance([a, b])');
    });
  });

  // --- string ---
  describe('string', () => {
    it('stringConcat()', () => {
      expect(stringConcat($('a'), $('b'))).toBe('string::concat(a, b)');
    });

    it('stringContains()', () => {
      expect(stringContains($('s'), $('sub'))).toBe('string::contains(s, sub)');
    });

    it('stringLowercase()', () => {
      expect(stringLowercase($('s'))).toBe('string::lowercase(s)');
    });

    it('stringUppercase()', () => {
      expect(stringUppercase($('s'))).toBe('string::uppercase(s)');
    });

    it('stringLen()', () => {
      expect(stringLen($('s'))).toBe('string::len(s)');
    });

    it('stringTrim()', () => {
      expect(stringTrim($('s'))).toBe('string::trim(s)');
    });

    it('stringStartsWith()', () => {
      expect(stringStartsWith($('s'), $('p'))).toBe('string::starts_with(s, p)');
    });

    it('stringEndsWith()', () => {
      expect(stringEndsWith($('s'), $('p'))).toBe('string::ends_with(s, p)');
    });

    it('stringJoin()', () => {
      expect(stringJoin($('a'), $('sep'))).toBe('string::join(a, sep)');
    });

    it('stringRepeat()', () => {
      expect(stringRepeat($('s'), $('n'))).toBe('string::repeat(s, n)');
    });

    it('stringReplace()', () => {
      expect(stringReplace($('s'), $('f'), $('r'))).toBe('string::replace(s, f, r)');
    });

    it('stringReverse()', () => {
      expect(stringReverse($('s'))).toBe('string::reverse(s)');
    });

    it('stringSlice() with end', () => {
      expect(stringSlice($('s'), $('1'), $('3'))).toBe('string::slice(s, 1, 3)');
    });

    it('stringSlice() without end', () => {
      expect(stringSlice($('s'), $('1'))).toBe('string::slice(s, 1)');
    });

    it('stringSplit()', () => {
      expect(stringSplit($('s'), $('d'))).toBe('string::split(s, d)');
    });

    it('stringIsEmail()', () => {
      expect(stringIsEmail($('s'))).toBe('string::is_email(s)');
    });

    it('stringIsUrl()', () => {
      expect(stringIsUrl($('s'))).toBe('string::is_url(s)');
    });

    it('stringIsUuid()', () => {
      expect(stringIsUuid($('s'))).toBe('string::is_uuid(s)');
    });

    it('stringHtmlEncode()', () => {
      expect(stringHtmlEncode($('s'))).toBe('string::html::encode(s)');
    });

    it('stringHtmlSanitize()', () => {
      expect(stringHtmlSanitize($('s'))).toBe('string::html::sanitize(s)');
    });

    it('stringDistance()', () => {
      expect(stringDistance($('a'), $('b'))).toBe('string::distance(a, b)');
    });

    it('stringSimilarity()', () => {
      expect(stringSimilarity($('a'), $('b'))).toBe('string::similarity(a, b)');
    });
  });

  // --- time ---
  describe('time', () => {
    it('timeNow()', () => {
      expect(timeNow()).toBe('time::now()');
    });

    it('timeYear()', () => {
      expect(timeYear($('d'))).toBe('time::year(d)');
    });

    it('timeMonth()', () => {
      expect(timeMonth($('d'))).toBe('time::month(d)');
    });

    it('timeDay()', () => {
      expect(timeDay($('d'))).toBe('time::day(d)');
    });

    it('timeHour()', () => {
      expect(timeHour($('d'))).toBe('time::hour(d)');
    });

    it('timeMinute()', () => {
      expect(timeMinute($('d'))).toBe('time::minute(d)');
    });

    it('timeSecond()', () => {
      expect(timeSecond($('d'))).toBe('time::second(d)');
    });

    it('timeUnix()', () => {
      expect(timeUnix($('d'))).toBe('time::unix(d)');
    });

    it('timeWeekday()', () => {
      expect(timeWeekday($('d'))).toBe('time::wday(d)');
    });

    it('timeFloor()', () => {
      expect(timeFloor($('d'), $('dur'))).toBe('time::floor(d, dur)');
    });

    it('timeFormat()', () => {
      expect(timeFormat($('d'), $('fmt'))).toBe('time::format(d, fmt)');
    });

    it('timeGroup()', () => {
      expect(timeGroup($('d'), $('dur'))).toBe('time::group(d, dur)');
    });

    it('timeMicros()', () => {
      expect(timeMicros($('d'))).toBe('time::micros(d)');
    });

    it('timeMillis()', () => {
      expect(timeMillis($('d'))).toBe('time::millis(d)');
    });

    it('timeNanos()', () => {
      expect(timeNanos($('d'))).toBe('time::nanos(d)');
    });

    it('timeRound()', () => {
      expect(timeRound($('d'), $('dur'))).toBe('time::round(d, dur)');
    });

    it('timeTimezone()', () => {
      expect(timeTimezone()).toBe('time::timezone()');
    });

    it('timeWeek()', () => {
      expect(timeWeek($('d'))).toBe('time::week(d)');
    });
  });

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
      expect(cryptoArgon2Compare($('pw'), $('hash'))).toBe('crypto::argon2::compare(pw, hash)');
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
      expect(cryptoBcryptCompare($('pw'), $('hash'))).toBe('crypto::bcrypt::compare(pw, hash)');
    });

    it('cryptoScryptGenerate()', () => {
      expect(cryptoScryptGenerate($('pw'))).toBe('crypto::scrypt::generate(pw)');
    });

    it('cryptoScryptCompare()', () => {
      expect(cryptoScryptCompare($('pw'), $('hash'))).toBe('crypto::scrypt::compare(pw, hash)');
    });

    it('cryptoPbkdf2Generate()', () => {
      expect(cryptoPbkdf2Generate($('pw'), $('key'))).toBe('crypto::pbkdf2::generate(pw, key)');
    });

    it('cryptoPbkdf2Compare()', () => {
      expect(cryptoPbkdf2Compare($('pw'), $('hash'))).toBe('crypto::pbkdf2::compare(pw, hash)');
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
      expect(geoHashEncode($('lng'), $('lat'))).toBe('geo::hash::encode(lng, lat)');
    });

    it('geoHashEncode() with len', () => {
      expect(geoHashEncode($('lng'), $('lat'), $('5'))).toBe('geo::hash::encode(lng, lat, 5)');
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

  // --- array ---
  describe('array', () => {
    it('arrayAdd()', () => {
      expect(arrayAdd($('arr'), $('val'))).toBe('array::add(arr, val)');
    });

    it('arrayAppend()', () => {
      expect(arrayAppend($('arr'), $('val'))).toBe('array::append(arr, val)');
    });

    it('arrayConcat()', () => {
      expect(arrayConcat($('arr1'), $('arr2'))).toBe('array::concat(arr1, arr2)');
    });

    it('arrayContains()', () => {
      expect(arrayContains($('arr'), $('val'))).toBe('array::contains(arr, val)');
    });

    it('arrayDifference()', () => {
      expect(arrayDifference($('arr1'), $('arr2'))).toBe('array::difference(arr1, arr2)');
    });

    it('arrayDistinct()', () => {
      expect(arrayDistinct($('arr'))).toBe('array::distinct(arr)');
    });

    it('arrayFilter()', () => {
      expect(arrayFilter($('arr'), $('predicate'))).toBe('array::filter(arr, predicate)');
    });

    it('arrayFind()', () => {
      expect(arrayFind($('arr'), $('predicate'))).toBe('array::find(arr, predicate)');
    });

    it('arrayFirst()', () => {
      expect(arrayFirst($('arr'))).toBe('array::first(arr)');
    });

    it('arrayFlatten()', () => {
      expect(arrayFlatten($('arr'))).toBe('array::flatten(arr)');
    });

    it('arrayGroup()', () => {
      expect(arrayGroup($('arr'))).toBe('array::group(arr)');
    });

    it('arrayIntersect()', () => {
      expect(arrayIntersect($('arr1'), $('arr2'))).toBe('array::intersect(arr1, arr2)');
    });

    it('arrayIsEmpty()', () => {
      expect(arrayIsEmpty($('arr'))).toBe('array::is_empty(arr)');
    });

    it('arrayJoin()', () => {
      expect(arrayJoin($('arr'), $('sep'))).toBe('array::join(arr, sep)');
    });

    it('arrayLast()', () => {
      expect(arrayLast($('arr'))).toBe('array::last(arr)');
    });

    it('arrayLen()', () => {
      expect(arrayLen($('arr'))).toBe('array::len(arr)');
    });

    it('arrayMap()', () => {
      expect(arrayMap($('arr'), $('mapper'))).toBe('array::map(arr, mapper)');
    });

    it('arrayMax()', () => {
      expect(arrayMax($('arr'))).toBe('array::max(arr)');
    });

    it('arrayMin()', () => {
      expect(arrayMin($('arr'))).toBe('array::min(arr)');
    });

    it('arrayPop()', () => {
      expect(arrayPop($('arr'))).toBe('array::pop(arr)');
    });

    it('arrayPrepend()', () => {
      expect(arrayPrepend($('arr'), $('val'))).toBe('array::prepend(arr, val)');
    });

    it('arrayPush()', () => {
      expect(arrayPush($('arr'), $('val'))).toBe('array::push(arr, val)');
    });

    it('arrayRemove()', () => {
      expect(arrayRemove($('arr'), $('val'))).toBe('array::remove(arr, val)');
    });

    it('arrayReverse()', () => {
      expect(arrayReverse($('arr'))).toBe('array::reverse(arr)');
    });

    it('arrayShuffle()', () => {
      expect(arrayShuffle($('arr'))).toBe('array::shuffle(arr)');
    });

    it('arraySlice() without end', () => {
      expect(arraySlice($('arr'), $('1'))).toBe('array::slice(arr, 1)');
    });

    it('arraySlice() with end', () => {
      expect(arraySlice($('arr'), $('1'), $('3'))).toBe('array::slice(arr, 1, 3)');
    });

    it('arraySort() without order', () => {
      expect(arraySort($('arr'))).toBe('array::sort(arr)');
    });

    it('arraySort() with order', () => {
      expect(arraySort($('arr'), $('"ASC"'))).toBe('array::sort(arr, "ASC")');
    });

    it('arrayStringJoin()', () => {
      expect(arrayStringJoin($('arr'), $('sep'))).toBe('array::string_join(arr, sep)');
    });

    it('arraySum()', () => {
      expect(arraySum($('arr'))).toBe('array::sum(arr)');
    });

    it('arrayUnion()', () => {
      expect(arrayUnion($('arr1'), $('arr2'))).toBe('array::union(arr1, arr2)');
    });

    it('arrayUnique()', () => {
      expect(arrayUnique($('arr'))).toBe('array::distinct(arr)');
    });
  });

  // --- value ---
  describe('value', () => {
    it('valueArrays()', () => {
      expect(valueArrays($('val'))).toBe('value::arrays(val)');
    });

    it('valueBooleans()', () => {
      expect(valueBooleans($('val'))).toBe('value::booleans(val)');
    });

    it('valueDatetimes()', () => {
      expect(valueDatetimes($('val'))).toBe('value::datetimes(val)');
    });

    it('valueDecimals()', () => {
      expect(valueDecimals($('val'))).toBe('value::decimals(val)');
    });

    it('valueDurations()', () => {
      expect(valueDurations($('val'))).toBe('value::durations(val)');
    });

    it('valueFloats()', () => {
      expect(valueFloats($('val'))).toBe('value::floats(val)');
    });

    it('valueInts()', () => {
      expect(valueInts($('val'))).toBe('value::ints(val)');
    });

    it('valueNumbers()', () => {
      expect(valueNumbers($('val'))).toBe('value::numbers(val)');
    });

    it('valueObjects()', () => {
      expect(valueObjects($('val'))).toBe('value::objects(val)');
    });

    it('valuePoints()', () => {
      expect(valuePoints($('val'))).toBe('value::points(val)');
    });

    it('valueStrings()', () => {
      expect(valueStrings($('val'))).toBe('value::strings(val)');
    });

    it('valueTable()', () => {
      expect(valueTable($('val'))).toBe('value::table(val)');
    });

    it('valueThing()', () => {
      expect(valueThing($('val'))).toBe('value::thing(val)');
    });
  });

  // --- parse ---
  describe('parse', () => {
    it('parseEmailHost()', () => {
      expect(parseEmailHost($('email'))).toBe('parse::email::host(email)');
    });

    it('parseEmailUser()', () => {
      expect(parseEmailUser($('email'))).toBe('parse::email::user(email)');
    });

    it('parseUrlDomain()', () => {
      expect(parseUrlDomain($('url'))).toBe('parse::url::domain(url)');
    });

    it('parseUrlFragment()', () => {
      expect(parseUrlFragment($('url'))).toBe('parse::url::fragment(url)');
    });

    it('parseUrlHost()', () => {
      expect(parseUrlHost($('url'))).toBe('parse::url::host(url)');
    });

    it('parseUrlPath()', () => {
      expect(parseUrlPath($('url'))).toBe('parse::url::path(url)');
    });

    it('parseUrlPort()', () => {
      expect(parseUrlPort($('url'))).toBe('parse::url::port(url)');
    });

    it('parseUrlQuery()', () => {
      expect(parseUrlQuery($('url'))).toBe('parse::url::query(url)');
    });

    it('parseUrlScheme()', () => {
      expect(parseUrlScheme($('url'))).toBe('parse::url::scheme(url)');
    });
  });

  // --- object ---
  describe('object', () => {
    it('objectEntries()', () => {
      expect(objectEntries($('obj'))).toBe('object::entries(obj)');
    });

    it('objectExtend()', () => {
      expect(objectExtend($('obj'), $('other'))).toBe('object::extend(obj, other)');
    });

    it('objectFromEntries()', () => {
      expect(objectFromEntries($('arr'))).toBe('object::from_entries(arr)');
    });

    it('objectIsEmpty()', () => {
      expect(objectIsEmpty($('obj'))).toBe('object::is_empty(obj)');
    });

    it('objectKeys()', () => {
      expect(objectKeys($('obj'))).toBe('object::keys(obj)');
    });

    it('objectLen()', () => {
      expect(objectLen($('obj'))).toBe('object::len(obj)');
    });

    it('objectRemove() with single key', () => {
      expect(objectRemove($('obj'), $('key'))).toBe('object::remove(obj, key)');
    });

    it('objectRemove() with multiple keys', () => {
      expect(objectRemove($('obj'), $('k1'), $('k2'))).toBe('object::remove(obj, k1, k2)');
    });

    it('objectValues()', () => {
      expect(objectValues($('obj'))).toBe('object::values(obj)');
    });
  });

  // --- set ---
  describe('set', () => {
    it('setAdd()', () => {
      expect(setAdd($('set'), $('val'))).toBe('set::add(set, val)');
    });

    it('setDifference()', () => {
      expect(setDifference($('set1'), $('set2'))).toBe('set::difference(set1, set2)');
    });

    it('setIntersect()', () => {
      expect(setIntersect($('set1'), $('set2'))).toBe('set::intersect(set1, set2)');
    });

    it('setIsEmpty()', () => {
      expect(setIsEmpty($('set'))).toBe('set::is::empty(set)');
    });

    it('setIsEqual()', () => {
      expect(setIsEqual($('set1'), $('set2'))).toBe('set::is::equal(set1, set2)');
    });

    it('setLen()', () => {
      expect(setLen($('set'))).toBe('set::len(set)');
    });

    it('setRemove()', () => {
      expect(setRemove($('set'), $('val'))).toBe('set::remove(set, val)');
    });

    it('setSort()', () => {
      expect(setSort($('set'))).toBe('set::sort(set)');
    });

    it('setUnion()', () => {
      expect(setUnion($('set1'), $('set2'))).toBe('set::union(set1, set2)');
    });
  });

  // --- vector ---
  describe('vector', () => {
    it('vectorAdd()', () => {
      expect(vectorAdd($('v1'), $('v2'))).toBe('vector::add(v1, v2)');
    });

    it('vectorAngle()', () => {
      expect(vectorAngle($('v1'), $('v2'))).toBe('vector::angle(v1, v2)');
    });

    it('vectorCross()', () => {
      expect(vectorCross($('v1'), $('v2'))).toBe('vector::cross(v1, v2)');
    });

    it('vectorDistance()', () => {
      expect(vectorDistance($('v1'), $('v2'))).toBe('vector::distance(v1, v2)');
    });

    it('vectorDot()', () => {
      expect(vectorDot($('v1'), $('v2'))).toBe('vector::dot(v1, v2)');
    });

    it('vectorMagnitude()', () => {
      expect(vectorMagnitude($('v'))).toBe('vector::magnitude(v)');
    });

    it('vectorMultiply()', () => {
      expect(vectorMultiply($('v'), $('scalar'))).toBe('vector::multiply(v, scalar)');
    });

    it('vectorNormalize()', () => {
      expect(vectorNormalize($('v'))).toBe('vector::normalize(v)');
    });

    it('vectorSimilarity()', () => {
      expect(vectorSimilarity($('v1'), $('v2'))).toBe('vector::similarity(v1, v2)');
    });
  });

  // --- session ---
  describe('session', () => {
    it('sessionExpiry()', () => {
      expect(sessionExpiry()).toBe('session::expiry()');
    });

    it('sessionId()', () => {
      expect(sessionId()).toBe('session::id()');
    });

    it('sessionOrigin()', () => {
      expect(sessionOrigin()).toBe('session::origin()');
    });

    it('sessionSc()', () => {
      expect(sessionSc()).toBe('session::sc()');
    });

    it('sessionToken()', () => {
      expect(sessionToken()).toBe('session::token()');
    });

    it('sessionUser()', () => {
      expect(sessionUser()).toBe('session::user()');
    });
  });

  // --- sequence ---
  describe('sequence', () => {
    it('sequenceNext()', () => {
      expect(sequenceNext($('seq'))).toBe('sequence::next(seq)');
    });

    it('sequencePeek()', () => {
      expect(sequencePeek($('seq'))).toBe('sequence::peek(seq)');
    });

    it('sequenceSet()', () => {
      expect(sequenceSet($('seq'), $('val'))).toBe('sequence::set(seq, val)');
    });
  });

  // --- api ---
  describe('api', () => {
    it('apiTimeout()', () => {
      expect(apiTimeout($('5s'))).toBe('api::timeout(5s)');
    });
  });

  // --- bytes ---
  describe('bytes', () => {
    it('bytesLen()', () => {
      expect(bytesLen($('data'))).toBe('bytes::len(data)');
    });

    it('bytesResize()', () => {
      expect(bytesResize($('data'), $('16'))).toBe('bytes::resize(data, 16)');
    });

    it('bytesReverse()', () => {
      expect(bytesReverse($('data'))).toBe('bytes::reverse(data)');
    });

    it('bytesToString()', () => {
      expect(bytesToString($('data'))).toBe('bytes::to_string(data)');
    });

    it('bytesXor()', () => {
      expect(bytesXor($('a'), $('b'))).toBe('bytes::xor(a, b)');
    });

    it('bytesAnd()', () => {
      expect(bytesAnd($('a'), $('b'))).toBe('bytes::and(a, b)');
    });

    it('bytesOr()', () => {
      expect(bytesOr($('a'), $('b'))).toBe('bytes::or(a, b)');
    });
  });

  // --- duration ---
  describe('duration', () => {
    it('durationDays()', () => {
      expect(durationDays($('d'))).toBe('duration::days(d)');
    });

    it('durationHours()', () => {
      expect(durationHours($('d'))).toBe('duration::hours(d)');
    });

    it('durationMicros()', () => {
      expect(durationMicros($('d'))).toBe('duration::micros(d)');
    });

    it('durationMillis()', () => {
      expect(durationMillis($('d'))).toBe('duration::millis(d)');
    });

    it('durationMins()', () => {
      expect(durationMins($('d'))).toBe('duration::mins(d)');
    });

    it('durationNanos()', () => {
      expect(durationNanos($('d'))).toBe('duration::nanos(d)');
    });

    it('durationSecs()', () => {
      expect(durationSecs($('d'))).toBe('duration::secs(d)');
    });

    it('durationWeeks()', () => {
      expect(durationWeeks($('d'))).toBe('duration::weeks(d)');
    });

    it('DURATION_MAX', () => {
      expect(DURATION_MAX).toBe('duration::max');
    });
  });

  // --- encoding ---
  describe('encoding', () => {
    it('encodingBase64Encode()', () => {
      expect(encodingBase64Encode($('data'))).toBe('encoding::base64::encode(data)');
    });

    it('encodingBase64Decode()', () => {
      expect(encodingBase64Decode($('data'))).toBe('encoding::base64::decode(data)');
    });
  });

  // --- files ---
  describe('files', () => {
    it('filesGet()', () => {
      expect(filesGet($('path'))).toBe('files::get(path)');
    });

    it('filesPut()', () => {
      expect(filesPut($('path'), $('data'))).toBe('files::put(path, data)');
    });

    it('filesList()', () => {
      expect(filesList($('path'))).toBe('files::list(path)');
    });

    it('filesDelete()', () => {
      expect(filesDelete($('path'))).toBe('files::delete(path)');
    });

    it('filesExists()', () => {
      expect(filesExists($('path'))).toBe('files::exists(path)');
    });

    it('filesInfo()', () => {
      expect(filesInfo($('path'))).toBe('files::info(path)');
    });
  });

  // --- http ---
  describe('http', () => {
    it('httpGet() without headers', () => {
      expect(httpGet($('"http://example.com"'))).toBe('http::get("http://example.com")');
    });

    it('httpGet() with headers', () => {
      expect(httpGet($('"http://example.com"'), $('{"Auth": "token"}'))).toBe(
        'http::get("http://example.com", {"Auth": "token"})',
      );
    });

    it('httpHead()', () => {
      expect(httpHead($('"http://example.com"'))).toBe('http::head("http://example.com")');
    });

    it('httpPost() without headers', () => {
      expect(httpPost($('"http://example.com"'), $('data'))).toBe(
        'http::post("http://example.com", data)',
      );
    });

    it('httpPost() with headers', () => {
      expect(httpPost($('"http://example.com"'), $('data'), $('{"Auth": "token"}'))).toBe(
        'http::post("http://example.com", data, {"Auth": "token"})',
      );
    });

    it('httpPatch()', () => {
      expect(httpPatch($('"http://example.com"'), $('data'))).toBe(
        'http::patch("http://example.com", data)',
      );
    });

    it('httpPut()', () => {
      expect(httpPut($('"http://example.com"'), $('data'))).toBe(
        'http::put("http://example.com", data)',
      );
    });

    it('httpDelete() without headers', () => {
      expect(httpDelete($('"http://example.com"'))).toBe('http::delete("http://example.com")');
    });

    it('httpDelete() with headers', () => {
      expect(httpDelete($('"http://example.com"'), $('{"Auth": "token"}'))).toBe(
        'http::delete("http://example.com", {"Auth": "token"})',
      );
    });
  });

  // --- not ---
  describe('not', () => {
    it('not()', () => {
      expect(not($('true'))).toBe('not(true)');
    });
  });

  // --- rand ---
  describe('rand', () => {
    it('rand()', () => {
      expect(rand()).toBe('rand()');
    });

    it('randBool()', () => {
      expect(randBool()).toBe('rand::bool()');
    });

    it('randEnum()', () => {
      expect(randEnum($('"a"'), $('"b"'))).toBe('rand::enum("a", "b")');
    });

    it('randFloat()', () => {
      expect(randFloat()).toBe('rand::float()');
    });

    it('randFloat(min)', () => {
      expect(randFloat($('1.0'))).toBe('rand::float(1.0)');
    });

    it('randFloat(min, max)', () => {
      expect(randFloat($('1.0'), $('10.0'))).toBe('rand::float(1.0, 10.0)');
    });

    it('randGuid()', () => {
      expect(randGuid()).toBe('rand::guid()');
    });

    it('randInt()', () => {
      expect(randInt()).toBe('rand::int()');
    });

    it('randInt(min)', () => {
      expect(randInt($('1'))).toBe('rand::int(1)');
    });

    it('randInt(min, max)', () => {
      expect(randInt($('1'), $('100'))).toBe('rand::int(1, 100)');
    });

    it('randString()', () => {
      expect(randString()).toBe('rand::string()');
    });

    it('randString(len)', () => {
      expect(randString($('16'))).toBe('rand::string(16)');
    });

    it('randUuidV4()', () => {
      expect(randUuidV4()).toBe('rand::uuid::v4()');
    });

    it('randUuidV7()', () => {
      expect(randUuidV7()).toBe('rand::uuid::v7()');
    });
  });

  // --- search ---
  describe('search', () => {
    it('searchHighlight() without fields', () => {
      expect(searchHighlight($('excerpt'))).toBe('search::highlight(excerpt)');
    });

    it('searchHighlight() with fields', () => {
      expect(searchHighlight($('excerpt'), $('"title"'))).toBe(
        'search::highlight(excerpt, "title")',
      );
    });

    it('searchScore()', () => {
      expect(searchScore($('excerpt'))).toBe('search::score(excerpt)');
    });
  });
});

// ============================================================================
// 2. End-to-End Tests — Execute functions against real SurrealDB
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
      const result = await select(orm, users).fields(as_(mathRandom(), 'r')).limit(1).execute();

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

      expect((result[0] as Record<string, unknown>).joined).toBe('Alice - alice@test.com');
    });

    it('stringContains filters records in WHERE', async () => {
      const result = await select(orm, users).where("string::contains(email, 'alice')").execute();

      expect(result).toHaveLength(1);
      expect((result[0] as Record<string, unknown>).name).toBe('Alice');
    });

    it('stringStartsWith filters records in WHERE', async () => {
      const result = await select(orm, users).where("string::starts_with(name, 'A')").execute();

      expect(result).toHaveLength(1);
      expect((result[0] as Record<string, unknown>).name).toBe('Alice');
    });

    it('stringEndsWith filters records in WHERE', async () => {
      const result = await select(orm, users).where("string::ends_with(name, 'e')").execute();

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

      expect(String((result[0] as Record<string, unknown>).joined)).toBe('dev, admin');
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
        .fields(as_(stringReplace($("'hello world'"), $("'world'"), $("'there'")), 'replaced'))
        .limit(1)
        .execute();

      expect((result[0] as Record<string, unknown>).replaced).toBe('hello there');
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
        .fields(as_(stringIsUuid($("'550e8400-e29b-41d4-a716-446655440000'")), 'is_uuid'))
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
      const result = await select(orm, users).fields(as_(timeNow(), 'now')).limit(1).execute();

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

      expect((result[0] as Record<string, unknown>).hash).toBe('5d41402abc4b2a76b9719d911017c592');
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
