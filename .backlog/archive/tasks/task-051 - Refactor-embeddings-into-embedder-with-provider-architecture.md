---
id: TASK-051
title: Refactor embeddings into embedder/ with provider architecture
status: Done
assignee: []
created_date: '2026-05-17 16:37'
updated_date: '2026-05-18 19:03'
labels:
  - refactor
  - embedding
  - dali-memory
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Extract ALL embedding functionality from `src/embedding.ts` into `src/embedder/` directory. Replace singleton `EmbeddingService` with provider-based architecture supporting `remote` (existing fetch) and `transformers` (local HF pipeline) providers.

**Context:**

- `src/embedding.ts` has `EmbeddingService` class with `configure()`, `embed()`, `clearCache()` + singleton `embeddingService` export
- `src/embedder/embedder.ts` exists but is EMPTY (0 lines)
- `src/test-embed.ts` shows working transformers pipeline using `@huggingface/transformers` with `Xenova/all-MiniLM-L6-v2`
- `@huggingface/transformers@4.2.0` is already a dependency
- `zod@4.1.8` is already a dependency
- `memory-service.ts` imports `embeddingService` from `'./embedding.ts'`

**Key Constraints:**

- NO TypeScript interfaces/types — all schemas in Zod
- NO barrel re-exports — `embedding.ts` is DELETED
- NO mocking transformers pipeline in tests — use fixture vectors instead
- Model cache dir: `~/.config/dali-memory/model_cache/`
- Existing configs without `provider` field default to `'remote'` for backward compat

**Files to create:**

- `src/embedder/schemas.ts` — all Zod schemas (embedder config, embed result)
- `src/embedder/remote-provider.ts` — fetch-based provider (extracted from `embedding.ts`)
- `src/embedder/transformers-provider.ts` — HF pipeline provider (from `test-embed.ts`)
- `src/embedder/embedder.test.ts` — tests for facade: provider selection, cache, schema validation
- `src/embedder/remote-provider.test.ts` — moved from `src/__tests__/embedding.test.ts`, keep fetch mocks
- `src/embedder/transformers-provider.test.ts` — use fixture vectors, test class wiring + config + embed shape
- `src/embedder/__fixtures__/embeddings.ts` — pre-computed fixture vectors for tests

**Files to update:**

- `src/config.ts` — add `provider` and `modelCacheDir` fields to embedding config, use Zod schema
- `src/memory-service.ts` — import from `'./embedder/embedder.ts'` instead of `'./embedding.ts'`
- `src/__tests__/memory-service.integration.test.ts` — update `embeddingService` import path
- `package.json` exports — update `"./embedding"` to `"./dist/embedder/embedder.mjs"`

**Files to delete:**

- `src/embedding.ts` (no barrel — delete entirely)
- `src/__tests__/embedding.test.ts` (moved to `embedder/remote-provider.test.ts`)

**Provider contract:**
Both providers implement same pattern: `configure(config)` initializes, `embed(text)` returns `{ vector: Float32Array, dimensions: number } | null`. The `transformers` provider loads model during `configure()` (slow once, then fast).

**Transformers embed logic** (from test-embed.ts):

```typescript
const pipe = await pipeline('feature-extraction', modelName, {
  cache_dir: modelCacheDir,
  dtype: 'fp32',
});
const output = await pipe(text, { pooling: 'mean', normalize: true });
// parse output.data into Float32Array
```

**Config schema (Zod):**

```typescript
export const embedderConfigSchema = z.object({
  provider: z.enum(['remote', 'transformers']).default('remote'),
  model: z.string(),
  endpoint: z.string().optional(),
  apiKey: z.string().optional(),
  modelCacheDir: z.string().optional(),
});
```

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 embedding.ts deleted, no barrel file created
- [x] #2 src/embedder/schemas.ts has all Zod schemas, no TS interfaces
- [x] #3 RemoteEmbedProvider works identically to current EmbeddingService
- [x] #4 TransformersEmbedProvider loads model on configure(), caches at ~/.config/dali-memory/model_cache/
- [x] #5 embedder/embedder.ts facade delegates to correct provider based on config.provider
- [x] #6 memory-service.ts imports from ./embedder/embedder.ts, zero logic changes
- [x] #7 All existing tests pass (remote-provider.test.ts, memory-service.integration.test.ts)
- [x] #8 Transformers embed tests use fixture vectors, no mocked pipeline calls
- [x] #9 package.json exports updated for ./embedding path
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

- Fixed 3 surreal-client integration tests failing under workspace-wide coverage (upsertSession, saveMessage x2)

- Root cause: concurrent migration runner access to meta/\_journal.json in fork pool

- Fix: added 3-attempt retry loop with linear backoff (500ms/1000ms/1500ms) to applyPendingMigrations()

- All 2458 tests pass under workspace pnpm test:coverage
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done

<!-- DOD:BEGIN -->

- [x] #1 pnpm lint passes with 0 errors
- [x] #2 pnpm test:coverage runs green for dali-memory tests
<!-- DOD:END -->
