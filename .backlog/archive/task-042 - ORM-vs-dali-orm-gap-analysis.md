---
id: TASK-042
title: ORM-vs-dali-orm-gap-analysis
status: Done
assignee: []
created_date: '2026-05-13'
updated_date: '2026-05-14 16:03'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Scope: column builders, table definitions, schema constructs, type inference, runtime validation, OrmSchema containers — packages/orm/ vs packages/dali-orm/.

## ALREADY MIGRATED (dali-orm equivalent exists)

### Column Builders (identical)

- types.ts — IDENTICAL (ColumnConfig, ColumnDefinition, SurrealColumnType, ElementConfig, TupleArrayAssert)
- base.ts — Near identical; dali-orm adds optional columnName param to build()
- Per-type: string, int, float, bool, datetime, duration, decimal, array, object, geometry, bytes, record, tuple — same
- dali-orm adds simple-builders.ts: createBuilder() factory returns plain objects, cleaner
- dali-orm index.ts exports from simple-builders; class files kept for backward compat

### Table Definitions

- Both: defineTable, defineRelationTable, TableConfig, TableDefinition, IndexDefinition, TablePermissions
- dali-orm: 119 lines (leaner). No runtime proxy wrapping.
- orm: 301 lines (heavier). SurrealTableInstance class, proxy via TableAliasProxyHandler

### Schema-level Config

- Both: AccessConfig, generateSignup/signin helpers, accessToSQL
- dali-orm has MORE: EventConfig, FunctionConfig, eventToSQL, functionToSQL

### Query Builders

- dali-orm full set: select, insert, update, delete\_, create, upsert, relate, live — type-safe with TableDefinition
- ColumnRef branded types + SerializedCondition pattern
- Graph traversal, live queries

### Conditions

- dali-orm: buildCondition(), isNull(), isNotNull(), allConditions(), anyConditions(), SerializedCondition

### Type Inference

- dali-orm: InferSelectResult, InferInsertInput, InferUpdateInput, InferTypedRecord, ColumnRef, recordId()
- dali-orm: InferRelateInput/Result, WithGraphAliases, isRelationTable()

### Functions

- dali-orm: full wrappers (math, string, vector, crypto, geo). orm: none

## MISSING FROM dali-orm (exists in orm)

### 1. Schema Proxy System (HIGH)

- SurrealTable, SurrealColumn, TableAliasProxyHandler
- table.columnName syntax → SurrealColumn.toSQL() → "tableName.columnName"

### 2. ORM-Style Conditions (MEDIUM, depends on proxy)

- eq/ne/gt/gte/lt/lte/contains with SurrealColumn or string
- Returns SDK Expr, uses SurrealColumn.toSQL()

### 3. QueryBuilder Class (MEDIUM)

- type-safe orderBy/groupBy/fields/limit/start with SurrealColumn

### 4. Standalone Query Builders (LOW — superseded)

- dali-orm builders better

### 5. TypeMap + Type Inference (MEDIUM)

- TypeMap, InferTableModel, InferCreateModel, InferUpdateModel
- InsertValues, SQL type alias

### 6. Schema-to-Valibot Converter (HIGH — unique)

- schemaToValibot(table) → valibot object schema
- validate(table, data) convenience

### 7. Driver Error Classes (MEDIUM)

- AuthenticationError, InvalidCredentialsError, ConnectionError

### 8-10: test utils, auth validation, timestamp (LOW — internal/trivial)

## dali-orm UNIQUE FEATURES (not in orm)

ColumnRef branded types, recordId(), defineAccess/Event/Function builders, graph traversal, live queries, function wrappers, migration CLI+core, InferRelateInput/Result, SerializedCondition, Map-based OrmSchema

## GAP SUMMARY

High: schema proxy, schema-to-valibot, TypeMap
Medium: ORM conditions, QueryBuilder, driver errors
Low: standalone builders, timestamp, test utils, auth validation

<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Analysis task — findings only. Next agent creates tasks from gaps below.

## Implementation Queue

### 1. MAJOR — SurrealORM Class Migration

Source: packages/orm/src/driver/orm.ts (1505 lines) — SurrealORM + TransactionORM
Target: packages/dali-orm/src/sdk/

**Decision: Merge INTO DaliORM or keep separate?**
RECOMMEND: Merge features into DaliORM, keep class thin. DaliORM currently 167 lines. SurrealORM 1505 lines. Move large subsystems (REST API, sessions, import/export) to separate files, import into DaliORM.

**Exact interface signatures to implement:**

```typescript
// ===== Static Methods =====
static from(client: Surreal, config?: {
  sqlFallback?: boolean;
  transactionStrictMode?: boolean;
  schemas?: Record<string, TableDefinition>;
  validateOutputs?: boolean;
  codecOptions?: CodecOptions;
  reconnect?: boolean | ReconnectOptions;
  enableApi?: boolean;
  apiPrefix?: string;
  openApi?: boolean;
}): DaliORM

// ===== Auth (missing from DaliORM) =====
signin(credentials: { access: string; variables: Record<string, string> }): Promise<Record<string, unknown>>
signup(credentials: { access: string; variables: Record<string, string> }): Promise<Record<string, unknown>>
authenticate(token: string | { access: string; refresh?: string }): Promise<Record<string, unknown>>
auth(): Promise<Record<string, unknown> | null>

// ===== Sessions (missing from DaliORM) =====
sessions(): Promise<unknown[]>
newSession(): Promise<DaliORM>  // Returns new DaliORM scoped to new session
forkSession(): Promise<DaliORM>  // Returns forked DaliORM
closeSession(): Promise<void>

// ===== Import/Export (missing from DaliORM) =====
export(options?: { namespace?: boolean; database?: boolean; users?: boolean; schema?: boolean; data?: boolean }): Promise<string>
import(sql: string): Promise<void>

// ===== Health & Info (missing from DaliORM) =====
health(): Promise<void>
version(): Promise<{ version: string }>

// ===== Database Functions (missing from DaliORM) =====
run<T>(name: string, args?: unknown[]): Promise<T>

// ===== Events (missing from DaliORM) =====
subscribe(event: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error', callback: (...args: unknown[]) => void): () => void

// ===== Feature Detection (missing from DaliORM) =====
isFeatureSupported(feature: string): boolean

// ===== Session Variables (missing from DaliORM) =====
set(key: string, value: unknown): Promise<void>
unset(key: string): Promise<void>

// ===== Invalidation (missing from DaliORM) =====
invalidate(): Promise<void>

// ===== Live Queries — DaliORM partially has via live.ts query builder =====
live<T>(table: string, callback?: (data: { action: string; data: T }) => void):  // Returns SDK live query handle
liveOf(id: Uuid):  // Subscribe to existing live query by ID
kill(subscriptionId: string | object): Promise<void>

// ===== REST API (missing from DaliORM) =====
enableApi: boolean (config option)
apiPrefix: string (config option, default '/api')
openApi: boolean (config option)
getApiRoutes(): ApiRoute[]
handleApiRequest(method: 'GET'|'POST'|'PUT'|'DELETE', path: string, body?: unknown, params?: Record<string, string>): Promise<{ status: number; data: unknown }>
generateOpenApiSpec(): Record<string, unknown> | null

// ===== Validation (missing from DaliORM) =====
validateOutputs: boolean (config option)
schemas?: Record<string, TableDefinition> (config option for validation)

// ===== SQL Fallback =====
sqlFallback?: boolean (config option)
transactionStrictMode?: boolean (config option)

// ===== Config Loading — DaliORM has partial =====
// Already: packages/dali-orm/src/sdk/driver/config/loader.ts, schema.ts, types.ts
// Need: Auto-discover from CWD/home when config:true, path when config:string

// ===== Additional Modules =====
// Export map additions needed for new modules:
// "./sdk/dali-orm" — already exists, enrich
// "./sdk/session" — new, for newSession/forkSession/closeSession
// "./sdk/rest-api" — new, for handleApiRequest/generateOpenApiSpec/getApiRoutes
// "./sdk/validation" — new, for validateOutputs
// "./sdk/export" — new, for export()/import()
```

**TransactionORM — needs ReturnOption support:**
Source: packages/orm/src/driver/orm.ts lines 1352-1504
Target: packages/dali-orm/src/sdk/dali-orm.ts (merge into DaliORMTransaction)

### 2. HIGH — Schema Proxy System

Source: packages/orm/src/schema/proxy/

- index.ts (69 lines): SurrealColumn class (toSQL(), table/name/type getters), SurrealTable abstract base class ($inferSelect/$inferInsert), ColumnSymbol
- table-with-columns.ts (70 lines): BuildTableColumns type, SurrealTableWithColumns type (typed columns as properties)
- table-alias-proxy.ts (99 lines): TableAliasProxyHandler — ProxyHandler that intercepts property access to return SurrealColumn instances
- Enables: `users.name` → SurrealColumn<UsersTable, 'name', 'string'> with .toSQL() → "users.name"

Target: packages/dali-orm/src/sdk/schema/proxy/
Integration: Bridge with dali-orm's ColumnRef approach. ColumnRef provides similar column type safety but without the proxy table.column syntax.

Add export: "./sdk/schema/proxy" → "./dist/sdk/schema/proxy/index.mjs"

### 3. HIGH — Schema-to-Valibot Converter

Source: packages/orm/src/schema-to-valibot.ts (211 lines)

- 3 exports: schemaToValibot(table, options?), validate(table, data), InferOutputFromTable<T>
- Maps SurrealDB types: string→string, int→pipe(number(),integer()), datetime→pipe(union,transform), etc.
- Options purpose: 'insert'|'select'|'update' — controls id/readonly handling
- Uses valibot: array, boolean, date, instance, integer, number, object, optional, parse, pipe, string, transform, union, unknown

Target: packages/dali-orm/src/sdk/schema/schema-to-valibot.ts
Import valibot from existing dep (already in dali-orm's package.json)

Add export: "./sdk/schema/schema-to-valibot" → "./dist/sdk/schema/schema-to-valibot.mjs"

### 4. MEDIUM — Driver Interface

Source: packages/orm/src/driver/types.ts (387 lines)

- QueryResult<T> wrapper: { result: T[], status?: string, time?: string, [key: string]: unknown }
- Transaction interface with ReturnOption params: select/create/insert/update/delete/relate all accept optional ReturnOption
- SurrealDriver interface has: signin, signup, authenticate, auth, getClient(), config property

Target: packages/dali-orm/src/sdk/driver/types.ts
Current dali-orm driver types (305 lines) already have signin/signup/authenticate/auth but:

- Missing: getClient() method on SurrealDriver
- Missing: ReturnOption type
- Missing: QueryResult<T> type
- Transaction methods return T[] directly instead of QueryResult<T>

Note: orm's getClient() exposes underlying Surreal SDK client. Security/encapsulation tradeoff.

### 5. MEDIUM — ORM-Style Conditions (depends on #2)

Source: packages/orm/src/schema/conditions.ts (282 lines)

- Exports: eq, ne, gt, gte, lt, lte, contains, and, or, not, allConditions, anyConditions, isCondition, SurrealCondition
- Accepts SurrealColumn OR string, returns SDK Expr
- Uses SurrealColumn.toSQL() for table.column format
- Uses SDK Expr (from surrealdb) — already re-exported in dali-orm's query/conditions.ts

Target: packages/dali-orm/src/query/conditions.ts
Current dali-orm conditions.ts (143 lines) already re-exports SDK eq/ne/gt/etc + has SerializedCondition helpers.
ORM-style conditions add SurrealColumn → Expr wrapping. Depends on proxy system for SurrealColumn.toSQL().

### 6. MEDIUM — QueryBuilder Class

Source: packages/orm/src/schema/query.ts (327 lines)

- QueryBuilder<TTable, TSelect> immutable class
- Methods: where(condition), orderBy(column, direction), groupBy(...columns), limit(n), start(n), fields(...names), fetch(), toSQL(), toParams()
- Uses SurrealColumn for type-safe orderBy/groupBy/fields
- Uses SurrealORM (orm.query()) for execution

Target: packages/dali-orm/src/query/
Alternative: Could enhance existing dali-orm query builders (SelectBuilder already has .where()) rather than creating new QueryBuilder class.

### 7. MEDIUM — Driver Error Classes

Source: packages/orm/src/driver/errors/auth-errors.ts (63 lines)

- AuthenticationError extends Error
- InvalidCredentialsError extends AuthenticationError
- ConnectionError extends Error
- AuthValidationError extends Error
- AuthValidationErrorDetail interface

Target: packages/dali-orm/src/sdk/driver/errors/
Add export: "./sdk/driver/errors" → "./dist/sdk/driver/errors/index.mjs"

### 8. LOW — Driver Test Utilities, Auth Validation, timestamp, TypeMap

## Architectural Notes

- dali-orm uses ColumnRef branded types + SerializedCondition. Proxy system must integrate.
- OrmSchema uses Map<string, TableDefinition> for iteration safety.
- Exports via clean subpaths (dali-orm/query, dali-orm/sdk/table).
- DaliORM intentionally thin (167 lines). Don't bloat.
- Migration system already fully migrated from kit/.
- dali-orm returns T[]; orm returns QueryResult<T>. Choose one approach.
- dali-orm SurrealDriver already has signin/signup/authenticate/auth (added during migration) but not getClient()

## Existing Test Patterns

- dali-orm tests: packages/dali-orm/src/\*\*/**tests**/
- orm tests: packages/orm/src/**tests**/
- Both use Vitest
- dali-orm query tests: src/query/**tests**/query.test.ts
- dali-orm builder tests: src/sdk/**tests**/ (access-builder, event-builder, function-builder)
- orm tests: orm-class.test.ts, proxy.test.ts, conditions-integration.test.ts, query-builder.test.ts, etc.

## Export Map Changes Required

New modules need entries in packages/dali-orm/package.json exports:

- ./sdk/schema/proxy
- ./sdk/schema/schema-to-valibot
- ./sdk/session
- ./sdk/rest-api
- ./sdk/validation
- ./sdk/export
- ./sdk/driver/errors

## KIT vs dali-orm — Fully Migrated, No Gaps

### Source: packages/kit/ — Migration System (CLI + DDL + Runner + Journal)

Target: packages/dali-orm/src/migration/

**Conclusion: kit fully migrated into dali-orm with enhancements.** No gaps found.

### What dali-orm has that kit doesn't (enhancements):

1. Shadow DB pre-validation — core/shadow.ts (connectToShadow, validateWithShadow, destroyShadow)
2. SDK↔DDL type conversion — ddl/convert.ts (toSurrealColumn/Table/Access/Event/Function & reverse)
3. Programmatic migration API — api.ts (migrateToDatabase, rollbackMigrations, getMigrationStatus, generateAndApplyMigration, pullAndMigrate, pushSchemaFromTableDefs)
4. Dev/deploy migration commands — migration/cli/migrate.ts (migrateDev, migrateDeploy)
5. Events + Functions in DDL — ddl/ddl.ts: SurrealDbDDL.events, .lives, .views, .access, .accessStructured, .functions. 19 statement types vs kit's 13.
6. Enhanced snapshot — migration/core/snapshot.ts: SerializedEvent, SerializedFunction
7. Format utilities — migration/utils/format.ts (formatDefaultValue, normalizeDefault, isNowVariant, validateChangefeed)
8. Shadow DB config — migration/config.ts supports shadow ns/db

### What kit has that dali-orm doesn't (not real gaps):

- Test mock factories (src/**tests**/fixtures.ts) — internal testing, dali-orm has own tests
- Generated example schema (schema/schema.ts) — trivial, user-generated file
- Dependency on @surrealdb-orm/orm — dali-orm has internal equivalents in sdk/

### Key architectural difference:

- kit depends on @surrealdb-orm/orm for SurrealDriver, TableDefinition, ColumnDefinition, defineTable, OrmSchema, access/event/function builders, SQL converters
- dali-orm has ALL these internally in sdk/ — no cross-package dependency needed

### File-by-file comparison:

| Kit file                 | dali-orm equivalent         | Status                                      |
| ------------------------ | --------------------------- | ------------------------------------------- |
| src/config.ts            | migration/config.ts         | Enhanced (shadow config)                    |
| src/cli.ts               | migration/cli.ts            | Enhanced (dev/deploy)                       |
| src/commands/diff.ts     | migration/cli/diff.ts       | Same                                        |
| src/commands/generate.ts | migration/cli/generate.ts   | Enhanced (OrmSchema+events+funcs)           |
| src/commands/migrate.ts  | migration/cli/migrate.ts    | Enhanced (dev/deploy)                       |
| src/commands/pull.ts     | migration/cli/pull.ts       | Enhanced (auto-init migration)              |
| src/commands/push.ts     | migration/cli/push.ts       | Same                                        |
| src/core/diff.ts         | migration/core/diff.ts      | Same                                        |
| src/core/generator.ts    | migration/core/generator.ts | Enhanced (access/events/funcs/tuple)        |
| src/core/runner.ts       | migration/core/runner.ts    | Same                                        |
| src/core/snapshot.ts     | migration/core/snapshot.ts  | Enhanced (events/funcs)                     |
| —                        | migration/core/shadow.ts    | **NEW**                                     |
| src/ddl/ddl.ts           | migration/ddl/ddl.ts        | Enhanced (+events/lives/views/access/funcs) |
| src/ddl/diff.ts          | migration/ddl/diff.ts       | Enhanced (+access/events/funcs diffing)     |
| src/ddl/introspect.ts    | migration/ddl/introspect.ts | Enhanced (+accessStructured/funcs/events)   |
| src/ddl/journal.ts       | migration/ddl/journal.ts    | Same                                        |
| src/ddl/schemas.ts       | migration/ddl/schemas.ts    | Same                                        |
| src/ddl/types.ts         | migration/ddl/types.ts      | Same                                        |
| —                        | migration/ddl/convert.ts    | **NEW**                                     |
| —                        | migration/api.ts            | **NEW**                                     |
| —                        | migration/utils/format.ts   | **NEW**                                     |

**GAPS FOUND: 0**

<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

### Schema Layer — Mostly Migrated

Column builders, defineTable, schema config, OrmSchema, query builders, conditions, type inference, functions all present in dali-orm. dali-orm cleaner (119-line defineTable vs 301), has MORE (events, functions), adds graph traversal + live queries.

### MAJOR GAP: SurrealORM Class (1505 lines)

20+ capabilities absent from DaliORM (167 lines):
Config loading, from() wrapper, auth (signin/signup/authenticate/auth), sessions (new/fork/close/list), import/export, health check, version, run(), subscribe(), feature detection, session variables, invalidation, REST API gen (handleApiRequest, generateOpenApiSpec, getApiRoutes), valibot validation, SQL fallback, transaction strict mode, obug logging, changefeeds, live management, execute(), use(). Includes TransactionORM.

### MEDIUM GAP: Driver Interface

- orm SurrealDriver has getClient(); dali-orm doesn't expose underlying client
- orm Transaction accepts ReturnOption; dali-orm doesn't
- orm returns QueryResult<T>; dali-orm returns raw T[]

### Other Gaps (priority order)

HIGH: schema proxy system, schema-to-valibot converter, TypeMap
MEDIUM: ORM-style conditions, QueryBuilder class, driver errors, config loading
LOW: auth validation, test utils, standalone builders (superseded), timestamp (trivial)

### dali-orm Strengths

Cleaner code, migration CLI, graph traversal, live queries, function wrappers, fluent builders, ColumnRef branded types, SerializedCondition, clean export map

<!-- SECTION:FINAL_SUMMARY:END -->
