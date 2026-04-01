---
id: TASK-008
title: Implement SDK Parity Features
status: Done
assignee: []
created_date: '2026-04-24 21:57'
updated_date: '2026-04-24 22:03'
labels:
  - implementation
  - sdk-parity
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Implement missing SDK parity features from the ORM documentation.

## Missing Features to Implement

### High Priority

1. **Session variables** - `session.set(key, value)` and `session.unset(key)`
2. **Event subscription** - `.subscribe('connected'|'error'|'disconnected', cb)`
3. **Feature detection** - `.isFeatureSupported(feature)`

### Medium Priority

4. **Codec options** - Expose `useNativeDates`, `valueEncodeVisitor`, `valueDecodeVisitor`
5. **Reconnect options** - Auto-reconnect configuration
6. **Return options** - Type-safe `.return('NONE'|'DIFF'|'BEFORE'|'AFTER'|'ALL')`

### Lower Priority

7. **`surql` template tag** - Type-safe bound queries (requires additional wrapping)
8. **Custom API** - `.api<T>()` for user-defined APIs
9. **Query builder methods** - `.fetch(fields)`, `.groupBy()` - typed versions
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Implemented SDK parity features in SurrealORM:

## Implemented (High + Medium Priority)

| Feature            | Method                            | Status |
| ------------------ | --------------------------------- | ------ |
| Session variables  | `orm.set(key, value)`             | ✅     |
| Session variables  | `orm.unset(key)`                  | ✅     |
| Event subscription | `orm.subscribe(event, callback)`  | ✅     |
| Feature detection  | `orm.isFeatureSupported(feature)` | ✅     |
| Codec options      | `SurrealORMConfig.codecOptions`   | ✅     |
| Reconnect options  | `SurrealORMConfig.reconnect`      | ✅     |
| Return options     | `ReturnOption` type               | ✅     |

## Still Missing (Lower Priority)

| Feature                  | Notes                       |
| ------------------------ | --------------------------- |
| `surql` template tag     | Type-safe bound queries     |
| `db.api<T>()`            | Custom API support          |
| `.fetch()`, `.groupBy()` | Typed query builder methods |

## Tests

All 550 tests pass (0 failures).

## Usage Examples

```typescript
// Session variables
await orm.set('userId', 'user:123');
await orm.unset('userId');

// Event subscription
const unsubscribe = orm.subscribe('connected', () => {
  console.log('Connected!');
});
// Later: unsubscribe()

// Feature detection
if (orm.isFeatureSupported('LIVE_QUERIES')) {
  await orm.live('users', callback);
}

// Codec options
const orm = await SurrealORM.connect({
  driver: { url: 'ws://localhost:8000', namespace: 'test', database: 'test' },
  codecOptions: { useNativeDates: true },
});

// Reconnect options
const orm = await SurrealORM.connect({
  driver: { url: 'ws://localhost:8000', namespace: 'test', database: 'test' },
  reconnect: {
    enabled: true,
    attempts: 5,
    retryDelay: 1000,
    retryDelayMax: 30000,
    retryDelayMultiplier: 2,
    retryDelayJitter: 100,
  },
});

// Return options
await orm.create('user:john', data).return('DIFF');
```

<!-- SECTION:FINAL_SUMMARY:END -->
