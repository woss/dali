---
id: TASK-033
title: Create thin SurrealDB query builder layer inspired by Drizzle ORM
status: Done
assignee: []
created_date: '2026-05-07 20:29'
updated_date: '2026-05-16 20:18'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Create a thin query builder layer in `packages/dali-orm` using the migration schema (TableDefinition) as the foundation. Inspired by Drizzle ORM's architecture but focused on SurrealDB's single dialect.

## Inspiration: Drizzle ORM

- SQL class with template tags for composable SQL chunks
- Config accumulation pattern (builder accumulates config, dialect converts to SQL)
- Type safety throughout with full TypeScript inference
- Builder pattern: SelectBuilder → SelectBase → QueryPromise

## Current State

- `packages/dali-orm` has migration system with `SurrealQLGenerator` generating DDL from `TableDefinition`
- `packages/orm` has basic query builders (simple, limited features)
- No table-aware type inference in query builders
- No join/subquery support

## Architecture

```
TableDefinition (from migration schema)
    ↓
Column types + Table config
    ↓
Query Builders (SelectBuilder, InsertBuilder, UpdateBuilder, DeleteBuilder)
    ↓
Config accumulation (where, join, orderBy, etc.)
    ↓
SurrealQL Generator (toSQL/toParams)
    ↓
SurrealDriver.execute()
```

## Scope

1. Table-aware types for column autocomplete and result inference
2. SELECT with WHERE, FETCH (relations), subqueries, GROUP BY, ORDER BY, LIMIT/START
3. INSERT/UPDATE/DELETE with RETURN options
4. Driver integration via SurrealDriver
5. Joins via FETCH and subqueries (SurrealDB's approach, not SQL JOINs)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 SelectBuilder with table-aware types, WHERE, JOIN/FETCH, subqueries, GROUP BY, ORDER BY, LIMIT/START
- [ ] #2 InsertBuilder, UpdateBuilder, DeleteBuilder with table-aware types and RETURN options
- [ ] #3 QueryBuilder integrates with SurrealDriver via execute() or toSQL()/toParams()
- [ ] #4 Type inference from TableDefinition for column autocomplete and result types
- [ ] #5 Unit tests for all builders with SurrealQL output verification

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

# Implementation Plan

## Goal

Create a thin, type-safe SurrealDB query builder layer in `packages/dali-orm` that uses the SDK's native CRUD methods (`driver.select()`, `driver.create()`, `driver.insert()`, `driver.update()`, `driver.delete()`, `driver.relate()`) with full TypeScript type inference from `TableDefinition`.

## Architecture Decisions

| Decision                                      | Rationale                                                                                                                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native SDK methods, not raw SQL               | SurrealDB SDK provides `select()`, `create()`, `insert()`, `update()`, `delete()`, `relate()` — use these directly for proper type handling, relation coercion, datetime transformation |
| Config accumulation pattern                   | Builder accumulates options, then calls appropriate driver method at execution time                                                                                                     |
| Reuse `TableDefinition` from migration schema | Single source of truth, already has column types and table config for type inference                                                                                                    |
| Immutable builders                            | Each method returns new instance, safe chaining                                                                                                                                         |
| `execute(driver)` as terminal method          | Accepts `SurrealDriver` instance, calls appropriate SDK method with accumulated config                                                                                                  |
| Type-safe relation definitions                | Define edge tables with `in`/`out` types, infer graph traversal types at compile time                                                                                                   |
| Dual graph traversal API                      | Simple `traverse()` for common cases, chainable `path()` builder for complex multi-hop queries                                                                                          |

## SDK Methods Available (from BaseDriver)

```typescript
driver.select<T>(table: string)          // "table" or "table:id"
driver.create<T>(table: string, data)    // "table" or "table:id"
driver.insert<T>(table: string, data)    // single or array
driver.update<T>(table: string, data)    // "table" or "table:id"
driver.delete<T>(table: string)          // "table" or "table:id"
driver.upsert<T>(table: string, data)    // "table:id" required
driver.relate<T>(from, edge, to, data?)  // record IDs
```

## Type Safety Design

### Table Definition Integration

```typescript
// From existing migration schema:
const userTable = defineTable('user', {
  id: string('id'),
  name: string('name'),
  email: string('email'),
  age: int('age'),
  active: bool('active'),
});

const postTable = defineTable('post', {
  id: string('id'),
  title: string('title'),
  content: string('content'),
  author: record('user'), // record link
  created_at: datetime('created_at'),
});

// Edge table with type info:
const wroteEdge = defineRelationTable('wrote', 'user', 'post', {
  created_at: datetime('created_at'),
});
```

### Type Inference

```typescript
// Infer result type from table definition
type UserResult = InferSelectResult<typeof userTable>;
// { id: string; name: string; email: string; age: number; active: boolean }

// Infer insert type (excludes id, optional fields)
type UserInput = InferInsertInput<typeof userTable>;
// { name: string; email: string; age: number; active?: boolean }

// Field selection narrows result type
select(userTable).select('id', 'name').execute(driver);
// Returns: Pick<UserResult, 'id' | 'name'>[]

// Graph traversal infers target table type
select(userTable)
  .where(eq('id', 'user:john'))
  .traverse('out', wroteEdge, 'myPosts')
  .execute(driver);
// Returns: { id: string; name: string; ...; myPosts: InferSelectResult<typeof postTable>[] }
```

## Phase 1: Core Infrastructure [PENDING]

- [ ] 1.1 Create `packages/dali-orm/src/query/` directory structure:
  - `types.ts` — Type inference utilities, generic type definitions
  - `conditions.ts` — Re-export condition builders (`eq`, `gt`, `and`, `or`, etc.)
  - `select.ts` — SelectBuilder implementation
  - `insert.ts` — InsertBuilder implementation
  - `create.ts` — CreateBuilder implementation
  - `update.ts` — UpdateBuilder implementation
  - `delete.ts` — DeleteBuilder implementation
  - `upsert.ts` — UpsertBuilder implementation
  - `relate.ts` — RelateBuilder + GraphPath implementation
  - `index.ts` — Public exports
- [ ] 1.2 Create type inference utilities:
  - `InferSelectResult<TTable>` — full result type from TableDefinition
  - `InferSelectFields<TTable, Fields>` — narrowed type for field selection
  - `InferInsertInput<TTable>` — input type for create/insert (excludes id, handles optional)
  - `InferUpdateInput<TTable>` — input type for update (all fields optional)
  - `InferGraphResult<TTable, Traversals>` — result type with graph traversal fields
- [ ] 1.3 Add exports to `packages/dali-orm/package.json`:
  - `"./query": "./dist/query/index.mjs"`
  - `"./query/types": "./dist/query/types.mjs"`
  - `"./query/conditions": "./dist/query/conditions.mjs"`

## Phase 2: SelectBuilder [PENDING]

- [ ] 2.1 `SelectBuilder<TTable, TSelected = TTable>` with table-aware generic types
- [ ] 2.2 `.select(...fields: (keyof TTable['$columns'])[])` — field selection with type narrowing, returns `SelectBuilder<TTable, Pick<TTable, Fields>>`
- [ ] 2.3 `.where(condition: Expr)` — accumulates WHERE conditions, multiple calls AND together
- [ ] 2.4 `.fetch(...relations: string[])` — SurrealDB FETCH clause for record link dereferencing
- [ ] 2.5 `.groupBy(...fields)`, `.orderBy(field, direction)` — grouping and sorting
- [ ] 2.6 `.limit(n)`, `.start(n)` — pagination
- [ ] 2.7 `.execute(driver: SurrealDriver): Promise<InferSelectResult<TSelected>[]>` — generates SQL and calls `driver.query()` for complex queries, or `driver.select()` for simple cases

## Phase 3: Graph Traversal — Dual API [PENDING]

### Simple: `traverse()` method on SelectBuilder

- [ ] 3.1 `SelectBuilder.traverse<'out' | 'in' | 'both', TEdge, TTarget>(direction, edgeTable, alias?)`
  - Generates `->edge->target.* AS alias` or `<-edge<-target.* AS alias`
  - Type-safe: edge table must match direction (out = edge.in matches source table)
  - Result type includes alias field with `InferSelectResult<TTarget>[]`

### Advanced: Chainable `path()` builder

- [ ] 3.2 `out(edgeTable)` — creates `OutboundPath` starting with `->edge`
- [ ] 3.3 `in_(edgeTable)` — creates `InboundPath` starting with `<-edge`
- [ ] 3.4 `both(edgeTable)` — creates `BidirectionalPath` starting with `<->edge`
- [ ] 3.5 Path chaining: `out('wrote').to('post').out('likes').to('user')`
  - Each `.to(targetTable)` validates type compatibility with previous edge
  - Generates `->wrote->post<-likes<-user`
- [ ] 3.6 `.alias(name)` and `.fields(...fields)` for field selection on traversed results
- [ ] 3.7 `.selectGraph(...paths)` on SelectBuilder to include multiple traversals in one query

### Type Safety for Graph Traversals

- [ ] 3.8 Edge table type validation: `defineRelationTable` carries `in` and `out` table types
  - `traverse('out', wroteEdge)` validates that source table matches `wroteEdge`'s `in` type
  - `traverse('in', wroteEdge)` validates that source table matches `wroteEdge`'s `out` type
- [ ] 3.9 Multi-hop type inference: each `.to()` step narrows the current table type for the next step

## Phase 4: CRUD Builders [PENDING]

- [ ] 4.1 `CreateBuilder<TTable>` with `.values(data: InferInsertInput<TTable>)` → calls `driver.create()`
- [ ] 4.2 `InsertBuilder<TTable>` with `.values(data: InferInsertInput<TTable> | InferInsertInput<TTable>[])` → calls `driver.insert()`
- [ ] 4.3 `UpdateBuilder<TTable>` with `.set(data: Partial<InferUpdateInput<TTable>>)` → calls `driver.update()`
- [ ] 4.4 `DeleteBuilder<TTable>` with `.where(condition)` → calls `driver.query()` with generated DELETE SQL
- [ ] 4.5 `UpsertBuilder<TTable>` with `.values(data: InferInsertInput<TTable>)` → calls `driver.upsert()`
- [ ] 4.6 `RelateBuilder<TFrom, TEdge, TTo>` with `.from()`, `.to()`, `.data()`, `.unique()` → calls `driver.relate()`
- [ ] 4.7 Each builder: `.execute(driver)` as terminal method with proper return type inference

## Phase 5: Subqueries and Advanced Features [PENDING]

- [ ] 5.1 Subquery support: `select(postTable).where(in_('author', select(userTable).where(eq('active', true))))`
- [ ] 5.2 `WITH` clause (CTE) support
- [ ] 5.3 `SPLIT` clause support
- [ ] 5.4 `TIMEOUT` clause support
- [ ] 5.5 Raw SQL escape hatch via `sql.raw()` for edge cases

## Phase 6: Tests [PENDING]

- [ ] 6.1 Unit tests for SelectBuilder SQL generation (verify SurrealQL output)
- [ ] 6.2 Unit tests for CRUD builders (verify SDK method calls)
- [ ] 6.3 Unit tests for graph traversal SQL generation (both `traverse()` and `path()`)
- [ ] 6.4 Integration tests with embedded SurrealDB (real execution)
- [ ] 6.5 Type tests for inference correctness (compile-time verification)

## Key Implementation Notes

**SELECT with WHERE/FETCH/etc**: SDK's `driver.select()` doesn't support WHERE clause — builders generate SurrealQL and use `driver.query()` for complex queries. Simple `select(table)` without conditions uses native `driver.select()`.

**Graph Traversal SQL**: Generated as `SELECT *, ->edge->target.* AS alias FROM table WHERE ...` — uses SurrealQL arrow syntax under the hood.

**CRUD Builders**: Use native SDK methods directly. Builders accumulate data and options, then call the appropriate method on `.execute(driver)`.

**Type Safety**:

- `TableDefinition` generic provides column names for autocomplete and result types
- Edge tables carry `in`/`out` table types for graph traversal validation
- Field selection narrows result types via `Pick<>`
- Graph traversals add aliased fields with inferred target types

<!-- SECTION:PLAN:END -->
