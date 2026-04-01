---
id: TASK-036
title: Event definitions - complete DDL support (builder + types + diff + SQL gen + push + tests)
status: Done
assignee: []
created_date: '2026-05-10'
updated_date: '2026-05-12'
labels: []
dependencies: [TASK-035]
priority: high
---

## Description

Implement complete DEFINE EVENT DDL support. Current state has the SurrealEvent data model and introspection (from TASK-018), but no builder API, DDL statements, diff logic, SQL generation, or push support.

### Requirements

- Fluent `defineEvent()` builder API
- Structured DDL types: `CreateEventStatement`, `DropEventStatement`, `AlterEventStatement`
- Event diff in `ddlDiff()` (add, remove, change detection)
- SQL generation methods in `SurrealQLGenerator`
- Event push support in push pipeline
- Event tests for builder, diff, SQL gen
- Add `events` field to `OrmSchemaConfig` and `OrmSchema`
- Schema file loading for event exports

### Files to Create

- `packages/dali-orm/src/sdk/schema/event-builder.ts` - Fluent defineEvent() builder

### Files to Modify

- `packages/dali-orm/src/migration/ddl/ddl.ts` - Add CreateEventStatement, DropEventStatement, AlterEventStatement
- `packages/dali-orm/src/migration/ddl/diff.ts` - Add event diff in ddlDiff()
- `packages/dali-orm/src/migration/core/generator.ts` - Add generateEventDefinition() and generateRemoveEvent() methods
- `packages/dali-orm/src/migration/cli/push.ts` - Add event handling in push pipeline
- `packages/dali-orm/src/migration/cli/generate.ts` - Add event handling in migration generation
- `packages/dali-orm/src/sdk/orm-schema.ts` - Add events field and methods
- `packages/dali-orm/src/migration/ddl/convert.ts` - Add event conversion functions

### Tests

- `packages/dali-orm/src/sdk/__tests__/event-builder.test.ts` - Builder tests
- `packages/dali-orm/src/migration/__tests__/event-diff.test.ts` - Diff tests
- `packages/dali-orm/src/migration/__tests__/event-sql.test.ts` - SQL generation tests
