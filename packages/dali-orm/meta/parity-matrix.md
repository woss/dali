# SurrealQL Parity Matrix

Comprehensive coverage map of SurrealQL features against DaliORM builders, helpers, and escape hatches.

> **Statuses:**
>
> - ✅ **SUPPORTED** — fluent builder with typed methods
> - ⚡ **RAW-SQL ONLY** — available via `driver.query()` or `surql` template tag, no dedicated builder
> - 🚫 **MISSING** — not supported at all
> - ➖ **PARITY-OPTIONAL** — too niche or experimental, documented escape hatch

Last verified: 2026-07-14

---

> **DEPRECATION NOTICE:** `DEFINE SCOPE` and `DEFINE TOKEN` were deprecated in SurrealDB v3.0.0 and replaced by `DEFINE ACCESS`.
> This ORM does NOT implement SCOPE/TOKEN builders. Use the `defineAccess()` builder in `sdk/schema.ts` for all auth configuration.

---

## 1. Statements

### 1.1 Core CRUD

| Statement | Status       | Location                            |
| --------- | ------------ | ----------------------------------- |
| SELECT    | ✅ SUPPORTED | `query/select.ts` — `SelectBuilder` |
| CREATE    | ✅ SUPPORTED | `query/create.ts` — `CreateBuilder` |
| INSERT    | ✅ SUPPORTED | `query/insert.ts` — `InsertBuilder` |
| UPDATE    | ✅ SUPPORTED | `query/update.ts` — `UpdateBuilder` |
| DELETE    | ✅ SUPPORTED | `query/delete.ts` — `DeleteBuilder` |
| RELATE    | ✅ SUPPORTED | `query/relate.ts` — `RelateBuilder` |
| UPSERT    | ✅ SUPPORTED | `query/upsert.ts` — `UpsertBuilder` |

### 1.2 DEFINE Subtypes

| Subtype   | Status             | Notes                                                                                  |
| --------- | ------------------ | -------------------------------------------------------------------------------------- |
| TABLE     | ✅ SUPPORTED       | `migration/core/generator.ts` → `generateTableDefinition()`                            |
| FIELD     | ✅ SUPPORTED       | `migration/core/generator.ts` → `generateFieldDefinition()`, `generateFieldRedefine()` |
| INDEX     | ✅ SUPPORTED       | `migration/core/generator.ts` → `generateIndexDefinition()` (unique, fulltext, HNSW)   |
| ACCESS    | ✅ SUPPORTED       | `migration/core/generator.ts` → `generateAccessDefinition()`                           |
| EVENT     | ✅ SUPPORTED       | `migration/core/generator.ts` → `generateEventDefinition()`                            |
| FUNCTION  | ✅ SUPPORTED       | `migration/core/generator.ts` → `generateFunctionDefinition()`                         |
| VIEW      | ✅ SUPPORTED       | `migration/core/generator.ts` → `generateViewDefinition()`                             |
| ANALYZER  | ✅ SUPPORTED       | `migration/core/generator.ts` → `generateAnalyzerDefinition()`                         |
| NAMESPACE | ✅ SUPPORTED       | `migration/core/generator.ts` → `generateNamespaceDefinition()`                        |
| DATABASE  | ✅ SUPPORTED       | `migration/core/generator.ts` → `generateDatabaseDefinition()`                         |
| TOKEN     | 🚫 MISSING         | Deprecated in SurrealDB v3.0.0 — replaced by DEFINE ACCESS. No builder.                |
| SCOPE     | 🚫 MISSING         | Deprecated in SurrealDB v3.0.0 — replaced by DEFINE ACCESS. No builder.                |
| PARAM     | ⚡ RAW-SQL ONLY    | `DEFINE PARAM` used in migration runner (`migration/core/runner.ts:138`) as raw SQL    |
| USER      | 🚫 MISSING         | No builder, no generator                                                               |
| CONFIG    | 🚫 MISSING         | No builder, no generator                                                               |
| BUCKET    | ➖ PARITY-OPTIONAL | Experimental SurrealDB feature                                                         |
| SEQUENCE  | ✅ SUPPORTED       | `migration/core/generator.ts` → `generateSequenceDefinition()`                         |
| MODULE    | ➖ PARITY-OPTIONAL | Experimental module system                                                             |
| API       | ⚡ RAW-SQL ONLY    | `sdk/functions/api.ts` has `apiTimeout()` but no `DEFINE API` generator                |

### 1.3 ALTER Subtypes

| Subtype   | Status             | Notes                                                                                        |
| --------- | ------------------ | -------------------------------------------------------------------------------------------- |
| TABLE     | ✅ SUPPORTED       | `generateAlterTablePermissions()` for permissions                                            |
| FIELD     | ✅ SUPPORTED       | `generateAlterFieldType()`, `generateAlterFieldPermissions()`, `generateAlterFieldDefault()` |
| NAMESPACE | ⚡ RAW-SQL ONLY    | No ALTER generator; use `driver.query('ALTER NS ...')`                                       |
| DATABASE  | ⚡ RAW-SQL ONLY    | No ALTER generator; use `driver.query('ALTER DB ...')`                                       |
| USER      | 🚫 MISSING         | No generator                                                                                 |
| ACCESS    | 🚫 MISSING         | No generator (DEFINE/REMOVE only)                                                            |
| ANALYZER  | 🚫 MISSING         | No generator                                                                                 |
| EVENT     | 🚫 MISSING         | No generator                                                                                 |
| FUNCTION  | 🚫 MISSING         | No generator                                                                                 |
| INDEXES   | 🚫 MISSING         | No generator                                                                                 |
| PARAM     | 🚫 MISSING         | No generator                                                                                 |
| SEQUENCE  | ⚡ RAW-SQL ONLY    | No ALTER generator; use `driver.query('ALTER SEQUENCE ...')`                                 |
| SYSTEM    | 🚫 MISSING         | No generator                                                                                 |
| API       | 🚫 MISSING         | No generator                                                                                 |
| CONFIG    | 🚫 MISSING         | No generator                                                                                 |
| BUCKET    | ➖ PARITY-OPTIONAL | Experimental                                                                                 |

### 1.4 REMOVE Subtypes

| Subtype   | Status       | Notes                                                       |
| --------- | ------------ | ----------------------------------------------------------- |
| TABLE     | ✅ SUPPORTED | `generateRemoveTable()`                                     |
| FIELD     | ✅ SUPPORTED | `generateRemoveField()`                                     |
| INDEX     | ✅ SUPPORTED | `generateRemoveIndex()`                                     |
| ACCESS    | ✅ SUPPORTED | `generateRemoveAccess()`                                    |
| EVENT     | ✅ SUPPORTED | `generateRemoveEvent()`                                     |
| FUNCTION  | ✅ SUPPORTED | `generateRemoveFunction()`                                  |
| VIEW      | ✅ SUPPORTED | `generateRemoveView()`                                      |
| ANALYZER  | ✅ SUPPORTED | `generateRemoveAnalyzer()`                                  |
| NAMESPACE | ✅ SUPPORTED | `migration/core/generator.ts` → `generateRemoveNamespace()` |
| DATABASE  | ✅ SUPPORTED | `migration/core/generator.ts` → `generateRemoveDatabase()`  |
| TOKEN     | 🚫 MISSING   | Deprecated in SurrealDB v3.0.0                              |
| SCOPE     | 🚫 MISSING   | Deprecated in SurrealDB v3.0.0                              |
| PARAM     | 🚫 MISSING   | No generator                                                |
| USER      | 🚫 MISSING   | No generator                                                |
| SEQUENCE  | ✅ SUPPORTED | `migration/core/generator.ts` → `generateRemoveSequence()`  |

### 1.5 Other Statements

| Statement               | Status          | Notes                                                                                                                                                                                                                                |
| ----------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| KILL                    | ✅ SUPPORTED    | `KillBuilder` in `query/statements.ts`. Factory: `kill()`. Output: `KILL $param`.                                                                                                                                                    |
| REBUILD INDEX           | ✅ SUPPORTED    | `RebuildIndexBuilder` in `query/statements.ts`. Factory: `rebuildIndex()`. Output: `REBUILD INDEX idx ON TABLE`.                                                                                                                     |
| INFO FOR ...            | ✅ SUPPORTED    | `InfoBuilder` in `query/statements.ts`. Factory: `info()`. Output: `INFO FOR DB` / `NS` / `TB` / `SC`.                                                                                                                               |
| SHOW CHANGES            | ✅ SUPPORTED    | `ShowChangesBuilder` in `query/statements.ts`. Factory: `showChanges()`. Output: `SHOW CHANGES FOR TABLE tbl SINCE $param LIMIT $param`.                                                                                             |
| USE                     | ✅ SUPPORTED    | `UseBuilder` in `query/statements.ts`. Factory: `use()`. Output: `USE NS name DB name`.                                                                                                                                              |
| BEGIN / CANCEL / COMMIT | ✅ SUPPORTED    | `BeginBuilder`, `CommitBuilder`, `CancelBuilder` in `query/statements.ts`. Factories: `beginTransaction()`, `commitTransaction()`, `cancelTransaction()`. Output: `BEGIN TRANSACTION` / `COMMIT TRANSACTION` / `CANCEL TRANSACTION`. |
| SLEEP                   | 🚫 MISSING      | No builder, no helper                                                                                                                                                                                                                |
| BREAK / CONTINUE        | 🚫 MISSING      | Control-flow only — not applicable to ORM builders                                                                                                                                                                                   |
| FOR ... IN              | 🚫 MISSING      | Control-flow — not applicable to ORM builders                                                                                                                                                                                        |
| IF ... ELSE ... END     | 🚫 MISSING      | Control-flow — not applicable to ORM builders                                                                                                                                                                                        |
| LET                     | ✅ SUPPORTED    | `LetBuilder` in `query/statements.ts`. Factory: `let_()`. Output: `LET $name = expr`. Supports raw expressions.                                                                                                                      |
| RETURN                  | ✅ SUPPORTED    | `ReturnBuilder` in `query/statements.ts`. Factory: `return_()`. Output: `RETURN expr`. Supports raw expressions.                                                                                                                     |
| THROW                   | ✅ SUPPORTED    | `ThrowBuilder` in `query/statements.ts`. Factory: `throw_()`. Output: `THROW expr`. Supports raw expressions.                                                                                                                        |
| REBUILD                 | 🚫 MISSING      | No builder                                                                                                                                                                                                                           |
| ALTER                   | ⚡ RAW-SQL ONLY | Some ALTER subtypes have generators (TABLE, FIELD); most use raw SQL                                                                                                                                                                 |
| UPSERT (standalone)     | ✅ SUPPORTED    | `query/upsert.ts`                                                                                                                                                                                                                    |

---

## 2. SELECT Clauses

| Clause             | Status       | Notes                                                                           |
| ------------------ | ------------ | ------------------------------------------------------------------------------- |
| FROM               | ✅ SUPPORTED | `SelectBuilder` — `query/select.ts:386`                                         |
| WHERE              | ✅ SUPPORTED | `ConditionNode` tree via `where()` — `query/select.ts:388-398`                  |
| GROUP BY           | ✅ SUPPORTED | `groupBy()` method — `query/select.ts:224-233`                                  |
| ORDER BY           | ✅ SUPPORTED | `orderByClauses` — `query/select.ts:406-409`                                    |
| LIMIT              | ✅ SUPPORTED | `limit()` method — `query/select.ts:173-178`                                    |
| START              | ✅ SUPPORTED | `start()` method — `query/select.ts:183-188`                                    |
| FETCH              | ✅ SUPPORTED | `fetch()` with typed autocomplete for record fields — `query/select.ts:193-201` |
| TIMEOUT            | ✅ SUPPORTED | `timeout()` method with string validation — `query/select.ts:238-242`           |
| PARALLEL           | ✅ SUPPORTED | `parallel()` toggle — `query/select.ts:247-250`                                 |
| WITH (CTEs)        | ✅ SUPPORTED | `with()` method for common table expressions — `query/select.ts:327-332`        |
| WITH (index hints) | ✅ SUPPORTED | `withIndex()` / `withNoIndex()` — `query/select.ts`                             |
| UNION              | ✅ SUPPORTED | `union()`, `unionAll()` — `query/select.ts:287-298`                             |
| INTERSECT          | ✅ SUPPORTED | `intersect()` — `query/select.ts:302-305`                                       |
| EXCEPT             | ✅ SUPPORTED | `except()` — `query/select.ts:309-312`                                          |
| SUBQUERY           | ✅ SUPPORTED | `subquery()` method — `query/select.ts:279-283`                                 |
| GRAPH TRAVERSE     | ✅ SUPPORTED | `traverse()` for `->edge->target` syntax — `query/select.ts:209-220`            |
| OMIT               | ✅ SUPPORTED | `omit()` method — emitted BEFORE FROM — `query/select.ts`                       |
| SPLIT              | ✅ SUPPORTED | `split()` method — `query/select.ts`                                            |
| EXPLAIN            | ✅ SUPPORTED | `explain()` method — wraps result in EXPLAIN prefix — `query/select.ts`         |
| TEMPFILES          | ✅ SUPPORTED | `tempfiles()` method — `query/select.ts`                                        |
| VERSION            | ✅ SUPPORTED | `version()` method with snapshot timestamp — `query/select.ts`                  |

---

## 3. Functions

All function namespaces have typed wrappers in `sdk/functions/` that return `SqlExpr` for composition. Coverage is comprehensive.

| Namespace  | Status       | Location                    | Notes                                                       |
| ---------- | ------------ | --------------------------- | ----------------------------------------------------------- |
| api::      | ✅ SUPPORTED | `sdk/functions/api.ts`      | `apiTimeout()`                                              |
| array::    | ✅ SUPPORTED | `sdk/functions/array.ts`    | 31 functions (add, append, concat, contains, etc.)          |
| bytes::    | ✅ SUPPORTED | `sdk/functions/bytes.ts`    | 7 functions (and, len, or, resize, reverse, to_string, xor) |
| count::    | ✅ SUPPORTED | `sdk/functions/count.ts`    | `count()`, `countAll()`                                     |
| crypto::   | ✅ SUPPORTED | `sdk/functions/crypto.ts`   | 16 functions (argon2, bcrypt, blake3, sha256, etc.)         |
| duration:: | ✅ SUPPORTED | `sdk/functions/duration.ts` | 8 functions (days, hours, mins, secs, etc.)                 |
| encoding:: | ✅ SUPPORTED | `sdk/functions/encoding.ts` | `base64Encode()`, `base64Decode()`                          |
| file::     | ✅ SUPPORTED | `sdk/functions/files.ts`    | 6 functions (delete, exists, get, info, list, put)          |
| geo::      | ✅ SUPPORTED | `sdk/functions/geo.ts`      | 8 functions (area, bearing, centroid, distance, etc.)       |
| http::     | ✅ SUPPORTED | `sdk/functions/http.ts`     | 6 functions (delete, get, head, patch, post, put)           |
| index::    | 🚫 MISSING   | —                           | No dedicated module. No function wrappers.                  |
| math::     | ✅ SUPPORTED | `sdk/functions/math.ts`     | 29 functions (abs, ceil, floor, random, sum, etc.)          |
| meta::     | ✅ SUPPORTED | `sdk/functions/meta.ts`     | `metaId()`, `metaTable()`, `metaTb()`                       |
| not::      | ✅ SUPPORTED | `sdk/functions/not.ts`      | `not()`                                                     |
| object::   | ✅ SUPPORTED | `sdk/functions/object.ts`   | 8 functions (entries, extend, keys, values, etc.)           |
| parse::    | ✅ SUPPORTED | `sdk/functions/parse.ts`    | 9 functions (email, url parsing)                            |
| rand::     | ✅ SUPPORTED | `sdk/functions/rand.ts`     | 9 functions (bool, enum, float, guid, int, string, uuid)    |
| record::   | ✅ SUPPORTED | `sdk/functions/record.ts`   | `recordId()`, `recordTable()`                               |
| search::   | ✅ SUPPORTED | `sdk/functions/search.ts`   | `searchHighlight()`, `searchScore()`                        |
| sequence:: | ✅ SUPPORTED | `sdk/functions/sequence.ts` | `sequenceNext()`, `sequencePeek()`, `sequenceSet()`         |
| session::  | ✅ SUPPORTED | `sdk/functions/session.ts`  | 6 functions (expiry, id, origin, sc, token, user)           |
| set::      | ✅ SUPPORTED | `sdk/functions/set.ts`      | 9 functions (add, difference, intersect, union, etc.)       |
| sleep::    | ✅ SUPPORTED | `sdk/functions/sleep.ts`    | `sleep()`                                                   |
| string::   | ✅ SUPPORTED | `sdk/functions/string.ts`   | 35 functions (concat, contains, length, slug, etc.)         |
| time::     | ✅ SUPPORTED | `sdk/functions/time.ts`     | 18 functions (now, floor, format, unix, etc.)               |
| type::     | ✅ SUPPORTED | `sdk/functions/type.ts`     | 24 functions (cast + type checking)                         |
| value::    | ✅ SUPPORTED | `sdk/functions/value.ts`    | 14 functions (arrays, booleans, strings, etc.)              |
| vector::   | ✅ SUPPORTED | `sdk/functions/vector.ts`   | 9 functions (add, angle, cross, distance, etc.)             |
| ml::       | ✅ SUPPORTED | `sdk/functions/ml.ts`       | `mlPredict()`, `mlTrain()`                                  |

**Summary:** 29/30 namespaces fully covered. `index::` is missing.

---

## 4. Language Primitives

| Primitive                | Status          | Notes                                                                                                                                                                                                                                                                                                         |
| ------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parameters (`$param`)    | ✅ SUPPORTED    | All query builders parameterize values. `SelectBuilder.toSQL()` remaps params for CTEs/subqueries. `buildCondition()` in `conditions.ts` generates `$param` placeholders.                                                                                                                                     |
| Record Links (`->`)      | ✅ SUPPORTED    | `RelateBuilder` for edge creation. `SelectBuilder.traverse()` for graph queries. `Record` column type with `recordTable` config.                                                                                                                                                                              |
| Record References        | ✅ SUPPORTED    | `record()` column builder with `linksTo` config. Auto-coercion in `BaseDriver.coerceRecordIds()`.                                                                                                                                                                                                             |
| Casting (`<type>value`)  | ⚡ RAW-SQL ONLY | No builder syntax. Use `raw()` or `$` template to emit `<string>$value`. `type::` function wrappers provide typed alternatives (e.g., `typeString()`, `typeInt()`).                                                                                                                                           |
| Transactions             | ✅ SUPPORTED    | `BeginBuilder`/`CommitBuilder`/`CancelBuilder` in `query/statements.ts`. Plus `BaseDriver.transaction()` wrapper.                                                                                                                                                                                             |
| Comments (`//`, `/* */`) | ➖ N/A          | Handled by SurrealDB parser, not ORM concern.                                                                                                                                                                                                                                                                 |
| Operators                | ✅ SUPPORTED    | `conditions.ts` re-exports SDK condition functions (`eq`, `gt`, `gte`, `lt`, `lte`, `ne`, `and`, `or`, `not`, `contains`, `inside`, `outside`, `intersects`, `raw`, `eeq`). `ConditionOp` union covers `=`, `==`, `!=`, `>`, `>=`, `<`, `<=`, `CONTAINS`, `INSIDE`, `OUTSIDE`, `INTERSECTS`, `IN`, `~`, `!~`. |
| Data Types               | ✅ SUPPORTED    | See Section 5 for column type coverage.                                                                                                                                                                                                                                                                       |
| Formatters               | ➖ N/A          | ORM concern — serializers handle formatting.                                                                                                                                                                                                                                                                  |
| Idioms                   | ➖ N/A          | Documentation-level concept.                                                                                                                                                                                                                                                                                  |

---

## 5. Column Types

Column type builders defined in `sdk/schema/column/`. The `SurrealColumnType` union in `types.ts` declares all recognized types; only a subset have dedicated builder functions.

### 5.1 Supported Builders

| Type     | Status       | Builder Location                            | Notes                                        |
| -------- | ------------ | ------------------------------------------- | -------------------------------------------- |
| string   | ✅ SUPPORTED | `column/string.ts` / `simple-builders.ts`   |                                              |
| int      | ✅ SUPPORTED | `column/int.ts` / `simple-builders.ts`      |                                              |
| float    | ✅ SUPPORTED | `column/float.ts` / `simple-builders.ts`    |                                              |
| bool     | ✅ SUPPORTED | `column/bool.ts` / `simple-builders.ts`     |                                              |
| datetime | ✅ SUPPORTED | `column/datetime.ts` / `simple-builders.ts` |                                              |
| duration | ✅ SUPPORTED | `column/duration.ts` / `simple-builders.ts` |                                              |
| decimal  | ✅ SUPPORTED | `column/decimal.ts` / `simple-builders.ts`  |                                              |
| uuid     | ✅ SUPPORTED | `column/simple-builders.ts`                 |                                              |
| array    | ✅ SUPPORTED | `column/array.ts`                           | Fixed-size arrays with element configs       |
| object   | ✅ SUPPORTED | `column/simple-builders.ts`                 |                                              |
| geometry | ✅ SUPPORTED | `column/geometry.ts`                        |                                              |
| record   | ✅ SUPPORTED | `column/record.ts`                          | With `recordTable` / `linksTo` config        |
| tuple    | ✅ SUPPORTED | `column/tuple.ts`                           | Ordered fixed-size array with typed elements |

### 5.2 Types in Union Without Builders

| Type     | Status             | Notes                                                                                   |
| -------- | ------------------ | --------------------------------------------------------------------------------------- |
| bytes    | 🚫 MISSING         | In `SurrealColumnType` union and `SURREALDB_TYPE_MAP`, but no `column/bytes.ts` builder |
| number   | 🚫 MISSING         | SurrealDB float64 — in union but no dedicated builder                                   |
| set      | 🚫 MISSING         | Unique unordered values — in union but no builder                                       |
| literal  | 🚫 MISSING         | Quoted string literals — in union but no builder                                        |
| function | 🚫 MISSING         | Computed columns — in union but no builder                                              |
| point    | 🚫 MISSING         | Geographic point — in union but no builder                                              |
| regex    | 🚫 MISSING         | Regular expression — in union but no builder                                            |
| range    | 🚫 MISSING         | Range type — in union but no builder                                                    |
| table    | 🚫 MISSING         | Table reference — in union but no builder                                               |
| file     | 🚫 MISSING         | File bucket reference — in union but no builder                                         |
| any      | ➖ PARITY-OPTIONAL | Wildcard type — in union, used in tuple element defaults                                |
| null     | ➖ PARITY-OPTIONAL | Null type — in union, edge-case usage                                                   |

---

## Summary Counts

| Category         | ✅ Supported | ⚡ Raw-SQL | 🚫 Missing | ➖ Optional |
| ---------------- | ------------ | ---------- | ---------- | ----------- |
| Core CRUD        | 7            | 0          | 0          | 0           |
| DEFINE           | 11           | 2          | 4          | 2           |
| ALTER            | 2            | 3          | 10         | 1           |
| REMOVE           | 11           | 0          | 4          | 0           |
| Other Statements | 10           | 1          | 5          | 0           |
| SELECT Clauses   | 21           | 0          | 0          | 0           |
| Functions        | 28           | 0          | 1          | 0           |
| Column Types     | 13           | 0          | 10         | 2           |
| **Total**        | **103**      | **6**      | **34**     | **5**       |

---

## Escape Hatches

When a feature is ⚡ RAW-SQL ONLY or 🚫 MISSING, use these patterns:

```typescript
// 1. driver.query() — raw SurrealQL execution
const result = await driver.query('INFO FOR DB');

// 2. raw() — embed raw SQL in builder context
import { raw } from 'surrealdb';
const expr = raw('function::uuid()');

// 3. $ template tag — build SqlExpr from template literals
import { $ } from '../sdk/functions/sql.js';
const sql = $('SHOW CHANGES FOR TABLE user SINCE 0 LIMIT 10');

// 4. ORM-level wrappers
await driver.use('myns', 'mydb'); // USE namespace/database
await driver.showChanges('user'); // SHOW CHANGES
await orm.transaction(async (tx) => {
  // BEGIN/COMMIT/CANCEL
  await tx.create('user', { name: 'test' });
});
```
