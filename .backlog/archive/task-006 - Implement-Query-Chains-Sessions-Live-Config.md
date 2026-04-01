---
id: TASK-006
title: 'Implement Query Chains, Sessions, Live Config'
status: Done
assignee: []
created_date: '2026-04-24 19:04'
updated_date: '2026-04-24 19:05'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Implement query builder chains, session management, and live query config:

1. .where(), .limit(), .orderBy() via SDK's SelectPromise
2. newSession(), forkSession(), sessions(), closeSession()
3. .diff(), .fields(), .where() on live queries
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

## Implemented SDK Parity Features

### 1. Query Builder Chains (was Critical #1)

- **select(table)** - Now returns SDK's SelectPromise for chaining:
  - `.where(condition)` - Add WHERE clause
  - `.limit(n)` - Limit results
  - `.start(n)` - Offset/pagination
  - `.fields(...)` - Select specific fields
  - `.fetch(...)` - Fetch relations
  - `.orderBy(field, direction)` - Sort results
- **insert(thing, data)** - Returns InsertPromise with `.ignore()`, `.relation()`
- **update(thing)** - Returns UpdatePromise with `.merge()`, `.content()`, `.replace()`

### 2. Session Management (was Major #5)

- **sessions()** - List all active sessions
- **newSession()** - Create new isolated session
- **forkSession()** - Fork current session for parallel ops
- **closeSession()** - Close the session
- **from(client)** - Static method to create from existing Surreal client

### 3. Live Query Configuration (was Major #6)

- **live(table, callback)** - Returns SDK's LiveSelect for chaining:
  - `.diff()` - Differential updates only
  - `.fields(...)` - Select specific fields
  - `.where(condition)` - Filter live updates

### Usage Examples

```typescript
// Query chains
const adults = await orm.select('users').where('age >= 18').limit(10).orderBy('name', 'ASC');

// Sessions
const session = await orm.newSession();
const fork = await orm.forkSession();
await orm.closeSession();

// Live query config
await orm.live('users', callback).diff().fields('name', 'email');
```

### Verification

- Build: ✅ Pass
- Tests: ✅ 535 passed
<!-- SECTION:FINAL_SUMMARY:END -->
