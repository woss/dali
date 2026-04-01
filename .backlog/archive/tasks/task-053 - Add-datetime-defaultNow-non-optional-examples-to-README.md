---
id: TASK-053
title: Add datetime() defaultNow() non-optional examples to README
status: Done
assignee: []
created_date: '2026-05-20 20:00'
updated_date: '2026-05-20 20:22'
labels:
  - documentation
  - readme
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Update README.md schema section to show `datetime('...').defaultNow()` (required, auto-defaults to `time::now()`) as a better real-world pattern than `.optional()` with no default.

Changes needed:

1. articleSchema: add `created_at: datetime('created_at').defaultNow()`, keep `published_at` as optional
2. wroteSchema: change `created_at` from `.optional()` to `.defaultNow()`
3. Optionally add column type table row for `.defaultNow()`

Also includes crypto::joaat wrapper:

- Add `cryptoJoaat(data: SqlExpr)` function to packages/dali-orm/src/sdk/functions/crypto.ts
- Add test case in packages/dali-orm/src/sdk/functions/**tests**/functions.test.ts
- Update export in packages/dali-orm/src/sdk/functions/index.ts
- Update skill reference in .agents/skills/dali-orm/references/functions.md
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 README articleSchema has `created_at: datetime('created_at').defaultNow()` (non-optional, auto-default)
- [ ] #2 README wroteSchema has `created_at: datetime('created_at').defaultNow()` instead of `.optional()`
- [ ] #3 cryptoJoaat() function added to crypto.ts with `data: SqlExpr` param
- [ ] #4 SQL output test for cryptoJoaat in functions.test.ts
- [ ] #5 cryptoJoaat exported from functions/index.ts
- [ ] #6 cryptoJoaat listed in skill ref functions.md import example
- [ ] #7 All existing tests still pass (pnpm test)
- [ ] #8 Lint passes (pnpm lint)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Added cryptoJoaat() wrapper + test + export; updated README schema examples to use datetime().defaultNow() (non-optional) in articleSchema and wroteSchema. 2412 tests pass.

<!-- SECTION:FINAL_SUMMARY:END -->
