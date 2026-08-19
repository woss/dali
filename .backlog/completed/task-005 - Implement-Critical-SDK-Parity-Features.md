---
id: TASK-005
title: Implement Critical SDK Parity Features
status: Done
assignee: []
created_date: '2026-04-24 18:31'
updated_date: '2026-04-24 18:33'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Implement critical features identified in code review against SDK_ARCHITECTURE_REPORT.md:

1. Add authenticate() method - enables token refresh flows
2. Re-export SDK value types - RecordId, DateTime, Decimal, Uuid, etc.
3. Fix datetime transformation to be type-based
4. Add better error messages

Partially addresses Critical #2, #3 from code review.

<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

## Implemented Critical SDK Parity Features

### Changes Made

1. **Added `authenticate()` method** (Critical #2 from code review)
   - `packages/orm/src/driver/types.ts`: Added to SurrealDriver interface
   - `packages/orm/src/driver/node-driver.ts`: Implemented using SDK's `db.authenticate()`
   - `packages/orm/src/driver/embedded-driver.ts`: Stub with clear error message
   - `packages/orm/src/driver/orm.ts`: High-level API exposure

2. **Re-exported SDK value type classes** (Critical #3 from code review)
   - `packages/orm/src/driver/index.ts`: Added re-exports for:
     - RecordId, Table, DateTime, Duration, Decimal, Uuid
     - Geometry types (Point, Line, Polygon, etc.)
     - Range, FileRef
   - Users can now import directly from `@surrealdb-orm/driver`

3. **Fixed datetime transformation** (Minor #11 from code review)
   - Changed `node-driver.ts` to use type-based conversion:
     - Only transform `Date` objects and `DateTime` instances
     - Removed heuristic field name matching
     - Fixes false positives like `update_count` → datetime

4. **Improved error messages** (Minor #15 from code review)
   - Embedded driver signin/signup now says "Use connection authentication"
   - More accurate than previous misleading messages

### Verification

- Build: ✅ Pass
- Tests: ✅ 534 passed / 119 skipped

<!-- SECTION:FINAL_SUMMARY:END -->
