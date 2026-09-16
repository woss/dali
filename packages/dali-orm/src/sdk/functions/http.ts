/**
 * http::* — SurrealDB HTTP function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function httpGet(url: SqlExpr, headers?: SqlExpr): SqlExpr {
  return headers !== undefined
    ? (`http::get(${url}, ${headers})` as SqlExpr)
    : (`http::get(${url})` as SqlExpr);
}

export function httpHead(url: SqlExpr, headers?: SqlExpr): SqlExpr {
  return headers !== undefined
    ? (`http::head(${url}, ${headers})` as SqlExpr)
    : (`http::head(${url})` as SqlExpr);
}

export function httpPatch(
  url: SqlExpr,
  data: SqlExpr,
  headers?: SqlExpr,
): SqlExpr {
  return headers !== undefined
    ? (`http::patch(${url}, ${data}, ${headers})` as SqlExpr)
    : (`http::patch(${url}, ${data})` as SqlExpr);
}

export function httpPost(
  url: SqlExpr,
  data: SqlExpr,
  headers?: SqlExpr,
): SqlExpr {
  return headers !== undefined
    ? (`http::post(${url}, ${data}, ${headers})` as SqlExpr)
    : (`http::post(${url}, ${data})` as SqlExpr);
}

export function httpPut(
  url: SqlExpr,
  data: SqlExpr,
  headers?: SqlExpr,
): SqlExpr {
  return headers !== undefined
    ? (`http::put(${url}, ${data}, ${headers})` as SqlExpr)
    : (`http::put(${url}, ${data})` as SqlExpr);
}

export function httpDelete(url: SqlExpr, headers?: SqlExpr): SqlExpr {
  return headers !== undefined
    ? (`http::delete(${url}, ${headers})` as SqlExpr)
    : (`http::delete(${url})` as SqlExpr);
}
