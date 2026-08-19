---
id: TASK-020
title: >-
  Review & plan driver consolidation - NodeDriver extends EmbeddedDriver or
  shared base
status: Done
assignee: []
created_date: '2026-05-02 13:08'
updated_date: '2026-06-03 20:11'
labels:
  - drivers
  - duplication
  - refactoring
milestone: m-0
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

FULL REVIEW: Analyze NodeDriver (1055 lines) vs EmbeddedDriver (869 lines) duplication to create consolidation plan.

ANALYSIS FROM resonant-gray-skink:

- orm/src/driver/node-driver.ts: 1055 lines (NodeDriver class: 968 lines)
- orm/src/driver/embedded-driver.ts: 869 lines (EmbeddedDriver: 820 lines)

CODE DUPLICATION IDENTIFIED:

1. **transaction() method** - ~100 lines identical between both drivers
2. **query() method** - Similar implementation pattern
3. **isConnected() method** - Identical logic
4. **disconnect() method** - Similar teardown logic
5. **Both implement identical Transaction interface patterns**

DRIVER INTERFACE (orm/src/driver/types.ts:201-354):

- SurrealDriver interface has 20+ methods
- Includes both SDK-parity methods AND auth methods
- NodeDriver and EmbeddedDriver both implement this full interface

KEY SIMILARITIES:

1. Both manage connection state (connected boolean)
2. Both implement transaction flow: begin() → query() → commit()/rollback()
3. Both have similar query execution patterns
4. Both handle auth token management
5. Both emit events (ready, disconnected, etc.)

PROPOSED CONSOLIDATION:
Option A: Shared BaseDriver class

- Create BaseDriver with common logic (transactions, connection state, events)
- NodeDriver extends BaseDriver + adds WebSocket specifics
- EmbeddedDriver extends BaseDriver + adds embedded specifics

Option B: NodeDriver extends EmbeddedDriver

- EmbeddedDriver has core logic
- NodeDriver extends and overrides connect() for WebSocket

Option C: Composition pattern

- Extract common logic into driver-utils.ts
- Both drivers use shared utilities

RECOMMENDATION: Option A (BaseDriver inheritance)

- Cleanest separation of concerns
- Easy to extend for future drivers (BrowserDriver, DenoDriver)
- Follows existing pattern from BaseColumnBuilder

DEPENDENCIES:

- Task 1 (Package restructuring) - drivers live in sdk/driver/
- Must complete before any driver code changes

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Full comparison document created
- [ ] #2 Consolidation strategy selected
- [ ] #3 BaseDriver class design sketched
- [ ] #4 Transaction logic unified
- [ ] #5 Connection state management unified
- [ ] #6 Event handling centralized

<!-- AC:END -->
