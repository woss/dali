/**
 * SurrealDB Function Wrappers — Public API
 *
 * Pure function wrappers for SurrealDB's built-in functions.
 * All functions return SqlExpr for composition in query builders.
 */
export { apiTimeout } from './api.js';
export { arrayAdd, arrayAppend, arrayConcat, arrayContains, arrayDifference, arrayDistinct, arrayFilter, arrayFind, arrayFirst, arrayFlatten, arrayGroup, arrayIntersect, arrayIsEmpty, arrayJoin, arrayLast, arrayLen, arrayMap, arrayMax, arrayMin, arrayPop, arrayPrepend, arrayPush, arrayRemove, arrayReverse, arrayShuffle, arraySlice, arraySort, arrayStringJoin, arraySum, arrayUnion, arrayUnique, } from './array.js';
export { bytesAnd, bytesLen, bytesOr, bytesResize, bytesReverse, bytesToString, bytesXor, } from './bytes.js';
export { count, countAll } from './count.js';
export { cryptoArgon2Compare, cryptoArgon2Generate, cryptoBcryptCompare, cryptoBcryptGenerate, cryptoBlake3, cryptoJoaat, cryptoMd5, cryptoPbkdf2Compare, cryptoPbkdf2Generate, cryptoScryptCompare, cryptoScryptGenerate, cryptoSha1, cryptoSha256, cryptoSha512, cryptoUuidV4, cryptoUuidV7, } from './crypto.js';
export { durationDays, durationHours, durationMicros, durationMillis, durationMins, durationNanos, durationSecs, durationWeeks, DURATION_MAX, } from './duration.js';
export { encodingBase64Decode, encodingBase64Encode } from './encoding.js';
export { filesDelete, filesExists, filesGet, filesInfo, filesList, filesPut } from './files.js';
export { geoArea, geoBearing, geoCentroid, geoDistance, geoHashDecode, geoHashEncode, geoIsValid, geoWithin, } from './geo.js';
export { httpDelete, httpGet, httpHead, httpPatch, httpPost, httpPut } from './http.js';
export { mathAbs, mathAcos, mathAsin, mathAtan, mathAtan2, mathCeil, mathCos, mathDeg, mathExp, mathFixed, mathFloor, mathLog, mathLog2, mathLog10, mathMax, mathMean, mathMedian, mathMin, mathProduct, mathRad, mathRandom, mathRound, mathSin, mathSqrt, mathStddev, mathSum, mathTan, mathTrunc, mathVariance, } from './math.js';
export { metaId, metaTable, metaTb } from './meta.js';
export { mlPredict, mlTrain } from './ml.js';
export { not } from './not.js';
export { objectEntries, objectExtend, objectFromEntries, objectIsEmpty, objectKeys, objectLen, objectRemove, objectValues, } from './object.js';
export { parseEmailHost, parseEmailUser, parseUrlDomain, parseUrlFragment, parseUrlHost, parseUrlPath, parseUrlPort, parseUrlQuery, parseUrlScheme, } from './parse.js';
export { rand, randBool, randEnum, randFloat, randGuid, randInt, randString, randUuidV4, randUuidV7, } from './rand.js';
export { recordId, recordTable } from './record.js';
export { searchHighlight, searchScore } from './search.js';
export { sessionExpiry, sessionId, sessionOrigin, sessionSc, sessionToken, sessionUser, } from './session.js';
export { sequenceNext, sequencePeek, sequenceSet } from './sequence.js';
export { setAdd, setDifference, setIntersect, setIsEmpty, setIsEqual, setLen, setRemove, setSort, setUnion, } from './set.js';
export { sleep } from './sleep.js';
export { $, as_, col, expr, type SqlExpr } from './sql.js';
export { stringConcat, stringContains, stringDistance, stringEndsWith, stringHtmlEncode, stringHtmlSanitize, stringIsAlpha, stringIsAlphanum, stringIsAscii, stringIsDatetime, stringIsDomain, stringIsEmail, stringIsHexadecimal, stringIsIp, stringIsIpv4, stringIsIpv6, stringIsLatitude, stringIsLongitude, stringIsNumeric, stringIsSemver, stringIsUrl, stringIsUuid, stringJoin, stringLen, stringLowercase, stringMatches, stringRepeat, stringReplace, stringReverse, stringSimilarity, stringSlice, stringSlug, stringSplit, stringStartsWith, stringSubstring, stringTrim, stringUppercase, stringWords, stringWrap, } from './string.js';
export { timeDay, timeFloor, timeFormat, timeGroup, timeHour, timeMicros, timeMillis, timeMinute, timeMonth, timeNanos, timeNow, timeRound, timeSecond, timeTimezone, timeUnix, timeWeek, timeWeekday, timeYear, } from './time.js';
export { typeBool, typeDatetime, typeDecimal, typeDuration, typeField, typeFloat, typeInt, typeIsArray, typeIsBool, typeIsDatetime, typeIsDecimal, typeIsDuration, typeIsFloat, typeIsInt, typeIsNumber, typeIsObject, typeIsPoint, typeIsRecord, typeIsString, typeNumber, typePoint, typeRecord, typeString, typeThing, } from './type.js';
export { valueArrays, valueBooleans, valueDatetimes, valueDecimals, valueDurations, valueFloats, valueInts, valueNumbers, valueObjects, valuePoints, valueStrings, valueTable, valueThing, } from './value.js';
export { vectorAdd, vectorAngle, vectorCross, vectorDistance, vectorDot, vectorMagnitude, vectorMultiply, vectorNormalize, vectorSimilarity, } from './vector.js';
//# sourceMappingURL=index.d.ts.map