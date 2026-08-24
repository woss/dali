/**
 * SQL output tests for array, value, parse, object, set, vector, session, sequence, api,
 * bytes, duration, encoding, files, ml, http, not, rand, and search namespaces.
 *
 * Pure string output — no DB needed.
 */

import { describe, expect, it } from 'vitest';
import {
  $,
  apiTimeout,
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
  bytesAnd,
  bytesLen,
  bytesOr,
  bytesResize,
  bytesReverse,
  bytesToString,
  bytesXor,
  DURATION_MAX,
  durationDays,
  durationHours,
  durationMicros,
  durationMillis,
  durationMins,
  durationNanos,
  durationSecs,
  durationWeeks,
  encodingBase64Decode,
  encodingBase64Encode,
  filesDelete,
  filesExists,
  filesGet,
  filesInfo,
  filesList,
  filesPut,
  httpDelete,
  httpGet,
  httpHead,
  httpPatch,
  httpPost,
  httpPut,
  mlPredict,
  mlTrain,
  not,
  objectEntries,
  objectExtend,
  objectFromEntries,
  objectIsEmpty,
  objectKeys,
  objectLen,
  objectRemove,
  objectValues,
  parseEmailHost,
  parseEmailUser,
  parseUrlDomain,
  parseUrlFragment,
  parseUrlHost,
  parseUrlPath,
  parseUrlPort,
  parseUrlQuery,
  parseUrlScheme,
  rand,
  randBool,
  randEnum,
  randFloat,
  randGuid,
  randInt,
  randString,
  randUuidV4,
  randUuidV7,
  searchHighlight,
  searchScore,
  sequenceNext,
  sequencePeek,
  sequenceSet,
  setAdd,
  setDifference,
  setIntersect,
  setIsEmpty,
  setIsEqual,
  setLen,
  setRemove,
  setSort,
  setUnion,
  sessionExpiry,
  sessionId,
  sessionOrigin,
  sessionSc,
  sessionToken,
  sessionUser,
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
    expect(filesGet($('path'))).toBe('file::get(path)');
  });

  it('filesPut()', () => {
    expect(filesPut($('path'), $('data'))).toBe('file::put(path, data)');
  });

  it('filesList()', () => {
    expect(filesList($('path'))).toBe('file::list(path)');
  });

  it('filesDelete()', () => {
    expect(filesDelete($('path'))).toBe('file::delete(path)');
  });

  it('filesExists()', () => {
    expect(filesExists($('path'))).toBe('file::exists(path)');
  });

  it('filesInfo()', () => {
    expect(filesInfo($('path'))).toBe('file::info(path)');
  });
});

// --- ml ---
describe('ml', () => {
  it('mlPredict()', () => {
    expect(mlPredict($('model'), $('input'))).toBe('ml::predict(model, input)');
  });

  it('mlTrain()', () => {
    expect(mlTrain($('model'), $('type'), $('input'))).toBe('ml::train(model, type, input)');
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
    expect(searchHighlight($('excerpt'), $('"title"'))).toBe('search::highlight(excerpt, "title")');
  });

  it('searchScore()', () => {
    expect(searchScore($('excerpt'))).toBe('search::score(excerpt)');
  });
});
