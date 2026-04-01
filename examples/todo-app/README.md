# DaliORM Todo App - Migration Example

A minimal example demonstrating DaliORM's migration system with schema definitions.

## Features

- **Schema-first design** - Table definitions in `schema/index.ts`
- **Migration generation** - `dali-orm generate` creates SurrealQL migrations
- **Type-safe schemas** - TableDefinition objects consumed by migration system
- **Multi-table setup** - Users, Todos, Articles with relations

## Prerequisites

- Node.js 18+
- pnpm 8+
- SurrealDB instance running on `ws://localhost:10101`

## Setup

1. **Start SurrealDB:**

```bash
# Using Docker Compose (from project root)
docker compose up -d

# Or using Docker directly
docker run --rm -p 10101:8000 surrealdb/surrealdb:latest start --user admin --pass admin --allow-auth
```

2. **Install dependencies:**

```bash
cd examples/todo-app
pnpm install
```

3. **Generate and run migrations:**

```bash
pnpm generate        # Generate migration from schema
pnpm migrate:up      # Apply migrations to database
```

## Schema Structure

```
examples/todo-app/
├── schema/
│   └── index.ts           # Table definitions (TableDefinition objects)
├── migrations/            # Auto-generated SurrealQL migrations
├── meta/                  # Migration state tracking
├── DaliORM.config.ts
└── package.json
```

## Schema Tables

| Table           | Type     | Description                         |
| --------------- | -------- | ----------------------------------- |
| `user`          | normal   | User accounts with email auth       |
| `todo`          | normal   | Todo items with owner               |
| `todo_share`    | relation | Sharing relation (user → todo)      |
| `article`       | normal   | Articles with owner                 |
| `wrote`         | relation | Author relation (user → article)    |
| `published`     | relation | Publisher relation (user → article) |
| `article_share` | relation | Sharing relation (user → article)   |

## Commands

```bash
pnpm generate            # Generate new migration from schema changes
pnpm migrate:status     # Show migration status
pnpm migrate:up         # Apply pending migrations
pnpm orm                # Access dali-orm CLI directly
```

## Configuration

```typescript
// DaliORM.config.ts
const config = {
  url: 'ws://localhost:10101',
  namespace: 'todo',
  database: 'todo',
  auth: { type: 'root', username: 'admin', password: 'admin' },
  migrations: { dir: './migrations', table: '__migrations' },
  schema: { dir: './schema', pattern: 'index.ts' },
};
```

## License

GPL-3.0-only
