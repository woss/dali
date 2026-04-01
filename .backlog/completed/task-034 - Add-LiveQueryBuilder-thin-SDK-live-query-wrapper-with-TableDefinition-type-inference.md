---
id: TASK-034
title: >-
  Add LiveQueryBuilder - thin SDK live query wrapper with TableDefinition type
  inference
status: Done
assignee: []
created_date: '2026-05-08'
updated_date: '2026-05-16 20:18'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Create a LiveQueryBuilder that wraps the SurrealDB SDK's fluent live query API (`db.live(table).diff().fields().where().fetch()`) with type inference from TableDefinition. Equivalent to how SelectBuilder wraps driver.select().

### Requirements

- Type-safe field selection from TableDefinition
- WHERE using SDK Expr (from conditions.ts)
- DIFF mode support
- FETCH support
- Single record subscription (onRecord)
- Both callback and async iterator subscription
- Works with WebSocket (SDK fluent API) and embedded (LIVE SELECT SQL) drivers
- LiveSubscription handle with kill()

### Files to Create

- `packages/dali-orm/src/query/live.ts` - LiveQueryBuilder + LiveSubscription

### Files to Modify

- `packages/dali-orm/src/query/types.ts` - Fix InferSelectResult from TableDefinition.columns
- `packages/dali-orm/src/sdk/driver/types.ts` - Add KILLED, LiveMessage, LiveOptions
- `packages/dali-orm/src/sdk/driver/base-driver.ts` - Add liveWithOptions()
- `packages/dali-orm/src/sdk/driver/embedded-driver.ts` - Add liveWithOptions() override
- `packages/dali-orm/src/query/index.ts` - Export new types and builders
- `packages/dali-orm/src/query/__tests__/live.test.ts` - NEW test file for live query tests
<!-- SECTION:DESCRIPTION:END -->
