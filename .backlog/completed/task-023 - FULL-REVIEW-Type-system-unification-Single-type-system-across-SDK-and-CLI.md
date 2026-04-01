---
id: TASK-023
title: 'FULL REVIEW: Type system unification - Single type system across SDK and CLI'
status: Done
assignee: []
created_date: '2026-05-02 14:03'
updated_date: '2026-05-02 22:55'
labels:
  - types
  - duplication
  - refactoring
  - review
milestone: m-0
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

FULL REVIEW: Analyze dual type systems in orm/ and kit/ packages to create unification plan.

ANALYSIS FROM resonant-gray-skink:

TYPE SYSTEM 1 - ORM PACKAGE (orm/src/):

- orm/src/table.ts:301 lines - TableDefinition, TableConfig, IndexDefinition
- orm/src/schema.ts:411 lines - Access definitions, signup/signin SQL generation
- orm/src/schema/column/types.ts:67 lines - ColumnDefinition, ColumnConfig, SurrealColumnType
- orm/src/schema/column/base.ts:71 lines - BaseColumnBuilder abstract class
- orm/src/types.ts:91 lines - TypeMap, InferColumnType, InferTableModel, InsertValues
- orm/src/schema/proxy/index.ts:69 lines - SurrealColumn, SurrealTable classes (proxy-based)

TYPE SYSTEM 2 - KIT PACKAGE (kit/src/):

- kit/src/ddl/ddl.ts:313 lines - SurrealDbDDL, SurrealTable, SurrealColumn types
- kit/src/ddl/types.ts:181 lines - Type mappings, parseKind(), SURREALDB_TYPE_MAP
- kit/src/ddl/schemas.ts:90 lines - Valibot schemas for STRUCTURE output
- kit/src/core/snapshot.ts:384 lines - SchemaSnapshot serialization
- kit/src/core/diff.ts:363 lines - SchemaDiffer (compares TableDefinition[])

OVERLAP & CONVERSION:

1. **TableDefinition (orm) vs SurrealTable (kit)**
   - orm: TableDefinition { name, columns, indexes, schema (TableConfig) }
   - kit: SurrealTable { name, schema (SurrealColumn[]) }
   - Convert in kit/src/commands/generate.ts:56-100

2. **ColumnDefinition (orm) vs SurrealColumn (kit)**
   - orm: ColumnDefinition { name, type, optional, unique, default, ... }
   - kit: SurrealColumn { name, kind, type, options, ... }
   - Convert in generate.ts

3. **Type Maps**
   - orm: TypeMap in orm/src/types.ts (inferred types)
   - kit: SURREALDB_TYPE_MAP in kit/src/ddl/types.ts
   - kit: TYPE_MAP in kit/src/core/ddl-generator.ts (DUPLICATE)

4. **DDL TYPES (kit/src/ddl/)**:
   - SurrealDbDDL, SurrealTable, SurrealColumn (ddl.ts)
   - parseKind(), SURREALDB_TYPE_MAP (types.ts)
   - Valibot schemas (schemas.ts)
   - OVERLAPS with orm/src/schema/column/types.ts

CONVERSION BOTTLENECK:
kit/src/commands/generate.ts:56-100 converts:

- TableDefinition → SurrealTable (for DDL operations)
- ColumnDefinition → SurrealColumn
  This is a pain point - dual type systems require constant conversion.

PROPOSED UNIFICATION:
Option A: Single type system in SDK

- orm/ types become source of truth
- kit/ imports from orm/ types
- Extend ColumnDefinition/SurrealColumnType for DDL-specific needs

Option B: Shared types package

- New @surrealdb-orm/types package
- Both orm/ and kit/ import from it
- Clean separation

Option C: kit/ uses orm/ types directly (RECOMMENDED)

- Remove kit/src/ddl/ddl.ts types
- kit/ imports TableDefinition, ColumnDefinition from orm/
- Add DDL-specific extensions only where needed
- Minimal refactoring
- orm/ types already well-designed
- Reduces conversion code in generate.ts
- Follows "single type system" principle

DEPENDENCIES:

- Task 1 (Package restructuring TASK-021) - single package
- Task 2 (Driver consolidation TASK-022) - unrelated
- Must complete before DDL simplification

REFERENCES:

- orm/src/table.ts:301 lines
- orm/src/schema/column/types.ts:67 lines
- kit/src/ddl/ddl.ts:313 lines
- kit/src/ddl/types.ts:181 lines
- kit/src/commands/generate.ts:56-100 (conversion code)
- ref:resonant-gray-skink
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 orm/ type system fully documented (ColumnDefinition, TableDefinition)
- [ ] #2 kit/ type system fully documented (SurrealColumn, SurrealTable, DDL types)
- [ ] #3 Overlap analysis complete with specific file/line references
- [ ] #4 Conversion points mapped (generate.ts:56-100)
- [ ] #5 Unified type system design proposed
- [ ] #6 Migration impact assessed for both SDK and CLI
<!-- AC:END -->
