## <<<<<<< New base: init memory

id: TASK-040
title: Fact extraction and consolidation flow
status: Done
assignee: []
created_date: '2026-05-10'
updated_date: '2026-05-12'
labels: []
dependencies: []
priority: medium

---

## Description

Design and implement the fact extraction flow. Facts are knowledge statements extracted from conversations (e.g., "User prefers Python over Rust"). Currently dali-memory has storage for facts (`facts` table + `relates_to` edge) but no fact extraction logic.

### Current Architecture

- **dali-memory** stores facts + links them to memories via graph edges. No LLM access. No extraction logic.
- **OpenCode agent** has LLM access but no fact tool in the `dali_memory` plugin.

### Who Creates Facts

The **OpenCode agent** creates facts — it has the LLM to understand conversation context. dali-memory is purely a storage backend.

### Who Stores Facts

dali-memory stores facts via `memoryService.saveFact(content, verified)` and links via `memoryService.linkMemoryToFact(memoryId, factId)`.

### Missing From Plugin

The `dali_memory` OpenCode tool only supports modes: `add`, `search`, `list`, `forget`, `help`, `profile`. No fact modes exist.

### Proposed Flow

1. **Message consolidation** — `session.compacted` event fires after message compression
2. **dali-memory receives event** — currently `session.compacted` case exists but is empty (opencode.ts line 218-220)
3. **Agent extracts facts** — agent uses LLM to identify knowledge statements from compacted messages
4. **Agent stores facts** — agent calls `dali_memory` tool with new fact modes:
   - `fact_add(content, memoryId?)` — store fact, optionally link to memory
   - `fact_list(memoryId?)` — retrieve facts for a memory or all
   - `fact_verify(factId)` — mark fact as verified

### Options for Design

1. **Agent-pushed** (current pattern): Agent extracts facts, pushes to dali-memory via tool. Simple, no new deps.
2. **Event-driven**: dali-memory listens to `session.compacted`, triggers agent-in-the-middle to extract facts, stores them.
3. **Autonomous dali-memory**: dali-memory gains LLM access, runs extraction itself during `session.compacted` (biggest change, most complex).

### Requirements

- Add fact modes to `dali_memory` tool in `opencode.ts`
- Wire `session.compacted` event to trigger fact extraction
- Expose `saveFact`, `linkMemoryToFact`, `getFactsForMemory` through the tool interface
- Determine who runs LLM extraction (agent or dali-memory)

### Files to Modify

- `packages/dali-memory/src/opencode.ts` — Add fact tool modes + event handler

### Not In Scope

- LLM extraction logic itself (that's agent-side)
- Changes to `memoryService` or `surrealClient` (already has fact storage)
  |||||||
  =======

---

id: TASK-040
title: Fact extraction and consolidation flow
status: Done
assignee: []
created_date: '2026-05-10'
updated_date: '2026-05-12'
labels: []
dependencies: []
priority: medium

---

## Description

Design and implement the fact extraction flow. Facts are knowledge statements extracted from conversations (e.g., "User prefers Python over Rust"). Currently dali-memory has storage for facts (`facts` table + `relates_to` edge) but no fact extraction logic.

### Current Architecture

- **dali-memory** stores facts + links them to memories via graph edges. No LLM access. No extraction logic.
- **OpenCode agent** has LLM access but no fact tool in the `dali_memory` plugin.

### Who Creates Facts

The **OpenCode agent** creates facts — it has the LLM to understand conversation context. dali-memory is purely a storage backend.

### Who Stores Facts

dali-memory stores facts via `memoryService.saveFact(content, verified)` and links via `memoryService.linkMemoryToFact(memoryId, factId)`.

### Missing From Plugin

The `dali_memory` OpenCode tool only supports modes: `add`, `search`, `list`, `forget`, `help`, `profile`. No fact modes exist.

### Proposed Flow

1. **Message consolidation** — `session.compacted` event fires after message compression
2. **dali-memory receives event** — currently `session.compacted` case exists but is empty (opencode.ts line 218-220)
3. **Agent extracts facts** — agent uses LLM to identify knowledge statements from compacted messages
4. **Agent stores facts** — agent calls `dali_memory` tool with new fact modes:
   - `fact_add(content, memoryId?)` — store fact, optionally link to memory
   - `fact_list(memoryId?)` — retrieve facts for a memory or all
   - `fact_verify(factId)` — mark fact as verified

### Options for Design

1. **Agent-pushed** (current pattern): Agent extracts facts, pushes to dali-memory via tool. Simple, no new deps.
2. **Event-driven**: dali-memory listens to `session.compacted`, triggers agent-in-the-middle to extract facts, stores them.
3. **Autonomous dali-memory**: dali-memory gains LLM access, runs extraction itself during `session.compacted` (biggest change, most complex).

### Requirements

- Add fact modes to `dali_memory` tool in `opencode.ts`
- Wire `session.compacted` event to trigger fact extraction
- Expose `saveFact`, `linkMemoryToFact`, `getFactsForMemory` through the tool interface
- Determine who runs LLM extraction (agent or dali-memory)

### Files to Modify

- `packages/dali-memory/src/opencode.ts` — Add fact tool modes + event handler

### Not In Scope

- LLM extraction logic itself (that's agent-side)
- Changes to `memoryService` or `surrealClient` (already has fact storage)
  > > > > > > > Current commit: init memory
