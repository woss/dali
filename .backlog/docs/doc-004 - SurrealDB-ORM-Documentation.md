---
id: doc-004
title: DaliORM Documentation
type: other
created_date: '2026-04-24 21:52'
updated_date: '2026-04-24 22:05'
---

# DaliORM Architecture & Capabilities

A comprehensive guide to the DaliORM's current implementation, capabilities, and comparison with the official SurrealDB JavaScript SDK.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Capabilities](#core-capabilities)
4. [Schema System](#schema-system)
5. [Query Operations](#query-operations)
6. [Driver Abstraction](#driver-abstraction)
7. [Authentication & Sessions](#authentication--sessions)
8. [Live Queries](#live-queries)
9. [Transactions](#transactions)
10. [Value Types](#value-types)
11. [SDK Feature Parity](#sdk-feature-parity)
12. [Migration System](#migration-system)
13. [Configuration](#configuration)
14. [REST API Generation](#rest-api-generation)
15. [API Reference](#api-reference)

---

## Overview

The DaliORM provides a type-safe query building interface for SurrealDB with:

- **Schema definition**: Define tables with typed columns
- **Query builders**: Immutable, chainable API for building queries
- **Driver abstraction**: Support for both WebSocket (NodeDriver) and embedded (EmbeddedDriver) connections
- **Validation**: Optional input/output validation using Valibot
- **Migration**: Schema migration generation from TypeScript definitions

**NPM Package**: `@surrealdb-orm/orm`

---

## Architecture

### Package Structure

```
packages/orm/src/
├── index.ts              # Main exports (@surrealdb-orm/orm)
├── schema.ts            # Schema creation functions
├── table.ts             # TableDefinition
├── types.ts             # TypeScript types
├── schema/              # Schema definition system
│   ├── index.ts         # Re-exports all schema types
│   ├── column/         # Column type builders
│   │   ├── string.ts
│   │   ├── int.ts
│   │   ├── bool.ts
│   │   ├── datetime.ts
│   │   ├── float.ts
│   │   ├── decimal.ts
│   │   ├── duration.ts
│   │   ├── array.ts
│   │   ├── object.ts
│   │   ├── geometry.ts
│   │   ├── record.ts
│   │   ├── tuple.ts
│   │   └── index.ts
│   └── proxy/          # Table aliasing proxies
├── driver/             # Driver implementations
│   ├── index.ts        # Re-exports all drivers
│   ├── orm.ts          # Main SurrealORM class
│   ├── types.ts        # Driver interfaces
│   ├── embedded-driver.ts
│   ├── node-driver.ts
│   ├── auth/           # Authentication
│   ├── config/         # Configuration loading
│   └── errors/         # Error types
└── migrate.ts          # Migration utilities
```

### Class Hierarchy

```
SurrealORM
├── TransactionORM     # Transaction-scoped operations
└── SurrealDriver (interface)
    ├── NodeDriver   # WebSocket connections
    └── EmbeddedDriver  # In-memory/file connections
```

---

## Core Capabilities

### Connection

```typescript
import { SurrealORM } from '@surrealdb-orm/orm';

// WebSocket connection
const orm = await SurrealORM.connect({
  driver: { url: 'ws://localhost:8000', namespace: 'test', database: 'test' },
});

// Embedded in-memory
const orm = await SurrealORM.connect({
  driver: { mode: 'memory', namespace: 'test', database: 'test' },
});

// With authentication
const orm = await SurrealORM.connect({
  driver: {
    url: 'ws://localhost:8000',
    namespace: 'test',
    database: 'test',
    auth: { user: 'root', pass: 'root' },
  },
});

// With codec options
const orm = await SurrealORM.connect({
  driver: { url: 'ws://localhost:8000', namespace: 'test', database: 'test' },
  codecOptions: { useNativeDates: true },
});

// With reconnect options
const orm = await SurrealORM.connect({
  driver: { url: 'ws://localhost:8000', namespace: 'test', database: 'test' },
  reconnect: { enabled: true, attempts: 5, retryDelay: 1000 },
});
```

### Basic Operations

```typescript
// Raw SQL query
const users = await orm.query<User[]>('SELECT * FROM user WHERE age > $age', { age: 18 });

// Select records
const users = await orm.select('user');

// Insert records
await orm.insert('user', { name: 'John', age: 30 });
await orm.insert('user', [
  { name: 'John', age: 30 },
  { name: 'Jane', age: 25 },
]);

// Update records
await orm.update('user:john', { name: 'John Updated' });

// Create records
await orm.create('user:john', { name: 'John', age: 30 });

// Delete records
await orm.delete('user:john');

// Upsert (create or replace)
await orm.upsert('user:john', { name: 'John', age: 30 });
```

---

## Schema System

### Defining Tables

```typescript
import { defineTable, string, int, bool, datetime, record } from '@surrealdb-orm/orm';

// Simple table
const users = defineTable('user', {
  id: string('id'),
  name: string('name'),
  email: string('email'),
  age: int('age'),
  active: bool('active').default(true),
  created_at: datetime('created_at'),
});

// Table with relations
const posts = defineTable('post', {
  id: string('id'),
  title: string('title'),
  author: record('user'), // References user table
});
```

### Column Types

| Type     | Builder              | Description           |
| -------- | -------------------- | --------------------- |
| String   | `string(name?)`      | String values         |
| Integer  | `int(name?)`         | Integer numbers       |
| Float    | `float(name?)`       | Floating point        |
| Boolean  | `bool(name?)`        | Boolean values        |
| DateTime | `datetime(name?)`    | Date/time values      |
| Decimal  | `decimal(name?)`     | Arbitrary precision   |
| Duration | `duration(name?)`    | Time span             |
| Array    | `array(name?)`       | Dynamic arrays        |
| Object   | `object(name?)`      | Dynamic objects       |
| Record   | `record(table)`      | Foreign key reference |
| Geometry | `geometry(type)`     | GeoJSON types         |
| Tuple    | `tuple(name?, size)` | Fixed-size arrays     |

### Column Modifiers

```typescript
const user = defineTable('user', {
  // Optional field
  name: string('name').optional(),

  // Default value
  active: bool('active').default(true),

  // Read-only (immutable after creation)
  created_at: datetime('created_at').readonly(),

  // Unique constraint
  email: string('email').unique(),

  // Assert/validation
  age: int('age').assert('$value >= 0 && $value <= 150'),

  // Permissions
  role: string('role').permissions({ read: 'WHERE role != "admin"' }),
});
```

---

## Query Operations

### Query Chaining

The ORM returns SDK chainables for query building:

```typescript
// Select with chaining (via SDK)
const users = await orm.select('user').where('age >= 18').limit(10);

// Live queries with configuration
const live = await orm.live('user').diff().fields('name', 'email');
```

### Raw Queries

```typescript
// With parameter binding
const users = await orm.query<User[]>('SELECT * FROM user WHERE age > $age AND active = $active', {
  age: 18,
  active: true,
});

// Multiple statements
const [users, posts] = await orm.query<[User[], Post[]]>(`
  SELECT * FROM user;
  SELECT * FROM post;
`);
```

---

## Driver Abstraction

### Supported Drivers

| Driver         | Protocol            | Use Case                      |
| -------------- | ------------------- | ----------------------------- |
| NodeDriver     | `ws://`, `wss://`   | Remote WebSocket connections  |
| EmbeddedDriver | `mem://`, `file://` | In-memory or file persistence |

---

## Authentication & Sessions

### Sign In / Sign Up

```typescript
// Record user authentication
await orm.signin({
  access: 'user',
  variables: { email: 'user@example.com', password: 'secret' },
});

await orm.signup({
  access: 'user',
  variables: { email: 'new@example.com', password: 'secret', name: 'New User' },
});

// Authenticate with token
await orm.authenticate('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
```

### Session Management

```typescript
// Create new session
const session = await orm.newSession();

// Fork session
const fork = await orm.forkSession();

// Close session
await orm.closeSession();

// List active sessions
const sessions = await orm.sessions();

// Session variables
await orm.set('userId', 'user:123');
await orm.unset('userId');
```

---

## Live Queries

### Basic Live Query

```typescript
// Subscribe to table changes
const subscription = await orm.live('user', (data) => {
  console.log(data.action, data.data);
});

// Kill subscription
await orm.kill(subscriptionId);
```

### Managed Live Queries

```typescript
// With diff (returns changes only)
await orm.live('user').diff();

// With field selection
await orm.live('user').fields('name', 'email');

// Unmanaged subscription
await orm.liveOf(existingLiveQueryId);
```

**Note**: Live queries are not supported over HTTP connections.

---

## Transactions

### Transaction Usage

```typescript
// Automatic transaction (recommended)
await orm.transaction(async (tx) => {
  await tx.create('user:alice', { name: 'Alice' });
  await tx.create('user:bob', { name: 'Bob' });
  // Auto-commit if no error
});

// Manual transaction
const tx = await orm.beginTransaction();
try {
  await tx.create('user:alice', { name: 'Alice' });
  await tx.commit();
} catch (e) {
  await tx.rollback();
}
```

---

## Value Types

### Exported Value Types

The ORM re-exports all SDK value types:

```typescript
import {
  RecordId,
  Table,
  DateTime,
  Duration,
  Decimal,
  Uuid,
  GeometryPoint,
  Geometry,
  // ...
} from '@surrealdb-orm/orm';

// RecordId
const id = new RecordId('users', 'john');

// Table
const table = new Table<User>('users');

// DateTime
const now = DateTime.now();

// Duration
const dur = Duration.parse('1h30m');

// Uuid
const v4 = Uuid.v4();
const v7 = Uuid.v7();
```

---

## SDK Feature Parity

### Complete Feature Matrix

| Feature                          | SDK | ORM | Status                       |
| -------------------------------- | --- | --- | ---------------------------- |
| **Connection**                   |     |     |                              |
| WebSocket (ws://)                | ✅  | ✅  | Full                         |
| HTTP (http://)                   | ✅  | ⚠️  | Limited (no live/tx)         |
| Embedded (mem://)                | ✅  | ✅  | Full                         |
| File persistence                 | ✅  | ✅  | Full                         |
| **Authentication**               |     |     |                              |
| `signin()`                       | ✅  | ✅  | Full                         |
| `signup()`                       | ✅  | ✅  | Full                         |
| `authenticate()`                 | ✅  | ✅  | Full                         |
| `auth()`                         | ✅  | ✅  | Full                         |
| `invalidate()`                   | ✅  | ✅  | Full                         |
| **Sessions**                     |     |     |                              |
| `newSession()`                   | ✅  | ✅  | Full                         |
| `forkSession()`                  | ✅  | ✅  | Full                         |
| `closeSession()`                 | ✅  | ✅  | Full                         |
| `sessions()`                     | ✅  | ✅  | Full                         |
| `set(key, value)`                | ✅  | ✅  | Full                         |
| `unset(key)`                     | ✅  | ✅  | Full                         |
| `use(ns, db)`                    | ✅  | ✅  | Full                         |
| **Live Queries**                 |     |     |                              |
| `live(table)`                    | ✅  | ✅  | Full                         |
| `live().diff()`                  | ✅  | ✅  | Full                         |
| `live().fields()`                | ✅  | ✅  | Full                         |
| `live().where()`                 | ✅  | ✅  | Full                         |
| `liveOf(id)`                     | ✅  | ✅  | Full                         |
| `kill(id)`                       | ✅  | ✅  | Full                         |
| **Transactions**                 |     |     |                              |
| `beginTransaction()`             | ✅  | ✅  | Full                         |
| `tx.commit()`                    | ✅  | ✅  | Full                         |
| `tx.rollback()`                  | ✅  | ✅  | Full                         |
| `transaction(fn)`                | ✅  | ✅  | Full                         |
| **Data Operations**              |     |     |                              |
| `select()`                       | ✅  | ✅  | Full                         |
| `insert()`                       | ✅  | ✅  | Full                         |
| `insert().bulk()`                | ✅  | ✅  | Full                         |
| `update()`                       | ✅  | ✅  | Full                         |
| `upsert()`                       | ✅  | ✅  | Full                         |
| `create()`                       | ✅  | ✅  | Full                         |
| `delete()`                       | ✅  | ✅  | Full                         |
| `relate()`                       | ✅  | ✅  | Full                         |
| **Query Options**                |     |     |                              |
| `.where()` with typed conditions | ✅  | ✅  | Full - accepts SurrealColumn |
| `.limit()`                       | ✅  | ⚠️  | Via SDK                      |
| `.start()`                       | ✅  | ⚠️  | Via SDK                      |
| `.orderBy()`                     | ✅  | ⚠️  | Via SDK                      |
| `.groupBy()`                     | ✅  | ❌  | Not typed                    |
| `.fetch()`                       | ✅  | ⚠️  | Via SDK                      |
| Return options                   | ✅  | ⚠️  | Via SDK                      |
| **Database Ops**                 |     |     |                              |
| `export()`                       | ✅  | ✅  | Full                         |
| `import()`                       | ✅  | ✅  | Full                         |
| `run()`                          | ✅  | ✅  | Full                         |
| `health()`                       | ✅  | ✅  | Full                         |
| `version()`                      | ✅  | ✅  | Full                         |
| **Configuration**                |     |     |                              |
| Auth at connect                  | ✅  | ✅  | Full                         |
| Codec options                    | ✅  | ✅  | Full                         |
| Reconnect options                | ✅  | ✅  | Full                         |
| **Extensibility**                |     |     |                              |
| Event subscription               | ✅  | ✅  | Full                         |
| Feature detection                | ✅  | ✅  | Full                         |
| `db.api<T>()`                    | ✅  | ❌  | Not available                |
| **REST API Generation**          |     |     |                              |
| `enableApi` config               | ❌  | ✅  | ORM enhancement              |
| `apiPrefix` config               | ❌  | ✅  | ORM enhancement              |
| `openApi` config                 | ❌  | ✅  | ORM enhancement              |
| `generateOpenApiSpec()`          | ❌  | ✅  | ORM enhancement              |
| `getApiRoutes()`                 | ❌  | ✅  | ORM enhancement              |
| `handleApiRequest()`             | ❌  | ✅  | ORM enhancement              |
| **Types**                        |     |     |                              |
| Value types (RecordId, etc)      | ✅  | ✅  | Re-exported                  |
| `InferTableModel`                | ✅  | ✅  | Custom                       |
| `InferCreateModel`               | ✅  | ✅  | Custom                       |

### Typed Conditions

The ORM now provides type-safe condition builders that work directly with the SDK:

```typescript
import { eq, gt, and, or } from '@surrealdb-orm/orm';
import { defineTable, string, int } from '@surrealdb-orm/orm';

const users = defineTable('users', {
  name: string('name'),
  age: int('age'),
});

// Type-safe conditions - TypeScript validates column types
orm
  .select('users')
  .where(eq(users.name, 'John')) // Works with SDK's .where()
  .where(gt(users.age, 18));

// Combine conditions
and(eq(users.name, 'John'), gt(users.age, 18));
or(eq(users.status, 'active'), eq(users.status, 'pending'));
```

Available conditions:

- `eq()`, `ne()` - equality
- `gt()`, `gte()`, `lt()`, `lte()` - comparisons
- `like()`, `contains()`, `startsWith()`, `endsWith()` - string matching
- `and()`, `or()`, `not()` - logical combinators

### What's NOT Implemented

These features are not currently available but could be added:

```typescript
// Lower priority items

// Custom API (user-defined functions)
db.api<MyApi>(); // Not available

// Type-safe query builder wrappers
db.select('users').groupBy('age'); // Via raw SDK only
db.select('users').fetch('field1', 'field2'); // Via raw SDK only
```

---

## Migration System

### Using Kit CLI

The migration system is available via the Kit CLI:

```bash
# Generate migration files
pnpm surrealdb-orm migrate generate my_migration

# Run migrations
pnpm surrealdb-orm migrate up

# Check migration status
pnpm surrealdb-orm migrate status
```

---

## Configuration

### Config File

```json
// surrealdb-orm.json
{
  "url": "ws://localhost:8000",
  "namespace": "my_ns",
  "database": "my_db",
  "auth": {
    "username": "root",
    "password": "root"
  }
}
```

### Schema Validation

```typescript
const orm = await SurrealORM.connect({
  driver: { url: 'ws://localhost:8000', namespace: 'test', database: 'test' },
  schemas: { user: usersTableDefinition },
  validateOutputs: true,
});
```

---

## REST API Generation

The ORM can generate REST API endpoints from your table definitions, providing OpenAPI specs and HTTP request handling.

### Configuration Options

```typescript
const orm = await SurrealORM.connect({
  driver: { url: 'ws://localhost:8000', namespace: 'test', database: 'test' },
  // Enable REST API generation
  enableApi: true,
  // Custom API prefix (default: '/api')
  apiPrefix: '/api',
  // OpenAPI configuration
  openApi: {
    title: 'My App API',
    version: '1.0.0',
    description: 'API for my application',
  },
});
```

### OpenAPI Configuration Options

| Option        | Type       | Description                |
| ------------- | ---------- | -------------------------- |
| `title`       | `string`   | API title for OpenAPI spec |
| `version`     | `string`   | API version                |
| `description` | `string`   | API description            |
| `servers`     | `Server[]` | Custom servers             |

### Generating OpenAPI Spec

```typescript
import { generateOpenApiSpec } from '@surrealdb-orm/orm';

// Generate full OpenAPI document
const spec = await generateOpenApiSpec(orm);
console.log(spec.paths);
console.log(spec.components.schemas);

// With custom options
const spec = await generateOpenApiSpec(orm, {
  title: 'Custom API',
  version: '2.0.0',
  servers: [{ url: 'https://api.example.com' }],
});
```

### Getting API Routes

```typescript
import { getApiRoutes } from '@surrealdb-orm/orm';

// Get all registered API routes
const routes = getApiRoutes(orm);
console.log(routes);
// [
//   { path: '/api/users', method: 'GET', operation: 'list' },
//   { path: '/api/users', method: 'POST', operation: 'create' },
//   { path: '/api/users/{id}', method: 'GET', operation: 'get' },
//   { path: '/api/users/{id}', method: 'PATCH', operation: 'update' },
//   { path: '/api/users/{id}', method: 'DELETE', operation: 'delete' },
// ]
```

### Handling API Requests

```typescript
import { handleApiRequest } from '@surrealdb-orm/orm';

// Handle incoming HTTP requests (e.g., from Express/Fastify)
app.all('/api/:table/:id?', async (req, res) => {
  const result = await handleApiRequest(orm, {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    headers: req.headers,
  });

  if (result.status === 404) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(result.data);
});
```

### Request Options

| Option    | Type     | Description                            |
| --------- | -------- | -------------------------------------- |
| `method`  | `string` | HTTP method (GET, POST, PATCH, DELETE) |
| `path`    | `string` | Request path                           |
| `query`   | `object` | Query parameters                       |
| `body`    | `object` | Request body                           |
| `headers` | `object` | Request headers                        |

### Response Format

```typescript
// Successful response
{
  status: 200,
  data: [...], // or single record
}

// Created response (POST)
{
  status: 201,
  data: { ... }
}

// Error response
{
  status: 400,
  error: 'Invalid request'
}
```

### Full Example

```typescript
import { SurrealORM, defineTable, string, int, handleApiRequest } from '@surrealdb-orm/orm';

const users = defineTable('user', {
  id: string('id'),
  name: string('name'),
  email: string('email'),
  age: int('age'),
});

const orm = await SurrealORM.connect({
  driver: { url: 'ws://localhost:8000', namespace: 'test', database: 'test' },
  enableApi: true,
  openApi: { title: 'User API', version: '1.0.0' },
});

// Express.js integration
import express from 'express';
const app = express();
app.use(express.json());

app.all('/api/:resource/:id?', async (req, res) => {
  const result = await handleApiRequest(orm, {
    method: req.method,
    path: req.params.resource + (req.params.id ? '/' + req.params.id : ''),
    query: req.query,
    body: req.body,
    headers: req.headers,
  });

  res.status(result.status).json(result.data || result.error);
});

app.listen(3000);
```

---

## API Reference

### SurrealORM Methods

| Method                  | Description            |
| ----------------------- | ---------------------- |
| `connect()`             | Create and connect     |
| `query()`               | Raw SQL query          |
| `select()`              | Select records         |
| `insert()`              | Insert records         |
| `update()`              | Update records         |
| `upsert()`              | Create or replace      |
| `delete()`              | Delete records         |
| `create()`              | Create record          |
| `relate()`              | Create edge            |
| `transaction()`         | Auto-transaction       |
| `beginTransaction()`    | Manual transaction     |
| `live()`                | Live query             |
| `liveOf()`              | Subscribe to live      |
| `kill()`                | Stop live query        |
| `disconnect()`          | Disconnect             |
| `signin()`              | Sign in                |
| `signup()`              | Sign up                |
| `authenticate()`        | Auth with token        |
| `auth()`                | Get auth user          |
| `invalidate()`          | Sign out               |
| `sessions()`            | List sessions          |
| `newSession()`          | New session            |
| `forkSession()`         | Fork session           |
| `closeSession()`        | Close session          |
| `set()`                 | Set session variable   |
| `unset()`               | Unset session variable |
| `export()`              | Export SQL             |
| `import()`              | Import SQL             |
| `run()`                 | Run function           |
| `health()`              | Health check           |
| `version()`             | DB version             |
| `subscribe()`           | Event subscription     |
| `isFeatureSupported()`  | Feature detection      |
| `generateOpenApiSpec()` | Generate OpenAPI spec  |
| `getApiRoutes()`        | Get API routes         |
| `handleApiRequest()`    | Handle HTTP request    |

---

## Related Documentation

- [SDK Architecture Report](../SDK_ARCHITECTURE_REPORT.md) - Full SDK reference
- [Table Definition Guide](./TABLE_DEFINITION_GUIDE.md) - Schema in depth
- [ORM Schema Implementation Plan](./doc-003%20-%20OrmSchema-Implementation-Plan.md) - Type-safe schema
