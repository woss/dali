/**
 * string::* — SurrealDB string function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

// ============================================================================
// String Manipulation
// ============================================================================

export function stringConcat(...exprs: SqlExpr[]): SqlExpr {
  return `string::concat(${exprs.join(', ')})` as SqlExpr;
}

export function stringContains(str: SqlExpr, substring: SqlExpr): SqlExpr {
  return `string::contains(${str}, ${substring})` as SqlExpr;
}

export function stringEndsWith(str: SqlExpr, suffix: SqlExpr): SqlExpr {
  return `string::ends_with(${str}, ${suffix})` as SqlExpr;
}

export function stringJoin(arr: SqlExpr, separator: SqlExpr): SqlExpr {
  return `string::join(${arr}, ${separator})` as SqlExpr;
}

export function stringLen(str: SqlExpr): SqlExpr {
  return `string::len(${str})` as SqlExpr;
}

export function stringLowercase(str: SqlExpr): SqlExpr {
  return `string::lowercase(${str})` as SqlExpr;
}

export function stringMatches(str: SqlExpr, pattern: SqlExpr): SqlExpr {
  return `string::matches(${str}, ${pattern})` as SqlExpr;
}

export function stringRepeat(str: SqlExpr, n: SqlExpr): SqlExpr {
  return `string::repeat(${str}, ${n})` as SqlExpr;
}

export function stringReplace(str: SqlExpr, search: SqlExpr, replace: SqlExpr): SqlExpr {
  return `string::replace(${str}, ${search}, ${replace})` as SqlExpr;
}

export function stringReverse(str: SqlExpr): SqlExpr {
  return `string::reverse(${str})` as SqlExpr;
}

export function stringSlice(str: SqlExpr, start: SqlExpr, end?: SqlExpr): SqlExpr {
  return end
    ? (`string::slice(${str}, ${start}, ${end})` as SqlExpr)
    : (`string::slice(${str}, ${start})` as SqlExpr);
}

export function stringSlug(str: SqlExpr): SqlExpr {
  return `string::slug(${str})` as SqlExpr;
}

export function stringSplit(str: SqlExpr, separator: SqlExpr): SqlExpr {
  return `string::split(${str}, ${separator})` as SqlExpr;
}

export function stringStartsWith(str: SqlExpr, prefix: SqlExpr): SqlExpr {
  return `string::starts_with(${str}, ${prefix})` as SqlExpr;
}

export function stringSubstring(str: SqlExpr, start: SqlExpr, length?: SqlExpr): SqlExpr {
  return length
    ? (`string::substring(${str}, ${start}, ${length})` as SqlExpr)
    : (`string::substring(${str}, ${start})` as SqlExpr);
}

export function stringTrim(str: SqlExpr): SqlExpr {
  return `string::trim(${str})` as SqlExpr;
}

export function stringUppercase(str: SqlExpr): SqlExpr {
  return `string::uppercase(${str})` as SqlExpr;
}

export function stringWords(str: SqlExpr): SqlExpr {
  return `string::words(${str})` as SqlExpr;
}

export function stringWrap(str: SqlExpr, chars: SqlExpr): SqlExpr {
  return `string::wrap(${str}, ${chars})` as SqlExpr;
}

// ============================================================================
// String Validation
// ============================================================================

export function stringIsAlphanum(str: SqlExpr): SqlExpr {
  return `string::is_alphanum(${str})` as SqlExpr;
}

export function stringIsAlpha(str: SqlExpr): SqlExpr {
  return `string::is_alpha(${str})` as SqlExpr;
}

export function stringIsAscii(str: SqlExpr): SqlExpr {
  return `string::is_ascii(${str})` as SqlExpr;
}

export function stringIsDatetime(str: SqlExpr): SqlExpr {
  return `string::is_datetime(${str})` as SqlExpr;
}

export function stringIsDomain(str: SqlExpr): SqlExpr {
  return `string::is_domain(${str})` as SqlExpr;
}

export function stringIsEmail(str: SqlExpr): SqlExpr {
  return `string::is_email(${str})` as SqlExpr;
}

export function stringIsHexadecimal(str: SqlExpr): SqlExpr {
  return `string::is_hexadecimal(${str})` as SqlExpr;
}

export function stringIsIp(str: SqlExpr): SqlExpr {
  return `string::is_ip(${str})` as SqlExpr;
}

export function stringIsIpv4(str: SqlExpr): SqlExpr {
  return `string::is_ipv4(${str})` as SqlExpr;
}

export function stringIsIpv6(str: SqlExpr): SqlExpr {
  return `string::is_ipv6(${str})` as SqlExpr;
}

export function stringIsLatitude(str: SqlExpr): SqlExpr {
  return `string::is_latitude(${str})` as SqlExpr;
}

export function stringIsLongitude(str: SqlExpr): SqlExpr {
  return `string::is_longitude(${str})` as SqlExpr;
}

export function stringIsNumeric(str: SqlExpr): SqlExpr {
  return `string::is_numeric(${str})` as SqlExpr;
}

export function stringIsSemver(str: SqlExpr): SqlExpr {
  return `string::is_semver(${str})` as SqlExpr;
}

export function stringIsUrl(str: SqlExpr): SqlExpr {
  return `string::is_url(${str})` as SqlExpr;
}

export function stringIsUuid(str: SqlExpr): SqlExpr {
  return `string::is_uuid(${str})` as SqlExpr;
}

// ============================================================================
// HTML
// ============================================================================

export function stringHtmlEncode(str: SqlExpr): SqlExpr {
  return `string::html::encode(${str})` as SqlExpr;
}

export function stringHtmlSanitize(str: SqlExpr): SqlExpr {
  return `string::html::sanitize(${str})` as SqlExpr;
}

// ============================================================================
// Comparison
// ============================================================================

export function stringDistance(a: SqlExpr, b: SqlExpr): SqlExpr {
  return `string::distance(${a}, ${b})` as SqlExpr;
}

export function stringSimilarity(a: SqlExpr, b: SqlExpr): SqlExpr {
  return `string::similarity(${a}, ${b})` as SqlExpr;
}
