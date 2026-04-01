---
id: TASK-011
title: 'Remove migrate() from ORM, consolidate in Kit'
status: Done
assignee: []
created_date: '2026-04-24 22:59'
updated_date: '2026-04-24 23:02'
labels:
  - refactoring
  - architecture
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Problem

- ORM package exposes `migrate(table)` function for generating DDL
- Kit package has its own migration commands (migrateUp, migrateDown, etc.)
- Two different "migrate" concepts cause confusion
- User confirmed: Kit must be ONLY place for migrations

## Requirements

1. **Remove from ORM**: Delete or move to Kit as internal
2. **Kit owns migrations**: Kit uses internally for DDL generation
3. **No backward compatibility**: Direct removal, no deprecation period

## Changes

### 1. Move DDL generation logic to Kit package

- Current: `packages/orm/src/migrate.ts` → generates DDL from TableDefinition
- New location: `packages/kit/src/core/ddl-generator.ts` (internal utility)
- Kit's `MigrationRunner` uses this internally

### 2. Remove public export from ORM

- Delete `packages/orm/src/migrate.ts` OR
- Move to Kit, keep in ORM but unexported

### 3. Update tests

- Update `packages/orm/src/__tests__/schema.test.ts` - remove migrate imports/usage
- Update `packages/orm/src/__tests__/migrate-integration.test.ts` - delete or move to Kit tests

### 4. Update documentation

- `.backlog/docs/doc-004...md` - remove migrate() example
- `README.md` - remove migrate() reference if present
- `.agents/skills/surreal-orm/SKILL.md` - remove migrate export

### 5. Update exports

- `packages/orm/src/schema/index.ts` - remove migrate export line

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 migrate() no longer exported from @surrealdb-orm/orm
- [x] #2 Kit uses internal DDL generation
- [x] #3 All tests pass
- [x] #4 No documentation references to ORM migrate()
  <!-- SECTION:DESCRIPTION:END -->
  <!-- AC:END -->
