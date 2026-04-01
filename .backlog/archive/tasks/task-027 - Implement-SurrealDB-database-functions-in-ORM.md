---
id: TASK-027
title: Implement SurrealDB database functions in ORM
status: Done
assignee: []
created_date: '2026-05-02 19:56'
updated_date: '2026-05-19 18:27'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Wrap all SurrealDB database functions (array, crypto, count, set, string, time, type, sleep, session, vector, sequence, value, object, parse, record, math, geo) as type-safe TypeScript helpers matching official docs.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Each function category has dedicated module
- [x] #2 Full TypeScript type coverage for params/returns
- [x] #3 Unit tests for all functions
- [x] #4 Documentation aligns with SurrealDB specs
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

## Summary

Implemented missing SurrealDB database function modules. All 17 categories from task spec now covered with type-safe TypeScript wrappers.

### What was missing (gaps before this task):

1. **object.ts** - No `object::` functions existed
2. **sequence.ts** - No `sequence::` functions existed
3. **crypto.ts** - Missing blake3, bcrypt, scrypt, pbkdf2, uuid functions

### Files created:

- `packages/dali-orm/src/sdk/functions/object.ts` — 8 functions (entries, extend, from_entries, is_empty, keys, len, remove, values)
- `packages/dali-orm/src/sdk/functions/sequence.ts` — 3 functions (next, peek, set)

### Files modified:

- `packages/dali-orm/src/sdk/functions/crypto.ts` — added 9 functions (blake3, bcrypt generate/compare, scrypt generate/compare, pbkdf2 generate/compare, uuid v4/v7)
- `packages/dali-orm/src/sdk/functions/index.ts` — added exports for object, sequence modules + new crypto functions
- `packages/dali-orm/src/sdk/functions/__tests__/functions.test.ts` — added 21 new SQL output tests
- `.agents/skills/dali-orm/references/functions.md` — added Object, Sequence sections; expanded Crypto section

### Verification:

- 2163 tests pass (48 files)
- All functions follow consistent pattern: `import type { SqlExpr }`, template literal with `as SqlExpr` cast, camelCase prefix
- All exports in alphabetical order in index.ts
- Each function has matching SQL output test
<!-- SECTION:FINAL_SUMMARY:END -->
