---
id: TASK-046
title: Migrate project to Vite+ unified toolchain
status: Done
assignee: []
created_date: '2026-05-15 19:06'
updated_date: '2026-05-16 21:48'
labels:
  - tooling
  - migration
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Migrate the dali-orm monorepo from separate tooling (Biome, tsdown, tsup, Vitest standalone, Turbo-like pnpm -r) to Vite+ (`vp` CLI) as the unified toolchain.

## Current Stack

- **Biome**: linting/formatting (`pnpm lint`, `pnpm format`)
- **tsdown**: builds (dali-orm, dali-memory have tsdown.config.ts)
- **tsup**: builds (kit, orm packages)
- **Vitest**: testing (each package has vitest.config.ts)
- **Husky**: git hooks
- **pnpm -r**: task runner
- **dotenv**: env loading in vitest configs

## Target Stack (Vite+)

- `vp lint` / `vp fmt` → replaces Biome (Oxlint/Oxfmt under the hood)
- `vp pack` → replaces tsdown/tsup for library builds
- `vp test` → wraps Vitest 4.1+
- `vp staged` → replaces husky pre-commit hooks
- `vp run` → replaces pnpm -r for task orchestration
- `vp env` → manages Node.js runtime

## Key Concerns

- Biome rules may not map 1:1 to Oxlint rules — audit after migration
- Imports need rewriting: `vitest/config` → `vite-plus/test`, `vitest` → `vite-plus/test`
- Vite+ requires Vite 8+ and Vitest 4.1+
- Per-package configs (tsdown, vitest) need consolidation into vite.config.ts at project root
- Publint/attw validation not built into Vite+ — may need separate manual scripts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 vp CLI installed and `vp help` works
- [x] #2 vp migrate runs successfully (or manual migration completes)
- [x] #3 All configs consolidated into root vite.config.ts (pack, test, lint, fmt blocks)
- [x] #4 All imports rewritten: vitest → vite-plus/test
- [x] #5 All package.json scripts updated to vp commands
- [x] #6 `vp test` passes for all workspace packages
- [x] #7 `vp pack` builds all packages successfully
- [x] #8 `vp check` passes (format, lint, type-check)
- [x] #9 Old config files removed (tsdown.config.ts, vitest.config.ts per package, biome.json)
- [x] #10 CI pipeline updated to use vp commands
- [x] #11 Biome → Oxlint rule differences audited and documented
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Vite+ migration confirmed complete. All 2,089 tests pass across both packages (36 files in dali-orm, 11 in dali-memory). vp CLI installed via pnpm catalog overrides. All imports use `vite-plus/test`. Scripts use `vp` commands. No remaining migration work needed.

<!-- SECTION:FINAL_SUMMARY:END -->
