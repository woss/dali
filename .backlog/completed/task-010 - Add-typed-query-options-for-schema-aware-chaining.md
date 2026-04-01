---
id: TASK-010
title: Add typed query options for schema-aware chaining
status: Done
assignee: []
created_date: '2026-04-24 22:24'
updated_date: '2026-05-16 20:18'
labels:
  - sdk-parity
  - type-safety
  - query-builders
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Add type-safe query options to SurrealORM that work with defined schemas.

Currently query chaining methods (.where, .orderBy, .groupBy, .fetch) are untyped - they return SDK chainables directly without type checking against table definitions.

Required:

1. Create typed column condition builders (eq, gt, lt, etc.) that accept column names from table definitions
2. Create typed orderBy/groupBy/fetch that accept column references
3. Add schema-aware select wrapper that returns properly typed results

Example target API:

```typescript
// Should infer: name is string column, age is number column
const users = defineTable('users', {
  name: string(),
  age: int(),
});

// Typed query - conditions know column types
orm
  .select(users) // Returns typed result
  .where(eq(users.name, 'John')) // TypeScript knows name is string
  .where(gt(users.age, 18)) // TypeScript knows age is number
  .orderBy(users.name, 'ASC') // TypeScript knows valid columns
  .limit(10);
```

<!-- SECTION:DESCRIPTION:END -->
