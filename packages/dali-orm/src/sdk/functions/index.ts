/**
 * SurrealDB Function Wrappers — Public API
 *
 * Pure function wrappers for SurrealDB's built-in functions.
 * All functions return SqlExpr for composition in query builders.
 */

// API
export { apiTimeout } from './api.js';
// Array
export {
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
} from './array.js';
// Bytes
export {
  bytesAnd,
  bytesLen,
  bytesOr,
  bytesResize,
  bytesReverse,
  bytesToString,
  bytesXor,
} from './bytes.js';
// Count
export { count, countAll } from './count.js';
// Crypto
export {
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
} from './crypto.js';
// Duration
export {
  durationDays,
  durationHours,
  durationMicros,
  durationMillis,
  durationMins,
  durationNanos,
  durationSecs,
  durationWeeks,
  DURATION_MAX,
} from './duration.js';
// Encoding
export { encodingBase64Decode, encodingBase64Encode } from './encoding.js';
// Files
export { filesDelete, filesExists, filesGet, filesInfo, filesList, filesPut } from './files.js';
// Geo
export {
  geoArea,
  geoBearing,
  geoCentroid,
  geoDistance,
  geoHashDecode,
  geoHashEncode,
  geoIsValid,
  geoWithin,
} from './geo.js';
// Http
export { httpDelete, httpGet, httpHead, httpPatch, httpPost, httpPut } from './http.js';
// Math
export {
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
} from './math.js';
// Meta
export { metaId, metaTable, metaTb } from './meta.js';
// ML
export { mlPredict, mlTrain } from './ml.js';
// Not
export { not } from './not.js';
// Object
export {
  objectEntries,
  objectExtend,
  objectFromEntries,
  objectIsEmpty,
  objectKeys,
  objectLen,
  objectRemove,
  objectValues,
} from './object.js';
// Parse
export {
  parseEmailHost,
  parseEmailUser,
  parseUrlDomain,
  parseUrlFragment,
  parseUrlHost,
  parseUrlPath,
  parseUrlPort,
  parseUrlQuery,
  parseUrlScheme,
} from './parse.js';
// Rand
export {
  rand,
  randBool,
  randEnum,
  randFloat,
  randGuid,
  randInt,
  randString,
  randUuidV4,
  randUuidV7,
} from './rand.js';
// Record
export { recordId, recordTable } from './record.js';
// Search
export { searchHighlight, searchScore } from './search.js';
// Session
export {
  sessionExpiry,
  sessionId,
  sessionOrigin,
  sessionSc,
  sessionToken,
  sessionUser,
} from './session.js';
// Sequence
export { sequenceNext, sequencePeek, sequenceSet } from './sequence.js';
// Set
export {
  setAdd,
  setDifference,
  setIntersect,
  setIsEmpty,
  setIsEqual,
  setLen,
  setRemove,
  setSort,
  setUnion,
} from './set.js';
// Sleep
export { sleep } from './sleep.js';
export { $, as_, col, expr, type SqlExpr } from './sql.js';
// String
export {
  stringConcat,
  stringContains,
  stringDistance,
  stringEndsWith,
  stringHtmlEncode,
  stringHtmlSanitize,
  stringIsAlpha,
  stringIsAlphanum,
  stringIsAscii,
  stringIsDatetime,
  stringIsDomain,
  stringIsEmail,
  stringIsHexadecimal,
  stringIsIp,
  stringIsIpv4,
  stringIsIpv6,
  stringIsLatitude,
  stringIsLongitude,
  stringIsNumeric,
  stringIsSemver,
  stringIsUrl,
  stringIsUuid,
  stringJoin,
  stringLen,
  stringLowercase,
  stringMatches,
  stringRepeat,
  stringReplace,
  stringReverse,
  stringSimilarity,
  stringSlice,
  stringSlug,
  stringSplit,
  stringStartsWith,
  stringSubstring,
  stringTrim,
  stringUppercase,
  stringWords,
  stringWrap,
} from './string.js';
// Time
export {
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
} from './time.js';
// Type
export {
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
} from './type.js';

// Value
export {
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
} from './value.js';
// Vector
export {
  vectorAdd,
  vectorAngle,
  vectorCross,
  vectorDistance,
  vectorDot,
  vectorMagnitude,
  vectorMultiply,
  vectorNormalize,
  vectorSimilarity,
} from './vector.js';
