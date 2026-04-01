---
id: TASK-043
title: Add defaultRaw() for SurrealDB function defaults
status: Done
assignee: []
created_date: '2026-05-14 13:57'
updated_date: '2026-05-15 19:22'
labels:
  - feature
  - dali-orm
  - schema
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Add `defaultRaw(expr: string)` builder method to pass SurrealDB function calls unquoted through column DEFAULT. Current `default(value)` wraps strings in quotes. `defaultRaw(expr)` stores in `ColumnConfig.defaultRaw` and renders as raw SurrealQL without quoting.

Enables patterns like:

- `string('content_hash').defaultRaw('crypto::blake3(content)')`
- `datetime('created_at').defaultRaw('time::now()')` (more explicit than `defaultNow()`)

Design: ColumnConfig gets `defaultRaw` field. Render chain checks `config.defaultRaw ?? config.default`. `defaultRaw` bypasses quoting, emitted as raw SurrealQL.

9 files in scope:

1. `packages/dali-orm/src/sdk/schema/column/types.ts` — add `defaultRaw?: string` to ColumnConfig
2. `packages/dali-orm/src/sdk/schema/column/simple-builders.ts` — add `defaultRaw(expr: string): this` method
3. `packages/dali-orm/src/migration/core/generator.ts` — 4 sites: render `config.defaultRaw ?? config.default`
4. `packages/dali-orm/src/migration/utils/format.ts` — handle raw defaults (pass-through, no quoting)
5. `packages/dali-orm/src/migration/cli/generate.ts` — 2 sites: collect `defaultRaw` from column config
6. `packages/dali-orm/src/migration/core/diff.ts` — include `defaultRaw` in field diff comparison
7. `packages/dali-orm/src/migration/cli/pull.ts` — recognize `defaultRaw` on reverse introspection
8. `packages/dali-orm/src/migration/core/snapshot.ts` — serialize/deserialize `defaultRaw`
9. `packages/kit/src/core/ddl-generator.ts` — 2 sites: render `defaultRaw` (kit package)

Then update `packages/dali-memory/src/schema.ts` to use `.defaultRaw('crypto::blake3(content)')` on `content_hash` field and generate migration.

Note: `packages/orm/` excluded per TASK-042 gap analysis — it's superseded legacy package.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 ColumnConfig has `defaultRaw?: string` field
- [x] #2 simple-builders.ts has `defaultRaw(expr: string): this` method chainable after other modifiers
- [x] #3 All 4 generator.ts sites render `config.defaultRaw ?? config.default` for DEFAULT clause
- [x] #4 generate.ts passes defaultRaw when collecting column config
- [x] #5 diff.ts recognizes defaultRaw changes in field diff
- [x] #6 pull.ts handles defaultRaw on reverse introspection
- [x] #7 snapshot.ts serializes/deserializes defaultRaw
- [x] #8 ddl-generator.ts (kit) 2 sites render defaultRaw
- [x] #9 Build passes for all packages
- [x] #10 Test: string('content_hash').defaultRaw('crypto::blake3(content)') produces DEFAULT crypto::blake3(content) unquoted
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

## Changes Made

### Core: ColumnConfig + Builder

- **`packages/dali-orm/src/sdk/schema/column/types.ts`**: Added `defaultRaw?: string` to `ColumnConfig` interface — stores raw SurrealDB expression for DEFAULT, emitted unquoted.
- **`packages/dali-orm/src/sdk/schema/column/simple-builders.ts`**: Added `defaultRaw(expr: string): this` method to builder — chainable after other modifiers, sets `config.defaultRaw`.

### Generator (4 DEFAULT sites)

- **`packages/dali-orm/src/migration/core/generator.ts`**:
  - `generateSingleFieldDefinition`: Changed DEFAULT clause to check `defaultRaw` first
  - `generateSingleFieldRedefine`: Same pattern
  - `generateTupleFieldDefinition`: Same pattern
  - `generateAlterFieldDefault`: Updated signature to accept `defaultRaw` param; renders raw if set

### Migration pipeline

- **`packages/dali-orm/src/migration/cli/generate.ts`**: Updated both `generateSnapshotMigration` and `generateLiveMigration` field-change loops — compare effective default (`defaultRaw ?? default`), pass `defaultRaw` to `generateAlterFieldDefault`.
- **`packages/dali-orm/src/migration/core/diff.ts`**: Field diff compares effective default (`defaultRaw ?? default`) instead of just `default`.
- **`packages/dali-orm/src/migration/core/snapshot.ts`**: Added `defaultRaw` to `SerializedColumnConfig`, `serializeColumnConfig`, `restoreColumnConfig`.
- **`packages/dali-orm/src/migration/cli/pull.ts`**: `applyModifiers` handles `defaultRaw` for generated TypeScript schema code; `generateColumnDefinition` type updated.

### Kit package

- **`packages/kit/src/core/ddl-generator.ts`**: Both DEFAULT sites (tuple and single field) now check `defaultRaw` before `default`.

### Build/Verification

- Build passes for all packages
- All 1917 dali-orm tests pass
- dali-memory tests have 13 pre-existing failures (integration tests needing SurrealDB instance) — unrelated to this change

### Notes

- `format.ts` not modified — `defaultRaw` handled at call sites in generator explicitly instead of trying to guess function patterns in `formatDefaultValue`. This follows "Parse Don't Validate": the builder boundary parses the `defaultRaw` field, internal code trusts it.
<!-- SECTION:FINAL_SUMMARY:END -->
