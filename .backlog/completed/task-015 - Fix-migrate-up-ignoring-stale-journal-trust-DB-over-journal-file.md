---
id: TASK-015
title: 'Fix migrate:up ignoring stale journal - trust DB over journal file'
status: Done
assignee: []
created_date: '2026-04-29 15:35'
updated_date: '2026-05-16 20:18'
labels:
  - bug
  - migrations
  - runner
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Bug: `migrate:up` returns "Applied 0 migration(s)" even though DB `__migrations` table is empty and no schema exists.

Root cause in `packages/kit/src/core/runner.ts` lines 174-178:

```typescript
const journalTags = await this.journal.getAppliedMigrations();
const dbTags = await this.getDbAppliedMigrations();
const appliedTags = new Set([...journalTags, ...dbTags]);
const pending = files.filter((f) => !appliedTags.has(f.name));
```

Journal file (`meta/_journal.json`) has 9 entries. DB `__migrations` table is empty. Union of both creates 9 "applied" tags → pending empty → 0 migrations run.

Fix approach (Code Philosophy - Fail Fast, Fail Loud):

1. Trust DB as source of truth (not journal)
2. Detect inconsistencies (journal ≠ DB state)
3. Re-apply migrations where journal says applied but DB missing
4. Sync journal AFTER successful DB insert (use existing `syncJournal()` method)

Files affected:

- `packages/kit/src/core/runner.ts` - `up()` method (lines 145-194)
- Potentially `packages/kit/src/ddl/journal.ts` - journal sync logic

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 migrate:up detects stale journal (journal says applied but DB missing)
- [ ] #2 migrate:up re-applies missing migrations when journal out-of-sync
- [ ] #3 DB \_\_migrations table is source of truth, journal is just cache
- [ ] #4 Journal synced AFTER successful DB insert
- [ ] #5 Inconsistency detected and reported (warn/error) to user
- [ ] #6 Existing tests still pass

<!-- AC:END -->
