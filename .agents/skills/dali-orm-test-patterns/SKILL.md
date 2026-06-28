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
