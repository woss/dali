/**
 * geo::* — SurrealDB geo function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */

import type { SqlExpr } from './sql.js';

export function geoArea(geom: SqlExpr): SqlExpr {
  return `geo::area(${geom})` as SqlExpr;
}

export function geoBearing(from: SqlExpr, to: SqlExpr): SqlExpr {
  return `geo::bearing(${from}, ${to})` as SqlExpr;
}

export function geoCentroid(geom: SqlExpr): SqlExpr {
  return `geo::centroid(${geom})` as SqlExpr;
}

export function geoDistance(from: SqlExpr, to: SqlExpr): SqlExpr {
  return `geo::distance(${from}, ${to})` as SqlExpr;
}

export function geoHashDecode(hash: SqlExpr): SqlExpr {
  return `geo::hash::decode(${hash})` as SqlExpr;
}

export function geoHashEncode(lng: SqlExpr, lat: SqlExpr, len?: SqlExpr): SqlExpr {
  return len
    ? (`geo::hash::encode(${lng}, ${lat}, ${len})` as SqlExpr)
    : (`geo::hash::encode(${lng}, ${lat})` as SqlExpr);
}

export function geoIsValid(geom: SqlExpr): SqlExpr {
  return `geo::is::valid(${geom})` as SqlExpr;
}

export function geoWithin(geom: SqlExpr, region: SqlExpr): SqlExpr {
  return `geo::within(${geom}, ${region})` as SqlExpr;
}
