/**
 * string::* — SurrealDB string function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function stringConcat(...exprs: SqlExpr[]): SqlExpr;
export declare function stringContains(
  str: SqlExpr,
  substring: SqlExpr,
): SqlExpr;
export declare function stringEndsWith(str: SqlExpr, suffix: SqlExpr): SqlExpr;
export declare function stringJoin(arr: SqlExpr, separator: SqlExpr): SqlExpr;
export declare function stringLen(str: SqlExpr): SqlExpr;
export declare function stringLowercase(str: SqlExpr): SqlExpr;
export declare function stringMatches(str: SqlExpr, pattern: SqlExpr): SqlExpr;
export declare function stringRepeat(str: SqlExpr, n: SqlExpr): SqlExpr;
export declare function stringReplace(
  str: SqlExpr,
  search: SqlExpr,
  replace: SqlExpr,
): SqlExpr;
export declare function stringReverse(str: SqlExpr): SqlExpr;
export declare function stringSlice(
  str: SqlExpr,
  start: SqlExpr,
  end?: SqlExpr,
): SqlExpr;
export declare function stringSlug(str: SqlExpr): SqlExpr;
export declare function stringSplit(str: SqlExpr, separator: SqlExpr): SqlExpr;
export declare function stringStartsWith(
  str: SqlExpr,
  prefix: SqlExpr,
): SqlExpr;
export declare function stringSubstring(
  str: SqlExpr,
  start: SqlExpr,
  length?: SqlExpr,
): SqlExpr;
export declare function stringTrim(str: SqlExpr): SqlExpr;
export declare function stringUppercase(str: SqlExpr): SqlExpr;
export declare function stringWords(str: SqlExpr): SqlExpr;
export declare function stringWrap(str: SqlExpr, chars: SqlExpr): SqlExpr;
export declare function stringIsAlphanum(str: SqlExpr): SqlExpr;
export declare function stringIsAlpha(str: SqlExpr): SqlExpr;
export declare function stringIsAscii(str: SqlExpr): SqlExpr;
export declare function stringIsDatetime(str: SqlExpr): SqlExpr;
export declare function stringIsDomain(str: SqlExpr): SqlExpr;
export declare function stringIsEmail(str: SqlExpr): SqlExpr;
export declare function stringIsHexadecimal(str: SqlExpr): SqlExpr;
export declare function stringIsIp(str: SqlExpr): SqlExpr;
export declare function stringIsIpv4(str: SqlExpr): SqlExpr;
export declare function stringIsIpv6(str: SqlExpr): SqlExpr;
export declare function stringIsLatitude(str: SqlExpr): SqlExpr;
export declare function stringIsLongitude(str: SqlExpr): SqlExpr;
export declare function stringIsNumeric(str: SqlExpr): SqlExpr;
export declare function stringIsSemver(str: SqlExpr): SqlExpr;
export declare function stringIsUrl(str: SqlExpr): SqlExpr;
export declare function stringIsUuid(str: SqlExpr): SqlExpr;
export declare function stringHtmlEncode(str: SqlExpr): SqlExpr;
export declare function stringHtmlSanitize(str: SqlExpr): SqlExpr;
export declare function stringDistance(a: SqlExpr, b: SqlExpr): SqlExpr;
export declare function stringSimilarity(a: SqlExpr, b: SqlExpr): SqlExpr;
//# sourceMappingURL=string.d.ts.map
