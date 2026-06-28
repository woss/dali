# @woss/dali-orm

## [Unreleased]

### Added

- `AnalyzerDefinition` interface for defining SurrealDB text analyzers (tokenizers + filters)
- `analyzers` field on `OrmSchemaConfig` / `OrmSchema` for declaring analyzers alongside tables
- `generateAnalyzerDefinition()` and `generateRemoveAnalyzer()` methods on `SurrealQLGenerator`
- `SerializedAnalyzer` type, `serializeAnalyzer()` and `restoreAnalyzer()` in snapshot module
- Analyzer support in all migration generation paths: `generateMigration`, `fullMigration`, `snapshotMigration`, `liveMigration`
- Analyzers emitted UP before tables, DOWN after tables (correct ordering since indexes depend on analyzers)
- Section separators (`-- ---- Analyzers ----`) in generated migration files

## 0.1.0

### Minor Changes

- [#56](https://github.com/woss/surrealdb-orm/pull/56) [`4a786ad`](https://github.com/woss/surrealdb-orm/commit/4a786ad74ae67d76d3dd39c59acd3b50a004ad9a) Thanks [@woss](https://github.com/woss)! - Init project
