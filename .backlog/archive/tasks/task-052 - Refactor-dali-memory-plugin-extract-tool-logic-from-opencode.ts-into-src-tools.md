---
id: TASK-052
title: >-
  Refactor dali-memory plugin: extract tool logic from opencode.ts into
  src/tools/
status: Done
assignee: []
created_date: '2026-05-19 18:26'
updated_date: '2026-05-19 18:32'
labels:
  - refactoring
  - dali-memory
  - mcp-prep
milestone: mcp-server
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Refactor dali-memory plugin to extract all tool logic from opencode.ts into separate files under src/tools/. Tools directory is currently empty. All tool logic (dali_memory with 9 modes, dali_migrate_oc_db) is embedded directly in opencode.ts (334 lines).

Goal: Extract pure functions for each tool, hook, and event handler. opencode.ts becomes thin wiring layer. Future MCP server shares same core functions.

Current structure:

- opencode.ts: 334 lines (tools + hooks + events + initialization all mixed)
- src/tools/: EMPTY directory
- memory-service.ts: 457 lines (service layer - stays as is)
- surreal-client.ts: 821 lines (DB layer - stays as is)

Target structure:

- src/tools/memory-tool.ts: dali_memory tool logic (9 modes)
- src/tools/migrate-tool.ts: dali_migrate_oc_db tool logic
- src/tools/hooks.ts: compacting + chat.message hook logic
- src/tools/events.ts: event handler logic
- src/tools/types.ts: Shared types for tool inputs/outputs
- opencode.ts: Thin wiring layer (<80 lines)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 [x] All tool logic extracted from opencode.ts into src/tools/ with pure functions
- [ ] #2 [x] opencode.ts reduced to thin wiring layer (<150 lines)
- [ ] #3 [x] New src/tools/ contains: memory-tool.ts, migrate-tool.ts, hooks.ts, events.ts, types.ts
- [ ] #4 [x] All existing tests pass without modification
- [ ] #5 [x] Both plugin and future MCP server can import same core functions
- [ ] #6 [x] No behavior changes - same inputs, outputs, error handling

<!-- AC:END -->

## Implementation Plan

## <!-- SECTION:PLAN:BEGIN -->

status: not-started
phase: 1
updated: 2026-05-19

---

# Implementation Plan

## Goal

Extract all tool/hook/event logic from opencode.ts (334 lines) into pure functions under src/tools/, reducing opencode.ts to thin wiring layer (<80 lines).

## Context & Decisions

| Decision                         | Rationale                                                                                      | Source                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------- |
| Pure functions, not classes      | MCP server and plugin both need stateless callables; memory-service.ts singleton handles state | ref:light-yellow-gayal |
| Keep memory-service.ts unchanged | Already well-structured service layer; extraction is about opencode.ts boundaries only         | ref:light-yellow-gayal |
| Types in separate types.ts       | Shared between plugin and future MCP server; avoids circular imports                           | architecture decision  |
| Zod schema stays in opencode.ts  | Plugin-specific; MCP server will define its own input schemas via @modelcontextprotocol/sdk    | architecture decision  |

## Phase 1: Create types.ts and migrate-tool.ts [IN PROGRESS]

- [ ] **1.1 Create src/tools/types.ts** ← CURRENT
  - Define ToolContext interface, ToolResult type, MemoryToolArgs type, HookInput/HookOutput types, EventInput type
- [ ] 1.2 Create src/tools/migrate-tool.ts
  - Extract executeMigrateTool(memoryService) function
  - Returns { output: string } with migration status

## Phase 2: Extract memory-tool.ts [PENDING]

- [ ] 2.1 Create src/tools/memory-tool.ts
  - Extract executeMemoryTool(args, context, memoryService) function
  - Move switch-case logic for all 9 modes: add, search, list, forget, help, profile, fact_add, fact_list, fact_verify

## Phase 3: Extract hooks.ts and events.ts [PENDING]

- [ ] 3.1 Create src/tools/hooks.ts - Extract onSessionCompacting(), onChatMessage()
- [ ] 3.2 Create src/tools/events.ts - Extract onSessionEvent()

## Phase 4: Rewrite opencode.ts as thin wiring layer [PENDING]

- [ ] 4.1 Rewrite opencode.ts to <80 lines importing and calling extracted functions

## Phase 5: Verify and test [PENDING]

- [ ] 5.1 Run existing tests: cd packages/dali-memory && pnpm test
- [ ] 5.2 Run lint: pnpm lint
- [ ] 5.3 Run format: pnpm format

## Notes

- 2026-05-19: Current opencode.ts has 334 lines with tools, hooks, events, initialization all mixed ref:light-yellow-gayal
- 2026-05-19: src/tools/ directory exists but is empty ref:light-yellow-gayal
- 2026-05-19: memory-service.ts (457 lines) and surreal-client.ts (821 lines) stay unchanged

<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

## Refactor dali-memory plugin: extract tool logic from opencode.ts into src/tools/

### What was done

Extracted all tool, hook, and event logic from opencode.ts (334 lines) into 5 pure function files under src/tools/. Rewrote opencode.ts as thin wiring layer (110 lines, 67% reduction).

### Files created

- `src/tools/types.ts` - ParsedMemoryToolArgs, ToolContext, ToolResult, HooksContext
- `src/tools/migrate-tool.ts` - executeMigrateTool()
- `src/tools/memory-tool.ts` - executeMemoryTool() with 9 modes
- `src/tools/hooks.ts` - onSessionCompacting(), onChatMessage()
- `src/tools/events.ts` - onSessionEvent() with injectFactExtraction callback

### Design

- Pure functions, no classes - portable to MCP server
- Zero @opencode-ai/\* imports in tool files (except type-only in events.ts)
- memoryService singleton imported directly (vitest mock-compatible)
- client-specific calls (app.log, session.prompt) in plugin wiring layer
- Zod schema stays in opencode.ts (MCP server defines its own schemas)
- console.log statements removed from hooks

### Verification

- 233 tests passed, 1 skipped, 0 failed
- No test files modified

<!-- SECTION:FINAL_SUMMARY:END -->
