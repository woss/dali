## <<<<<<< New base: init memory

id: TASK-039
title: Migrate dali-memory raw SurrealDB calls to dali-orm query builders
status: Done
assignee: []
created_date: '2026-05-10'
updated_date: '2026-05-12'
labels: []
dependencies: []
priority: medium

---

## Description

Migrate 3 raw `this.orm.query()` calls in `surreal-client.ts` (packages/dali-memory) to use dali-orm type-safe query builders.

### Current Raw Calls

1. **Line 380** - `RELATE` query for memory-fact edge linking
   - Current: `this.orm.query('RELATE type::thing($memoryId)->relates_to->type::thing($factId) SET type = "memory_fact"', ...`
   - Target: dali-orm `relate()` query builder

2. **Line 176** - Vector similarity search
   - Current: `this.orm.query('SELECT *, vector::similarity::cosine(vector, $vector) AS score FROM memories ...')`
   - Target: KEEP as `this.orm.query()` (dali-orm select builder lacks computed field support for `vector::similarity::cosine`)

3. **Line 316** - Graph traversal for linked facts
   - Current: `this.orm.query('SELECT * FROM facts WHERE id IN (SELECT VALUE out FROM relates_to WHERE ...)')`
   - Target: KEEP as `this.orm.query()` (dali-orm select builder lacks `SELECT VALUE` subquery support)

### Requirements

- Add `relates_to` edge TableDefinition to `packages/dali-memory/src/schema.ts`
- Import `defineRelationTable` from dali-orm (or check if `defineTable` supports edge types)
- Replace RELATE call with `relate(driver, relatesToSchema).from(id).to(id).set(key, val).execute()`
- Vector search and graph traversal remain as `this.orm.query()` (already through dali-orm path)
- All tests pass after changes

### Files to Modify

- `packages/dali-memory/src/schema.ts` - Add relates_to edge table definition
- `packages/dali-memory/src/surreal-client.ts` - Replace RELATE raw query

### Not Changing

- DDL (DEFINE NAMESPACE/DATABASE) - stays as `this.orm.query()`
- Vector search - stays as `this.orm.query()`
- Graph traversal - stays as `this.orm.query()`
  |||||||
  =======

---

id: TASK-039
title: Migrate dali-memory raw SurrealDB calls to dali-orm query builders
status: Done
assignee: []
created_date: "2026-05-10"
updated_date: "2026-05-12"
labels: []
dependencies: []
priority: medium

---

## Description

Migrate 3 raw `this.orm.query()` calls in `surreal-client.ts` (packages/dali-memory) to use dali-orm type-safe query builders.

### Current Raw Calls

1. **Line 380** - `RELATE` query for memory-fact edge linking
   - Current: `this.orm.query('RELATE type::thing($memoryId)->relates_to->type::thing($factId) SET type = "memory_fact"', ...`
   - Target: dali-orm `relate()` query builder

2. **Line 176** - Vector similarity search
   - Current: `this.orm.query('SELECT *, vector::similarity::cosine(vector, $vector) AS score FROM memories ...')`
   - Target: KEEP as `this.orm.query()` (dali-orm select builder lacks computed field support for `vector::similarity::cosine`)

3. **Line 316** - Graph traversal for linked facts
   - Current: `this.orm.query('SELECT * FROM facts WHERE id IN (SELECT VALUE out FROM relates_to WHERE ...)')`
   - Target: KEEP as `this.orm.query()` (dali-orm select builder lacks `SELECT VALUE` subquery support)

### Requirements

- Add `relates_to` edge TableDefinition to `packages/dali-memory/src/schema.ts`
- Import `defineRelationTable` from dali-orm (or check if `defineTable` supports edge types)
- Replace RELATE call with `relate(driver, relatesToSchema).from(id).to(id).set(key, val).execute()`
- Vector search and graph traversal remain as `this.orm.query()` (already through dali-orm path)
- All tests pass after changes

### Files to Modify

- `packages/dali-memory/src/schema.ts` - Add relates_to edge table definition
- `packages/dali-memory/src/surreal-client.ts` - Replace RELATE raw query

### Not Changing

- DDL (DEFINE NAMESPACE/DATABASE) - stays as `this.orm.query()`
- Vector search - stays as `this.orm.query()`
- Graph traversal - stays as `this.orm.query()`
  > > > > > > > Current commit: init memory
