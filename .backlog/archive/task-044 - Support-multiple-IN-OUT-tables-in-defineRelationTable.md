---
id: TASK-044
title: Support multiple IN/OUT tables in defineRelationTable
status: Done
assignee: []
created_date: '2026-05-14 15:58'
updated_date: '2026-05-14 16:27'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

defineRelationTable currently accepts only single string for `in` and `out` config. SurrealDB supports multiple comma-separated tables for relation edges (e.g., `TYPE RELATION IN projects OUT memories, sessions`). Need to accept `string | string[]` throughout the stack.

## Context

User wants:

```ts
const partOfProjectSchema = defineRelationTable(
  'part_of_project',
  { type: string('type') },
  { out: ['memories', 'sessions'], in: 'projects' },
);
```

SurrealQL output must be:

```sql
DEFINE TABLE part_of_project TYPE RELATION IN projects OUT memories, sessions SCHEMAFULL;
```

## Impact scope

8 files need changes across sdk layer + migration system. See full analysis in conversation (m0014).

## Key complexity

Introspection must handle union record types from STRUCTURE output. When SurrealDB stores `OUT memories, sessions`, the `out` field's kind appears as `record<memories> | record<sessions>` (union type). Current `parseKind` returns only first type. Need to extract all record table names from union types.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 defineRelationTable accepts string | string[] for config.in and config.out
- [x] #2 DDL generator emits correct SurrealQL: `IN projects OUT memories, sessions` for array values
- [x] #3 Diff engine correctly compares string vs array in/out values (introspect → diff → generate roundtrip)
- [x] #4 Introspection (parseKind) extracts all record tables from union types like `record<memories> | record<sessions>`
- [x] #5 RelateBuilder + type inference unchanged (runtime .from()/.to() use record IDs, not schema)
- [x] #6 All existing tests pass; new tests added for array in/out config
- [x] #7 DDL push/diff/generate CLI commands handle array in/out correctly
<!-- AC:END -->

## Implementation Plan

## <!-- SECTION:PLAN:BEGIN -->

status: not-started
phase: 1
updated: 2026-05-14

---

# Implementation Plan

## Goal

Support `string | string[]` for `in`/`out` in `defineRelationTable` across SDK + migration stack.

## Context & Decisions

| Decision                                      | Rationale                                                                                    | Source                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------ |
| `string                                       | string[]` type                                                                               | SurrealQL uses comma-separated table names for multiple IN/OUT | `ref:conversation-m0014` |
| `parseKind` must return multiple recordTables | Introspection from STRUCTURE returns union types like `record<memories> \| record<sessions>` | `ref:conversation-m0014`                                       |
| RelateBuilder unchanged                       | `.from()`/`.to()` deal with runtime record IDs, not schema-level table constraints           | `ref:conversation-m0014`                                       |

## Phase 1: SDK Type Changes + Generator [PENDING]

- [ ] 1.1 `sdk/table.ts`: Change `TableConfig.in/out`, `RelationTableConfig.in/out`, `defineRelationTable` param type to `string | string[]`
- [ ] 1.2 `migration/ddl/ddl.ts`: Change `SurrealTable`, `SurrealRelation`, `CreateTableStatement`, `CreateRelationStatement` `.in`/`.out` to `string | string[]`
- [ ] 1.3 `migration/core/generator.ts`: Update `generateTableDefinition` to join arrays with `, ` for IN/OUT clauses

## Phase 2: Migration Tooling [PENDING]

- [ ] 2.1 `migration/ddl/introspect.ts` + `types.ts`: Update `parseKind` to extract all record tables from union types (e.g., `record<memories> | record<sessions>` → `['memories', 'sessions']`)
- [ ] 2.2 `migration/ddl/diff.ts`: Update `create_relation` SQL generation and table comparison logic for array in/out
- [ ] 2.3 `migration/cli/push.ts`, `diff.ts`, `generate.ts`, `core/snapshot.ts`, `ddl/convert.ts`: Update type annotations (pass-through, no logic change)

## Phase 3: Tests + Verify [PENDING]

- [ ] 3.1 Add test case in `query.test.ts` with `in: ['memories','sessions']` config
- [ ] 3.2 Verify DDL generator output matches expected SurrealQL
- [ ] 3.3 Run full test suite (`pnpm test`)
- [ ] 3.4 Verify DDL push/diff/generate roundtrip with array in/out

## Notes

- 2026-05-14: Full analysis in conversation — 8 files affected, key complexity in parseKind union handling `ref:conversation-m0014`
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Implemented `string | string[]` support for `in`/`out` in `defineRelationTable` across SDK + migration stack.

## Changes

**7 files modified:**

| File                          | Change                                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `sdk/table.ts`                | `TableConfig.in`/`out`, `RelationTableConfig.in`/`out`, `defineRelationTable` params → `string \| string[]`                                     |
| `migration/ddl/ddl.ts`        | `SurrealTable.in`/`out`, `SurrealRelation.in`/`out`, `CreateTableStatement.in`/`out`, `CreateRelationStatement.in`/`out` → `string \| string[]` |
| `migration/core/generator.ts` | `generateTableDefinition` joins array values with `, ` for SurrealQL output                                                                     |
| `migration/ddl/types.ts`      | `parseKind` returns `recordTables: string[]` for union record types (e.g., `record<memories> \| record<sessions>`)                              |
| `migration/ddl/introspect.ts` | Extracts multiple record tables from union types → normalizes to `string \| string[]`                                                           |
| `migration/ddl/diff.ts`       | `statementToSql` for `create_relation` handles array in/out                                                                                     |
| `migration/core/snapshot.ts`  | `SerializedTableConfig.in`/`out` → `string \| string[]`                                                                                         |

**Test file:** 6 new tests for multi IN/OUT relation tables in query test suite.

**All 643 tests pass**, no regressions.

<!-- SECTION:FINAL_SUMMARY:END -->
