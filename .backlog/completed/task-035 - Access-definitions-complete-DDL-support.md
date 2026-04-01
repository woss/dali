---
id: TASK-035
title: Access definitions - complete DDL support (builder + types + diff + SQL gen + push + tests)
status: Done
assignee: []
created_date: '2026-05-10'
updated_date: '2026-05-12'
labels: []
dependencies: []
priority: high
---

## Description

Complete the access definition pipeline for DEFINE ACCESS in SurrealDB. Current partial infrastructure exists (AccessConfig type, accessToSQL(), introspection, snapshot support) but lacks structured DDL types, diff support, push support, and SDK builder API.

### Requirements

- Fluent `defineAccess()` builder API with chainable methods
- Structured `SurrealAccess` DDL type (replacing raw SQL strings)
- `CreateAccessStatement` / `DropAccessStatement` DDL types
- Access diff in `ddlDiff()` (add, remove, change detection)
- Access SQL generation methods in `SurrealQLGenerator`
- Access push support in `tablesToDdl()` / `pushSchema()`
- Full test coverage for builder, diff, SQL gen, push
- Update `AccessConfigSchema` valibot schema to support JWT and OIDC types

### Files to Create

- `packages/dali-orm/src/sdk/schema/access-builder.ts` - Fluent defineAccess() builder

### Files to Modify

- `packages/dali-orm/src/migration/ddl/ddl.ts` - Add SurrealAccess type, CreateAccessStatement, DropAccessStatement
- `packages/dali-orm/src/migration/ddl/diff.ts` - Add access diff logic in ddlDiff()
- `packages/dali-orm/src/migration/core/generator.ts` - Add generateAccessDefinition() and generateRemoveAccess()
- `packages/dali-orm/src/migration/cli/push.ts` - Add access handling in tablesToDdl() and pushSchema()
- `packages/dali-orm/src/sdk/schema.ts` - Fix AccessConfigSchema to support JWT/OIDC
- `packages/dali-orm/src/sdk/orm-schema.ts` - Add getAccess() helper method
- `packages/dali-orm/src/migration/ddl/convert.ts` - Add access conversion functions

### Tests

- `packages/dali-orm/src/sdk/__tests__/access-builder.test.ts` - Builder tests
- `packages/dali-orm/src/migration/__tests__/access-diff.test.ts` - Diff tests
- `packages/dali-orm/src/migration/__tests__/access-sql.test.ts` - SQL generation tests
