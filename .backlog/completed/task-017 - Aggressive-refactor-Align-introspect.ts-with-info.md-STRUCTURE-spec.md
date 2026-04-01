---
id: TASK-017
title: 'Aggressive refactor: Align introspect.ts with info.md STRUCTURE spec'
status: Done
assignee: []
created_date: '2026-05-01 16:39'
updated_date: '2026-05-16 20:18'
labels:
  - refactor
  - structure
  - valibot
  - breaking
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Refactor introspect.ts and related DDL types to fully match SurrealDB STRUCTURE output per .backlog/docs/surrealdb-reports/info.md.

## Current State (WRONG)

`introspectTable()` only processes 2/5 STRUCTURE keys:

- ✅ `fields` → columns
- ✅ `indexes` → indexes
- ❌ `events` — completely ignored
- ❌ `lives` — completely ignored
- ❌ `tables` (views) — completely ignored

## Missing FieldDefinition Fields

`SurrealColumn` missing (from info.md FieldDefinition):

- `value?: string` — computed field values
- `assert?: string` — field assertions
- `computed?: string` — virtual/stored computed expressions
- `reference?: { on_delete: string }` — record field reference constraints
- `comment?: string` — field comments

## Missing Kind Types

`SurrealColumnType` missing (from info.md Kind values):

- `regex` — regex type
- `range` — range type
- `table<X>` — table type
- `file<bucket>` — file type
- `Either (T | U)` — union types (beyond just option<T>)

## Missing DDL Components

`SurrealDbDDL` missing:

- `events: SurrealEvent[]`
- `lives: SurrealLive[]`
- `views: string[]` (raw SQL strings)

## Missing IndexDefinition Fields

`SurrealIndex` missing:

- `comment?: string`
- `prepare_remove?: boolean`

## VALIDATE Schema Requirements

Must use valibot schema validation for ALL parsed STRUCTURE output. No raw type assertions.

### Required Schemas

```typescript
import * as v from 'valibot';

// FieldDefinition schema (from info.md)
export const FieldDefinitionSchema = v.object({
  name: v.string(),
  table: v.string(),
  kind: v.optional(v.string()),
  flexible: v.optional(v.literal(true)),
  value: v.optional(v.string()),
  assert: v.optional(v.string()),
  computed: v.optional(v.string()),
  default_always: v.optional(v.boolean()),
  default: v.optional(v.string()),
  reference: v.optional(
    v.object({
      on_delete: v.string(), // "REJECT" | "IGNORE" | "CASCADE" | "UNSET" | custom SQL
    }),
  ),
  readonly: v.boolean(),
  permissions: v.object({
    select: v.union([v.boolean(), v.string()]),
    create: v.union([v.boolean(), v.string()]),
    update: v.union([v.boolean(), v.string()]),
  }),
  comment: v.optional(v.string()),
});

// EventDefinition schemas
export const EventSyncSchema = v.object({
  name: v.string(),
  what: v.string(),
  when: v.string(),
  then: v.array(v.string()),
  comment: v.optional(v.string()),
});

export const EventAsyncSchema = v.object({
  name: v.string(),
  what: v.string(),
  when: v.string(),
  then: v.array(v.string()),
  async: v.literal(true),
  retry: v.number(),
  maxdepth: v.number(),
  comment: v.optional(v.string()),
});

export const EventDefinitionSchema = v.union([EventSyncSchema, EventAsyncSchema]);

// IndexDefinition schema
export const IndexDefinitionSchema = v.object({
  name: v.string(),
  table: v.string(),
  cols: v.array(v.string()),
  index: v.string(),
  comment: v.optional(v.string()),
  prepare_remove: v.optional(v.literal(true)),
});

// SubscriptionDefinition schema (lives)
export const SubscriptionDefinitionSchema = v.object({
  id: v.string(),
  node: v.string(),
  fields: v.union([v.literal('diff'), v.string()]),
  what: v.string(),
  cond: v.optional(v.string()),
  fetch: v.optional(v.string()),
});

// ViewDefinition = string (raw SQL)
// tables: string[] in DDL

// Top-level InfoForTable
export const InfoForTableSchema = v.object({
  events: v.array(EventDefinitionSchema),
  fields: v.array(FieldDefinitionSchema),
  indexes: v.array(IndexDefinitionSchema),
  lives: v.array(SubscriptionDefinitionSchema),
  tables: v.array(v.string()), // ViewDefinition = string
});
```

## Implementation Steps

1. **Update types.ts** — Add missing types to `SurrealColumnType`
2. **Update ddl.ts** — Add missing fields to `SurrealColumn`, `SurrealIndex`, add `SurrealEvent`, `SurrealLive` types
3. **Create schemas.ts** — Add valibot schemas above in `packages/kit/src/ddl/schemas.ts`
4. **Refactor introspect.ts** — Use valibot `parse()` on STRUCTURE output, handle all 5 keys
5. **Update getLiveSchema()** — Handle new DDL structure
6. **Add tests** — Test all new types + events + lives + views

## Philosophy

- **Parse Don't Validate**: valibot schemas parse at boundary
- **Fail Fast**: Invalid STRUCTURE output throws immediately
- **No backward compat**: Break everything that doesn't match info.md spec

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 valibot schemas created in `schemas.ts`
- [ ] #2 `introspectTable()` uses `v.parse(InfoForTableSchema, result)`
- [ ] #3 All 5 STRUCTURE keys processed (events, fields, indexes, lives, tables)
- [ ] #4 Missing `SurrealColumnType` values added (regex, range, table, file, Either)
- [ ] #5 Missing field properties handled (value, assert, computed, reference, comment)
- [ ] #6 `SurrealDbDDL` includes events, lives, views
- [ ] #7 All tests pass (1568+ expected)
- [ ] #8 No backward compat code remains
  <!-- SECTION:DESCRIPTION:END -->
  <!-- AC:END -->
