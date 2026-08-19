/**
 * time::* — SurrealDB time/date function wrappers.
 *
 * Naming follows SurrealDB docs with JS-friendly camelCase prefix.
 * All functions return SqlExpr for composition.
 */
import type { SqlExpr } from './sql.js';
export declare function timeNow(): SqlExpr;
export declare function timeDay(date: SqlExpr): SqlExpr;
export declare function timeFloor(date: SqlExpr, duration: SqlExpr): SqlExpr;
export declare function timeFormat(date: SqlExpr, format: SqlExpr): SqlExpr;
export declare function timeGroup(date: SqlExpr, duration: SqlExpr): SqlExpr;
export declare function timeHour(date: SqlExpr): SqlExpr;
export declare function timeMicros(date: SqlExpr): SqlExpr;
export declare function timeMillis(date: SqlExpr): SqlExpr;
export declare function timeMinute(date: SqlExpr): SqlExpr;
export declare function timeMonth(date: SqlExpr): SqlExpr;
export declare function timeNanos(date: SqlExpr): SqlExpr;
export declare function timeRound(date: SqlExpr, duration: SqlExpr): SqlExpr;
export declare function timeSecond(date: SqlExpr): SqlExpr;
export declare function timeTimezone(): SqlExpr;
export declare function timeUnix(date: SqlExpr): SqlExpr;
export declare function timeWeekday(date: SqlExpr): SqlExpr;
export declare function timeWeek(date: SqlExpr): SqlExpr;
export declare function timeYear(date: SqlExpr): SqlExpr;
//# sourceMappingURL=time.d.ts.map