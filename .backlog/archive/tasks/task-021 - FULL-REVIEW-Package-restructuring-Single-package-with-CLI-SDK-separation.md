---
id: TASK-021
title: 'FULL REVIEW: Package restructuring - Single package with CLI/SDK separation'
status: Done
assignee: []
created_date: '2026-05-02 14:01'
updated_date: '2026-06-03 20:12'
labels:
  - architecture
  - restructuring
  - high-impact
  - review
milestone: m-0
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

FULL REVIEW: Analyze current packages/orm and packages/kit structure to create single package with clear CLI/SDK separation.

ANALYSIS FROM resonant-gray-skink:

- packages/orm/src/: 411 lines schema.ts, 301 table.ts, 1496 orm.ts, 1055 node-driver.ts, 869 embedded-driver.ts
- packages/kit/src/: 477 cli.ts, 1163 commands/generate.ts, 742 ddl/diff.ts, 745 core/runner.ts
- CLI entry point kit/src/cli.ts (477 lines) mixed with core migration logic
- Kit imports from ORM and re-exports: kit/src/index.ts re-exports from ORM

KEY ISSUES IDENTIFIED:

1. CLI commands (migrate, generate, push, pull, diff) live in kit/src/commands/ - should be separate from ORM SDK
2. ORM package should be pure SDK - no CLI code
3. Current "kit" package blurs line between CLI tool and migration engine
4. Dual config systems: orm/src/driver/config/ (types.ts 170 + schema.ts 413 + loader.ts 427 = 1010 lines) vs kit/src/config.ts (147 lines)
5. Index files pure re-exports create confusion: orm/src/schema/column/index.ts, orm/src/schema/proxy/index.ts, kit/src/index.ts

CURRENT STRUCTURE PAIN POINTS:

- orm/src/driver/orm.ts: 1496 lines (SurrealORM class with connect, query, CRUD, transactions, live queries)
- orm/src/driver/node-driver.ts: 1055 lines (WebSocket driver)
- orm/src/driver/embedded-driver.ts: 869 lines (Embedded driver)
- kit/src/commands/generate.ts: 1163 lines (migration generation)
- kit/src/ddl/diff.ts: 742 lines (DDL diffing)
- kit/src/core/runner.ts: 745 lines (migration runner)

PROPOSED STRUCTURE:
packages/surrealdb-orm/ (single package)
├── src/
│ ├── sdk/ # Pure SDK (current orm/src/ minus CLI concerns)
│ │ ├── schema/ # Column builders, table definitions (from orm/src/schema/)
│ │ ├── driver/ # Database drivers (consolidated from orm/src/driver/)
│ │ └── ...
│ ├── migration/ # Migration engine (from kit/src/core/ + kit/src/ddl/)
│ │ ├── core/ # Diff, snapshot, generator (from kit/src/core/)
│ │ └── ddl/ # DDL types, introspection simplified (from kit/src/ddl/)
│ └── cli/ # CLI only (from kit/src/commands/ + kit/src/cli.ts)
│ ├── commands/ # migrate, generate, push, pull, diff
│ └── cli.ts # Entry point
├── package.json
└── tsconfig.json

DEPENDENCIES:

- Task 2 (Driver consolidation) - drivers live in sdk/driver/
- Task 3 (Type system unification)
- Task 4 (DDL simplification)

REFERENCES:

- ref:resonant-gray-skink for full file tree
- orm/src/driver/types.ts:387 lines (DriverConfig, SurrealDriver interface)
- kit/src/config.ts:147 lines (loadConfig, defineConfig)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Single package structure documented
- [ ] #2 CLI code fully isolated from SDK in design
- [ ] #3 All existing functionality mapped to new structure
- [ ] #4 Import paths designed for backward compatibility
- [ ] #5 Config system consolidation strategy defined
<!-- AC:END -->
