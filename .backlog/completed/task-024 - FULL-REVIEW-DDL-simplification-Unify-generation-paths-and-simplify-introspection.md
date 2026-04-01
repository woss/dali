---
id: TASK-024
title: >-
  FULL REVIEW: DDL simplification - Unify generation paths and simplify
  introspection
status: Done
assignee: []
created_date: '2026-05-02 14:03'
updated_date: '2026-05-02 22:55'
labels:
  - ddl
  - duplication
  - introspection
  - simplification
  - review
milestone: m-0
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

FULL REVIEW: Analyze DDL generation duplication and introspection complexity to create simplification plan.

ANALYSIS FROM resonant-gray-skink:

DUAL DDL GENERATION PATHS:

1. **kit/src/core/generator.ts** (365 lines) - SurrealQLGenerator class
   - TableDefinition → SQL
   - Generates: DEFINE TABLE, DEFINE FIELD, DEFINE INDEX
2. **kit/src/core/ddl-generator.ts** (229 lines) - generateTableDDL() function
   - TableDefinition → SQL (SAME PURPOSE)
   - Also has its own TYPE_MAP, validateChangefeed(), isNowVariant()
   - OVERLAPS with core/generator.ts and ddl/diff.ts

DUPLICATE UTILITIES:

1. **formatDefaultValue / isNowVariant** - Found in BOTH:
   - kit/src/core/generator.ts (lines 14-23, 29-36)
   - kit/src/ddl/diff.ts (lines 34-49)
     Both define nearly identical isNowVariant() and formatDefaultValue() / normalizeDefault() functions.

2. **TYPE MAPS** (3 locations!):
   - kit/src/ddl/types.ts - SURREALDB_TYPE_MAP (maps orm types → SurrealDB SQL)
   - kit/src/core/ddl-generator.ts - TYPE_MAP (same purpose, DUPLICATE)
   - orm/src/schema/column/types.ts - SurrealColumnType (enum)

3. **Permission serialization duplicated**:
   - kit/src/ddl/diff.ts:88-94 - serializePermissions()
   - kit/src/commands/generate.ts:18-26 - serializeColumnPermissions()
     Similar functionality, different implementations.

DDL TYPES OVERLAP:

- kit/src/ddl/ddl.ts:313 lines - SurrealDbDDL, SurrealTable, SurrealColumn types
- kit/src/ddl/types.ts:181 lines - Type mappings, parseKind()
- kit/src/core/snapshot.ts:384 lines - SchemaSnapshot (uses TableDefinition, not SurrealTable)
- kit/src/core/diff.ts:363 lines - SchemaDiffer (uses TableDefinition[])

INTROSPECTION COMPLEXITY:

- kit/src/ddl/introspect.ts:488 lines - Database introspection via STRUCTURE clause
- Uses: INFO FOR DB, SELECT \* FROM surrealdb_structures()
- Complex parsing logic for STRUCTURE output
- Could be simplified with better types

SIMPLIFICATION OPPORTUNITIES:

1. **UNIFY DDL GENERATION**:
   - Keep only ONE: core/generator.ts (class-based) OR ddl-generator.ts (functional)
   - Recommended: core/generator.ts (already class-based, more extensible)
   - Remove ddl-generator.ts TYPE_MAP, isNowVariant duplicates

2. **UNIFY UTILITIES**:
   - Single formatDefaultValue() in shared location
   - Single isNowVariant() utility
   - Single permission serializer

3. **UNIFY TYPE MAPS**:
   - Single SURREALDB_TYPE_MAP in kit/src/ddl/types.ts
   - Remove duplicates from ddl-generator.ts
   - Re-use orm/src/schema/column/types.ts SurrealColumnType

4. **SIMPLIFY INTROSPECTION**:
   - Use STRUCTURE clause only (remove INFO FOR DB fallback?)
   - Stronger types from ddl/ddl.ts (but simplify them first)
   - Consider: Is introspect.ts 488 lines doing too much?

5. **SIMPLIFY DDL TYPES**:
   - SurrealDbDDL, SurrealTable, SurrealColumn in ddl/ddl.ts
   - These overlap with orm/ types (see Task 3 - Type Unification TASK-023)
   - Simplify after type unification

DEPENDENCIES:

- Task 3 (Type system unification TASK-023) - must unify types first
- Task 1 (Package restructuring TASK-021) - single package
- Task 2 (Driver consolidation TASK-022) - unrelated

REFERENCES:

- kit/src/core/generator.ts:365 lines
- kit/src/core/ddl-generator.ts:229 lines
- kit/src/ddl/diff.ts:742 lines
- kit/src/ddl/introspect.ts:488 lines
- kit/src/ddl/ddl.ts:313 lines
- kit/src/ddl/types.ts:181 lines
- ref:resonant-gray-skink
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 DDL generation paths analyzed (generator.ts vs ddl-generator.ts)
- [ ] #2 Duplicate utilities identified (formatDefaultValue, isNowVariant)
- [ ] #3 Dual type maps analyzed (SURREALDB_TYPE_MAP vs TYPE_MAP)
- [ ] #4 Simplified DDL generation design proposed
- [ ] #5 Introspection simplification strategy (STRUCTURE vs INFO)
- [ ] #6 Unified DDL types design (remove ddl.ts duplicates)
<!-- AC:END -->
