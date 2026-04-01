---
status: in-progress
phase: 1
updated: 2026-05-03T00:00:00.000Z
id: doc-006
title: Thin Wrapper Implementation Plan
type: other
created_date: '2026-05-03 12:26'
updated_date: '2026-05-03 12:45'
---

# Implementation Plan: Thin Wrapper Refactoring

## Goal

Refactor DaliORM drivers to be thin wrappers around SurrealDB SDK, removing CRUD re-implementations while keeping migrations, query builders, and schema validation.

## Context & Decisions

| Decision                               | Rationale                                                                       | Source                     |
| -------------------------------------- | ------------------------------------------------------------------------------- | -------------------------- |
| Remove CRUD from BaseDriver            | SurrealDB SDK already provides select/create/insert/update/delete/upsert/relate | Analysis of base-driver.ts |
| Remove ORM class                       | Pure delegation layer adds no value                                             | Analysis of orm.ts         |
| Remove orm-query.ts, orm-connection.ts | Unnecessary middle layers                                                       | Analysis of driver folder  |
| Keep query-builders.ts                 | DX strength - typed builders                                                    | User requirement           |
| Keep schema-to-valibot.ts              | Input/output parsing strength                                                   | User requirement           |
| Keep migrations                        | SurrealDB doesn't have them - our strength                                      | User requirement           |

## Phase 1: Driver Simplification [IN PROGRESS]

- [x] 1.1 Analyze current BaseDriver CRUD methods
- [x] 1.2 Remove CRUD methods from BaseDriver
- [ ] **1.3 Fix failing tests** ← CURRENT
- [ ] 1.4 Simplify ORM class or remove it
- [ ] 1.5 Remove orm-query.ts and orm-connection.ts middle layers
- [ ] 1.6 Update NodeDriver and EmbeddedDriver

## Phase 2: Validation & Testing [PENDING]

- [ ] 2.1 Run tests to ensure nothing breaks
- [ ] 2.2 Verify same public API for node/embedded drivers
- [ ] 2.3 Commit changes to unification branch

## Phase 3: Query Builder DX [PENDING]

- [ ] 3.1 Add typed field selection with autocomplete
- [ ] 3.2 Improve where clause DX with typed column references
- [ ] 3.3 Add table-bound builders

## Notes

- 2026-05-03: User wants thin wrapper using MAXIMUM SurrealDB SDK
- 2026-05-03: Keep migrations, query builders, schema validation as strengths
- 2026-05-03: BaseDriver rewritten as thin wrapper (coder agent)
- 2026-05-03: 85 tests fail - they expect validation errors we removed
- 2026-05-03: Tests need updating to match thin-wrapper behavior
