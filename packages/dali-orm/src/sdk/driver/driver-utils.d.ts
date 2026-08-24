/**
 * Driver Utilities
 *
 * Pure functions extracted from BaseDriver for parsing and transforming data.
 * No class dependencies — all functions are module-level.
 */
import { RecordId } from 'surrealdb';
export declare function parseTableWithId(table: string): {
  tableName: string;
  recordId: string | undefined;
};
export declare function isDatetimeField(key: string): boolean;
export declare function transformDatetimeValues(obj: unknown): unknown;
export declare function coerceRecordIds(
  tableName: string,
  input: unknown,
  schema?: {
    getTable: (name: string) =>
      | {
          $columns?: Record<
            string,
            {
              config: {
                recordTable?: string;
              };
            }
          >;
        }
      | undefined;
  },
): unknown;
export declare function tryCoerceRecordId(value: unknown): unknown;
export declare function recordIdFromString(value: string): RecordId | string;
export declare function isPlainObject(
  value: unknown,
): value is Record<string, unknown>;
export declare function tryCreateDateTime(value: unknown): unknown;
//# sourceMappingURL=driver-utils.d.ts.map
