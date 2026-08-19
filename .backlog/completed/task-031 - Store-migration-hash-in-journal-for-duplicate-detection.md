---
id: TASK-031
title: Store migration hash in journal for duplicate detection
status: Done
assignee: []
created_date: '2026-05-05 11:34'
updated_date: '2026-05-05 11:46'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Store migration hash in \_journal.json entries. On `generate`, check if a pending migration with matching hash already exists. If yes, skip file creation.

Changes needed:

1. Journal entry type: add `hash?: string` field
2. Migration runner: store hash when applying migration
3. generate.ts: before creating migration, check if any pending migration has matching hash against the schema
4. Handle backward compat: entries without hash field work fine

Current hash function: `computeMigrationHash(content)` in `packages/dali-orm/src/migration/ddl/journal.ts` - SHA-256 of file content.

Files to modify:

- `packages/dali-orm/src/migration/ddl/journal.ts` - journal entry type, hash storage
- `packages/dali-orm/src/migration/core/runner.ts` - store hash on apply
- `packages/dali-orm/src/migration/cli/generate.ts` - check hash before creating migration
- `packages/dali-orm/src/migration/cli/pull.ts` - update generateAndApplyMigration to use hash check

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Journal entries include hash field for applied migrations
- [x] #2 generateMigration checks if pending migration with matching hash already exists
- [x] #3 If hash matches existing migration, skip file creation and log message
- [x] #4 Existing journal entries without hash field handled gracefully (backward compatible)
- [x] #5 Build passes

<!-- AC:END -->
