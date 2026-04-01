---
id: TASK-002
title: Support fixed-size tuple arrays with element assertions
status: Done
assignee: []
created_date: '2026-04-24 09:22'
updated_date: '2026-04-24 18:20'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Code review completed against SDK architecture. Critical gaps identified:

1. Missing query builder chain methods (.where(), .limit(), .orderBy())
2. Missing authenticate() method
3. No value type classes exposed (RecordId, DateTime, etc.)
4. Incomplete transaction interface
5. Missing session management
6. Live query configuration missing
7. No export/import support

See full review in delegation artifact: tart-gray-salamander.md

<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

## Code Review Summary: Driver Implementation vs SDK Architecture

### Critical Issues Found (4)

1. **Missing Query Builder Chain Methods** - ORM lacks `.where()`, `.limit()`, `.orderBy()` support that the SDK provides
2. **Missing `authenticate()` Method** - Cannot authenticate with pre-existing tokens (breaks token refresh flows)
3. **No Value Type Classes** - RecordId, DateTime, Decimal, Uuid not re-exported from SDK
4. **Incomplete Transaction Interface** - No query builder support within transactions

### Major Issues Found (6)

5. Missing Session Management - `newSession()`, `forkSession()`, session variables not implemented
6. Live Query Configuration - No `.diff()`, `.fields()`, `.where()` for live queries
7. No Export/Import - Missing `db.export()` / `db.import()` for backups
8. Return Options Unused - `.return()` chain method exists but unused
9. Missing Health/Version - No `health()`, `version()`, `isFeatureSupported()`
10. No Function Execution - Missing `run()` method for DB functions

### Minor Issues (5)

11. Datetime Heuristic Too Aggressive - False positives on field names like `update_count`
12. Missing `api()` Method - No user-defined API access
13. Inconsistent signin/signup Returns - Returns `{ access }` vs SDK `Tokens`
14. No RecordIdRange Support - Can't do range queries
15. Misleading Embedded Auth Errors

### Positive Observations (10)

- Excellent guard clause pattern throughout
- Proper connection state management
- Good error handling with context
- DateTime transformation layer
- Transaction rollback on error
- Clean parseTableWithId helper
- Subscription cleanup (no leaks)
- Config resolution priority strategy
- HTTP protocol detection
- Factory pattern for testing

### Philosophy Compliance

✅ Pass: Early Exit, Atomic Predictability, Fail Fast, Intentional Naming  
⚠️ Partial: Parse Don't Validate, Security, Performance

### Recommendation

Priority should be implementing query builder chain API (Critical #1) as it's the core SDK feature affecting all query operations.

<!-- SECTION:FINAL_SUMMARY:END -->
