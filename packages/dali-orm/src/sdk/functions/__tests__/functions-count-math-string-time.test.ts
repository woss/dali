/**
 * SQL output tests for count, math, string, and time function namespaces.
 *
 * Pure string output — no DB needed.
 */

import { describe, expect, it } from 'vite-plus/test';
import {
  $,
  count,
  countAll,
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
  stringConcat,
  stringContains,
  stringDistance,
  stringEndsWith,
  stringHtmlEncode,
  stringHtmlSanitize,
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
} from '../index.js';
import { stringIsEmail } from '../string.js';

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
