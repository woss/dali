# Schema Definition

Define tables and columns for type-safe access.

## Column Builders

Create columns with chainable builder API:

```typescript
import {
  string,
  int,
  float,
  bool,
  datetime,
  duration,
  decimal,
  array,
  object,
  uuid,
} from '@woss/dali-orm/sdk/schema/column/simple-builders';
import { record } from '@woss/dali-orm/sdk/schema/column/record';
import { geometry } from '@woss/dali-orm/sdk/schema/column/geometry';
import { tuple } from '@woss/dali-orm/sdk/schema/column/tuple';

string('name'); // TYPE string
int('count'); // TYPE int
float('price'); // TYPE float
bool('active'); // TYPE bool
datetime('created_at'); // TYPE datetime
duration('ttl'); // TYPE duration
decimal('total'); // TYPE decimal
array('tags'); // TYPE array
object('metadata'); // TYPE object
uuid('id'); // TYPE uuid
geometry('location'); // TYPE geometry
tuple('coords', 2); // TYPE tuple<2>
record('projects'); // TYPE record<projects>
```

## Chaining Methods

All column builders share these chainable methods:

| Method               | Description                          | DDL Output            |
| -------------------- | ------------------------------------ | --------------------- |
| `.optional()`        | Field can be null                    | `TYPE option<type>`   |
| `.default(value)`    | Default value                        | `DEFAULT value`       |
| `.defaultNow()`      | Default to current time              | `DEFAULT time::now()` |
| `.unique()`          | Unique constraint                    | `UNIQUE`              |
| `.flexible()`        | Allow arbitrary fields (object only) | `FLEXIBLE`            |
| `.readonly()`        | Read-only after create               | `READONLY`            |
| `.assert(expr)`      | Validation assertion                 | `ASSERT expr`         |
| `.permissions(expr)` | Field-level permissions              | `PERMISSIONS expr`    |

```typescript
// Full example
const emailCol = string('email')
  .optional()
  .default('unknown@example.com')
  .unique()
  .assert('is::email($value)');

// Record with optional
const projectCol = record('projects').optional();
```

## defineTable

Define a normal table:

```typescript
import { defineTable } from '@woss/dali-orm/sdk/table';

const usersTable = defineTable(
  'users',
  {
    id: uuid('id'),
    name: string('name'),
    email: string('email').optional(),
    created_at: datetime('created_at').defaultNow(),
    tags: array('tags').optional(),
  },
  {
    schema: 'full', // default — SCHEMAFULL
    permissions: { select: 'WHERE published = true' }, // Table-level permissions
  },
);
```

## defineRelationTable

Define a relation (edge) table:

```typescript
const followsTable = defineRelationTable(
  'follows',
  {
    created_at: datetime('created_at').defaultNow(),
  },
  {
    in: 'users', // FROM table
    out: 'users', // TO table
    schema: 'full',
  },
);
```

## OrmSchema — Container

Group multiple tables into a schema:

```typescript
import { createOrmSchema } from '@woss/dali-orm';

const schema = createOrmSchema({
  tables: {
    users: usersTable,
    posts: postsTable,
    comments: commentsTable,
  },
  access: [
    {
      name: 'user_access',
      type: 'record',
      roles: ['user'],
    },
  ],
  variables: {
    $current_user: 'SELECT * FROM users WHERE id = $auth.id',
  },
  functions: {
    hello: 'CREATE RETURN "world"',
  },
});
```

## OrmSchema API

| Method                  | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| `schema.getTable(name)` | Get table by name (returns TableDefinition \| undefined) |
| `schema.getTables()`    | Get all tables as array                                  |
| `schema.hasTable(name)` | Check if table exists                                    |
| `schema.tableCount`     | Number of tables                                         |
