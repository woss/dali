---
id: doc-005
title: ORM Changefeeds Implementation
type: other
created_date: '2026-04-26 21:07'
---

# Implementation Plan: SurrealDB Changefeeds for ORM

## Goal

Add changefeed support to ORM for global real-time table updates across all connections

## Context & Decisions

| Decision                                     | Rationale                                                     | Source                                                        |
| -------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| Use `DEFINE TABLE CHANGEFEED` at table level | Per-table control, can also be database-level                 | `surrealdb.com/docs/learn/querying/real-time/changefeeds`     |
| Use `SHOW CHANGES FOR TABLE` to query        | Returns changelog with versionstamps, supports SINCE          | `surrealdb.com/docs/reference/query-language/statements/show` |
| Add to schema definition, not migrations     | Schema already handles table definitions, cleaner integration | N/A                                                           |

## Implementation Notes

### How Changefeeds Work

```sql
-- Enable on a table
DEFINE TABLE todo CHANGEFEED 7d;

-- Query changes (polling or initial sync)
SHOW CHANGES FOR TABLE todo SINCE <timestamp | versionstamp> LIMIT 10;
```

### ORM API Design

```typescript
// In defineTable
const todos = defineTable('todo', {
  // Schema definition includes:
  changefeed: '7d', // or with options: { duration: '7d', includeOriginal: true }
});

// In ORM
orm.showChanges('todo', { since: '2024-01-01', limit: 10 });
```

### Migration Integration

```sql
-- In migration .surql files:
DEFINE TABLE todo CHANGEFEED 7d;
```

## Tasks

### Phase 1: Schema Definition Updates

- [ ] 1.1 Add `changefeed` property to table definition options
- [ ] 1.2 Generate `DEFINE TABLE ... CHANGEFEED` in schema.ts
- [ ] 1.3 Add helper function `changeFeed(table, duration)`

### Phase 2: ORM Query Method

- [ ] 2.1 Add `orm.showChanges(table, options)` method to NodeDriver
- [ ] 2.2 Add `orm.showChanges(table, options)` method to ORM class
- [ ] 2.3 Handle query results parsing (versionstamp, changes array)

### Phase 3: Todo-App Integration

- [ ] 3.1 Add migration for todo table changefeed
- [ ] 3.2 Test polling with SHOW CHANGES (simpler than SSE for initial test)

### Phase 4: Documentation

- [ ] 4.1 Document how changefeeds work with examples
- [ ] 4.2 Note: LIVE SELECT vs SHOW CHANGES differences

## Notes

- Changefeeds persist changes for duration (e.g., '7d' = 7 days)
- Uses `versionstamp` for sequential ordering (not timestamps)
- LIVE SELECT is per-client, SHOW CHANGES is global changelog
- Can combine both: LIVE SELECT for same-session, polling SHOW CHANGES for external sync
