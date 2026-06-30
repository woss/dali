# DaliORM

> SUPER EARLY BETA -- do not use in production yet! API is subject to change without warning.

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
    - [Backwards Compatibility](#backwards-compatibility)
    - [SDK Integration](#sdk-integration)
  - [Database Functions](#database-functions)
    - [String \& Math](#string--math)
    - [Crypto](#crypto)
    - [Vector \& Geo](#vector--geo)
    - [Time \& Type](#time--type)
    - [Array \& Object](#array--object)
    - [HTTP, Rand, Sequence \& More](#http-rand-sequence--more)
    - [SQL Expression Helpers](#sql-expression-helpers)
  - [Driver Connection](#driver-connection)
    - [NodeDriver (Remote)](#nodedriver-remote)
    - [Embedded Modes](#embedded-modes)
    - [DaliORM Methods](#daliorm-methods)
  - [Configuration Files](#configuration-files)
    - [Supported Formats](#supported-formats)
    - [Example Config](#example-config)
    - [Usage](#usage)
    - [Authentication Types](#authentication-types)
    - [Shadow Database](#shadow-database)
  - [Migrations](#migrations)
    - [CLI Commands](#cli-commands)
    - [Shadow DB Pre-validation](#shadow-db-pre-validation)
    - [Programmatic API](#programmatic-api)
  - [Demo Example](#demo-example)
  - [TypeScript Types](#typescript-types)
  - [Packages](#packages)
  - [License](#license)

## Features

- **TypeScript-First** - Full type inference for schema, queries, and results
- **Schema Builder** - Define tables, columns, indexes, analyzers, and relations programmatically
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
import { DaliORM, createOrmSchema, defineTable } from '@woss/dali-orm';
import { string, int, bool, datetime } from '@woss/dali-orm/sdk/schema/column/simple-builders';
import { select, insert } from '@woss/dali-orm/query';

// Define schema
const usersTable = defineTable('user', {
  name: string('name'),
  email: string('email'),
  age: int('age').optional(),
  active: bool('active').default(true),
  created_at: datetime('created_at').defaultNow(),
});

// Wrap in OrmSchema
const schema = createOrmSchema({ tables: { users: usersTable } });

// Connect to SurrealDB
const orm = await DaliORM.connect({
  nodeDriver: { driver: 'node', url: 'ws://localhost:10101', namespace: 'test', database: 'test' },
  schema,
});

const driver = orm.getDriver();

// Insert a user
const [newUser] = await insert(driver, usersTable)
  .one({ name: 'John', email: 'john@example.com', age: 30 })
  .execute();

// Query users
const users = await select(driver, usersTable)
  .where((w) => w.eq('active', true))
  .orderBy('name', 'ASC')
  .limit(10)
  .execute();

await orm.disconnect();
```

## Schema Definitions

### Tables

```typescript
import { defineTable, defineRelationTable, createOrmSchema, index } from '@woss/dali-orm';
import {
  string,
  int,
  bool,
  datetime,
  duration,
  decimal,
  array,
  object,
} from '@woss/dali-orm/sdk/schema/column/simple-builders';
import { record } from '@woss/dali-orm/sdk/schema/column/record';

// Basic table
const userTable = defineTable('user', {
  name: string('name'),
  email: string('email'),
  age: int('age'),
});

// Table with options
const articleTable = defineTable(
  'article',
  {
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
const wroteTable = defineRelationTable(
  'wrote',
  {
    created_at: datetime('created_at').defaultNow(),
  },
  {
    in: 'user',
    out: 'article',
    enforced: true,
  },
);

// Wrap in OrmSchema for DaliORM.connect
const schema = createOrmSchema({
  tables: { users: userTable, articles: articleTable },
});
```

### Analyzers

Define custom text analyzers for `FULLTEXT` indexes:

```typescript
import { createOrmSchema } from '@woss/dali-orm';

// Define analyzer with tokenizers and optional filters
const myAnalyzer = {
  name: 'my_analyzer',
  tokenizers: ['class', 'punctuation'],
  filters: ['lowercase', 'snowball'],
};

// Minimum viable analyzer (only tokenizers)
const simpleAnalyzer = {
  name: 'simple_analyzer',
  tokenizers: 'class',
};

// Pass analyzers through OrmSchema for migration generation
const schema = createOrmSchema({
  tables: { articles: articleTable },
  analyzers: [myAnalyzer, simpleAnalyzer],
});

// Reference analyzer in fulltext index
const articleTable = defineTable(
  'article',
  { title: string('title'), content: string('content') },
  {
    indexes: [index('title_search').on('title').fulltext('my_analyzer')],
  },
);
```

Analyzers are emitted **before** tables in UP migrations (indexes depend on their analyzer).

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
import { select, eq, and, or, not, like, contains, isNull } from '@woss/dali-orm/query';

const driver = orm.getDriver();

select(driver, userTable)
  .where(eq('name', 'John')) // WHERE clause
  .where((w) => w.eq('age', 18)) // Typed WHERE builder
  .orderBy('name', 'ASC') // ORDER BY
  .limit(10) // LIMIT
  .start(20) // OFFSET/START
  .groupBy('status') // GROUP BY
  .fetch('posts') // FETCH related records
  .parallel() // PARALLEL
  .timeout(5) // TIMEOUT (seconds)
  .execute();
```

### INSERT

```typescript
import { insert } from '@woss/dali-orm/query';

// Single record
const [result] = await insert(driver, userTable)
  .one({ name: 'John', email: 'john@example.com' })
  .execute();
```

### UPDATE

```typescript
import { update } from '@woss/dali-orm/query';

const [result] = await update(driver, userTable)
  .id('user:123')
  .data({ name: 'Jane', email: 'jane@example.com' })
  .execute();
```

### DELETE

```typescript
import { delete_ } from '@woss/dali-orm/query';

// Delete by ID
const [result] = await delete_(driver, userTable).id('user:123').execute();

// Delete with condition
const [result] = await delete_(driver, userTable).where(eq('active', false)).execute();
```

### RELATE

```typescript
import { relate } from '@woss/dali-orm/query';
import { defineRelationTable } from '@woss/dali-orm';

const wroteSchema = defineRelationTable('wrote', {}, { in: 'user', out: 'article' });

const [result] = await relate(driver, wroteSchema)
  .from('user:123')
  .to('article:456')
  .set({ created_at: new Date().toISOString() })
  .execute();
```

## Conditions

### Comparison Operators

```typescript
import { eq, ne, gt, gte, lt, lte } from '@woss/dali-orm/query';

eq('age', 18); // age = 18
ne('status', 'active'); // status != 'active'
gt('price', 100); // price > 100
gte('age', 18); // age >= 18
lt('price', 100); // price < 100
lte('age', 18); // age <= 18
```

### String Operators

```typescript
import { like, contains, startsWith, endsWith } from '@woss/dali-orm/query';

like('name', 'J%'); // name LIKE 'J%'
contains('name', 'ohn'); // string::contains(name, 'ohn')
startsWith('name', 'Jo'); // string::startsWith(name, 'Jo')
endsWith('name', 'hn'); // string::endsWith(name, 'hn')
```

### Null & Array Checks

```typescript
import { isNull, isNotNull, inside, notInside, all, any } from '@woss/dali-orm/query';

isNull('email'); // email = NONE
isNotNull('email'); // email != NONE
inside('status', ['active', 'pending']); // status IN [...]
notInside('status', ['banned']); // status NOT IN [...]
all('tags', ['featured', 'new']); // CONTAINSALL
any('tags', ['sale', 'new']); // CONTAINSANY
```

### Combinators

```typescript
import { and, or, not } from '@woss/dali-orm/query';

and(eq('age', 18), eq('active', true));
or(eq('status', 'active'), eq('status', 'pending'));
not(eq('active', false));
```

## Typed Conditions

For full TypeScript type safety, use conditions with typed columns from table definitions:

```typescript
import { defineTable, string, int, array } from '@woss/dali-orm';
import { select, eq, gt, and, or, like, contains, inside } from '@woss/dali-orm/query';

// Define schema with typed columns
const users = defineTable('user', {
  id: string('id'),
  name: string('name'),
  email: string('email'),
  age: int('age'),
  status: string('status'),
  tags: array('tags'),
});

// Type-safe conditions with typed columns
select(driver, users).where((w) => w.eq(users.name, 'John')); // name = 'John'
select(driver, users).where((w) => w.gt(users.age, 18)); // age > 18
select(driver, users).where((w) => w.and(w.eq(users.status, 'active'), w.gt(users.age, 18)));
select(driver, users).where((w) => w.inside(users.status, ['active', 'pending']));
select(driver, users).where((w) => w.contains(users.tags, 'featured'));

// String conditions
select(driver, users).where((w) => w.like(users.name, 'J%'));
```

### Backwards Compatibility

Conditions also accept string column names for backwards compatibility:

```typescript
select(driver, users).where(eq('name', 'John')); // Still works
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
  stringConcat,
  stringLowercase,
  stringIsEmail,
  stringDistance,
  stringHtmlEncode,
  mathRound,
  mathMax,
  mathSqrt,
  cryptoSha256,
  cryptoBlake3,
  cryptoArgon2Generate,
  cryptoBcryptCompare,
  cryptoUuidV4,
  vectorDistance,
  vectorSimilarity,
  geoDistance,
  geoHashEncode,
  timeNow,
  timeFormat,
  typeInt,
  typeThing,
  typeIsArray,
  arrayPush,
  arrayFilter,
  objectKeys,
  objectEntries,
  httpGet,
  httpDelete,
  randInt,
  sequenceNext,
  sleep,
  count,
  $,
  as_,
  col,
  expr,
} from '@woss/dali-orm/sdk/functions';
```

### String & Math

```typescript
stringConcat('a', 'b'); // string::concat('a', 'b')
stringLowercase('HELLO'); // string::lowercase('HELLO')
stringIsEmail('a@b.com'); // string::is_email('a@b.com')
stringHtmlEncode('<br>'); // string::html::encode('<br>')
stringDistance('a', 'b'); // string::distance('a', 'b')

mathRound(4.7); // math::round(4.7)
mathMax(1, 2, 3); // math::max([1, 2, 3])
mathSqrt(9); // math::sqrt(9)
```

### Crypto

```typescript
cryptoSha256('data'); // crypto::sha256('data')
cryptoBlake3('data'); // crypto::blake3('data')
cryptoArgon2Generate('pw'); // crypto::argon2::generate('pw')
cryptoBcryptCompare('pw', 'h'); // crypto::bcrypt::compare('pw', 'h')
cryptoUuidV4(); // crypto::uuid::v4()
```

### Vector & Geo

```typescript
vectorDistance(v1, v2); // vector::distance(v1, v2)
vectorSimilarity(v1, v2); // vector::similarity::cosine(v1, v2)

geoDistance(p1, p2); // geo::distance(p1, p2)
geoHashEncode(lng, lat); // geo::hash::encode(lng, lat)
```

### Time & Type

```typescript
timeNow(); // time::now()
timeFormat(date, '%Y-%m-%d'); // time::format(date, '%Y-%m-%d')
typeInt('42'); // type::int('42')
typeThing('user', 'abc'); // type::thing('user', 'abc')
typeIsArray(val); // type::is_array(val)
```

### Array & Object

```typescript
arrayPush(['a'], 'b'); // array::push(['a'], 'b')
arrayFilter(arr, pred); // array::filter(arr, pred)
objectKeys({ a: 1 }); // object::keys({a: 1})
objectEntries({ a: 1 }); // object::entries({a: 1})
```

### HTTP, Rand, Sequence & More

```typescript
httpGet('https://api.example.com'); // http::get(...)
randInt(1, 100); // rand::int(1, 100)
sequenceNext('my_seq'); // sequence::next(my_seq)
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
  nodeDriver: { driver: 'node', url: 'ws://localhost:10101', namespace: 'test', database: 'test' },
  schema,
});

// With authentication
const orm = await DaliORM.connect({
  nodeDriver: {
    driver: 'node',
    url: 'ws://localhost:10101',
    auth: { username: 'root', password: 'root' },
  },
  schema,
});
```

### Embedded Modes

```typescript
import { DaliORM } from '@woss/dali-orm';

// Memory mode
const orm = await DaliORM.connect({
  embeddedDriver: { driver: 'embedded', mode: 'memory' },
  schema,
});

// SurrealKV mode (persistent key-value storage)
const orm = await DaliORM.connect({
  embeddedDriver: { driver: 'embedded', mode: 'surrealkv', path: './db' },
  schema,
});
```

### DaliORM Methods

```typescript
// Execute raw SQL with parameters
const result = await orm.query('SELECT * FROM user WHERE age > $age', { age: 18 });

// Query builder — execute directly
const driver = orm.getDriver();
const users = await select(driver, userTable).where(eq('active', true)).execute();

// Get driver for query builders
const driver = orm.getDriver();

// Check connection
const connected = orm.isConnected();

// Switch namespace/database
await orm.use('new_namespace', 'new_database');

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
    "username": "root",
    "password": "root"
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
  nodeDriver: {
    url: 'ws://custom:8000', // Takes precedence
  },
});
```

### Authentication Types

| Type        | Required Fields                                 |
| ----------- | ----------------------------------------------- |
| `root`      | `username`, `password`                          |
| `namespace` | `username`, `password`, `namespace`             |
| `database`  | `username`, `password`, `namespace`, `database` |
| `record`    | `table`                                         |

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

// Connect
const orm = await DaliORM.connect({
  nodeDriver: { driver: 'node', url: 'ws://localhost:10101', namespace: 'test', database: 'test' },
});

// Generate SQL from schema
const generator = new SurrealQLGenerator();
const sql = generator.generateMigration([userTable]);

// With analyzers (emitted before tables)
const analyzers = [
  { name: 'my_analyzer', tokenizers: ['class', 'punctuation'], filters: ['lowercase'] },
];
const sqlWithAnalyzers = generator.generateMigration([userTable], 'up', analyzers);

// Generate full migration file with analyzers
const migrationFile = generator.generateMigrationFile([userTable], '001', 'init', analyzers);

// Get driver from ORM
const driver = orm.getDriver();

// Create runner with the driver
const runner = new MigrationRunner(driver);
await runner.init();
await runner.up();
const status = await runner.status();
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
import { defineTable, string, int } from '@woss/dali-orm';
import { InferSelectResult, InferInsertInput } from '@woss/dali-orm/query/types';

const userSchema = defineTable('user', {
  id: string('id'),
  name: string('name'),
  email: string('email'),
  age: int('age'),
});

// Type for SELECT results
type User = InferSelectResult<typeof userSchema>;
// { id?: string; id?: string; name?: string; email?: string; age?: number | null }

// Type for INSERT data
type NewUser = InferInsertInput<typeof userSchema>;
// { name: string; email: string; age?: number }
```

## RecordId Conventions

SurrealDB v2 uses `RecordId` objects as the canonical record identifier (`{ table: Table, id: Id }`). The SDK accepts `RecordId` natively — never extract bare strings for query params.

**RecordId inside, strings at I/O boundary.** Convert string → RecordId at routes, MCP handlers, or API adapters — not in service methods.

```typescript
import { RecordId } from 'surrealdb';

// ✓ Pass RecordId directly to SDK methods
const result = await db.select(new RecordId('user', id));

// ✗ Don't extract bare slugs for SDK calls
// const result = await db.select(`user:${id}`); // avoid
```

**Extract ID for human-readable output only:**

```typescript
const slug = String(record.id.id); // ✓ clean value
// record.id.toString()             // ✗ adds ⟨⟩ SurrealQL escaping
```

**TypeScript caveat:** `InferSelectResult<T>` types `id` as `string` — known type/runtime mismatch. Service code handles `RecordId` at runtime even if types say `string`.

**Never write string-parsing helpers** (`toQualifiedId`, `stripBrackets`, `rawId`, `normalizeId`). The SDK handles `RecordId` natively. See [id-conventions.md](../../.agents/skills/dali-orm/references/id-conventions.md) for full guidelines.

## Packages

| Package                        | Description                                                           |
| ------------------------------ | --------------------------------------------------------------------- |
| `@woss/dali-orm`               | Schema definitions, query builders, conditions (merged core + driver) |
| `@woss/dali-orm/migration/api` | CLI, migrations, schema generation, config management                 |

## License

GPL-3.0-only
