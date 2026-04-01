---
id: TASK-032
title: Expose migration methods as TypeScript APIs with embedded driver support
status: Done
assignee: []
created_date: '2026-05-05 16:57'
updated_date: '2026-05-05 17:33'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Expose migration operations as TypeScript APIs and ensure they work with embedded drivers (memory, surrealkv, rocksdb).

## Current State

Migration system exists primarily as CLI commands in `packages/dali-orm/src/migration/cli/`. Functions like `generateAndApplyMigration`, `generateFullMigration`, etc. need to be accessible programmatically.

## Requirements

1. Export migration functions from package index for TypeScript consumption
2. Ensure migration runner supports embedded driver connections
3. Create clean API surface for programmatic migration execution
4. Test with both remote and embedded drivers

## Implementation Approach

- Identify all migration functions that should be public API
- Create/modify exports in package index
- Verify driver connection abstraction supports embedded mode
- Add integration tests for embedded driver migrations
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Migration functions are exported from package index and callable from TypeScript
- [x] #2 Embedded driver (memory/surrealkv/rocksdb) supported by migration runner
- [x] #3 TypeScript API accepts driver config matching SurrealORM.connect() signature
- [x] #4 Integration tests pass for both remote and embedded drivers
<!-- AC:END -->
