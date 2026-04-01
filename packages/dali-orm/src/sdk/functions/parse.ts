/**
 * parse::* — SurrealDB parse function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function parseEmailHost(email: SqlExpr): SqlExpr {
  return `parse::email::host(${email})` as SqlExpr;
}

export function parseEmailUser(email: SqlExpr): SqlExpr {
  return `parse::email::user(${email})` as SqlExpr;
}

export function parseUrlDomain(url: SqlExpr): SqlExpr {
  return `parse::url::domain(${url})` as SqlExpr;
}

export function parseUrlFragment(url: SqlExpr): SqlExpr {
  return `parse::url::fragment(${url})` as SqlExpr;
}

export function parseUrlHost(url: SqlExpr): SqlExpr {
  return `parse::url::host(${url})` as SqlExpr;
}

export function parseUrlPath(url: SqlExpr): SqlExpr {
  return `parse::url::path(${url})` as SqlExpr;
}

export function parseUrlPort(url: SqlExpr): SqlExpr {
  return `parse::url::port(${url})` as SqlExpr;
}

export function parseUrlQuery(url: SqlExpr): SqlExpr {
  return `parse::url::query(${url})` as SqlExpr;
}

export function parseUrlScheme(url: SqlExpr): SqlExpr {
  return `parse::url::scheme(${url})` as SqlExpr;
}
