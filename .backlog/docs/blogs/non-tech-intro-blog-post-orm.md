---
title: 'Shipping Data Without the Headaches'
featured: true
description: 'Stop wrestling with raw database queries and manual schema management. Learn how a type-safe, migration-first ORM for SurrealDB turns your data structure into reusable building blocks — with auto-generated migrations, compile-time validation, and minimal abstraction over SurrealQL.'
date: 2026-06-03
tags:
  - surrealdb
  - orm
  - database
  - migrations
  - developer tools
header_image: '[Future in the city](https://u.macula.link/HR7CSIPkTFOBV8xVNmVUxg-7?preset=sys_lg)'
---

# Shipping Data Without the Headaches

You've worked with databases. You know how it goes. You write queries, hope they're right, and discover the typo when the app breaks at 2 AM.

There's a better way.

## Why We Built This

Databases are genuinely powerful now. Modern databases handle documents, graphs, and relationships seamlessly. Live updates keep your UI in sync. Flexible schemas mean you're not fighting rigidity when your data evolves.

But here's the gap: your code doesn't understand your database. You keep the schema in your head. Your queries are raw instructions with no safety net. A typo in a field name doesn't error — it crashes. Refactoring means hunting through every file manually.

We built this tool to bridge that gap. Not by hiding the database behind abstraction, but by giving your code a shared blueprint that catches mistakes before they reach users.

## The Problem

Without a shared blueprint, data management becomes a source of friction that compounds over time:

- **Small changes take too long** — rename a field, and you're grepping through every file that touches it, hoping you didn't miss one
- **Bugs sneak into production** — a typo in a column name passes code review and gets caught by a customer instead
- **Refactoring feels risky** — changing data structure means wondering what might silently break
- **Knowledge lives in people's heads** — when the person who wrote the schema leaves, the understanding leaves with them

These aren't engineering trivia. They're lost shipping velocity, unplanned hotfix cycles, and team friction that compounds.

The root cause is always the same: your application doesn't share a common understanding of what your data looks like. Each part of the code makes its own assumptions.

### What This Looks Like in Practice

Here's the typical approach to querying a database:

```typescript
const email = 'user@example.com';
const result = await db.query(`SELECT * FROM user WHERE email = $email`, { email });
// ^ result: unknown[] — TypeScript has no idea what `user` contains
```

The problem? Your code doesn't know what `user` has in it. A typo in the field name crashes at runtime. Refactoring means hunting through every file manually.

## How This Compares to the Alternative

Most teams handle this in one of three ways:

1. **Manual discipline** — Everyone just knows the schema. Code reviews catch mismatches. This works until the team grows past three people or the codebase passes 10,000 lines.

2. **Runtime validation** — Check data shapes at runtime with validation libraries. This catches mismatches only when code actually runs, which means the testing burden is on you. Miss one test, and it hits production.

3. **Code generation** — Generate TypeScript types from the database schema. This is better, but it adds a build step, generated files to manage, and drift between generation runs.

This tool takes a different approach. Instead of generating code from the database, you define the data blueprint once, and every part of the codebase understands it automatically. No build step. No generated files. No drift.

## What This Tool Actually Does

DaliORM is a layer between your application and your database that gives your code a shared understanding of your data structure.

Think of it as a **blueprint** for your data. You define what a "user" looks like — name, email, role — in one place. Then every query in your code knows about that structure.

When your data needs to change, you edit the blueprint, and the tool generates a **migration** automatically — a set of safe, reversible instructions to update the database. Up and down. Apply and rollback.

Here's what the blueprint looks like:

```typescript
import { defineTable } from '@woss/dali-orm/sdk/table';
import { string, datetime } from '@woss/dali-orm/sdk/schema/column/simple-builders';

export const users = defineTable('user', {
  id: string('id'),
  name: string('name'),
  email: string('email').unique(),
  role: string('role'),
  bio: string('bio').optional(),
  created_at: datetime('created_at').defaultNow(),
});
// ^ TypeScript now knows: user has id, name, email, role, bio?, created_at
```

That's it. One definition. Now every database operation across your codebase validates against this shape. Referencing a field that doesn't exist gets caught before deployment. Not at runtime. Not by a customer.

Available column types: `string()`, `int()`, `float()`, `bool()`, `datetime()`, `duration()`, `decimal()`, `array()`, `object()`, `record()`, `uuid()`, `geometry()`, `tuple()`.

The `.unique()` on email is a small detail that saves a disproportionate amount of pain. Without it, your code has to manually check for duplicate emails before every insert. With it, the database enforces uniqueness automatically, and your blueprints handle the logic.

## A Closer Look at Migrations

Here's what makes the migration system genuinely useful: you don't write migration files by hand.

When you change the data blueprint — add a field, rename a column, create a new table — the tool compares the old blueprint against the new one and generates the migration automatically. It figures out exactly what needs to happen to get from point A to point B.

Every migration has two directions:

- **UP**: Apply the changes
- **DOWN**: Reverse them if something goes wrong

If a deployment breaks, rolling back is one command.

Before a migration touches your live database, the tool can validate it against a **shadow database** — a temporary copy that exists only for testing. The migration runs against shadow first. If it passes, it runs against your real database. If it fails, nothing breaks.

Migrations are tracked in a journal. If one fails halfway through, the journal knows which statements succeeded and can resume from where it stopped. No manual cleanup. No guessing.

### Migration Configuration

The tool is configured in a single file:

```typescript
import { defineConfig } from '@woss/dali-orm/migration/config';

export default defineConfig({
  url: 'ws://localhost:8000',
  namespace: 'myapp',
  database: 'mydb',
  auth: { type: 'root', username: 'root', password: 'root' },
  migrations: {
    dir: './migrations',
    table: '__migrations',
  },
  schema: {
    dir: './src',
    pattern: 'schema.ts',
  },
});
```

Apply migrations from the command line:

```bash
npx dali-orm migrate up
npx dali-orm migrate status
```

## Building Queries

Once your blueprint is defined, querying the database follows the same structure. Every operation validates against your schema — misspell a field name and it errors before deployment.

```typescript
import { select, insert } from '@woss/dali-orm/query';

// Insert a new user
await insert(driver, users)
  .one({ name: 'Jane', email: 'jane@example.com', role: 'author' })
  .execute();
// Promise<{ id: string, name: string, email: string, role: string, bio?: string, created_at: string }[]>

// Query users with filters
const results = await select(driver, users)
  .where((w) => w.eq('role', 'author'))
  .orderBy('name', 'ASC')
  .execute();
// ^ results: { id: string, name: string, email: string, role: string, bio?: string, created_at: string }[]
```

The query builder knows what fields exist on `user`. Type `w.eq(` in your editor and it suggests available columns. Invalid field names get caught by your editor — not by a customer.

## Why This Works

**Zero abstraction over SurrealQL.** The tool builds SurrealQL instructions directly, sends them through the official SurrealDB SDK, and returns results. No hidden ORM magic — just database operations, typed.

**Blueprint enforcement.** Your schema is the single source of truth. Every operation validates against it. You can't accidentally reference a field that doesn't exist.

**Automatic migrations.** Schema changes produce migration files automatically. No manual SQL. No guessing what changed between environments.

**Built on the official SurrealDB SDK.** DaliORM wraps the [`surrealdb`](https://www.npmjs.com/package/surrealdb) JavaScript SDK — the same library SurrealDB publishes for connecting to their database. We handle type-safety, schema validation, and migration generation; the SDK handles connections, authentication, and transport. This means WebSocket, HTTP, and embedded modes all work out of the box without us reimplementing the protocol.

**Confidence to move fast.** When you know the tool will catch mismatches, you ship changes faster. Rename a field without fear. Add a column without hunting through every query in the codebase.

## Try It

The repository includes a working todo app connected to the database. Clone the repo, start the database, and see it in action in minutes.

The README covers installation, setup, and the example step by step.

## Quick Start

```bash
pnpm add @woss/dali-orm
```

```typescript
import { DaliORM, createOrmSchema } from '@woss/dali-orm';
import { defineTable } from '@woss/dali-orm/sdk/table';
import { string } from '@woss/dali-orm/sdk/schema/column/simple-builders';

const users = defineTable('user', {
  id: string('id'),
  name: string('name'),
  email: string('email'),
});
// ^ users: TableDefinition — id is string, name is string, email is string

const schema = createOrmSchema({ tables: { users } });

const orm = await DaliORM.connect({
  nodeDriver: {
    url: 'ws://localhost:10101',
    namespace: 'test',
    database: 'test',
    auth: { username: 'root', password: 'root' },
  },
  schema,
});
// ^ orm: DaliORM with full type awareness of the users table
```

Define your blueprint, connect, and start querying.

## The Bottom Line

This tool doesn't add features you can't build without it. It removes friction you shouldn't have to tolerate. It turns database work from a source of risk into a source of confidence.

For teams: faster shipping, fewer bugs, less technical debt. For individuals: spending time on what matters instead of hunting down data mismatches.

Your data blueprint should be as reliable as the rest of your code. Now it can be.
