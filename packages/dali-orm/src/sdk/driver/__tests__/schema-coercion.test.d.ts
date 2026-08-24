/**
 * Schema-Aware Record Coercion Tests (Task 1.2)
 *
 * Tests coerceRecordIds behavior through public CRUD methods:
 * 1. Schema-aware path: only record-typed columns coerced
 * 2. Fallback path (no schema): all string values with record-like format coerced
 * 3. Table not found in schema: falls back to coerce-all behavior
 * 4. Non-record string fields with colons preserved when schema is available
 * 5. Record-typed fields coerced when schema is available
 * 6. upsertWhere passes parsed tableName (not full "table:id") to coerceRecordIds
 */
export {};
//# sourceMappingURL=schema-coercion.test.d.ts.map
