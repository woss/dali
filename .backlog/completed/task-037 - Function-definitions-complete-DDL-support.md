---
id: TASK-037
title: Function definitions - complete DDL support (structured types + builder + diff + SQL gen + tests)
status: Done
assignee: []
created_date: '2026-05-10'
updated_date: '2026-05-12'
labels: []
dependencies: [TASK-036]
priority: medium
---

## Description

Implement complete DEFINE FUNCTION DDL support. Current state only has `OrmSchema.functions: Record<string, string>` (raw SQL strings). Needs structured types, builder API, DDL diff, SQL generation, and introspection.

### Requirements

- `defineFunction()` builder API
- Structured `SurrealFunction` DDL type
- `CreateFunctionStatement` / `DropFunctionStatement` DDL types
- Function diff in `ddlDiff()`
- SQL generation for DEFINE FUNCTION / REMOVE FUNCTION
- Function push support
- Introspection support for functions
- Tests for builder, diff, SQL gen

### Files to Create

- `packages/dali-orm/src/sdk/schema/function-builder.ts` - Fluent defineFunction() builder

### Files to Modify

- `packages/dali-orm/src/migration/ddl/ddl.ts` - Add SurrealFunction type, CreateFunctionStatement, DropFunctionStatement
- `packages/dali-orm/src/migration/ddl/diff.ts` - Add function diff
- `packages/dali-orm/src/migration/ddl/introspect.ts` - Add function introspection
- `packages/dali-orm/src/migration/core/generator.ts` - Add function SQL generation
- `packages/dali-orm/src/migration/cli/generate.ts` - Add function handling in migration gen
- `packages/dali-orm/src/migration/cli/push.ts` - Add function push support
- `packages/dali-orm/src/migration/core/snapshot.ts` - Add function serialization

### Tests

- `packages/dali-orm/src/sdk/__tests__/function-builder.test.ts` - Builder tests
- `packages/dali-orm/src/migration/__tests__/function-diff.test.ts` - Diff tests
- `packages/dali-orm/src/migration/__tests__/function-sql.test.ts` - SQL generation tests
