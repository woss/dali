---
name: dali-orm-test-patterns
description: Test patterns for DaliORM — SurrealDB mocking, record comparison, migration assertions, and NodeDriver test setup
license: MIT
---

# DaliORM Test Patterns

Test patterns and conventions for the DaliORM mono-repo test suite.

## Record Comparison

**Always sort before deep-equality** when tests query unordered result sets:

```typescript
// CORRECT — sort before compare
const expected = [
  { id: '1', name: 'alpha' },
  { id: '2', name: 'beta' },
];
const actual = [...results].sort((a, b) => a.id.localeCompare(b.id));
expect(actual).toEqual(expected);

// WRONG — ordering is non-deterministic
expect(results).toEqual(expected);
```

Use a stable field (`id`, `name`) for sorting. Avoid relying on insertion
order.

## SurrealWebSocket Mock Setup

When testing NodeDriver directly, mock `SurrealWebSocket` before import:

```typescript
vi.mock('surrealdb.js', async () => {
  const actual = await vi.importActual('surrealdb.js');
  const MockSocket = vi.fn(() => ({
    readyState: WebSocket.OPEN,
    close: vi.fn(),
    send: vi.fn(),
  }));
  return { ...actual, SurrealWebSocket: MockSocket as any };
});
```

Always restore mocks in `afterEach()`:

```typescript
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
```

## Migration Assertions

Use snapshot-based matching for generated DDL:

```typescript
const sql = generateMigration(prevSchema, nextSchema);
expect(stripDynamicIds(sql)).toMatchSnapshot();
```

For programmatic migration API tests:

```typescript
const status = await getMigrationStatus(driver);
expect(status.pending).toHaveLength(1);
expect(status.applied).toHaveLength(0);
```

## SchemaBuilder Tests

SchemaBuilder tests use a mock queryFn instead of real SurrealDB:

```typescript
import { createSchemaBuilder } from '../schema-builder.js';

describe('SchemaBuilder', () => {
  it('defineTable generates correct SQL', () => {
    const queryFn = vi.fn().mockResolvedValue(undefined);
    const builder = createSchemaBuilder(queryFn);
    const sql = builder.defineTable('user').toSQL();
    expect(sql).toEqual(['DEFINE TABLE user SCHEMAFULL TYPE normal']);
  });

  it('defineIndex generates correct SQL', () => {
    const queryFn = vi.fn().mockResolvedValue(undefined);
    const builder = createSchemaBuilder(queryFn);
    const sql = builder
      .defineIndex('user_email_idx', {
        table: 'user',
        fields: ['email'],
        type: 'unique',
      })
      .toSQL();
    expect(sql).toEqual(['DEFINE INDEX user_email_unique ON TABLE user COLUMNS email UNIQUE']);
  });

  it('chaining returns same builder', () => {
    const queryFn = vi.fn().mockResolvedValue(undefined);
    const builder = createSchemaBuilder(queryFn);
    const result = builder
      .defineTable('user')
      .defineField('user', 'name', { type: 'string' })
      .removeTable('legacy');
    expect(result).toBe(builder);
  });

  it('execute calls queryFn for each statement', async () => {
    const queryFn = vi.fn().mockResolvedValue(undefined);
    const builder = createSchemaBuilder(queryFn);
    await builder.defineTable('user').defineField('user', 'name', { type: 'string' }).execute();
    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});
```

**Key patterns:**

- Mock `queryFn` with `vi.fn().mockResolvedValue(undefined)` — no real DB needed
- Test `toSQL()` for SQL generation correctness
- Test chaining by verifying `result === builder`
- Test `execute()` by verifying `queryFn` call count and arguments
- Adversarial tests: empty strings, SQL injection via `raw()`, multiple `execute()` calls

## Test File Placement

| Package             | Test Directory                        |
| ------------------- | ------------------------------------- |
| `@woss/dali-orm`    | `packages/dali-orm/src/**/__tests__/` |
| `@woss/dali-memory` | `packages/dali-memory/tests/`         |

Run tests:

```bash
# Root (all packages)
pnpm test

# Single package
pnpm --filter @woss/dali-orm test

# Watch mode
pnpm --filter @woss/dali-orm test:watch

# With coverage
pnpm test:coverage
```

## Cross-Skill References

- **Vitest setup** → Use `vitest` skill for test configuration patterns
- **DaliORM driver API** → Use `dali-orm` skill for driver config details
