# Conditions DSL

Type-safe condition builder for WHERE clauses. Used with `SelectBuilder.where()`, `UpdateBuilder.where()`, `DeleteBuilder.where()`.

## Import

```typescript
import { select } from '@woss/dali-orm/query';
// Conditions built inline via the where callback
```

## WhereBuilder Methods

Inside `.where(w => ...)`, `w` provides:

| Method                          | SurrealQL Output               |
| ------------------------------- | ------------------------------ |
| `w.eq(field, value)`            | `field = $value`               |
| `w.eeq(field, value)`           | `field == $value`              |
| `w.ne(field, value)`            | `field != $value`              |
| `w.gt(field, value)`            | `field > $value`               |
| `w.gte(field, value)`           | `field >= $value`              |
| `w.lt(field, value)`            | `field < $value`               |
| `w.lte(field, value)`           | `field <= $value`              |
| `w.contains(field, value)`      | `field CONTAINS $value`        |
| `w.containsAny(field, values)`  | `field CONTAINSANY [$v1,$v2]`  |
| `w.containsAll(field, values)`  | `field CONTAINSALL [$v1,$v2]`  |
| `w.containsNone(field, values)` | `field CONTAINSNONE [$v1,$v2]` |
| `w.inside(field, values)`       | `field INSIDE [$v1,$v2]`       |
| `w.outside(field, values)`      | `field OUTSIDE [$v1,$v2]`      |
| `w.intersects(field, values)`   | `field INTERSECTS [$v1,$v2]`   |
| `w.isNull(field)`               | `field IS NONE`                |
| `w.isNotNull(field)`            | `field IS NOT NONE`            |

All methods are chainable — multiple conditions are AND'd:

```typescript
const results = await select(driver, usersTable)
  .where((w) => w.eq('active', true).gt('age', 18).contains('tags', 'admin'))
  .execute();
// WHERE active = $p1 AND age > $p2 AND tags CONTAINS $p3
```

## Standalone Condition Functions

For complex conditions with AND/OR/NOT nesting:

```typescript
import { eq, gt, and, or, not, isNull, raw, expr } from '@woss/dali-orm/query';

const results = await select(driver, usersTable)
  .where((w) =>
    or(and(eq('role', 'admin'), gt('level', 5)), eq('role', 'superadmin'), isNull('deleted_at')),
  )
  .execute();
// WHERE (role = $p1 AND level > $p2) OR role = $p3 OR deleted_at IS NONE
```

## Standalone Condition API

| Function                      | Description           |
| ----------------------------- | --------------------- |
| `eq(field, value)`            | Equals                |
| `eeq(field, value)`           | Strict equals         |
| `ne(field, value)`            | Not equals            |
| `gt(field, value)`            | Greater than          |
| `gte(field, value)`           | Greater than or equal |
| `lt(field, value)`            | Less than             |
| `lte(field, value)`           | Less than or equal    |
| `contains(field, value)`      | CONTAINS              |
| `containsAny(field, values)`  | CONTAINSANY           |
| `containsAll(field, values)`  | CONTAINSALL           |
| `containsNone(field, values)` | CONTAINSNONE          |
| `inside(field, values)`       | INSIDE                |
| `outside(field, values)`      | OUTSIDE               |
| `intersects(field, values)`   | INTERSECTS            |
| `isNull(field)`               | IS NONE               |
| `isNotNull(field)`            | IS NOT NONE           |
| `and(...conditions)`          | AND                   |
| `or(...conditions)`           | OR                    |
| `not(condition)`              | NOT                   |
| `raw(sql, params?)`           | Raw SQL condition     |
| `expr(fn)`                    | Expression builder    |
