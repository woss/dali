---
id: TASK-047
title: Validate generator HNSW SQL against embedded SurrealDB
status: Done
assignee: []
created_date: '2026-06-06 09:19'
updated_date: '2026-06-06 09:41'
labels:
  - testing
  - hnsw
  - integration
dependencies: []
modified_files:
  - packages/dali-orm/src/migration/core/__tests__/generator.integration.test.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Generator tests (generator.test.ts) are pure string matching — they construct mock objects and assert SQL output. This misses syntax errors like `DISTANCE` vs `DIST` because no SQL is ever executed against a real SurrealDB engine. The only HNSW integration test (introspect.integration.test.ts) soft-skips HNSW because embedded `mode: 'memory'` doesn't support it.

Add generator.integration.test.ts that:
1. Connects to embedded SurrealDB (try file-backed mode, fall back to memory)
2. Generates all HNSW index variations (COSINE, EUCLIDEAN, MANHATTAN, with/without vectorType)
3. Executes the generated SQL against the live engine
4. Asserts no error — syntax validation that catches generator bugs
5. Cleans up test tables after each case

If file-backed embedded mode also doesn't support HNSW, the test should fail explicitly (not silently skip like the current introspect test).

See the HNSW test helpers at generator.test.ts:27-33 (index() helper) and the existing integration test pattern at introspect.integration.test.ts:1-49 (EmbeddedDriver setup).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 generator.integration.test.ts exists alongside generator.test.ts
- [x] #2 Uses EmbeddedDriver (file-backed mode preferred) for real SQL execution
- [x] #3 Covers all HNSW distance types: COSINE, EUCLIDEAN, MANHATTAN
- [x] #4 Covers HNSW with and without vectorType (float32, float64)
- [x] #5 Test fails if generated SQL is rejected by SurrealDB engine
- [x] #6 All existing 2419 tests still pass
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

**Task**: Validate generator HNSW SQL against embedded SurrealDB

**File**: `packages/dali-orm/src/migration/core/__tests__/generator.integration.test.ts` (182 lines)

**Setup**: Uses `EmbeddedDriver` with `surrealkv` (file-backed) mode, falling back to `memory`. Each test creates a unique table, defines a vector field, generates HNSW index SQL via `SurrealQLGenerator.generateIndexDefinition()`, executes it against the live engine, asserts no error, then cleans up.

**5 test cases covering all variations**:
1. HNSW COSINE with float32 → `TYPE F32 DIST COSINE`
2. HNSW with minimal params (dimension only) → no type/distance
3. HNSW MANHATTAN + float64 → `TYPE F64 DIST MANHATTAN`
4. HNSW EUCLIDEAN (no vectorType) → `DIST EUCLIDEAN`
5. HNSW float deprecated alias + COSINE → `TYPE F64 DIST COSINE`

**Bug caught**: All 5 tests originally failed because generator emitted `TYPE float32`/`TYPE float64`/`TYPE float` — SurrealDB expects `TYPE F32`/`TYPE F64`. Fixed by adding `VECTOR_TYPE_TO_SQL` mapping in `generator.ts`.

**Result**: All 2424 tests pass (62 test files, 0 failures).
<!-- SECTION:FINAL_SUMMARY:END -->
