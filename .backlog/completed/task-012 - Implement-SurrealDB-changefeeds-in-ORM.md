---
id: TASK-012
title: Implement SurrealDB changefeeds in ORM
status: Done
assignee: []
created_date: '2026-04-26 21:07'
updated_date: '2026-05-16 20:18'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

# Implementation Plan: SurrealDB Changefeeds for ORM

## Goal

Add changefeed support to ORM for global real-time table updates across all connections

## Context & Decisions

| Decision                                     | Rationale                            | Source                                                      |
| -------------------------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| Use `DEFINE TABLE CHANGEFEED` at table level | Per-table control                    | surrealdb.com/docs/learn/querying/real-time/changefeeds     |
| Use `SHOW CHANGES FOR TABLE` to query        | Returns changelog with versionstamps | surrealdb.com/docs/reference/query-language/statements/show |

## Implementation Notes

### How Changefeeds Work

```sql
-- Enable on a table
DEFINE TABLE todo CHANGEFEED 7d;

-- Query changes
SHOW CHANGES FOR TABLE todo SINCE <timestamp | versionstamp> LIMIT 10;
```

### ORM API Design

```typescript
// schema
const todos = defineTable('todo', { ... }, { changefeed: '7d' });

// query
orm.showChanges('todo', { since: '2024-01-01', limit: 10 });
```

## Tasks

### Phase 1: Schema Definition Updates

- [ ] 1.1 Add `changefeed` property to table definition options
- [ ] 1.2 Generate `DEFINE TABLE ... CHANGEFEED` in schema.ts

### Phase 2: ORM Query Method

- [ ] 2.1 Add `orm.showChanges(table, options)` method
- [ ] 2.2 Handle query results parsing

### Phase 3: Todo-App Integration

- [ ] 3.1 Add migration for todo table changefeed

### Phase 4: Documentation

- [ ] 4.1 Document changefeeds vs LIVE SELECT

## Notes

- Changefeeds persist for duration (e.g., '7d')
- Uses versionstamp for sequential ordering
- LIVE SELECT per-client, SHOW CHANGES global
<!-- SECTION:DESCRIPTION:END -->
