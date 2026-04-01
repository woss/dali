---
id: TASK-045
title: Achieve 90%+ test coverage for @packages/dali-orm
status: To Do
assignee: []
created_date: '2026-05-14 14:00'
updated_date: '2026-05-14 14:00'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Achieve minimum 90% statement/line coverage for all source files in `packages/dali-orm/`. Current weighted average is 41.6%. This requires comprehensive unit tests for all untested and under-tested modules.

## Current State

| Metric                    | Value          |
| ------------------------- | -------------- |
| Total source files        | 87             |
| Total statements          | 5,295          |
| **Weighted avg coverage** | **41.6%**      |
| Files at 0%               | 11             |
| Files <50%                | 24             |
| Files 50–80%              | 15             |
| Files ≥80%                | 14             |
| Type-only/no-code files   | 23             |
| Test files                | 16             |
| Tests                     | 637 (all pass) |

## Priority Ranking — Biggest Coverage Gaps

### TIER 1 — CLI layer (worst coverage, highest risk)

| #   | File                            | Cov   | Stmts | Uncovered | Test exists? |
| --- | ------------------------------- | ----- | ----- | --------- | ------------ |
| 1   | `src/migration/cli/generate.ts` | 22.1% | 738   | 575       | YES          |
| 2   | `src/migration/cli/migrate.ts`  | 0.0%  | 210   | 210       | YES          |
| 3   | `src/migration/cli/diff.ts`     | 0.0%  | 167   | 167       | YES          |
| 4   | `src/migration/cli.ts`          | 10.4% | 182   | 163       | NO           |
| 5   | `src/migration/cli/push.ts`     | 0.0%  | 135   | 135       | YES          |
| 6   | `src/migration/cli/pull.ts`     | 9.6%  | 135   | 122       | YES          |

**Total uncovered:** 1,372 stmts — CLI command orchestration code with zero meaningful test execution.

### TIER 2 — Migration core (moderate coverage, high complexity)

| #   | File                              | Cov   | Stmts | Uncovered | Test exists? |
| --- | --------------------------------- | ----- | ----- | --------- | ------------ |
| 7   | `src/migration/ddl/diff.ts`       | 32.7% | 303   | 204       | YES          |
| 8   | `src/migration/core/generator.ts` | 42.5% | 285   | 164       | YES          |
| 9   | `src/migration/core/runner.ts`    | 53.6% | 304   | 141       | YES          |
| 10  | `src/migration/ddl/introspect.ts` | 43.2% | 222   | 126       | YES          |
| 11  | `src/migration/ddl/convert.ts`    | 35.3% | 119   | 77        | YES          |

**Total uncovered:** 712 stmts — schema diffing, introspection, migration generation and application logic.

### TIER 3 — Driver layer (no dedicated test suites)

| #   | File                                | Cov   | Stmts | Uncovered | Test exists? |
| --- | ----------------------------------- | ----- | ----- | --------- | ------------ |
| 12  | `src/sdk/driver/embedded-driver.ts` | 41.3% | 155   | 91        | NO           |
| 13  | `src/sdk/driver/node-driver.ts`     | 6.8%  | 73    | 68        | NO           |
| 14  | `src/sdk/driver/config/schema.ts`   | 8.9%  | 101   | 92        | NO           |
| 15  | `src/sdk/driver/auth/validate.ts`   | 9.8%  | 51    | 46        | NO           |
| 16  | `src/sdk/driver/orm-connection.ts`  | 4.8%  | 42    | 40        | NO           |

**Total uncovered:** 337 stmts — actual SurrealDB driver implementations and config/auth logic.

### TIER 4 — Functions (some entirely untested)

| #   | File                           | Cov  | Stmts | Uncovered | Test exists? |
| --- | ------------------------------ | ---- | ----- | --------- | ------------ |
| 17  | `src/sdk/functions/array.ts`   | 0.0% | 31    | 31        | YES          |
| 18  | `src/sdk/functions/value.ts`   | 0.0% | 13    | 13        | YES          |
| 19  | `src/sdk/functions/parse.ts`   | 0.0% | 9     | 9         | YES          |
| 20  | `src/sdk/functions/set.ts`     | 0.0% | 9     | 9         | YES          |
| 21  | `src/sdk/functions/vector.ts`  | 0.0% | 9     | 9         | YES          |
| 22  | `src/sdk/functions/session.ts` | 0.0% | 6     | 6         | YES          |
| 23  | `src/sdk/functions/sleep.ts`   | 0.0% | 1     | 1         | YES          |

**Total uncovered:** 78 stmts — SurrealDB function wrappers, trivial to cover (small pure functions).

### TIER 5 — Schema & Config (no dedicated tests)

| #   | File                                       | Cov   | Stmts | Uncovered | Test exists? |
| --- | ------------------------------------------ | ----- | ----- | --------- | ------------ |
| 24  | `src/sdk/schema.ts`                        | 15.2% | 99    | 84        | NO           |
| 25  | `src/migration/config.ts`                  | 4.4%  | 45    | 43        | NO           |
| 26  | `src/migration/utils/format.ts`            | 22.5% | 40    | 31        | NO           |
| 27  | `src/sdk/schema/column/simple-builders.ts` | 46.7% | 30    | 16        | NO           |

**Total uncovered:** 174 stmts — schema container, migration config loading, formatting utilities.

## Current Well-Covered Files (≥80%)

These need maintenance only:

| File                     | Cov   | Stmts |
| ------------------------ | ----- | ----- |
| `base-driver.ts`         | 100%  | 314   |
| `conditions.ts`          | 100%  | 16    |
| `function-builder.ts`    | 100%  | 14    |
| `access-builder.ts`      | 100%  | 7     |
| `event-builder.ts`       | 100%  | 6     |
| `clause-ring-builder.ts` | 100%  | 5     |
| `relate.ts`              | 100%  | 19    |
| `create.ts`              | 100%  | 18    |
| `delete.ts`              | 100%  | 15    |
| `table.ts`               | 85.7% | 14    |
| `select.ts`              | 81.8% | 154   |

## Implementation Strategy

### Phase 1 — Low-hanging fruit (TIER 4 + TIER 5 small files)

Focus on small, pure-function files first. These are simple to test and build momentum:

- `src/sdk/functions/array.ts`, `value.ts`, `parse.ts`, `set.ts`, `vector.ts`, `session.ts`, `sleep.ts` — wrapper modules, 1-31 stmts each
- `src/sdk/schema/column/simple-builders.ts` — 30 stmts
- `src/migration/utils/format.ts` — 40 stmts

### Phase 2 — Driver layer (TIER 3)

Mock-based tests for driver implementations:

- `node-driver.ts`, `embedded-driver.ts` — mock Surreal SDK response shapes
- `orm-connection.ts` — connection lifecycle tests
- `config/schema.ts` — config schema validation
- `auth/validate.ts` — auth config validation

### Phase 3 — Migration core (TIER 2)

Complex logic requiring deep understanding:

- `ddl/diff.ts`, `ddl/convert.ts`, `ddl/introspect.ts`
- `core/generator.ts`, `core/runner.ts`
- `migration/config.ts`

### Phase 4 — CLI commands (TIER 1)

Hardest — CLI orchestration code that strings together migration primitives:

- `cli/generate.ts`, `cli/migrate.ts`, `cli/diff.ts`, `cli/push.ts`, `cli/pull.ts`
- `cli.ts` — command router

### Phase 5 — Insert builder & remaining (below 80%)

- `src/query/insert.ts` (42.3%) — ensure comprehensive tests
- `src/query/types.ts` (12.5%) — type utilities

## Success Criteria

- [ ] All source files ≥90% statement coverage
- [ ] All source files ≥90% line coverage
- [ ] All source files ≥80% branch coverage
- [ ] All 637+ existing tests still pass
- [ ] All existing lint rules still pass (0 biome errors)
- [ ] No regressions in dali-memory package (separate module)
