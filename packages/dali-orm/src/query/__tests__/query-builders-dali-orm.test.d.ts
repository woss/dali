/**
 * Tests: All query builders accept DaliORM instead of raw SurrealDriver
 *
 * Verifies every builder (Select, Insert, Update, Delete, Create, Upsert,
 * Relate, Live) accepts a DaliORM instance in its constructor and internally
 * calls orm.getDriver() to obtain the underlying SurrealDriver.
 *
 * Also verifies factory functions (select, insert, update, delete_, create,
 * upsert, relate, live) and bindTable() methods accept DaliORM.
 *
 * Unit tests — no DB connection required.
 */
export {};
//# sourceMappingURL=query-builders-dali-orm.test.d.ts.map