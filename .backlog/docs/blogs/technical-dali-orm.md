---
title: 'Type-Safe SurrealDB: Meet the ORM That Ships'
featured: true
description: "A technical walkthrough of DaliORM — how schema definitions become type-safe queries and auto-generated migrations for SurrealDB. Covers the driver architecture, query builder design, migration engine internals, and the Parse Don't Validate philosophy behind it."
date: 2026-06-03
tags:
  - surrealdb
  - orm
  - typescript
  - database
  - query builder
  - migrations
header_image: '[Future in the city](https://u.macula.link/HR7CSIPkTFOBV8xVNmVUxg-7?preset=sys_lg)'
---

# Type-Safe SurrealDB: Meet the ORM That Ships

## The Problem

SurrealQL is expressive — documents, graphs, live queries, flexible schemas — but using it from TypeScript has a gap: there's no coupling between your database schema and your query types. The SDK does accept generic type parameters (`db.query<[Person[]]]>(...)`, `db.select<Person>(table)`) to annotate results, but those types are **manual assertions** — you maintain them by hand and they silently drift when the schema changes. Field names inside SurrealQL strings (`WHERE emial = 'x'`) are unchecked at compile time. Without an ORM, schema changes require hand-writing SurrealQL migration scripts — no diffing, no up/down pairing, no rollback safety net.

These aren't operational trivia. They're friction that compounds with every schema change, every deploy, every new team member who doesn't know the field names by heart.

DaliORM bridges this gap by making your TypeScript schema the single source of truth. Query builders derive their types from table definitions — no codegen step, no generated files to manage. Migrations generate automatically from schema diffs, with pre-deployment shadow validation and per-statement journal tracking. The architecture is intentionally thin: a wrapper around the official SurrealDB SDK with validation at entry boundaries (Parse Don't Validate) and direct delegation to the SDK for all CRUD operations.

## Schema as Source of Truth

The schema definition is a single TypeScript file. Every table gets a `defineTable` call with typed column builders. This one definition drives query building, migration generation, and runtime validation — three outputs from one input.

```typescript
import { defineTable, defineRelationTable } from '@woss/dali-orm/sdk/table';
import { string, int, bool, datetime } from '@woss/dali-orm/sdk/schema/column/simple-builders';
import { record } from '@woss/dali-orm/sdk/schema/column/record';

const users = defineTable('user', {
  id: string('id'),
  email: string('email').unique(),
  name: string('name'),
  role: string('role').default('viewer'),
  created_at: datetime('created_at').defaultNow(),
});

const posts = defineTable(
  'post',
  {
    id: string('id'),
    title: string('title'),
    content: string('content'),
    published: bool('published').default(false),
    views: int('views').default(0),
    author: record('user'),
    created_at: datetime('created_at').defaultNow(),
  },
  {
    indexes: [
      { name: 'author_idx', fields: ['author'] },
      { name: 'published_idx', fields: ['published'] },
    ],
    changefeed: '7d',
  },
);

const likes = defineRelationTable(
  'likes',
  { created_at: datetime('created_at').defaultNow() },
  { in: 'user', out: 'post' },
);
```

Each column builder accepts a SurrealQL type and returns a chainable object. `.unique()` maps to `UNIQUE` in the generated field definition. `.defaultNow()` maps to `DEFAULT time::now()`. `.default('viewer')` maps to a static `DEFAULT`. The chain methods correspond one-to-one with SurrealQL clauses — no abstraction layer between the builder call and the generated DDL.

The `record()` builder is where SurrealDB's graph model becomes visible through the type system. `record('user')` maps to SurrealQL's `TYPE record<user>`, a native reference type that the database enforces. When you write `author: record('user')`, every `author` value must be a valid `user` record ID. The database enforces referential integrity without application-level checks.

`defineRelationTable` handles edge tables. It generates the `in` and `out` fields automatically and tags the table as a relation, which both query builders and migration generation use to produce correct SurrealQL. Graph traversals like `->likes->post` derive their type metadata from this definition.

The key design decision: `defineTable` returns a `TableDefinition` object that carries both runtime values and TypeScript types. The same `users` constant that types your insert input also drives migration generation and validates query conditions. There is no code generation step, no `npm run generate-types`, no generated `.d.ts` files. The types are derived structurally from the builder calls — add a column, all query types update automatically; remove one, every query referencing it breaks at compile time.

## Type-Safe Queries

Query builders take a `SurrealDriver` and a `TableDefinition`. The builder knows every field on the table — its name, type, optionality — and constrains your query before it reaches the database.

```typescript
import { select, insert, update, relate } from '@woss/dali-orm/query';
import type { InferSelectResult } from '@woss/dali-orm/query';

// Insert — every field is type-checked
const [post] = await insert(driver, posts)
  .one({
    title: 'Hello SurrealDB',
    content: 'Type-safe databases are better.',
    author: 'user:abc123',
  })
  .execute();
// post: { id: string, title: string, content: string, published: boolean, views: number, author: string, created_at: string }

// Select — WhereBuilder autocompletes valid fields
const results = await select(driver, posts)
  .where((w) => w.eq('published', true).eq('author', 'user:abc123'))
  .orderBy('created_at', 'DESC')
  .limit(10)
  .execute();
// results: InferSelectResult<typeof posts>[]

// Update — partial merge, field-checked
await update(driver, posts).id('post:xyz').data({ published: true }).execute();

// Graph relation — builder knows in/out types
await relate(driver, likes)
  .from('user:abc123')
  .to('post:xyz')
  .set({ created_at: new Date().toISOString() })
  .execute();
```

The WhereBuilder DSL is where type safety becomes tangible. Inside `.where((w) => ...)`, `w.eq()` accepts only field names that exist on the table. `w.eq('publishd', true)` is a compile error. The conditions are composable — `w.eq('a', 1).ne('b', 2).gt('c', 3)` chains naturally — and each condition validates its value against the field's type. You can't compare a `string` field with `true`, and you can't filter on a field that doesn't exist.

`InferSelectResult` derives the return type from the table definition without any explicit annotation:

```typescript
type Post = InferSelectResult<typeof posts>;
// { id: string, title: string, content: string, published: boolean, views: number, author: string, created_at: string }
```

The inference maps SurrealDB types to TypeScript: `string()` → `string`, `int()` → `number`, `bool()` → `boolean`, `record('user')` → `string` (the record ID string), `datetime()` → `string` (ISO 8601). Optional columns become `T | undefined`. This mapping lives in `@woss/dali-orm/query/types` and updates automatically as table definitions change.

The design follows Law 2 of Elegant Defense (Parse Don't Validate) at the query level too. The `insert().one()` call accepts only valid input shapes — fields that don't exist on the table are compiler errors, not runtime guards. The update path filters out non-existent fields structurally. Invalid data is structurally impossible to express in the API.

The same structural approach extends to results. The raw SDK's generic type parameters (`select<Person>(table)`) are type-level assertions — `RecordResult<T>` is a bare `type` alias that defines a shape but performs no runtime validation. If the database returns data missing a required field, TypeScript won't catch it. DaliORM's `InferSelectResult` derives output types structurally from the table definition. The type is computed from the schema, not manually annotated, and updates automatically when the schema changes.

## Migration Workflow

Migrations work by diffing. The migration engine introspects the current database state (from a snapshot file or live DB), compares it against the current schema definitions, and generates the SurrealQL statements needed to reconcile them.

```bash
# Generate migration from schema diff
npx dali-orm generate add_views_field

# Validate against shadow DB, then apply to target
npx dali-orm migrate dev add_views_field
```

When you change the schema — add a field, rename a column, create a new table — the diff engine compares table definitions field by field and constructs UP and DOWN SurrealQL:

```
migrations/
  20260505_add_views_field.surql   # UP + DOWN statements
meta/
  _journal.json                     # Per-statement progress tracking
  snapshots/
    20260505_add_views_field.json   # Schema state after migration
```

The diff engine works at the DDL level. It introspects the database via SurrealDB's `INFO FOR TABLE`, parses the response into a typed DDL model, and compares it against the current `TableDefinition`. The comparison detects additions, removals, type changes, constraint diffs, and index/relation metadata changes. The output is a `.surql` file with UP/DOWN sections that can be reviewed and committed.

**Shadow validation** runs the migration against a temporary database before touching production. The `migrate dev` command creates a disposable shadow namespace and database, applies the pending migration there, checks for errors, destroys the shadow, and only then applies to the target database. This catches SurrealQL syntax errors, constraint violations, and schema conflicts before they reach production.

**Journal resume** tracks each migration statement individually. If a migration has five statements and statement three fails, the journal records statements one and two as applied. Running `migrate resume` skips the completed statements and retries from the failure point. No manual SQL recovery, no guessing where it stopped.

```bash
npx dali-orm migrate up          # Apply pending
npx dali-orm migrate down        # Rollback last
npx dali-orm migrate reset       # Rollback all, then re-apply
npx dali-orm migrate resume      # Resume interrupted migration
```

## Architecture

DaliORM wraps the official `surrealdb` npm package. The relationship is thin delegation — the ORM layer handles type-safety and validation; the SDK handles transport, authentication, and connection lifecycle.

```
connect() → orm-connection.ts
    ↓
BaseDriver (protected abstract db: Surreal)
    ├── NodeDriver      — new Surreal({ engines: createRemoteEngines() })
    └── EmbeddedDriver  — new Surreal({ engines: { ...createNodeEngines() } })
```

`BaseDriver` stores `protected abstract db: Surreal` and delegates every CRUD operation to direct `this.db.select()`, `this.db.create()`, `this.db.insert()`, and `this.db.query()` calls. The SDK class (`Surreal` from the `surrealdb` npm package) manages WebSocket connections, HTTP requests, authentication flows, and live query streaming. DaliORM adds input parsing at the boundary, output type derivation (structurally from table definitions, not manual type assertions), and migration tooling on top of this SDK foundation.

`NodeDriver` connects to remote SurrealDB instances via WebSocket. `EmbeddedDriver` runs SurrealDB in-process for development, testing, and ephemeral databases. Both share the same `BaseDriver` — the SDK abstracts the transport difference.

The design follows the Parse Don't Validate principle. All public API inputs — driver config, table definitions, query parameters — are parsed through Valibot schemas at the entry boundary. Once parsed into typed internal structures, no further validation is needed. Invalid states are structurally impossible in internal code paths:

```typescript
// Boundary: raw input parsed through Valibot schema
const parsed = parse(DriverConfigSchema, rawInput);
// parsed: typed DriverConfig — never needs validation again

// Internals: zero type guards, zero null checks
this.url = parsed.url;
this.namespace = parsed.namespace;
```

Fail Fast (Law 4) applies throughout. Invalid driver configuration throws on construction with a descriptive error. Malformed connection strings fail before connecting. Invalid query parameters fail at the builder level, not at the database. Silent data corruption is avoided by design.

## Quick Start

```bash
pnpm add @woss/dali-orm
```

Define a table, connect to SurrealDB, and run a query:

```typescript
import { DaliORM, createOrmSchema, defineTable } from '@woss/dali-orm';
import { string, datetime } from '@woss/dali-orm/sdk/schema/column/simple-builders';
import { select, insert } from '@woss/dali-orm/query';

// 1. Schema — one definition
const users = defineTable('user', {
  id: string('id'),
  name: string('name'),
  email: string('email').unique(),
  created_at: datetime('created_at').defaultNow(),
});

const schema = createOrmSchema({ tables: { users } });

// 2. Connect — thin wrapper over surrealdb SDK
const orm = await DaliORM.connect({
  nodeDriver: {
    url: 'ws://localhost:10101',
    namespace: 'test',
    database: 'test',
    auth: { username: 'root', password: 'root' },
  },
  schema,
});

// 3. Query — type-safe insert and select
const driver = orm.getDriver();

const [user] = await insert(driver, users)
  .one({ name: 'Alice', email: 'alice@example.com' })
  .execute();

const found = await select(driver, users)
  .where((w) => w.eq('email', 'alice@example.com'))
  .execute();
```

## Try It

The repository includes a working todo app at `examples/todo-app/` with users, todos, and relation tables. Clone, configure, and explore:

```bash
git clone https://github.com/woss/dali-orm
cd dali-orm/examples/todo-app
pnpm install
npx dali-orm migrate up
```

For a deeper look: the schema definitions in `examples/todo-app/src/schema.ts` show a complete multi-table setup with relation tables, and the migration files at `examples/todo-app/migrations/` show the generated SurrealQL output. The README covers installation, driver configuration, and deployment workflow.
