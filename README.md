# DaliORM

A TypeScript ORM for SurrealDB with schema definitions, fluent query builders, and migrations. Built with 100% TypeScript for full type safety.

## Table of Contents

- [DaliORM](#daliorm)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [Schema Definitions](#schema-definitions)
    - [Tables](#tables)
    - [Column Types](#column-types)
    - [Column Options](#column-options)
  - [Query Builders](#query-builders)
    - [SELECT](#select)
    - [INSERT](#insert)
    - [UPDATE](#update)
    - [DELETE](#delete)
    - [RELATE](#relate)
  - [Conditions](#conditions)
    - [Comparison Operators](#comparison-operators)
    - [String Operators](#string-operators)
    - [Null \& Array Checks](#null--array-checks)
    - [Combinators](#combinators)
    - [Typed Conditions](#typed-conditions)
  - [Database Functions](#database-functions)
  - [Driver Connection](#driver-connection)
    - [NodeDriver (Remote)](#nodedriver-remote)
    - [Embedded Modes](#embedded-modes)
    - [DaliORM Methods](#daliorm-methods)
  - [Configuration Files](#configuration-files)
  - [Migrations](#migrations)
    - [Shadow DB Pre-validation](#shadow-db-pre-validation)
  - [Demo Example](#demo-example)
  - [TypeScript Types](#typescript-types)
  - [Packages](#packages)
  - [License](#license)

## Features

- **TypeScript-First** - Full type inference for schema, queries, and results
- **Schema Builder** - Define tables, columns, indexes, and relations programmatically
- **Query Builders** - Fluent API for SELECT, INSERT, UPDATE, DELETE, and RELATE queries
- **Migrations** - Generate and run database migrations with shadow DB pre-validation
- **Multiple Drivers** - Support for remote (WebSocket) and embedded modes (memory, file, rocksdb)
- **Config Files** - JSON, JSONC, and TypeScript configuration files with validation
- **Database Functions** - Type-safe wrappers for all 28 SurrealDB function modules (array, math, string, crypto, geo, http, rand, vector, etc.)

## Installation

```bash
pnpm add @woss/dali-orm
```

## Quick Start

```typescript
import { DaliORM } from '@woss/dali-orm';
import { defineTable, string, int, bool, select, insert, eq } from '@woss/dali-orm';

// Define schema
const userSchema = defineTable('user', {
  id: string('id'),
  name: string('name'),
  email: string('email').unique(),
  age: int('age').optional(),
  active: bool('active').default(true),
});

// Connect to SurrealDB
const orm = await DaliORM.connect({
  driver: { url: 'ws://localhost:10101', namespace: 'test', database: 'test' },
});

// Insert a user
await orm.execute(
  insert('user').values({ name: 'John', email: 'john@example.com', age: 30 }).returnAfter(),
);

// Query users
const users = await orm.execute(
  select('user')
    .select('id', 'name', 'email')
    .where(eq('active', true))
    .orderBy('name', 'ASC')
    .limit(10),
);

await orm.disconnect();
```

## Schema Definitions

### Tables

```typescript
import {
  defineTable,
  string,
  int,
  bool,
  index,
  datetime,
  defineRelationTable,
} from '@woss/dali-orm';

// Basic table
const userSchema = defineTable('user', {
  id: string('id'),
  name: string('name'),
  email: string('email'),
  age: int('age'),
});

// Table with options
const articleSchema = defineTable(
  'article',
  {
    id: string('id'),
    created_at: datetime('created_at').defaultNow(),
    title: string('title'),
    content: string('content'),
    published_at: datetime('published_at').optional(),
    author: string('author'),
  },
  {
    schema: 'full', // 'full' or 'less'
    type: 'normal', // 'normal' or 'relation'
    permissions: {
      select: 'WHERE true',
      create: 'WHERE true',
      update: 'WHERE true',
      delete: 'WHERE true',
    },
    indexes: [
      index('email_idx').on('email').unique(),
      index('title_search').on('title').fulltext(),
      index('embedding_idx').on('embedding').hnsw(1536, { distance: 'cosine' }),
    ],
  },
);

// Relation table
const wroteSchema = defineRelationTable(
  'wrote',
  {
    id: string('id'),
    created_at: datetime('created_at').defaultNow(),
  },
  {
    in: 'user',
    out: 'article',
    enforced: true,
  },
);
```

### Column Types

| Function     | SurrealQL Type |
| ------------ | -------------- |
| `string()`   | `string`       |
| `int()`      | `int`          |
| `float()`    | `float`        |
| `bool()`     | `bool`         |
| `datetime()` | `datetime`     |
| `duration()` | `duration`     |
| `decimal()`  | `decimal`      |
| `array()`    | `array`        |
| `object()`   | `object`       |
| `record()`   | `record`       |
| `geometry()` | `geometry`     |

### Column Options

```typescript
string()
  .optional() // Allow NULL values
  .default('value') // Set default value
  .assert('condition') // Add validation assertion
  .readonly() // Mark as read-only
  .flexible() // Allow flexible schema
  .unique(); // Create unique index
```

## Query Builders

### SELECT

```typescript
import { select, eq, and, or, not, like, contains, inside, isNull } from '@woss/dali-orm';

select('user')
  .select('id', 'name', 'email') // Select specific columns
  .selectAs('name', 'full_name') // Select with alias
  .selectOnly() // SELECT ONLY
  .where(eq('age', 18)) // WHERE clause
  .whereRaw('name LIKE "John%"') // Raw WHERE
  .orderBy('name', 'ASC') // ORDER BY (ASC or DESC)
  .limit(10) // LIMIT
  .start(20) // OFFSET/START
  .groupBy('status') // GROUP BY
  .having(eq('count', 5)) // HAVING
  .fetch('posts') // FETCH related records
  .fetchAs('posts', 'user_posts') // FETCH with alias
  .graph('out', 'friends') // Graph traversal
  .graphWith('out', 3, 'friends') // Graph with depth
  .parallel() // PARALLEL execution
  .split() // SPLIT each
  .timeout(5000) // TIMEOUT (seconds)
  .toSQL();
```

### INSERT

```typescript
import { insert } from '@woss/dali-orm';

// Single record
insert('user')
  .values({ name: 'John', email: 'john@example.com' })
  .returnAfter() // RETURN AFTER
  .returnBefore() // RETURN BEFORE
  .ignore(); // IGNORE on conflict

// Multiple records
insert('user').values([
  { name: 'John', email: 'john@example.com' },
  { name: 'Jane', email: 'jane@example.com' },
]);
```

### UPDATE

```typescript
import { update, eq } from '@woss/dali-orm';

update('user', 'user:123')
  .set('name', 'Jane')
  .set({ email: 'jane@example.com', age: 25 })
  .where(eq('active', true)) // Filter which records to update
  .returnAfter()
  .returnBefore();
```

### DELETE

```typescript
import { remove, eq } from '@woss/dali-orm';

// Delete by ID
remove('user', 'user:123').returnBefore().returnAfter();

// Delete with condition
remove('user').where(eq('active', false)).returnBefore();
```

### RELATE

```typescript
import { relate, eq } from '@woss/dali-orm';

relate('wrote', 'user:123', 'article:456')
  .set('created_at', 'time::now()')
  .where(eq('active', true))
  .returnAfter()
  .returnBefore();
```

## Conditions

### Comparison Operators

```typescript
import { eq, ne, gt, gte, lt, lte } from '@woss/dali-orm';

eq('age', 18); // age = 18
ne('status', 'active'); // status != 'active'
gt('price', 100); // price > 100
gte('age', 18); // age >= 18
lt('price', 100); // price < 100
lte('age', 18); // age <= 18
```

### String Operators

```typescript
import { like, contains, startsWith, endsWith } from '@woss/dali-orm';

like('name', 'J%'); // name LIKE 'J%'
contains('name', 'ohn'); // string::contains(name, 'ohn')
startsWith('name', 'Jo'); // string::startsWith(name, 'Jo')
endsWith('name', 'hn'); // string::endsWith(name, 'hn')
```

### Null & Array Checks

```typescript
import { isNull, isNotNull, inside, notInside, all, any } from '@woss/dali-orm';

isNull('email'); // email = NONE
isNotNull('email'); // email != NONE
inside('status', ['active', 'pending']); // status IN [...]
notInside('status', ['banned']); // status NOT IN [...]
all('tags', ['featured', 'new']); // CONTAINSALL
any('tags', ['sale', 'new']); // CONTAINSANY
```

### Combinators

```typescript
import { and, or, not } from '@woss/dali-orm';

and(eq('age', 18), eq('active', true));
or(eq('status', 'active'), eq('status', 'pending'));
not(eq('active', false));
```

## Typed Conditions

For full TypeScript type safety, import conditions from `dali-orm` and use with `SurrealColumn`:

```typescript
import {
  defineTable,
  string,
  int,
  array,
  select,
  eq,
  gt,
  and,
  or,
  like,
  contains,
  inside,
} from '@woss/dali-orm';

// Define schema with typed columns
const users = defineTable('user', {
  id: string('id'),
  name: string('name'),
  email: string('email'),
  age: int('age'),
  status: string('status'),
  tags: array('tags'),
});

// Type-safe conditions with SurrealColumn
select('user').where(eq(users.name, 'John')); // name = 'John'
select('user').where(gt(users.age, 18)); // age > 18
select('user').where(and(eq(users.status, 'active'), gt(users.age, 18)));
select('user').where(inside(users.status, ['active', 'pending']));
select('user').where(contains(users.tags, 'featured'));

// String conditions
select('user').where(like(users.name, 'J%'));
```

### Backwards Compatibility

Conditions also accept string column names for backwards compatibility:

```typescript
select('user').where(eq('name', 'John')); // Still works
```

### SDK Integration

The ORM conditions are built on top of the SurrealDB SDK's internal condition functions, providing:

- Full TypeScript type inference
- Proper escaping of parameter values
- Consistent behavior with SDK methods

## Database Functions

Type-safe TypeScript wrappers for all SurrealDB built-in functions. Import from `@woss/dali-orm/sdk/functions`:

```typescript
import {
  count,
  math,
  string,
  vector,
  time,
  crypto,
  geo,
  meta,
  session,
  array,
  set,
  value,
  parse,
  type,
  sleep,
  record as rec,
  object,
  sequence,
  rand,
  search,
  bytes,
  duration,
  encoding,
  http,
  files,
  not,
  api,
  $,
  as_,
  col,
  expr,
} from '@woss/dali-orm/sdk/functions';
```

### String & Math

```typescript
string.concat('a', 'b'); // string::concat('a', 'b')
string.lowercase('HELLO'); // string::lowercase('HELLO')
string.isEmail('a@b.com'); // string::is_email('a@b.com')
string.html.encode('<br>'); // string::html::encode('<br>')
string.distance('a', 'b'); // string::distance('a', 'b')

math.round(4.7); // math::round(4.7)
math.max(1, 2, 3); // math::max([1, 2, 3])
math.sqrt(9); // math::sqrt(9)
```

### Crypto

```typescript
crypto.sha256('data'); // crypto::sha256('data')
crypto.blake3('data'); // crypto::blake3('data')
crypto.argon2.generate('pw'); // crypto::argon2::generate('pw')
crypto.bcrypt.compare('pw', 'h'); // crypto::bcrypt::compare('pw', 'h')
crypto.uuid.v4(); // crypto::uuid::v4()
```

### Vector & Geo

```typescript
vector.distance(v1, v2); // vector::distance(v1, v2)
vector.similarity.cosine(v1, v2); // vector::similarity::cosine(v1, v2)

geo.distance(p1, p2); // geo::distance(p1, p2)
geo.hash.encode(lng, lat); // geo::hash::encode(lng, lat)
```

### Time & Type

```typescript
time.now(); // time::now()
time.format(date, '%Y-%m-%d'); // time::format(date, '%Y-%m-%d')
type.int('42'); // type::int('42')
type.thing('user', 'abc'); // type::thing('user', 'abc')
type.isArray(val); // type::is_array(val)
```

### Array & Object

```typescript
array.push(['a'], 'b'); // array::push(['a'], 'b')
array.filter(arr, pred); // array::filter(arr, pred)
object.keys({ a: 1 }); // object::keys({a: 1})
object.entries({ a: 1 }); // object::entries({a: 1})
```

### HTTP, Rand, Sequence & More

```typescript
http.get('https://api.example.com'); // http::get(...)
rand.int(1, 100); // rand::int(1, 100)
sequence.next('my_seq'); // sequence::next(my_seq)
sleep('1s'); // sleep(1s)
count('*'); // count(*)
```

### SQL Expression Helpers

```typescript
$('age'); // Column reference: age
as_(count(), 'total'); // Alias: count() AS total
col('name'); // Column reference
expr`${$('age')} + 1`; // Raw expression: age + 1
```

Functions compose naturally in query builders:

```typescript
const result = await select(driver, users)
  .fields(as_(mathRound($('score')), 'rounded'))
  .where((w) => w.eq('name', 'Alice'))
  .execute();
```

## Driver Connection

### NodeDriver (Remote)

```typescript
import { DaliORM } from '@woss/dali-orm';

const orm = await DaliORM.connect({
  driver: {
    url: 'ws://localhost:10101',
    namespace: 'test',
    database: 'test',
    auth: { user: 'root', pass: 'password' },
  },
});
```

### Embedded Modes

```typescript
import { DaliORM, EmbeddedDriver } from '@woss/dali-orm';

// Memory mode
const orm = await DaliORM.connect({
  driver: new EmbeddedDriver({ mode: 'memory', namespace: 'test', database: 'test' }),
});

// SurrealKV mode (persistent key-value storage)
const orm = await DaliORM.connect({
  driver: new EmbeddedDriver({
    mode: 'surrealkv',
    path: './db',
    namespace: 'test',
    database: 'test',
  }),
});

// RocksDB mode (alias for surrealkv)
const orm = await DaliORM.connect({
  driver: new EmbeddedDriver({
    mode: 'rocksdb',
    path: './db',
    namespace: 'test',
    database: 'test',
  }),
});
```

### DaliORM Methods

```typescript
// Execute raw SQL with parameters
const result = await orm.query('SELECT * FROM user WHERE age > $age', { age: 18 });

// Execute query builder
const result = await orm.execute(select('user').where(eq('active', true)));

// Transactions
await orm.transaction(async (tx) => {
  await tx.query('CREATE user:john SET name = "John"');
  await tx.query('CREATE post:1 SET title = "Hello"');
  return { success: true };
});

// Live queries
const subscriptionId = await orm.live('user', (data) => {
  console.log(data.action, data.result);
});

// Kill a live query subscription
await orm.kill(subscriptionId);

// Switch namespace/database
await orm.use('new_namespace', 'new_database');

// Get raw SurrealDB client for advanced operations
const db = orm.client;
await db.query('SELECT * FROM user');

// Close connection
await orm.disconnect();
```

## Configuration Files

The `@woss/dali-orm` package supports configuration files for connecting to databases.

### Supported Formats

- `.dali-orm.json` - JSON format
- `.dali-orm.jsonc` - JSON with comments
- `.dali-orm.ts` - TypeScript format

### Example Config

Create `.dali-orm.json` in your project root:

```json
{
  "url": "ws://localhost:8000",
  "namespace": "test",
  "database": "test",
  "auth": {
    "type": "root",
    "user": "root",
    "pass": "root"
  }
}
```

### Usage

```typescript
import { DaliORM } from '@woss/dali-orm';

// Load from config file
const orm = await DaliORM.connect({
  config: './dali-orm.json',
});

// Auto-discover config
const orm = await DaliORM.connect({
  config: true,
});

// Explicit options override config
const orm = await DaliORM.connect({
  config: './dali-orm.json',
  driver: {
    url: 'ws://custom:8000', // Takes precedence
  },
});
```

### Authentication Types

| Type        | Required Fields                         |
| ----------- | --------------------------------------- |
| `root`      | `user`, `pass`                          |
| `namespace` | `user`, `pass`, `namespace`             |
| `database`  | `user`, `pass`, `namespace`, `database` |
| `record`    | `table`                                 |

### Shadow Database

Optionally configure a shadow database for pre-validation:

```json
{
  "shadow": {
    "namespace": "myapp_shadow",
    "database": "shadow_db"
  }
}
```

Guard: shadow ns/db must differ from target ns/db.

## Migrations

### CLI Commands

```bash
# Dev workflow — generate migration + validate on shadow + apply
npx dali-orm migrate dev add_users_table

# Deploy to production — validate pending on shadow + apply (REQUIRES shadow config)
npx dali-orm migrate deploy

# Apply pending migrations to database
npx dali-orm migrate up

# Rollback last migration
npx dali-orm migrate down --steps 1

# Reset all migrations
npx dali-orm migrate reset

# Check migration status
npx dali-orm migrate status

# Generate migration from schema
npx dali-orm generate add_users_table

# Pull schema from database
npx dali-orm pull
```

- `migrate dev <name>` — Generate migration file, validate on shadow DB, then apply to target
- `migrate deploy` — Validate all pending migrations on shadow DB, then apply to target (requires `shadow` config)
- `push` is removed — use `migrate dev` or `migrate deploy` instead

### Shadow DB Pre-validation

DaliORM supports shadow database validation for safe migration deployment. Before applying changes to production, migrations are validated on an isolated shadow database. If validation fails, neither the shadow nor the target database is affected.

**Configuration:**

Add `shadow` to your `dali-orm.config.ts`:

```typescript
export default defineConfig({
  url: 'ws://localhost:10101',
  namespace: 'myapp',
  database: 'mydb',
  // ...
  shadow: {
    namespace: 'myapp_shadow', // Must differ from target namespace
    database: 'shadow_db', // Destroyed after each validation run
  },
});
```

**Guard:** Shadow ns/db cannot match target ns/db — throws error immediately.

### Programmatic API

```typescript
import { MigrationRunner, SurrealQLGenerator } from '@woss/dali-orm/migration/api';
import { DaliORM } from '@woss/dali-orm';

// Generate SQL from schema
const generator = new SurrealQLGenerator();
const sql = generator.generateMigration([userSchema]);

// First connect to database
const orm = await DaliORM.connect({
  driver: { url: 'ws://localhost:10101', namespace: 'test', database: 'test' },
});

// Create runner with the driver
const runner = new MigrationRunner(orm.driver);

// Initialize migration tracking
await runner.init();

// Run pending migrations
await runner.up();

// Check status
const status = await runner.status([]);

// Revert last migration (1 step)
await runner.down(1);
```

## Demo Example

The `examples/demo` package provides a complete working demo of the ORM:

```bash
cd examples/demo

# Run with interactive prompts
pnpm dev

# Run with auto-accept defaults (no prompts)
pnpm dev --yes

# Show help
pnpm dev --help

# Generate migration from schema
pnpm generate

# Apply migrations
pnpm dali-orm migrate up
```

The demo includes:

- Schema definitions with tables and relations
- Interactive CLI for data entry
- Migration generation and execution
- Complete CRUD operations with relations

## TypeScript Types

```typescript
import { defineTable, string, int, InferSelectModel, InferInsertModel } from '@woss/dali-orm';

const userSchema = defineTable('user', {
  id: string('id'),
  name: string('name'),
  email: string('email'),
  age: int('age'),
});

// Type for SELECT results
type User = InferSelectModel<typeof userSchema>;
// { id?: string; name?: string; email?: string; age?: number | null }

// Type for INSERT data
type NewUser = InferInsertModel<typeof userSchema>;
// { name: string; email: string; age?: number }
```

## Packages

| Package                        | Description                                                           |
| ------------------------------ | --------------------------------------------------------------------- |
| `@woss/dali-orm`               | Schema definitions, query builders, conditions (merged core + driver) |
| `@woss/dali-orm/migration/api` | CLI, migrations, schema generation, config management                 |

## License

GPL-3.0-only
