---
id: TASK-026
title: >-
  FULL REVIEW: Large file breakdown - Reduce complexity in 1496-line orm.ts +
  others
status: Done
assignee: []
created_date: '2026-05-02 14:05'
updated_date: '2026-05-02 22:55'
labels:
  - large-files
  - complexity
  - refactoring
  - review
milestone: m-0
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

FULL REVIEW: Analyze large files (>500 lines) and propose breakdown strategy to reduce complexity.

ANALYSIS FROM resonant-gray-skink + initial analysis:

LARGE FILES IDENTIFIED:

1. **orm/src/driver/orm.ts:1496 lines** - SurrealORM class
   - Constructor: ~100 lines (legacy + new config handling)
   - connect(): ~50 lines
   - query(): ~80 lines
   - select(), insert(), update(), delete() - ~300 lines total
   - transaction(): ~100 lines
   - live(): ~150 lines
   - Multiple SDK-parity methods (use, run, version, health, etc.)
   - 15+ methods in single class

2. **kit/src/commands/generate.ts:1163 lines**
   - Migration generation logic
   - Snapshot comparison
   - SQL output generation
   - TableDefinition → SurrealTable conversion (lines 56-100)
   - Mixed concerns: generation + conversion + output

3. **orm/src/driver/node-driver.ts:1055 lines** (NodeDriver: 968 lines)
   - Connection handling
   - Query execution
   - Transaction management
   - Event handling
   - Duplicates EmbeddedDriver (see TASK-022)

4. **kit/src/ddl/diff.ts:742 lines**
   - DDL diffing logic
   - formatDefaultValue(), normalizeDefault(), serializePermissions()
   - Duplicates generator.ts (see TASK-024)

5. **orm/src/schema/query-builders.ts:739 lines**
   - Standalone builders: select(), insert(), update(), remove()
   - Immutable builder pattern
   - No inheritance/shared base (each builder standalone)

6. **orm/src/driver/embedded-driver.ts:870 lines** (EmbeddedDriver: 820 lines)
   - Similar to NodeDriver
   - Embedded-specific init logic
   - Duplicates NodeDriver (see TASK-022)

7. **kit/src/core/runner.ts:745 lines** (MigrationRunner: 629 lines)
   - Migration application/rollback
   - Journal management
   - File I/O operations

8. **kit/src/core/generator.ts:365 lines** - KEEP (medium size)
9. **orm/src/schema.ts:411 lines** - KEEP (medium size)
10. **orm/src/table.ts:301 lines** - KEEP (medium size)

BREAKDOWN STRATEGIES:

**orm.ts (1496 → target: 3-4 files ~400 lines each)**:
Option A: Extract manager classes

```
orm.ts (300 lines) - SurrealORM main class (thin orchestrator)
├── connection-manager.ts (200 lines) - connect, disconnect, isConnected
├── query-manager.ts (300 lines) - query, select, insert, update, delete
├── transaction-manager.ts (150 lines) - transaction, begin, commit, rollback
└── live-manager.ts (200 lines) - live queries, subscriptions
```

Option B: Extract by concern

```
orm.ts (400 lines) - Core + SDK-parity methods
├── orm-query.ts (400 lines) - Query building, execution
├── orm-transaction.ts (200 lines) - Transaction logic
└── orm-live.ts (200 lines) - Live queries
```

**generate.ts (1163 → target: 3-4 files)**:

```
generate.ts (300 lines) - Main orchestrator
├── snapshot-comparison.ts (300 lines) - Diff logic
├── sql-generator.ts (300 lines) - SQL output generation
└── type-converter.ts (200 lines) - TableDefinition → SurrealTable
```

**query-builders.ts (739 → extract base class)**:

- Create BaseQueryBuilder with common methods
- Reduce duplication between select/insert/update/remove builders
- Or keep as-is (each builder is standalone by design)

DEPENDENCIES:

- Task 1 (Package restructuring TASK-021) - affects file locations
- Task 2 (Driver consolidation TASK-022) - node-driver.ts, embedded-driver.ts
- Task 4 (DDL simplification TASK-024) - ddl/diff.ts

REFERENCES:

- orm/src/driver/orm.ts:1496 lines
- kit/src/commands/generate.ts:1163 lines
- orm/src/driver/node-driver.ts:1055 lines
- kit/src/ddl/diff.ts:742 lines
- orm/src/schema/query-builders.ts:739 lines
- ref:resonant-gray-skink
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 orm.ts (1496 lines) analyzed for breakdown points
- [ ] #2 node-driver.ts (1055 lines) analyzed for extraction
- [ ] #3 generate.ts (1163 lines) analyzed for splitting
- [ ] #4 Large function identification complete (100+ line functions)
- [ ] #5 Breakdown plan proposed (extract classes, split files)
- [ ] #6 SurrealORM class refactoring strategy (extract Connection, Query, Transaction managers)
<!-- AC:END -->
