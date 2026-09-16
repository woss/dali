# @woss/dali-orm

## [Unreleased]

### Added

- Depth range support for graph traversal: `.traverse('out', 'edge', 'target', 'alias', { depth: { min: 1, max: 3 } })` and `graphPath().out('edge').depth(1, 3).to('target')` — generates SurrealQL depth syntax `->edge->table{min,max}` (bounded) or `->edge->table{min,}` (unbounded)
- `DeleteBuilder.where()` with 3 overloads matching `SelectBuilder` API: (a) callback `(w: WhereBuilder) => WhereBuilder`, (b) `SerializedCondition` object, (c) raw string clause
- `DeleteBuilder.limit(n)` — limits deleted records via subquery wrap (`DELETE FROM (SELECT id FROM table WHERE ... LIMIT n)`)
- `DeleteBuilder.toSQL()` — public method returning `{ sql, params }` for SurrealQL compilation
- Shared `serializer.ts` module (`andTrees`, `serializeCondition`, `serializedConditionToNode`) extracted from SelectBuilder to avoid condition tree duplication across builders
- Schema-aware record ID coercion — `coerceRecordIds` only coerces fields defined as `record()` columns when schema is available; non-record string fields with colons preserved as-is
- Schema threading from `DaliORM.connect()` through to `BaseDriver` — schema config flows to `SurrealDriver.schema` for all CRUD coercion decisions
- `NodeDriverConfig.reconnect` field — forward reconnect options to SDK `ConnectOptions` for auto-reconnection support
- System auth (root/namespace/database) passed via `ConnectOptions.authentication` instead of `db.signin()` — credentials persist across SDK auto-reconnections
- Typed CRUD methods on DaliORM: `selectFrom()`, `insertInto()`, `updateTable()`, `deleteFrom()` with full type inference from table definitions
- Type inference utilities in `@woss/dali-orm/sdk/infer-types`: `InferSelectResult<T>`, `InferInsertData<T>`, `InferUpdateData<T>`, `SurrealTypeToTS<S>`
- All query builders and factory functions now accept `DaliORM` instead of raw `SurrealDriver`
- `TableBinding` builder methods now accept `DaliORM`
- `DaliORM` type re-export from `@woss/dali-orm/query`
- `AnalyzerDefinition` interface for defining SurrealDB text analyzers (tokenizers + filters)
- `analyzers` field on `OrmSchemaConfig` / `OrmSchema` for declaring analyzers alongside tables
- `generateAnalyzerDefinition()` and `generateRemoveAnalyzer()` methods on `SurrealQLGenerator`
- `SerializedAnalyzer` type, `serializeAnalyzer()` and `restoreAnalyzer()` in snapshot module
- Analyzer support in all migration generation paths: `generateMigration`, `fullMigration`, `snapshotMigration`, `liveMigration`
- Analyzers emitted UP before tables, DOWN after tables (correct ordering since indexes depend on analyzers)
- Section separators (`-- ---- Analyzers ----`) in generated migration files

### Changed

- `SelectBuilder` condition serialization refactored to import from shared `serializer.ts` module (no behavior change)
- `BaseDriver.coerceRecordIds` rewritten to be schema-aware: when `schema` is set, only record-typed columns are coerced; falls back to coerce-all behavior when no schema is provided (backward compatible)
- `upsertWhere` now parses table name (`table:id` → `table`) before passing to `coerceRecordIds`
- `NodeDriver.connect()` refactored: system auth types now authenticate through connect options rather than `db.signin()`. Record auth flow unchanged.

### Fixed

- Non-record string fields containing colons (e.g. `"repo: woss/dali"`) no longer incorrectly coerced to `RecordId` when schema is available — only `record()` typed columns are coerced

### Removed

- `down()` and `reset()` methods from `MigrationRunner` — forward-only migrations (no rollback)
- `rollback()` method from `MigrationJournalManager`
- `-- DOWN` section parsing from `parseMigrationFileContent()` — now returns only `{ up: string[] }`
- `migrate down` and `migrate reset` CLI commands removed

## 0.1.0

### Minor Changes

- [#56](https://github.com/woss/surrealdb-orm/pull/56) [`4a786ad`](https://github.com/woss/surrealdb-orm/commit/4a786ad74ae67d76d3dd39c59acd3b50a004ad9a) Thanks [@woss](https://github.com/woss)! - Init project
