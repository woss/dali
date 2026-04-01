# Query Builders

Type-safe fluent query builders. All accept a `SurrealDriver` and `TableDefinition`.

Import pattern:

```typescript
import { select, insert, update, delete_, upsert, create, relate } from '@woss/dali-orm/query';
import type { InferSelectResult, InferInsertInput, InferUpdateInput } from '@woss/dali-orm/query';
```

## SelectBuilder

```typescript
import { select } from '@woss/dali-orm/query';

const driver = orm.getDriver();

// Basic select
const results = await select(driver, usersTable).execute();

// With conditions
const results = await select(driver, usersTable)
  .where((w) => w.eq('verified', true))
  .limit(10)
  .execute();

// Multiple conditions
const results = await select(driver, usersTable)
  .where((w) => w.gt('age', 18).eq('active', true))
  .orderBy('name', 'ASC')
  .limit(20)
  .start(5) // OFFSET
  .execute();

// Field selection
const results = await select(driver, usersTable)
  .fields('name', 'email')
  .where((w) => w.eq('id', 'user:abc'))
  .execute();

// Count
const [result] = await select(driver, usersTable).count('*', 'total').execute();

// Subquery condition
const results = await select(driver, usersTable)
  .where((w) => w.in('id', select(driver, postsTable).fields('author')))
  .execute();

// With graph traversal
const results = await select(driver, usersTable)
  .where((w) => w.eq('id', 'user:abc'))
  .graph()
  .out('follows')
  .depth(1)
  .execute();
```

## SelectBuilder Chain

| Method                 | Description                |
| ---------------------- | -------------------------- |
| `.where(fn)`           | Add WHERE condition        |
| `.orderBy(field, dir)` | ORDER BY field ASC/DESC    |
| `.limit(n)`            | LIMIT                      |
| `.start(n)`            | START (offset)             |
| `.fields(...names)`    | Select specific fields     |
| `.count(field, alias)` | Add COUNT field            |
| `.graph()`             | Enter graph traversal mode |
| `.execute()`           | Run query, return results  |

## InsertBuilder

```typescript
import { insert } from '@woss/dali-orm/query';

// Insert single record
const [user] = await insert(driver, usersTable)
  .one({ name: 'Alice', email: 'a@b.com', verified: false })
  .execute();

// Insert multiple records
const users = await insert(driver, usersTable)
  .many([{ name: 'Alice' }, { name: 'Bob' }])
  .execute();

// With duplicate handling
const [user] = await insert(driver, usersTable)
  .one(data)
  .ignoreDuplicates() // Skip if conflict
  .execute();
```

## InsertBuilder Chain

| Method                | Description                |
| --------------------- | -------------------------- |
| `.one(data)`          | Insert single record       |
| `.many(data[])`       | Insert multiple records    |
| `.ignoreDuplicates()` | Skip on duplicate key      |
| `.overwrite()`        | Replace on duplicate key   |
| `.execute()`          | Run insert, return records |

## UpdateBuilder

```typescript
import { update } from '@woss/dali-orm/query';

const driver = orm.getDriver();

// Update by ID — destructure id from data
const { id, ...rest } = data;
await update(driver, usersTable).id(id).data(rest).execute();

// Update with SET (partial update)
// .data() uses MERGE semantics

// Simple update
await update(driver, usersTable).id('user:abc').data({ verified: true }).execute();
```

## UpdateBuilder Chain

| Method           | Description                   |
| ---------------- | ----------------------------- |
| `.id(recordId)`  | Target record by ID           |
| `.data(partial)` | Data to merge/update          |
| `.merge()`       | Use MERGE semantics (default) |
| `.where(fn)`     | UPDATE with WHERE condition   |
| `.execute()`     | Run update                    |

## DeleteBuilder

```typescript
import { delete_ } from '@woss/dali-orm/query';

// Delete by ID
await delete_(driver, usersTable).id('user:abc').execute();

// Delete with WHERE
await delete_(driver, usersTable)
  .where((w) => w.eq('active', false))
  .execute();
```

## DeleteBuilder Chain

| Method          | Description         |
| --------------- | ------------------- |
| `.id(recordId)` | Target record by ID |
| `.where(fn)`    | DELETE with WHERE   |
| `.execute()`    | Run delete          |

## RelateBuilder

```typescript
import { relate } from '@woss/dali-orm/query';

// Create relation
const [edge] = await relate(driver, followsRelationTable)
  .from('user:abc')
  .to('user:xyz')
  .set({ created_at: '2025-01-01T00:00:00Z' })
  .execute();

// With graph path
import { graphPath } from '@woss/dali-orm/query';

const results = await graphPath(driver).from('user:abc').out('follows').depth(2).execute();
```

## UpsertBuilder

```typescript
import { upsert } from '@woss/dali-orm/query';

const [record] = await upsert(driver, usersTable)
  .one(data)
  .onConflict('email') // Conflict target
  .merge({ updated_at: 'time::now()' })
  .execute();
```

## CreateBuilder (raw SurrealQL CREATE)

```typescript
import { create } from '@woss/dali-orm/query';

const [record] = await create(driver, usersTable).id('user:abc').set({ name: 'Alice' }).execute();
```

## Live Queries

```typescript
import { live } from '@woss/dali-orm/query';

const subscription = await live(driver, usersTable)
  .onCreate(handleCreate)
  .onUpdate(handleUpdate)
  .onDelete(handleDelete)
  .subscribe();

// Later
subscription.kill();

// Handlers receive:
// { action: 'CREATE' | 'UPDATE' | 'DELETE', id: string, result?: any }
```

## Table Binding

```typescript
import { bindTable } from '@woss/dali-orm/query';

const users = bindTable(driver, usersTable);
const results = await users
  .select()
  .where((w) => w.eq('active', true))
  .execute();
```

## Infer Result Types

```typescript
import type { InferSelectResult, InferInsertInput, InferUpdateInput } from '@woss/dali-orm/query';

// From table schema
type User = InferSelectResult<typeof usersTable>;
type NewUser = InferInsertInput<typeof usersTable>;
type UserUpdate = InferUpdateInput<typeof usersTable>;
```
