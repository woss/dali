---
id: TASK-014
title: Fix DDL implementation gaps from Surrealist cross-reference
status: To Do
assignee: []
created_date: '2026-04-28 15:10'
updated_date: '2026-05-20 21:57'
labels:
  - ddl
  - bug-fix
  - enhancement
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Cross-referenced Surrealist Schema Designer's table creation logic with our ORM DDL implementation. Found several gaps and bugs that need fixing.

**Issues Found:**

1. **View Tables (missing)** - Surrealist supports `view` type with `AS SELECT ...` clause. ORM has no view support in `SurrealTable`, no `AS` clause generation.

2. **Multiple IN/OUT Tables** - Surrealist uses `in?: string[]`, `out?: string[]` (arrays) for relations. ORM uses single strings `in?: string`, `out?: string`.

3. **ENFORCED Keyword (missing)** - Surrealist `Kind` interface has `enforced?: boolean`. ORM has no `enforced` field, no generation support.

4. **CHANGEFEED Object Formatting** - Generator has `CHANGEFEED ${table.config.changefeed}` which stringifies the object as `[object Object]`. Need to format as `CHANGEFEED {expiry} [STORE_ORIGINAL]`.

5. **Schema Mode Naming** - Surrealist uses `schemafull?: boolean` (SurrealDB 3.0) and `full: boolean` (SurrealDB 2.0). ORM uses `schema: 'full' | 'less'` which is non-standard naming.

6. **Permission Format** - Need to verify if `FOR select` syntax is needed or just `SELECT WHERE`.

**Review Findings:**

- No critical/major issues
- Minor: changefeed formatting bug (80%+ confidence)
- Nitpicks: schema naming, single vs array IN/OUT, missing view type

**Implementation Plan:**

1. Update `SurrealTable` types - add view support, change IN/OUT to arrays, add enforced flag
2. Fix CHANGEFEED formatting in `generator.ts` and `ddl-generator.ts`
3. Update introspection to parse view tables and multiple IN/OUT
4. Update diff logic for view tables and array IN/OUT
5. Update all SQL generation for views, ENFORCED, proper permissions
6. Add tests for new functionality
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 View table type supported with AS SELECT clause generation
- [ ] #2 IN/OUT support arrays for multiple relation tables
- [ ] #3 ENFORCED keyword generated for relations when specified
- [ ] #4 CHANGEFEED properly formats expiry and store_original
- [ ] #5 Schema mode naming consistent with SurrealDB (SCHEMAFULL/SCHEMALESS)
- [ ] #6 Permission generation matches SurrealDB syntax
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

## Implementation Steps

1. Update `ddl.ts` types: view type, arrays for IN/OUT, enforced flag

2. Fix CHANGEFEED formatting in `generator.ts` and `ddl-generator.ts`

3. Update `introspect.ts`: parse view tables, multiple IN/OUT from definition

4. Update `diff.ts`: handle view type changes, array IN/OUT comparison

5. Update SQL generation: views (AS SELECT), ENFORCED, proper permission syntax

6. Add tests for new table types and changefeed formatting
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## Code-Graph Verified DDL Gaps (2026-05-20)

Cross-referenced task-014 issues against actual code using code-review-graph + direct reads.

### Issue 1: View Tables (STILL OPEN — partial gap)

- `SurrealTable.type` (ddl.ts:34): `'normal' | 'relation'` — no `'view'`
- `SurrealTable` has `views?: string[]` (ddl.ts:44) but not a dedicated view type
- `introspectTable` (introspect.ts:400-402) already parses views from `parsed.tables`
- **Missing**: generator.ts `generateTableDefinition` has no view handling, no `AS SELECT ...` clause generation
- **Missing**: no `create_view` statement type in SurrealStatement union
- **Missing**: convert.ts `toSurrealTable`/`fromSurrealTable` don't map view properties

### Issue 2: Multiple IN/OUT Tables (ALREADY FIXED) ✅

- ddl.ts:39-40: `in?: string | string[]`, `out?: string | string[]`
- introspect.ts:253-263: handles arrays via `recordTables`
- generator.ts:39-46: joins arrays with `join(', ')`
- No action needed.

### Issue 3: ENFORCED Keyword (STILL OPEN — partial gap)

- `RelationTableConfig` (sdk/table.ts:43): `enforced?: boolean` — SDK type exists
- `defineRelationTable` (sdk/table.ts:100): accepts `enforced`
- **Missing**: `SurrealRelation` (ddl.ts:100-105) has no `enforced` field
- **Missing**: `CreateRelationStatement` (ddl.ts:291-297) has no `enforced` field
- **Missing**: generator.ts `generateTableDefinition` (line 36-48) does NOT emit `ENFORCED` for relations
- **Missing**: diff.ts `create_relation` case (line 729-734) does NOT emit `ENFORCED`

### Issue 4: CHANGEFEED Formatting (ALREADY FIXED) ✅

- generator.ts:59-60: `CHANGEFEED ${table.config.changefeed}` — clean, no `[object Object]`
- Validator in format.ts validates duration format
- Tests exist. No action needed.

### Issue 5: Schema Mode Naming (ALREADY FIXED) ✅

- generator.ts:29-33: emits correct `SCHEMAFULL`/`SCHEMALESS` (SurrealDB syntax)
- Internal naming `schema: 'full' | 'less'` is fine for types
- No action needed.

### Issue 6: Permission Format (ALREADY FIXED) ✅

- generator.ts:760-771: emits `FOR select ${perms.select}` — correct SurrealDB syntax
- diff.ts:849-851: fallback permissions use correct `WHERE true` syntax
- No action needed.

### Summary

- **4 issues already fixed** ✅: IN/OUT arrays, CHANGEFEED, schema naming, permissions
- **2 issues remain partially open**: view table type + ENFORCED keyword
- Scope for view support: new SurrealStatement variant, generator method, convert mappings, and diff handler
- Scope for ENFORCED: add to SurrealRelation + CreateRelationStatement, emit in generator + diff
<!-- SECTION:NOTES:END -->
