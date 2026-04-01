# Type Inference Utilities

Derive TypeScript types from table definitions.

## Import

```typescript
import type {
  InferSelectResult,
  InferInsertInput,
  InferUpdateInput,
  InferTypedRecord,
  ColumnRef,
  SelectField,
} from '@woss/dali-orm/query';
```

## Core Type Utilities

```typescript
// Get the record type from a table
type User = InferSelectResult<typeof usersTable>;
// { id?: string; name: string; email: string | undefined; created_at: string; }

// Get insert input (all fields optional)
type NewUser = InferInsertInput<typeof usersTable>;
// Partial<User>

// Get update input (all fields optional)
type UserUpdate = InferUpdateInput<typeof usersTable>;
// Partial<User>
```

## ColumnRef

Reference a specific column for type-safe field selection:

```typescript
import { columnRef } from '@woss/dali-orm/query';

// Create a column reference
const nameRef = columnRef('name');

// Use in select fields
const results = await select(driver, usersTable).fields(nameRef, 'email').execute();
```

## SelectField

```typescript
type SelectField = string | ColumnRef | { expr: string; alias: string };
```

## ColumnType

```typescript
// Extract TypeScript type from column/schema
type T = ColumnType<typeof usersTable, 'name'>;
// string

type U = ColumnType<typeof usersTable, 'created_at'>;
// string (datetime serialized as ISO string)
```

## InferTypedRecord

```typescript
// Low-level: Derive record type directly from TableDefinition
type UserRecord = InferTypedRecord<typeof usersTable>;
```

## TableBinding

```typescript
import { bindTable } from '@woss/dali-orm/query';

// Create a typed table binding
const users = bindTable(driver, usersTable);
const results = await users
  .select()
  .where((w) => w.eq('active', true))
  .execute();
const [created] = await users.insert().one(data).execute();
```

## Column Type Mappings

| SurrealDB Type     | TypeScript Type           |
| ------------------ | ------------------------- |
| `string`           | `string`                  |
| `int`              | `number`                  |
| `float`            | `number`                  |
| `decimal`          | `number`                  |
| `bool`             | `boolean`                 |
| `datetime`         | `string`                  |
| `duration`         | `string`                  |
| `record<table>`    | `string`                  |
| `array`            | `unknown[]`               |
| `object`           | `Record<string, unknown>` |
| `uuid`             | `string`                  |
| With `.optional()` | `\| undefined`            |
