---
status: completed
phase: 4
updated: 2026-05-12
---

# Implementation Plan: DDL Features + Type-Safe Relations

## Goal

Complete SurrealDB DDL support (access, events, functions) and add type-safe relation traversal to query builders.

## Context & Decisions

| Decision                                                | Rationale                                                                                                                                     | Source                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Priority: access → events → functions → relations       | Access has most existing infra, lowest risk to build on. Events have model. Functions need full construction. Relations are query-layer only. | `ref:general-cyan-marsupial` |
| Access uses structured DDL type (not raw SQL)           | Raw SQL strings prevent diff/change detection. Existing `AccessConfig` provides structured foundation.                                        | `ref:bitter-tomato-walrus`   |
| Events reuse existing `SurrealEvent` model              | Already validated via valibot schemas from TASK-018. Only need pipeline integration.                                                          | `ref:general-cyan-marsupial` |
| Functions stored as structured config (not raw strings) | Consistent with tables/access pattern. Enables diff and change detection.                                                                     | `ref:general-cyan-marsupial` |
| Access diff is add-only (never removes)                 | Safety-first: removing access definitions can break auth. User manually handles removal.                                                      | `ref:bitter-tomato-walrus`   |

## Phase 1: Access Definitions — Complete DDL Support [COMPLETE]

- [x] 1.1 Research existing access infrastructure (AccessConfig, accessToSQL, introspection, snapshot) → `ref:bitter-tomato-walrus`, `ref:general-cyan-marsupial`
- [x] 1.2 Create `defineAccess()` fluent builder
- [x] 1.3 Add structured `SurrealAccess` DDL type and statement types (CreateAccessStatement, DropAccessStatement)
- [x] 1.4 Add access diff logic to `ddlDiff()` (detect new/missing/changed access)
- [x] 1.5 Add access SQL generation to `SurrealQLGenerator` (generateAccessDefinition)
- [x] 1.6 Add access push support in `tablesToDdl()` and `pushSchema()`
- [x] 1.7 Fix `AccessConfigSchema` valibot to support JWT and OIDC types
- [x] 1.8 Add access conversion functions to `convert.ts`
- [x] 1.9 Write tests: builder, diff, SQL gen, push
- [x] 1.10 Run tests and verify build (272/272 passing)

## Phase 2: Event Definitions — Complete DDL Support [COMPLETE]

- [x] 2.1 Create `defineEvent()` fluent builder
- [x] 2.2 Add EventConfig type, valibot schema, and `eventToSQL()` to schema.ts
- [x] 2.3 Add DDL statement types (CreateEventStatement, DropEventStatement)
- [x] 2.4 Add event diff to `ddlDiff()` (diffEvents, statementToSql, orderStatements)
- [x] 2.5 Add event SQL generation to SurrealQLGenerator
- [x] 2.6 Add event conversion in convert.ts (toSurrealEvent, fromSurrealEvent)
- [x] 2.7 Add event push+pipeline+snapshot support
- [x] 2.8 Write tests (24 tests: builder, diff, SQL gen, conversion)

## Phase 3: Function Definitions — Complete DDL Support [COMPLETE]

- [x] **3.1 Create `defineFunction()` fluent builder**
- [x] 3.2 Add structured `SurrealFunction` DDL type and statement types (CreateFunctionStatement, DropFunctionStatement)
- [x] 3.3 Add function diff to `ddlDiff()`
- [x] 3.4 Add function SQL generation to `SurrealQLGenerator`
- [x] 3.5 Add function introspection
- [x] 3.6 Add function push support
- [x] 3.7 Add function serialization to snapshot
- [x] 3.8 Write tests: builder, diff, SQL gen
- [x] 3.9 Run tests and verify build

## Phase 4: Type-Safe Relations in Query Builders [COMPLETE]

- [x] 4.1 Add generic type params to RelateBuilder for type-safe edges (TIn, TOut, TEdge)
- [x] 4.2 Add type-safe FETCH for relations in SelectBuilder
- [x] 4.3 Add typed graph path traversal in GraphPath
- [x] 4.4 Add edge type inference utilities in types.ts
- [x] 4.5 Write tests: RelateBuilder, relation FETCH, graph path
- [x] 4.6 Run tests and verify build

## Notes

- 2026-05-10: Research complete. Access has most existing infra. Events have model but no pipeline. Functions need full construction. `ref:general-cyan-marsupial`
- 2026-05-10: Access infra recovered from git history of deleted packages. `AccessConfig` type, `accessToSQL()`, `introspectAccessSQL()` all exist. Missing: structured DDL type, diff, push, builder. `ref:bitter-tomato-walrus`
- 2026-05-10: Backlog tasks created: TASK-035 (access), TASK-036 (events), TASK-037 (functions), TASK-038 (type-safe relations). Dependencies: 035 → 036 → 037 → 038.
- 2026-05-10: Phase 1 complete. 272/272 tests passing. 24 new tests for access definitions. Pre-existing semicolon bug in generateMigrationFile() fixed.
- 2026-05-10: Phase 2 complete. 309/309 tests passing. 39 new tests for events (15 builder, 24 diff+convert). Fixed pre-existing boolean import bug in schema.ts.
