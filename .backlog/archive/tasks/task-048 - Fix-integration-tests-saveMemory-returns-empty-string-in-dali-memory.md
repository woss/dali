---
id: TASK-048
title: 'Fix integration tests: saveMemory returns empty string in dali-memory'
status: Done
assignee: []
created_date: '2026-05-16 20:02'
updated_date: '2026-06-03 20:14'
labels:
  - bug
  - dali-memory
  - integration-test
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

8 integration tests fail when SURREALDB_URL is set and a SurrealDB instance is running:

**Failed tests** (2 files):

1. `packages/dali-memory/src/__tests__/surreal-client.integration.test.ts` (5 failures) — `saveMemory` returns `''` instead of a record ID
2. `packages/dali-memory/src/__tests__/memory-service.integration.test.ts` (3 failures) — `addMemory` returns `''`

**Root cause**: The migration (`content_hash_blake3`) that creates the `memories` table schema with `DEFAULT crypto::blake3(content)` hasn't been applied to the running DB. Tests connect but the table doesn't exist. `INSERT INTO memories` implicitly creates the table, but the `content_hash` field's `DEFAULT crypto::blake3(content)` fails because `content` field isn't in the INSERT record, causing empty string return.

**To fix**: Apply the dali-memory migration to the running SurrealDB instance, or ensure the test setup script runs migrations before integration tests.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Apply dali-memory migration to running SurrealDB instance
- [ ] #2 All 8 integration tests pass with SurrealDB running
- [ ] #3 CI auto-skips integration tests when SURREALDB_URL is not set (existing describeDb pattern preserved)
- [ ] #4 No regressions in unit tests (2020 passing)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Todo moved from session to task:

- Fix 8 integration tests: apply dali-memory migration
<!-- SECTION:NOTES:END -->
