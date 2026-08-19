---
id: TASK-022
title: 'FULL REVIEW: Driver consolidation - NodeDriver extends BaseDriver'
status: Done
assignee: []
created_date: '2026-05-02 14:02'
updated_date: '2026-05-02 22:55'
labels:
  - drivers
  - duplication
  - refactoring
  - review
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
- orm/src/driver/types.ts: 387 lines (SurrealDriver interface: 154 lines)

CODE DUPLICATION IDENTIFIED:

1. **transaction() method** - ~100 lines identical between both drivers
   - Both implement: begin → query → commit/rollback pattern
   - Both use same Transaction interface from types.ts
   - Both handle transaction state identically
2. **query() method** - Similar implementation pattern
   - Both convert QueryBuilder to SurrealQL
   - Both handle params/response similarly
3. **isConnected() method** - Identical logic (check this.connected boolean)
4. **disconnect() method** - Similar teardown logic
5. **Event handling** - Both emit ready, disconnected events identically

6. **Connection state management** - Both track this.connected

DRIVER INTERFACE (orm/src/driver/types.ts:201-354):

- SurrealDriver interface has 20+ methods
- Includes both SDK-parity methods (query, select, insert, update, delete, etc.)
- AND auth methods (signup, signin, authenticate, invalidate)
- NodeDriver and EmbeddedDriver both implement this full interface

KEY SIMILARITIES:

1. Both manage connection state (connected boolean)
2. Both implement transaction flow: begin() → query() → commit()/rollback()
3. Both have similar query execution patterns (convert to SQL, execute, parse response)
4. Both handle auth token management (this.token)
5. Both emit events (ready, disconnected, etc.)
6. Both have similar constructor patterns

DIFFERENCES:

1. **Connection method**:
   - NodeDriver: WebSocket to remote SurrealDB
   - EmbeddedDriver: In-process (memory or SurrealKV)
2. **Engine initialization**:
   - NodeDriver: new Surreal() from surrealdb.js
   - EmbeddedDriver: new SurrealKV() or memory
3. **Connection params**:
   - NodeDriver: url, auth config
   - EmbeddedDriver: storage type (memory/kv), path

PROPOSED CONSOLIDATION OPTIONS:

**Option A: BaseDriver inheritance (RECOMMENDED)**

```
BaseDriver (abstract)
├── common: transaction(), isConnected(), disconnect(), events
├── abstract: connect(), query(), other driver-specific methods
├── NodeDriver extends BaseDriver
│   └── implements connect() with WebSocket
└── EmbeddedDriver extends BaseDriver
    └── implements connect() with embedded engine
```

**Option B: NodeDriver extends EmbeddedDriver**

- EmbeddedDriver has core logic
- NodeDriver extends and overrides connect() for WebSocket
- Issue: EmbeddedDriver has embedded-specific init logic

**Option C: Composition pattern**

- Extract common logic into driver-utils.ts
- Both drivers use shared utilities
- Less clean, more prop drilling

RECOMMENDATION: Option A (BaseDriver inheritance)

- Cleanest separation of concerns
- Easy to extend for future drivers (BrowserDriver, DenoDriver)
- Follows existing pattern from BaseColumnBuilder in orm/src/schema/column/base.ts
- Transaction logic can be fully unified in BaseDriver

DEPENDENCIES:

- Task 1 (Package restructuring TASK-021) - drivers live in sdk/driver/
- Must complete review before any driver code changes

REFERENCES:

- orm/src/driver/node-driver.ts:1055 lines
- orm/src/driver/embedded-driver.ts:869 lines
- orm/src/driver/types.ts:387 lines (SurrealDriver interface)
- ref:resonant-gray-skink for full file tree

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Full duplication analysis documented
- [ ] #2 Consolidation strategy selected (BaseDriver inheritance)
- [ ] #3 Transaction logic unified in design
- [ ] #4 Connection state management unified
- [ ] #5 Event handling centralized in base class
- [ ] #6 NodeDriver extends BaseDriver planned
- [ ] #7 EmbeddedDriver extends BaseDriver planned

<!-- AC:END -->
