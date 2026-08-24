---
name: dali-orm
description: DaliORM patterns, type-safe query builders, schema definitions, migrations, and SurrealDB integration
license: MIT
---

# DaliORM

Type-safe TypeScript ORM for SurrealDB. Provides fluent query builders, schema definitions, migration system, and database function wrappers.

## Architecture Overview

```
src/
  index.ts           — Main entry: DaliORM, OrmSchema, connect, types
  sdk/
    dali-orm.ts      — DaliORM class (connect, CRUD, query, execute, schema)
    orm-schema.ts    — OrmSchema container (tables, access, variables, functions)
    table.ts         — defineTable, defineRelationTable, ColumnBuilder
    schema-builder.ts — SchemaBuilder (runtime DDL: DEFINE TABLE/FIELD/INDEX, REMOVE)
    schema.ts        — AccessConfig definitions, accessToSQL
    driver/          — SurrealDriver, NodeDriver, EmbeddedDriver, config, auth
    functions/       — SurrealDB function wrappers (math, string, vector, etc.)
    schema/column/   — Column builders (string, int, bool, datetime, record, etc.)
  query/
    index.ts         — Query builder exports (select, insert, update, delete_, etc.)
    select.ts        — SelectBuilder + WhereBuilder
    insert.ts        — InsertBuilder
    update.ts        — UpdateBuilder
    delete.ts        — DeleteBuilder
    relate.ts        — RelateBuilder + GraphPath
    upsert.ts        — UpsertBuilder
    create.ts        — CreateBuilder
    live.ts          — LiveQueryBuilder
    conditions.ts    — Condition DSL (eq, ne, gt, contains, and, or, etc.)
    types.ts         — InferSelectResult, InferInsertInput, ColumnRef, etc.
    binding.ts       — bindTable, TableBinding
    model.ts         — Model&lt;TDef&gt; class + createModel() factory
  migration/
    api.ts           — Programmatic migration API (migrateToDatabase, rollbackMigrations, etc.)
    config.ts        — Migration config loading (supports shadow ns/db)
    cli.ts           — CLI entry (dali-orm generate|migrate|pull)
    cli/             — CLI command implementations (migrate dev/deploy)
    core/            — Runner, generator, snapshot, diff
    core/shadow.ts   — Shadow DB pre-validation (validate before apply)
    ddl/             — Introspect, diff, types, journal
```

## Quick Start

```typescript
import { DaliORM, createOrmSchema, defineTable } from '@woss/dali-orm';
import { string, datetime, bool } from '@woss/dali-orm/sdk/schema/column/simple-builders';
import { record } from '@woss/dali-orm/sdk/schema/column/record';
import { select, insert } from '@woss/dali-orm/query';

// 1. Define schema
const usersTable = defineTable('users', {
  name: string('name'),
  email: string('email'),
  verified: bool('verified'),
  created_at: datetime('created_at').defaultNow(),
});

const schema = createOrmSchema({ tables: { users: usersTable } });

// 2. Connect
const orm = await DaliORM.connect({
  nodeDriver: {
    url: 'ws://localhost:10101',
    namespace: 'test',
    database: 'test',
    auth: { username: 'root', password: 'root' },
  },
  schema,
});

// 3. Query with builders (type-safe)
const driver = orm.getDriver();
const results = await select(driver, usersTable)
  .where((w) => w.eq('verified', true))
  .limit(10)
  .execute();
// results: InferSelectResult<typeof usersTable>[]

// 4. Insert
const [newUser] = await insert(driver, usersTable)
  .one({ name: 'Alice', email: 'alice@example.com', verified: false })
  .execute();

// 5. Or use Model for ad-hoc queries (bind once)
import { createModel } from '@woss/dali-orm/query';

const userModel = createModel(orm, usersTable);
const verified = await userModel
  .select()
  .where((w) => w.eq('verified', true))
  .limit(10)
  .execute();
const [newUser] = await userModel
  .insert()
  .one({ name: 'Bob', email: 'bob@example.com', verified: true })
  .execute();

// 6. Raw SQL for complex queries
await orm.query('SELECT * FROM users WHERE email = $email', { email: 'a@b.com' });
```

## ConnectOptions Auth Pattern

System-level auth (root / namespace / database) MUST flow through `ConnectOptions.authentication` in SurrealDB SDK v2. Do **not** use standalone `db.signin()` for system auth.

**Why**: SDK v2 opens a new WebSocket on auto-reconnect. Session-level `db.signin()` tokens bind to the old connection and are lost. Credentials in `ConnectOptions.authentication` persist across reconnects.

**System auth** — auth config maps to `buildSystemAuth()` which strips the `type` discriminator and produces `RootAuth | NamespaceAuth | DatabaseAuth`:

```typescript
const orm = await DaliORM.connect({
  nodeDriver: {
    url: 'ws://localhost:10101',
    namespace: 'test',
    database: 'test',
    auth: { type: 'root', username: 'root', password: 'root' },
  },
});
```

**Record / scope auth** still uses `db.use()` + `db.signin()` — it requires matching the selected namespace/database to the access scope.

## Model Class

`Model<TDef>` binds a `DaliORM` + `TableDefinition` up front so you call builder methods without passing ORM/table on every invocation.

**When to use:** ad-hoc queries, service methods that need multiple builder calls.
**When to use `bindTable`/`TableBinding` instead:** when you need the builder to share an underlying driver-level chain state (the same SELECT mutated incrementally).

### Factory & Methods

```typescript
import { createModel } from '@woss/dali-orm/query';
import type { Model } from '@woss/dali-orm/query';

const users = defineTable('user', { name: string('name') });
const userModel = createModel(orm, users); // → Model<typeof users>

// 8 builder methods — each returns a fresh builder instance
userModel.select(); // → SelectBuilder<TDef>
userModel.insert(); // → InsertBuilder<TDef>
userModel.update(); // → UpdateBuilder<TDef>
userModel.delete(); // → DeleteBuilder<TDef>
userModel.relate(); // → RelateBuilder<TDef>
userModel.create(); // → CreateBuilder<TDef>
userModel.upsert(); // → UpsertBuilder<TDef>
userModel.live(); // → LiveQueryBuilder<TDef>
userModel.orm; // → DaliORM (getter)
```

### Renamed export from barrel

Both `Model` and `createModel` are re-exported from `@woss/dali-orm/query`:

```typescript
import { Model, createModel } from '@woss/dali-orm/query';
// Equivalent:
import { Model, createModel } from '@woss/dali-orm/query/model';
```

### DaliORM convenience

`orm.model(tableDef)` wraps `createModel`:

```typescript
const userModel = orm.model(users); // same as createModel(orm, users)
```

### Usage

```typescript
const activeUsers = await userModel
  .select()
  .where((w) => w.eq('active', true))
  .orderBy('name', 'ASC')
  .limit(10)
  .execute();

const [newUser] = await userModel.insert().one({ name: 'Alice' }).execute();

await userModel
  .update()
  .where((w) => w.eq('name', 'Alice'))
  .data({ name: 'Alice Updated' })
  .execute();
```

Each method call creates a **fresh** builder — safe to reuse the same model across concurrent calls.

## Runtime Schema Builder

`SchemaBuilder` provides a fluent API for runtime DDL operations without migration files or journal tracking.

### Creating a SchemaBuilder

```typescript
const schema = orm.schema(); // returns SchemaBuilder
```

### Methods

| Method                                      | Description                           | Returns         |
| ------------------------------------------- | ------------------------------------- | --------------- |
| `defineTable(name, config?)`                | DEFINE TABLE with optional config     | SchemaBuilder   |
| `defineField(table, name, config)`          | DEFINE FIELD on a table               | SchemaBuilder   |
| `defineIndex(name, {table, fields, type?})` | DEFINE INDEX (unique/normal/fulltext) | SchemaBuilder   |
| `removeTable(name)`                         | REMOVE TABLE                          | SchemaBuilder   |
| `removeField(table, name)`                  | REMOVE FIELD FROM TABLE               | SchemaBuilder   |
| `removeIndex(name, table)`                  | REMOVE INDEX FROM TABLE               | SchemaBuilder   |
| `raw(sql)`                                  | Raw DDL statement passthrough         | SchemaBuilder   |
| `toSQL()`                                   | Generate all statements as string[]   | string[]        |
| `execute()`                                 | Run all statements via orm.query()    | Promise\<void\> |

### Usage

```typescript
// Chain operations
const schema = orm.schema();
schema
  .defineTable('user', { type: 'normal' })
  .defineField('user', 'name', { type: 'string', notNull: true })
  .defineField('user', 'email', { type: 'string', notNull: true })
  .defineIndex('user_email_idx', { table: 'user', fields: ['email'], type: 'unique' });

// Generate SQL without executing
const statements = schema.toSQL();
// → ["DEFINE TABLE user SCHEMAFULL TYPE normal", "DEFINE FIELD name ON TABLE user TYPE string ASSERT $input != NONE", ...]

// Execute all statements
await schema.execute();

// Raw DDL for unsupported operations
schema.raw('DEFINE ANALYZER my_analyzer TOKENIZERS blank CLASS FILTERS lowercase');
```

### Notes

- All methods return `this` for chaining
- `id` field is automatically skipped by `generateFieldDefinition` (SurrealDB manages it)
- `raw()` passes SQL through verbatim — no escaping or validation
- `execute()` runs statements sequentially without transaction wrapping
- Type-safe definitions reuse the same types as the migration system (`TableDefinition`, `IndexDefinition`, `ColumnDefinition`)

## Reference Files

| Task                                          | File                                                               |
| --------------------------------------------- | ------------------------------------------------------------------ |
| Column builders, defineTable, OrmSchema       | [references/schema-definition.md](references/schema-definition.md) |
| DaliORM class, connect, CRUD operations       | [references/dali-orm-class.md](references/dali-orm-class.md)       |
| Query builders (select/insert/update/etc)     | [references/query-builders.md](references/query-builders.md)       |
| Conditions DSL (eq/ne/gt/and/or/isNull)       | [references/conditions.md](references/conditions.md)               |
| Migration system (CLI + programmatic)         | [references/migrations.md](references/migrations.md)               |
| Database function wrappers                    | [references/functions.md](references/functions.md)                 |
| RecordId conventions (I/O boundary, services) | [references/id-conventions.md](references/id-conventions.md)       |
| Type inference utilities                      | [references/type-inference.md](references/type-inference.md)       |
| Driver configuration                          | [references/driver-config.md](references/driver-config.md)         |

## Loading Files

**Load reference files based on task:**

- [ ] [references/schema-definition.md](references/schema-definition.md) — if defining tables, columns, OrmSchema
- [ ] [references/dali-orm-class.md](references/dali-orm-class.md) — if connecting, CRUD, transactions, runtime DDL (orm.schema())
- [ ] [references/query-builders.md](references/query-builders.md) — if writing select/insert/update/delete queries
- [ ] [references/query-builders.md](references/query-builders.md) — Model section — if using Model class for ad-hoc queries
- [ ] [references/conditions.md](references/conditions.md) — if building complex WHERE conditions
- [ ] [references/migrations.md](references/migrations.md) — if generating/applying migrations
- [ ] [references/functions.md](references/functions.md) — if using SurrealDB functions (math, string, vector, etc.)
- [ ] [references/type-inference.md](references/type-inference.md) — if working with InferSelectResult, custom types
- [ ] [references/id-conventions.md](references/id-conventions.md) — if writing service methods, routes, or MCP handlers that handle record IDs
- [ ] [references/driver-config.md](references/driver-config.md) — if configuring connections, config files

## Export Map

| Import Path                                        | Exports                                                                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@woss/dali-orm`                                   | DaliORM, OrmSchema, createOrmSchema, connect, SurrealDriver, TableDefinition, ColumnDefinition, SchemaBuilder, createSchemaBuilder                                   |
| `@woss/dali-orm/query`                             | select, insert, update, delete\_, upsert, create, relate, live, bindTable, Model, createModel, all condition helpers, InferSelectResult, InferInsertInput, ColumnRef |
| `@woss/dali-orm/query/select`                      | SelectBuilder, WhereBuilder, select                                                                                                                                  |
| `@woss/dali-orm/query/insert`                      | InsertBuilder, insert                                                                                                                                                |
| `@woss/dali-orm/query/update`                      | UpdateBuilder, update                                                                                                                                                |
| `@woss/dali-orm/query/delete`                      | DeleteBuilder, delete\_                                                                                                                                              |
| `@woss/dali-orm/query/relate`                      | RelateBuilder, GraphPath, relate, graphPath                                                                                                                          |
| `@woss/dali-orm/query/conditions`                  | eq, ne, gt, gte, lt, lte, and, or, not, isNull, raw, etc.                                                                                                            |
| `@woss/dali-orm/query/types`                       | InferSelectResult, InferInsertInput, InferUpdateInput, ColumnRef, InferTypedRecord                                                                                   |
| `@woss/dali-orm/query/binding`                     | bindTable, TableBinding                                                                                                                                              |
| `@woss/dali-orm/query/model`                       | Model, createModel                                                                                                                                                   |
| `@woss/dali-orm/migration/api`                     | migrateToDatabase, rollbackMigrations, getMigrationStatus, generateAndApplyMigration, pushSchemaFromTableDefs                                                        |
| `@woss/dali-orm/migration/core/shadow`             | connectToShadow, destroyShadow, validateWithShadow, ShadowConfig, ShadowValidationResult                                                                             |
| `@woss/dali-orm/sdk/table`                         | defineTable, defineRelationTable, TableDefinition, ColumnBuilder, IndexDefinition                                                                                    |
| `@woss/dali-orm/sdk/schema/column/simple-builders` | string, int, float, bool, datetime, duration, decimal, array, object, uuid, createBuilder                                                                            |
| `@woss/dali-orm/sdk/schema/column/record`          | record                                                                                                                                                               |
| `@woss/dali-orm/sdk/schema/column/base`            | BaseColumnBuilder                                                                                                                                                    |
| `@woss/dali-orm/sdk/dali-orm`                      | DaliORM, DaliORMConfig, DaliORMTransaction                                                                                                                           |
| `@woss/dali-orm/sdk/orm-schema`                    | OrmSchema, createOrmSchema, OrmSchemaConfig                                                                                                                          |
| `@woss/dali-orm/sdk/driver/types`                  | SurrealDriver, DriverConfig, EmbeddedConfig, AuthType, ReconnectOptions                                                                                              |

## Cross-Skill References

- **TypeScript generics** → Use `typescript-pro` skill for advanced type patterns
- **Testing query builders** → Use `vitest` skill for writing tests
- **Test patterns (mocking, record comparison)** → Use `dali-orm-test-patterns` skill
