---
id: TASK-029
title: 'Query builder DX: autocomplete for where, select fields'
status: Done
assignee: []
created_date: '2026-05-03 12:26'
updated_date: '2026-05-16 20:18'
labels:
  - dx
  - query-builder
  - typescript
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Enhance query builder DX with better autocomplete and type inference.

CURRENT STATE:

- Query builders exist: SelectBuilder, InsertBuilder, UpdateBuilder, DeleteBuilder
- Located in packages/dali-orm/src/sdk/schema/query-builders.ts
- Basic fluent API works: select('users').where(...).limit(10)

IMPROVEMENTS NEEDED:

1. **Select specific fields with autocomplete**:
   - select('users').select('id', 'name', 'email')
   - Should provide autocomplete based on TableDefinition
   - users.select(({id, name}) => [id, name]) // typed version

2. **Where clause DX**:
   - Current: .where(eq('active', true)) - uses SurrealDB Expr
   - Improve: typed column references
   - users.where(u => eq(u.age, 25)) // u is typed proxy

3. **Table-bound query builders**:
   - users.select().where(...) // auto-binds table
   - Provides better DX than standalone select('users')

4. **Return type inference**:
   - select('users').select('id', 'name') should return Pick<User, 'id'|'name'>[]
   - Use TableDefinition to infer return types

5. **Builder integration with ORM**:
   - orm.select(users.select().where(...)) // pass builder directly
   - orm.execute(builder) // execute builder

EXAMPLES OF DESIRED DX:

```typescript
// Typed field selection
const users = defineTable('users', { id: string(), name: string(), age: int() });
const result = await orm.select(
  select(users).fields((u) => [u.id, u.name]), // autocomplete on u
);

// Typed where clauses
await orm.select(
  select(users).where((u) => gt(u.age, 25)), // u.age is typed as number
);

// Table-bound builders
const activeUsers = await users
  .select()
  .where((u) => eq(u.active, true))
  .exec();
```

REFERENCE:

- See Drizzle ORM for inspiration: https://orm.drizzle.team/docs/select
- Current query-builders.ts: 738 lines
- Current conditions.ts for Expr types

SUCCESS CRITERIA:

- SelectBuilder supports typed field selection
- Where clauses support typed column references
- Table-bound builders (users.select(), users.where())
- Return type inference from field selection
- All existing tests still pass
<!-- SECTION:DESCRIPTION:END -->
