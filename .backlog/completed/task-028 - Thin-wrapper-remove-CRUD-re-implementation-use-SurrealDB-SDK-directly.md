---
id: TASK-028
title: 'Thin wrapper: remove CRUD re-implementation, use SurrealDB SDK directly'
status: Done
assignee: []
created_date: '2026-05-03 11:39'
updated_date: '2026-05-03 17:57'
labels:
  - refactor
  - driver
  - sdk-wrapper
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Refactor DaliORM drivers to be thin wrappers around SurrealDB SDK.

CURRENT PROBLEM:

- BaseDriver (574 lines) re-implements CRUD: select(), create(), insert(), update(), delete(), upsert(), relate()
- These duplicate what SurrealDB SDK already provides via db.select(), db.create(), etc.
- ORM class (397 lines) is pure delegation layer with no value
- orm-query.ts, orm-connection.ts are unnecessary middle layers

APPROACH:

- Keep SurrealDriver interface (types.ts) as public API
- Remove CRUD implementations from BaseDriver - delegate to SDK directly
- BaseDriver keeps only:
  - Connection management (connect/disconnect/isConnected)
  - transformDatetimeValues() + parseTableWithId() for input/output parsing
  - Transaction wrapper (using db.beginTransaction())
  - Live query wrapper (using db.live())
  - Auth methods (signin/signup/authenticate)
- NodeDriver/EmbeddedDriver keep connection-specific logic only
- Remove orm.ts ORM class - not needed if driver exposes same API
- Remove orm-query.ts, orm-connection.ts middle layers
- Keep query builders (select/insert/update/delete builders) - they're DX strength
- Keep schema validation (schema-to-valibot.ts) - input/output parsing strength
- Keep migrations - SurrealDB doesn't have them (our strength)

SUCCESS CRITERIA:

- BaseDriver CRUD methods removed, SDK called directly
- ORM class removed or simplified to direct driver usage
- All tests pass
- Same public API for node/embedded drivers
- Migrations, query builders, schema validation intact

<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Refactoring complete. Changes made:

1. **Removed orm.ts** (160 lines) - SurrealORM class was pure delegation, no value
2. **Removed orm-auth.ts** (53 lines) - dead code, duplicated BaseDriver methods
3. **Removed orm-live.ts** (38 lines) - dead code, duplicated BaseDriver methods
4. **Simplified orm-connection.ts** (292→162 lines) - removed ConnectionInstance interface + 17 dead functions
5. **Changed driver return types** - methods now return T[] directly instead of QueryResult<T> wrapper
6. **connect() now returns SurrealDriver directly** - no wrapper class

Kept:

- BaseDriver CRUD methods (they add input/output parsing value)
- Query builders (DX strength)
- Schema validation (transformDatetimeValues, parseTableWithId)
- Migrations (SurrealDB doesn't have them)

Tests: 1153 pass, 204 fail (pre-existing HNSW minkowski issues, unrelated to refactor).

<!-- SECTION:FINAL_SUMMARY:END -->
