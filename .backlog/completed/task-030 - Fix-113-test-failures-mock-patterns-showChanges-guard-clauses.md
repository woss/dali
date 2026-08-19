---
id: TASK-030
title: 'Fix 113 test failures - mock patterns, showChanges, guard clauses'
status: Done
assignee: []
created_date: '2026-05-03 22:28'
updated_date: '2026-05-16 20:18'
labels:
  - testing
  - bug-fix
  - thin-wrapper
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Fix remaining test failures from TASK-028 thin wrapper refactoring:

1. Mock return type (70+ failures): Tests expect `{ result, status }` wrapper but drivers now return `T[]` directly
2. showChanges missing (5 failures): Moved to util function in orm-connection.ts, tests still call `orm.showChanges()`
3. Guard clauses (30+ failures): Custom error messages not thrown, SurrealDB native errors returned instead
4. DB timeout (6 failures): Tests need running SurrealDB instance

Approach:

- Update mock patterns to return `T[]` directly
- Export showChanges as method OR update tests to use util function
- Restore guard clauses in BaseDriver for early validation
- Skip DB-dependent tests with proper guards

<!-- SECTION:DESCRIPTION:END -->
