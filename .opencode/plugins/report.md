# opencode-mem Comprehensive Technical Architecture Report

Date: 2026-05-03  
Repository: `opencode-mem`  
Version analyzed: `2.13.0`

---

## 1. Scope and analysis method

This report is a full architecture-level technical analysis of the current `opencode-mem` codebase, with focus on:

1. How every major feature works end-to-end
2. How storage, vector search, and AI flows are wired
3. What must change to build a similar plugin on another backend database
4. Where the main bottlenecks and architectural risks are

Code was analyzed directly from:

- Plugin entry and runtime orchestration (`src/index.ts`, `src/plugin.ts`)
- Configuration and secrets (`src/config.ts`, `src/services/secret-resolver.ts`)
- Storage and vector layers (`src/services/sqlite/*`, `src/services/vector-backends/*`)
- Capture, profile, and maintenance features (`src/services/*.ts`)
- AI provider stack (`src/services/ai/**/*`)
- Web server and API layer (`src/services/web-server.ts`, `src/services/api-handlers.ts`)
- Web UI (`src/web/*`)
- Test suite for behavior contracts (`tests/**/*`)

---

## 2. Product and system overview

`opencode-mem` is an OpenCode plugin that provides persistent memory for coding sessions. It captures technical outcomes from conversations, stores vectorized memories with metadata, retrieves relevant memories by semantic search, and injects those memories back into chat context.

Beyond memory retrieval, it also includes:

- prompt timeline persistence,
- user profile learning (preferences/patterns/workflows),
- session compaction restoration,
- data maintenance flows (cleanup, dedup, migration),
- and a local web UI/API for management.

### Core runtime responsibilities

At runtime the plugin acts as both:

1. **an OpenCode hook/tool extension** (`chat.message`, `event`, `tool.memory`), and
2. **a local memory platform** (storage, indexing, summarization, profile evolution, UI).

### Technology shape

- Runtime: Bun + TypeScript (ESM)
- Primary persistence: local SQLite files (`bun:sqlite`)
- Vector acceleration: USearch in-memory indexes
- Fallback vector search: exact cosine scan
- Embeddings: local HF Transformers or remote OpenAI-compatible embedding API
- AI summarization/profile extraction: OpenCode provider path or direct providers (OpenAI/Anthropic/Gemini)

---

## 3. Feature inventory (all major features)

This section maps all user-visible and system features to implementation areas.

| Feature                                     | What it does                                             | Primary files                                                             |
| ------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| Memory tool (`add/search/list/forget/help`) | User/agent API for memory operations                     | `src/index.ts`, `src/services/client.ts`                                  |
| Profile tool mode (`profile` read/write)    | Read profile and save explicit preference                | `src/index.ts`, `src/services/user-profile/*`                             |
| Chat memory injection                       | Inject memory/profile context into outgoing prompt parts | `src/index.ts`, `src/services/context.ts`                                 |
| Idle auto-capture                           | Summarize recent technical work and store memory         | `src/services/auto-capture.ts`                                            |
| Prompt timeline capture                     | Persist prompts for linking and analysis                 | `src/services/user-prompt/user-prompt-manager.ts`                         |
| User profile learning                       | Infer preferences/patterns/workflows from prompts        | `src/services/user-memory-learning.ts`                                    |
| Session compaction restoration              | Re-inject session memories after compaction events       | `src/index.ts`                                                            |
| Cleanup and retention                       | Delete old data with pin/link protections                | `src/services/cleanup-service.ts`                                         |
| Deduplication                               | Remove exact duplicates, detect near duplicates          | `src/services/deduplication-service.ts`                                   |
| Embedding model migration                   | Detect dimension mismatch and migrate data               | `src/services/migration-service.ts`                                       |
| Tag migration batch flow                    | Backfill technical tags and re-vectorize                 | `src/services/api-handlers.ts`                                            |
| Vector backend abstraction                  | Switch/use fallback between USearch and exact scan       | `src/services/vector-backends/*`                                          |
| Web API + UI                                | Browse/edit/search/pin/delete and profile introspection  | `src/services/web-server.ts`, `src/services/api-handlers.ts`, `src/web/*` |
| Multi-language UI text                      | English/Chinese UI localization                          | `src/web/i18n.js`                                                         |
| Secret indirection                          | `file://` and `env://` config secret resolution          | `src/services/secret-resolver.ts`                                         |
| Privacy tag stripping                       | Redact `<private>...</private>` blocks                   | `src/services/privacy.ts`                                                 |

---

## 4. Runtime architecture and control flow

## 4.1 Plugin loader contract

`src/plugin.ts` exports a minimal OpenCode plugin module:

- `id` from `package.json`
- `server: OpenCodeMemPlugin`

This is validated in `tests/plugin-loader-contract.test.ts`.

## 4.2 Startup orchestration (`src/index.ts`)

On load:

1. `initConfig(directory)` merges global and project config
2. Derive tags (`getTags(directory)`) for user/project identity
3. One-time warmup guard via global symbol
4. Fire-and-forget fetch of OpenCode state path and connected provider list
5. Optional web server startup
6. Register process shutdown handlers (`SIGINT`, `SIGTERM`)

Then returns handler map:

- `chat.message` hook
- `tool.memory`
- `event`

## 4.3 Hook: `chat.message`

Flow:

1. Ensure feature enabled (`CONFIG.chatMessage.enabled`)
2. Extract text parts from outgoing message
3. Save prompt to prompt store (`userPromptManager.savePrompt`)
4. Read session messages and compute injection conditions:
   - `injectOn: always` or first user turn logic
   - special handling after compaction
5. Pull recent memories with optional filters:
   - exclude current session
   - max age limit
6. Format memory context (`formatContextForPrompt`)
7. Inject as synthetic text part at beginning of output

## 4.4 Tool: `memory`

Modes and behavior:

- `help`: returns schema-like usage info
- `add`: sanitize privacy tags, parse tags, persist memory with metadata
- `search`: semantic query by embedding and vector search
- `profile`:
  - read: return current profile
  - write: save explicit preference (with user identity constraints)
- `list`: list latest memories by scope
- `forget`: delete memory by id

Scope behavior:

- `scope` can be `project` or `all-projects`
- fallback scope from `CONFIG.memory.defaultScope`
- behavior validated in `tests/memory-scope.test.ts` and `tests/tool-scope.test.ts`

## 4.5 Event handling

### `session.idle`

- Debounced by 10s
- Executes `performAutoCapture`
- If this instance owns the web server:
  - run profile learning
  - run cleanup if due
  - checkpoint all DBs

### `session.compacted`

- Pull memories linked by `sessionID`
- Build restore text
- Inject via `ctx.client.session.prompt(... noReply: true)`

---

## 5. Storage architecture (current backend)

## 5.1 File/database topology

Default data root: `~/.opencode-mem/data`

Key SQLite files:

- `metadata.db` (shards table)
- `projects/project_<hash>_shard_<n>.db`
- `users/user_<hash>_shard_<n>.db`
- `user-prompts.db`
- `user-profiles.db`
- `ai-sessions.db`

## 5.2 Connection manager

`src/services/sqlite/connection-manager.ts`:

- maintains path-keyed connection cache
- sets PRAGMAs on open:
  - `busy_timeout=5000`
  - `journal_mode=WAL`
  - `synchronous=NORMAL`
  - `cache_size=-64000`
  - `temp_store=MEMORY`
  - `foreign_keys=ON`
- provides `checkpointAll`, `closeAll`

## 5.3 Shard manager

`src/services/sqlite/shard-manager.ts` manages shard metadata and physical shard creation.

### Key behaviors

- Active shard lookup per `(scope, hash)`
- Auto-rotate to new shard if vector count exceeds threshold
- Shard integrity checks and recreation if invalid/missing
- Stored relative `db_path` resolution to current `CONFIG.storagePath`

### Sharding model

- Scope values: `user` or `project`
- Hash from tag identity
- Logical partitions by hash, then indexed shard number

## 5.4 Memory table schema and semantics

Shard DB `memories` table holds both vector and metadata payload.

Notable design choices:

- vector bytes in BLOB
- optional tags vector in BLOB
- metadata extensibility via JSON text field
- denormalized identity fields for display/UI filtering
- pin flag for cleanup protection

## 5.5 Additional stores in SQLite

### Prompt store

`user_prompts` table tracks:

- capture state (`captured`: 0/1/2 where 2=claimed)
- analysis state (`user_learning_captured`)
- links to generated memory (`linked_memory_id`)

### User profile store

Two tables:

- `user_profiles` (active profile state)
- `user_profile_changelogs` (version snapshots)

### AI session store

Two tables:

- `ai_sessions` (provider session continuity)
- `ai_messages` (ordered conversation messages/tool payloads)

---

## 6. Vector search architecture

## 6.1 Search pipeline

In `src/services/client.ts` and `src/services/sqlite/vector-search.ts`:

1. Embed query text
2. Resolve relevant shards by scope
3. Search each shard (`searchInShard`)
4. Merge result sets, apply threshold and top-k cut

## 6.2 Vector backend abstraction

`VectorBackend` interface supports:

- insert/delete
- batch insert
- search
- index rebuild from DB rows
- shard index delete

Implementations:

- `USearchBackend`: in-memory ANN index per `(scope, hash, shard, kind)`
- `ExactScanBackend`: DB read + cosine ranking

Factory (`backend-factory.ts`) supports modes:

- `usearch-first` (default)
- `usearch`
- `exact-scan`

Fallback-aware backend degrades on runtime errors.

## 6.3 Result scoring model

`searchInShard` combines two similarities:

- content vector sim
- tags vector sim with exact-match word boost

Final weighted score:

- `contentSim * 0.6 + tagsSim * 0.4`

## 6.4 Operational implications

- USearch indexes are ephemeral and rebuilt from SQLite when needed
- SQLite remains authoritative source
- Degrade path preserves correctness but may reduce performance substantially

---

## 7. Embedding architecture

`src/services/embedding.ts` provides singleton embedding service.

## 7.1 Modes

### Local model mode

- Lazy-loads `@huggingface/transformers`
- Builds feature-extraction pipeline with configured model
- Uses mean pooling + normalize
- Caches model artifacts under `CONFIG.storagePath/.cache`

### Remote API mode

- Calls `POST {embeddingApiUrl}/embeddings`
- Requires resolved API key
- Converts response vectors to `Float32Array`

## 7.2 Caching and timeout

- In-memory text-to-vector cache (size 100)
- 30s timeout wrapper for embedding operations
- Cache reset if embedding model changes

---

## 8. Identity, scope, and tagging architecture

`src/services/tags.ts` is foundational for data partitioning.

### Identity derivation

- user identity from overrides or git config (`user.email`, `user.name`)
- project identity from git common dir / top level / remote URL / path fallback

### Scope tags

- user tag: `opencode_user_<sha256-16>`
- project tag: `opencode_project_<sha256-16>`

This drives shard selection, search scope, and display metadata.

### Worktree handling

Project identity logic attempts to keep consistent tags across git worktrees; validated in `tests/project-scope.test.ts`.

---

## 9. Auto-capture architecture

`src/services/auto-capture.ts` transforms conversations into durable technical memory.

## 9.1 Capture contract

- Only technical conversations should be captured
- Non-technical output can be marked `type="skip"`
- Summary must include request + outcome, technical details, and tags

## 9.2 Pipeline details

1. Get last uncaptured prompt for session
2. Claim prompt atomically (`captured=2`) to avoid duplicate workers
3. Fetch full session messages from OpenCode
4. Slice assistant responses after prompt message id
5. Extract:
   - text responses
   - tool calls and trimmed argument previews
6. Include previous memory context (latest memory snippet)
7. Send analysis prompt to provider
8. If non-skip, persist memory with metadata and linked prompt id

## 9.3 Provider paths

- **OpenCode provider path** (preferred if configured): uses structured output via `generateText` + zod schema
- **Manual provider path**: uses provider-specific tool-call execution loop

---

## 10. User profile learning architecture

`src/services/user-memory-learning.ts` + `src/services/user-profile/*`

## 10.1 Trigger policy

- runs when unanalyzed prompt count reaches `userProfileAnalysisInterval`
- currently triggered during idle processing when web server owner

## 10.2 Model output contract

Structured categories:

- `preferences`
- `patterns`
- `workflows`

Language is expected to match user prompt language.

## 10.3 Merge and lifecycle logic

`mergeProfileData` behavior:

- dedupe by category+description (preferences/patterns)
- confidence/frequency increment strategies
- cap list sizes by config maxes
- keep changelog snapshots and cleanup old versions

Supports explicit writes via `memory(profile + content)` in addition to inferred updates.

---

## 11. AI provider integration architecture

## 11.1 Factory and provider set

`AIProviderFactory` supports:

- `openai-chat`
- `openai-responses`
- `anthropic`
- `google-gemini`

## 11.2 OpenCode provider integration

`src/services/ai/opencode-provider.ts`:

- stores state path and connected providers from OpenCode runtime
- reads auth state from potential auth.json locations
- supports OAuth token refresh for Anthropic
- creates SDK provider adapters (`@ai-sdk/anthropic`, `@ai-sdk/openai`)

## 11.3 Session continuity

External provider sessions are persisted in `ai-sessions.db`, allowing multi-iteration tool-call flows.

## 11.4 Validation and defensive behavior

- structured output uses zod schema (opencode path)
- fallback providers validate tool output structure
- explicit errors for unsupported temperature/model combinations

---

## 12. Web server and API architecture

## 12.1 Server ownership and takeover

`WebServer` supports singleton-like behavior per host/port:

- if port occupied, instance becomes non-owner and enters health-check loop
- attempts takeover when owner disappears
- jitter added to reduce takeover herd

## 12.2 API surface

Major route groups:

- `/api/tags`
- `/api/memories` CRUD + bulk delete + pin/unpin
- `/api/search`
- `/api/stats`
- `/api/cleanup`, `/api/deduplicate`
- `/api/migration/*` for model/tag migration flows
- `/api/prompts/*`
- `/api/user-profile/*`

## 12.3 Handler responsibilities

`api-handlers.ts` currently combines:

- HTTP-level input/output shaping
- domain logic
- storage queries
- maintenance orchestration

This makes it functional but highly coupled.

## 12.4 UI behavior

`src/web/app.js` features:

- timeline view mixing memories and linked prompts
- search/filter/pagination
- edit/delete/bulk delete
- pin/unpin
- cleanup/dedup actions
- migration workflows with progress polling
- profile dashboard with changelog
- language toggle (EN/ZH)

---

## 13. Configuration architecture

## 13.1 Config sources and precedence

Sources:

- user-level: `~/.config/opencode/opencode-mem.jsonc|json`
- project-level: `<project>/.opencode/opencode-mem.jsonc|json`

Project config shallow-overrides global config.

## 13.2 Defaults and option surface

Notable categories:

- storage (`storagePath`, shard size)
- embedding model/API
- vector backend strategy
- auto-capture controls
- provider credentials and model selection
- web server host/port
- cleanup and dedup thresholds
- profile learning caps
- compaction and chat injection controls

## 13.3 Secret value resolution

`resolveSecretValue` supports:

- direct value
- `file://path`
- `env://VAR_NAME`

With warning on permissive file mode (non-Windows).

---

## 14. Test coverage and confidence signals

Test suite covers:

- plugin loader contract
- config defaults and project override behavior
- scope semantics
- vector backend behavior + fallback
- provider request-shape behavior
- path normalization and tags
- privacy redaction
- profile manager update semantics

What is less covered (based on repo tests):

- full end-to-end auto-capture flow with real provider responses
- long-running cleanup/dedup scalability behavior
- multi-session concurrency contention
- web server takeover race under heavy parallel starts

---

## 15. Porting to another backend DB: technical migration plan

This is the core section for your goal: building a similar project with another backend database.

## 15.1 Current coupling map you must break

Hard dependencies to remove/abstract:

1. `bun:sqlite` bootstrap and DB object assumptions
2. SQL scattered outside storage modules
3. Shard manager assumptions tied to file-system DB paths
4. Maintenance services directly scanning shard DB rows
5. Prompt/profile/session stores hard-coded to SQLite

## 15.2 Recommended target architecture (adapter/port model)

Introduce these interfaces:

- `MemoryRepository`
- `PromptRepository`
- `ProfileRepository`
- `AISessionRepository`
- `MaintenanceRepository`

Then implement:

- `SQLiteRepositories` (legacy/compat mode)
- `YourBackendRepositories` (new target)

Inject repositories into services at startup after config load.

## 15.3 Data domains to migrate

You need to migrate not only memories, but also:

- memory metadata and pin state
- prompt-memory links
- profile and changelog versions
- AI provider session/message histories

## 15.4 Backend capability requirements

Minimum requirements for your target backend:

1. vector similarity search with metadata filters
2. consistent ordering by created/updated times
3. atomic updates for link + counters + writes
4. efficient pagination and aggregate counts
5. support for tenant-like partition key (project/user tag)

## 15.5 Suggested migration phases

### Phase A: architectural prep

- isolate storage access behind repositories
- remove direct SQL from handlers/services
- preserve current behavior through tests

### Phase B: new backend implementation

- implement repositories
- add compatibility integration tests
- ensure vector score semantics match expected quality

### Phase C: data migration and rollout

- one-time migrator from SQLite files to new backend
- dual-read verification mode (temporary)
- cutover with rollback switch

---

## 16. Bottlenecks and risks (detailed)

## 16.1 Critical bottlenecks

1. **Module-load singletons capture stale config**
   - Many managers are instantiated before `initConfig(directory)`
   - Project-specific config (especially `storagePath`) may not be applied consistently
   - This is a correctness issue, not just performance

2. **Synchronous execution model**
   - `execSync` for git identity
   - synchronous SQLite operations in hot paths
   - can block event loop during capture/search/list and maintenance

3. **Fan-out search/list with in-memory merge/sort**
   - large datasets will create latency and memory pressure
   - `all-projects` behavior amplifies this

4. **Fallback exact scan scaling limits**
   - graceful degradation preserves functionality
   - but high cardinality search may become slow enough to degrade UX

## 16.2 High-severity design risks

5. **Global mutable process flags**
   - capture/learning serialized globally (`isCaptureRunning`, `isLearningRunning`)
   - poor concurrency across independent sessions

6. **Weak transaction boundaries**
   - multi-step updates (delete/insert/counter/link) can partially fail

7. **`LIKE` over JSON metadata for session filtering**
   - fragile and non-index-friendly

8. **Maintenance complexity**
   - dedup pairwise comparisons and broad scans can become expensive

9. **API/web layer duplication**
   - duplicate route logic in `web-server.ts` and `web-server-worker.ts`

## 16.3 Medium risks

10. **`isConfigured()` always true**
    - weak config validation and confusing readiness semantics

11. **Web API auth model**
    - no auth on API endpoints, permissive CORS
    - acceptable for localhost default, risky for network exposure

12. **Import-time side effects**
    - config file creation on import can surprise tests/embeds

13. **Endpoint edge inconsistencies**
    - minor parameter naming mismatches and uneven error handling

---

## 17. Prioritized hardening roadmap (before backend swap)

If you want a production-grade fork on another DB, execute in this order:

1. **Initialization refactor**
   - remove module-load singleton construction for config-sensitive services
   - initialize service graph after `initConfig`

2. **Storage abstraction layer**
   - create repository interfaces and move all SQL out of non-storage files

3. **Concurrency and transactions**
   - add scoped locks per session/project instead of global booleans
   - enforce transactional write bundles

4. **Search/list scalability**
   - push pagination/filter/ranking to backend
   - avoid broad in-memory aggregation

5. **Observability and safeguards**
   - structured logs per flow id
   - add health and latency metrics for search/capture/cleanup

6. **Security and config checks**
   - enforce minimum config validation
   - optional API token when host != localhost

---

## 18. Direct answer to your goal

You can build a very similar plugin on another backend DB, but the fastest safe path is:

1. first isolate storage interfaces,
2. then implement the new backend adapters,
3. then migrate data and cut over.

Do not start by directly swapping `sqlite/*` files only. The current architecture has cross-cutting storage logic in handlers, maintenance services, and auxiliary stores (prompts/profiles/sessions). If you skip the abstraction step, your new backend implementation will become brittle quickly.

---

## 19. Appendix: key code locations

- Plugin runtime: `src/index.ts`, `src/plugin.ts`
- Config: `src/config.ts`
- Memory client: `src/services/client.ts`
- Embedding service: `src/services/embedding.ts`
- SQLite stack: `src/services/sqlite/connection-manager.ts`, `src/services/sqlite/shard-manager.ts`, `src/services/sqlite/vector-search.ts`
- Vector backends: `src/services/vector-backends/backend-factory.ts`, `src/services/vector-backends/usearch-backend.ts`, `src/services/vector-backends/exact-scan-backend.ts`
- Auto-capture: `src/services/auto-capture.ts`
- Profile learning: `src/services/user-memory-learning.ts`
- Prompt store: `src/services/user-prompt/user-prompt-manager.ts`
- Profile store: `src/services/user-profile/user-profile-manager.ts`
- AI sessions: `src/services/ai/session/ai-session-manager.ts`
- Provider integration: `src/services/ai/opencode-provider.ts`, `src/services/ai/providers/*`
- Web server/API: `src/services/web-server.ts`, `src/services/api-handlers.ts`
- Web UI: `src/web/index.html`, `src/web/app.js`, `src/web/i18n.js`

---

## 20. Exact tech stack (packages, runtime, tooling)

This section answers the stack question directly with the concrete dependencies currently in `package.json`.

## 20.1 Runtime and platform

- Runtime target: **Bun**
- Language: **TypeScript** (compiled to ESM JS)
- Module type: `"type": "module"`
- Plugin SDK target: OpenCode plugin contract (`@opencode-ai/plugin`, `@opencode-ai/sdk`)

## 20.2 Production dependencies and role

| Package                     | Version    | Role in system                                          |
| --------------------------- | ---------- | ------------------------------------------------------- |
| `@opencode-ai/plugin`       | `^1.3.0`   | Plugin hooks/tool registration                          |
| `@opencode-ai/sdk`          | `^1.3.0`   | OpenCode SDK types and runtime surfaces                 |
| `@huggingface/transformers` | `^4.0.1`   | Local embedding model inference                         |
| `usearch`                   | `^2.21.4`  | In-memory vector ANN index backend                      |
| `ai`                        | `^6.0.116` | Structured generation (`generateText`, `Output.object`) |
| `@ai-sdk/anthropic`         | `^3.0.58`  | Anthropic provider adapter                              |
| `@ai-sdk/openai`            | `^3.0.41`  | OpenAI provider adapter                                 |
| `zod`                       | `^4.3.6`   | Structured output validation/schema                     |
| `franc-min`                 | `^6.2.0`   | Language detection for auto-capture/profile prompts     |
| `iso-639-3`                 | `^3.0.1`   | Language code/name mapping                              |

## 20.3 Dev/build toolchain

| Package       | Version   | Purpose                      |
| ------------- | --------- | ---------------------------- |
| `typescript`  | `^5.7.3`  | Compile and declaration emit |
| `@types/bun`  | `^1.3.8`  | Bun typing support           |
| `prettier`    | `^3.4.2`  | formatting                   |
| `husky`       | `^9.1.7`  | git hooks                    |
| `lint-staged` | `^16.2.7` | staged file formatting       |

Build script behavior:

- `bunx tsc`
- copy static web files `src/web/*` -> `dist/web/`

---

## 21. How data is saved to DB (exact persistence flow)

This section explains exactly how memory records reach persistent storage.

## 21.1 Memory write path (tool `add`, auto-capture, web API)

All major write flows eventually converge on this path:

1. Caller constructs memory content + metadata
   - Tool path: `tool.memory` mode `add` (`src/index.ts`)
   - Auto-capture path: `performAutoCapture` (`src/services/auto-capture.ts`)
   - Web API path: `handleAddMemory` (`src/services/api-handlers.ts`)
2. Content is embedded (`embeddingService.embedWithTimeout`)
3. Optional tags are embedded into `tagsVector`
4. Container tag (`opencode_project_*` or `opencode_user_*`) is resolved to scope/hash
5. Write shard selected (`shardManager.getWriteShard`)
6. Record assembled (`MemoryRecord`) with id + metadata + vectors
7. SQL insert via `vectorSearch.insertVector`
8. Vector backend index insert (`USearch` or fallback backend)
9. Metadata shard counter increment (`shardManager.incrementVectorCount`)

## 21.2 SQL insertion details

`vectorSearch.insertVector` performs:

- SQL `INSERT INTO memories (...) VALUES (...)`
- vector BLOB conversion via `toBlob(Float32Array) => Uint8Array(buffer)`
- index-side insert for `content` and optionally `tags`
- rollback-on-index-failure behavior:
  - if vector index insert fails after SQL insert, code deletes the inserted row

## 21.3 Memory id format

Generated id pattern:

- `mem_<timestamp>_<randomBase36>`

Used consistently in `client.ts` and API add handlers.

## 21.4 Update path

`handleUpdateMemory` currently does a delete + reinsert flow:

1. find shard containing id
2. delete record + index
3. recompute vectors from new content/tags
4. reinsert memory record

This is functional but not transactional (important for reliability planning).

## 21.5 Delete path

Delete scans shards to find id, then:

- removes row from `memories`
- removes index entries (`content` + `tags`)
- decrements shard vector count

Cascade deletion (memory<->prompt link) is supported in API handlers.

## 21.6 Other DB write domains

### Prompt DB (`user-prompts.db`)

- every relevant chat prompt saved with session/message/project
- capture states tracked (`captured`, `user_learning_captured`)
- memory link stored (`linked_memory_id`)

### Profile DB (`user-profiles.db`)

- active profile row updated version-by-version
- full snapshot changelog row inserted per update

### AI session DB (`ai-sessions.db`)

- provider sessions persisted (`conversation_id`, metadata, expiry)
- ordered message rows persisted for multi-turn provider interactions

---

## 22. Vectors: generation, storage, indexing, scoring

## 22.1 Embedding generation

Two embedding modes:

1. **Local model mode**
   - `@huggingface/transformers` pipeline: `feature-extraction`
   - options: mean pooling, normalization
   - model cache under `${storagePath}/.cache`
2. **Remote API mode**
   - `POST {embeddingApiUrl}/embeddings`
   - body: `{ input, model }`
   - reads `data[0].embedding`

Timeout per embedding call: `30000ms`.

## 22.2 Embedding dimensions

- Default model: `Xenova/nomic-embed-text-v1`
- Default dimensions: `768`
- Dimension inference table in `config.ts` for many known models
- Actual configured dimensions are saved in each shard's `shard_metadata` table

## 22.3 Physical vector storage format

- In-memory type: `Float32Array`
- Persisted as BLOB bytes (`Uint8Array(vector.buffer)`)
- Reconstructed by `new Float32Array(arrayBufferSlice)` in backends

Two vector fields per memory row:

- `vector` (content embedding)
- `tags_vector` (tag embedding, optional)

## 22.4 Index backends and rebuild behavior

### USearch backend

- Index key format: `${scope}_${scopeHash}_${shardIndex}_${kind}`
- Uses in-memory `usearch.Index({ dimensions, metric: "cos" })`
- Maintains `id <-> bigint key` maps
- `rebuildFromShard` loads all vectors from SQLite row set into index

### Exact scan backend

- no persistent index
- query-time full scan from DB row vectors
- cosine similarity ranking and top-k slicing

### Degradation model

- if USearch probe/create/search/rebuild fails, backend degrades to exact scan
- correctness retained, speed can drop significantly on large datasets

## 22.5 Ranking/scoring formula in search

Per result:

- `contentSim = 1 - contentDistance`
- `tagsSim = 1 - tagsDistance`
- exact word boost computed from query words vs memory tags
- `finalTagsSim = max(tagsSim, exactMatchBoost)`
- final score:

`similarity = contentSim * 0.6 + finalTagsSim * 0.4`

Then filtered by similarity threshold and top-k limit.

---

## 23. APIs used (internal OpenCode, local HTTP, external providers)

## 23.1 OpenCode host APIs used by plugin

Via `ctx.client` the plugin calls:

- `path.get()` -> discover OpenCode state path
- `provider.list()` -> connected provider names
- `session.messages({ path: { id } })` -> fetch chat history
- `session.prompt({ path: { id }, body })` -> inject compaction restore context
- `tui.showToast(...)` -> user notifications

## 23.2 External network APIs used

### Embedding API (optional remote)

- Endpoint: `POST {embeddingApiUrl}/embeddings`
- Auth: `Authorization: Bearer {embeddingApiKey}`
- Body: `{ input: string, model: string }`

### OpenAI Chat Completions (memory provider mode)

- Endpoint: `POST {memoryApiUrl}/chat/completions`
- Body includes:
  - `model`
  - `messages`
  - `tools`
  - `tool_choice: "auto"`
  - `temperature` unless disabled

### OpenAI Responses API

- Endpoint: `POST {memoryApiUrl}/responses`
- Body includes:
  - `model`
  - `input`
  - `tools`
  - `conversation` or `instructions`

### Anthropic Messages API

- Endpoint: `POST {memoryApiUrl}/messages`
- Headers include:
  - `anthropic-version: 2023-06-01`
  - `x-api-key` when API mode
- Body includes:
  - `model`
  - `max_tokens`
  - `system`
  - `messages`
  - `tools`

### Google Gemini API

- Endpoint: `POST {apiUrl}/models/{model}:generateContent?key={apiKey}`
- Uses function declaration tool format and `functionCallingConfig`

### Anthropic OAuth refresh (OpenCode provider path)

- Endpoint: `POST https://console.anthropic.com/v1/oauth/token`
- Used when OpenCode auth type is OAuth and access token expired

## 23.3 Local plugin HTTP API (web UI)

All served by Bun local server. Main routes:

- `GET /api/tags`
- `GET /api/memories`
- `POST /api/memories`
- `PUT /api/memories/:id`
- `DELETE /api/memories/:id`
- `POST /api/memories/bulk-delete`
- `POST /api/memories/:id/pin`
- `POST /api/memories/:id/unpin`
- `GET /api/search`
- `GET /api/stats`
- `POST /api/cleanup`
- `POST /api/deduplicate`
- `GET /api/migration/detect`
- `POST /api/migration/run`
- `GET /api/migration/tags/detect`
- `POST /api/migration/tags/run-batch`
- `GET /api/migration/tags/progress`
- `DELETE /api/prompts/:id`
- `POST /api/prompts/bulk-delete`
- `GET /api/user-profile`
- `GET /api/user-profile/changelog`
- `GET /api/user-profile/snapshot`
- `POST /api/user-profile/refresh`

Note: snapshot endpoint currently expects `chlogId` query key in implementation.

---

## 24. Concrete payload examples (from actual code paths)

## 24.1 Embedding request payload

```json
{
  "input": "Project uses feature flags and blue-green deploy",
  "model": "Xenova/nomic-embed-text-v1"
}
```

## 24.2 Memory API add payload (`POST /api/memories`)

```json
{
  "content": "Migrated auth middleware to token introspection",
  "containerTag": "opencode_project_a1b2c3d4e5f6a7b8",
  "type": "refactor",
  "tags": ["auth", "middleware", "token"]
}
```

## 24.3 OpenAI chat completion tool-call request shape

```json
{
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "save_memory",
        "description": "Save summary",
        "parameters": { "type": "object", "properties": {}, "required": [] }
      }
    }
  ],
  "tool_choice": "auto"
}
```

## 24.4 Stored memory record fields (logical view)

```text
id: mem_...
content: string
vector: BLOB(Float32Array)
tags_vector: BLOB(Float32Array) | null
container_tag: opencode_project_* or opencode_user_*
tags: comma-separated string | null
type: string | null
created_at / updated_at: epoch millis
metadata: JSON text | null
display_name / user_name / user_email / project_path / project_name / git_repo_url
is_pinned: 0|1
```

---

## 25. DB backend replacement impact summary (quick map)

If you swap backend, these functional domains must be reimplemented end-to-end:

1. memory persistence + vector retrieval
2. shard/partition selection logic
3. prompt timeline persistence + link integrity
4. profile/changelog persistence
5. AI session/message persistence
6. maintenance operations (cleanup/dedup/migration)

The fastest stable strategy is to keep service logic and replace storage behind repository interfaces first.
