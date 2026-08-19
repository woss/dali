/**
 * geo::* — SurrealDB geo function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function geoArea(geom: SqlExpr): SqlExpr;
export declare function geoBearing(from: SqlExpr, to: SqlExpr): SqlExpr;
export declare function geoCentroid(geom: SqlExpr): SqlExpr;
export declare function geoDistance(from: SqlExpr, to: SqlExpr): SqlExpr;
export declare function geoHashDecode(hash: SqlExpr): SqlExpr;
export declare function geoHashEncode(lng: SqlExpr, lat: SqlExpr, len?: SqlExpr): SqlExpr;
export declare function geoIsValid(geom: SqlExpr): SqlExpr;
export declare function geoWithin(geom: SqlExpr, region: SqlExpr): SqlExpr;
//# sourceMappingURL=geo.d.ts.map