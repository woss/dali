/**
 * Normalize a SurrealDB record ID string to colon-qualified format (`tableName:key`).
 *
 * SurrealDB record IDs have two string representations:
 * - Colon-qualified: `memories:abc123` (SurrealQL syntax)
 * - Angle-bracket: `memories⟨abc123⟩` (`RecordId.toString()` format)
 *
 * This function extracts the key portion and re-qualifies it with the
 * provided `tableName`, always using the parameter's table name regardless
 * of any prefix embedded in `recordId`.
 *
 * @param recordId - The record ID string to normalize (colon-qualified, angle-bracket, or bare key)
 * @param tableName - The target table name to use in the output
 * @returns Colon-qualified record ID in the format `tableName:key`
 * @throws {Error} If `recordId` or `tableName` is empty/missing, or if `recordId` contains an angle-bracket character `<` that isn't the proper `⟨`
 */
export declare function resolveRecordId(recordId: string, tableName: string): string;
//# sourceMappingURL=record-id.d.ts.map