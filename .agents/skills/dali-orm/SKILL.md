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
    dali-orm.ts      — DaliORM class (connect, CRUD, query, execute)
    orm-schema.ts    — OrmSchema container (tables, access, variables, functions)
    table.ts         — defineTable, defineRelationTable, ColumnBuilder
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

// 5. Raw SQL for complex queries
await orm.query('SELECT * FROM users WHERE email = $email', { email: 'a@b.com' });
```

## Reference Files

| Task                                      | File                                                               |
| ----------------------------------------- | ------------------------------------------------------------------ |
| Column builders, defineTable, OrmSchema   | [references/schema-definition.md](references/schema-definition.md) |
| DaliORM class, connect, CRUD operations   | [references/dali-orm-class.md](references/dali-orm-class.md)       |
| Query builders (select/insert/update/etc) | [references/query-builders.md](references/query-builders.md)       |
| Conditions DSL (eq/ne/gt/and/or/isNull)   | [references/conditions.md](references/conditions.md)               |
| Migration system (CLI + programmatic)     | [references/migrations.md](references/migrations.md)               |
| Database function wrappers                | [references/functions.md](references/functions.md)                 |
| Type inference utilities                  | [references/type-inference.md](references/type-inference.md)       |
| Driver configuration                      | [references/driver-config.md](references/driver-config.md)         |

## Loading Files

**Load reference files based on task:**

- [ ] [references/schema-definition.md](references/schema-definition.md) — if defining tables, columns, OrmSchema
- [ ] [references/dali-orm-class.md](references/dali-orm-class.md) — if connecting, CRUD, transactions
- [ ] [references/query-builders.md](references/query-builders.md) — if writing select/insert/update/delete queries
- [ ] [references/conditions.md](references/conditions.md) — if building complex WHERE conditions
- [ ] [references/migrations.md](references/migrations.md) — if generating/applying migrations
- [ ] [references/functions.md](references/functions.md) — if using SurrealDB functions (math, string, vector, etc.)
- [ ] [references/type-inference.md](references/type-inference.md) — if working with InferSelectResult, custom types
- [ ] [references/driver-config.md](references/driver-config.md) — if configuring connections, config files

## Export Map

| Import Path                                        | Exports                                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@woss/dali-orm`                                   | DaliORM, OrmSchema, createOrmSchema, connect, SurrealDriver, TableDefinition, ColumnDefinition                                                   |
| `@woss/dali-orm/query`                             | select, insert, update, delete\_, upsert, create, relate, live, bindTable, all condition helpers, InferSelectResult, InferInsertInput, ColumnRef |
| `@woss/dali-orm/query/select`                      | SelectBuilder, WhereBuilder, select                                                                                                              |
| `@woss/dali-orm/query/insert`                      | InsertBuilder, insert                                                                                                                            |
| `@woss/dali-orm/query/update`                      | UpdateBuilder, update                                                                                                                            |
| `@woss/dali-orm/query/delete`                      | DeleteBuilder, delete\_                                                                                                                          |
| `@woss/dali-orm/query/relate`                      | RelateBuilder, GraphPath, relate, graphPath                                                                                                      |
| `@woss/dali-orm/query/conditions`                  | eq, ne, gt, gte, lt, lte, and, or, not, isNull, raw, etc.                                                                                        |
| `@woss/dali-orm/query/types`                       | InferSelectResult, InferInsertInput, InferUpdateInput, ColumnRef, InferTypedRecord                                                               |
| `@woss/dali-orm/query/binding`                     | bindTable, TableBinding                                                                                                                          |
| `@woss/dali-orm/migration/api`                     | migrateToDatabase, rollbackMigrations, getMigrationStatus, generateAndApplyMigration, pushSchemaFromTableDefs                                    |
| `@woss/dali-orm/migration/core/shadow`             | connectToShadow, destroyShadow, validateWithShadow, ShadowConfig, ShadowValidationResult                                                         |
| `@woss/dali-orm/sdk/table`                         | defineTable, defineRelationTable, TableDefinition, ColumnBuilder, IndexDefinition                                                                |
| `@woss/dali-orm/sdk/schema/column/simple-builders` | string, int, float, bool, datetime, duration, decimal, array, object, uuid, createBuilder                                                        |
| `@woss/dali-orm/sdk/schema/column/record`          | record                                                                                                                                           |
| `@woss/dali-orm/sdk/schema/column/base`            | BaseColumnBuilder                                                                                                                                |
| `@woss/dali-orm/sdk/dali-orm`                      | DaliORM, DaliORMConfig, DaliORMTransaction                                                                                                       |
| `@woss/dali-orm/sdk/orm-schema`                    | OrmSchema, createOrmSchema, OrmSchemaConfig                                                                                                      |
| `@woss/dali-orm/sdk/driver/types`                  | SurrealDriver, DriverConfig, EmbeddedConfig, AuthType, ReconnectOptions                                                                          |

## Cross-Skill References

- **TypeScript generics** → Use `typescript-pro` skill for advanced type patterns
- **Testing query builders** → Use `vitest` skill for writing tests
