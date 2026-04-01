---
id: TASK-038
title: Type-safe relations in query builders (type inference for edges + relation traversal)
status: Done
assignee: []
created_date: '2026-05-10'
updated_date: '2026-05-12'
labels: []
dependencies: [TASK-037]
priority: medium
---

## Description

Add type-safe relation (edge) support to query builders. Currently relations can be defined with defineRelationTable() but the query builders (SelectBuilder, RelateBuilder) don't infer types from relation table definitions for edge traversal, FETCH, and WHERE clauses.

### Requirements

- Typed `RelateBuilder<TIn, TOut, TEdge>` with generic inference from relation table definitions
- Type-safe FETCH for relations (fetch related records through edges)
- Type-safe edge traversal in WHERE clauses
- Type inference for edge fields (fields on the relation itself)
- Typed graph path traversal with GraphPath
- Tests for type-safe relation queries

### Files to Modify

- `packages/dali-orm/src/query/relate-builder.ts` - Generic type params from relation table defs
- `packages/dali-orm/src/query/select-builder.ts` - FETCH type inference for relations
- `packages/dali-orm/src/query/graph-path.ts` - Typed graph path traversal
- `packages/dali-orm/src/query/types.ts` - Relation type inference utilities
- `packages/dali-orm/src/query/where-builder.ts` - Type-safe edge WHERE conditions
- `packages/dali-orm/src/query/__tests__/relate-builder.test.ts` - Tests

### Tests

- `packages/dali-orm/src/query/__tests__/relate-builder.test.ts`
- `packages/dali-orm/src/query/__tests__/select-builder.test.ts` - Add relation FETCH tests
