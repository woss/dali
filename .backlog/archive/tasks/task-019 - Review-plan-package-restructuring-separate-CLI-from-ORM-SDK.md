---
id: TASK-019
title: Review & plan package restructuring - separate CLI from ORM SDK
status: Done
assignee: []
created_date: '2026-05-02 13:07'
updated_date: '2026-06-03 20:11'
labels:
  - architecture
  - restructuring
  - high-impact
milestone: m-0
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

FULL REVIEW: Analyze current packages/orm and packages/kit structure to create single package with clear CLI/SDK separation.

FINDINGS FROM ANALYSIS (ref:resonant-gray-skink):

- packages/orm (1496 lines orm.ts, 1055 node-driver.ts, 869 embedded-driver.ts)
- packages/kit (1163 generate.ts, 742 ddl/diff.ts, 745 core/runner.ts)
- CLI entry point kit/src/cli.ts (477 lines) mixed with core migration logic
- Kit imports from ORM and re-exports: kit/src/index.ts re-exports from ORM

KEY ISSUES:

1. CLI commands (migrate, generate, push, pull, diff) live in kit/src/commands/ - should be separate from ORM SDK
2. ORM package should be pure SDK - no CLI code
3. Current "kit" package blurs line between CLI tool and migration engine
4. Dual config systems: orm/src/driver/config/ (170+413+427 lines) vs kit/src/config.ts (147 lines)

PROPOSED STRUCTURE:
packages/surrealdb-orm/ (single package)
├── src/sdk/ - Pure SDK (current orm/src/ minus CLI concerns)
├── src/migration/ - Migration engine (from kit/src/core/)
└── src/cli/ - CLI only (from kit/src/commands/)

DEPENDENCIES:

- Task 2 (Driver consolidation) - drivers live in sdk/
- Task 3 (Type system unification)
- Task 4 (DDL simplification)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Single package created with sdk/, migration/, cli/ separation
- [ ] #2 CLI code fully isolated from SDK exports
- [ ] #3 All existing functionality preserved
- [ ] #4 Clear import paths established
- [ ] #5 Backward compatibility layer for existing imports

<!-- AC:END -->
