/**
 * type::* — SurrealDB type conversion function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function typeBool(expr: SqlExpr): SqlExpr;
export declare function typeDatetime(expr: SqlExpr): SqlExpr;
export declare function typeDecimal(expr: SqlExpr): SqlExpr;
export declare function typeDuration(expr: SqlExpr): SqlExpr;
export declare function typeFloat(expr: SqlExpr): SqlExpr;
export declare function typeInt(expr: SqlExpr): SqlExpr;
export declare function typeNumber(expr: SqlExpr): SqlExpr;
export declare function typePoint(lng: SqlExpr, lat: SqlExpr): SqlExpr;
export declare function typeString(expr: SqlExpr): SqlExpr;
export declare function typeThing(table: SqlExpr, id: SqlExpr): SqlExpr;
export declare function typeField(name: SqlExpr): SqlExpr;
export declare function typeRecord(tb: SqlExpr, id: SqlExpr): SqlExpr;
export declare function typeIsArray(val: SqlExpr): SqlExpr;
export declare function typeIsBool(val: SqlExpr): SqlExpr;
export declare function typeIsDatetime(val: SqlExpr): SqlExpr;
export declare function typeIsDecimal(val: SqlExpr): SqlExpr;
export declare function typeIsDuration(val: SqlExpr): SqlExpr;
export declare function typeIsFloat(val: SqlExpr): SqlExpr;
export declare function typeIsInt(val: SqlExpr): SqlExpr;
export declare function typeIsNumber(val: SqlExpr): SqlExpr;
export declare function typeIsObject(val: SqlExpr): SqlExpr;
export declare function typeIsPoint(val: SqlExpr): SqlExpr;
export declare function typeIsRecord(val: SqlExpr): SqlExpr;
export declare function typeIsString(val: SqlExpr): SqlExpr;
//# sourceMappingURL=type.d.ts.map