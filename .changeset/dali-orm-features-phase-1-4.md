---
"@woss/dali-orm": minor
---

Add DELETE WHERE/LIMIT support, graph traversal depth parameter, and runtime SchemaBuilder DDL API

- **DELETE WHERE/LIMIT**: Added `where()` and `limit()` methods to DeleteBuilder with full graph path expression support (e.g., `->knows->person`)
- **Graph Depth**: Added optional depth/range parameter to `traverseIn`, `traverseOut`, and `traverseBoth` methods for bounded graph traversal
- **SchemaBuilder DDL API**: New `schema()` method on DaliORM returns a chainable builder for runtime DDL operations: `defineTable`, `defineField`, `defineIndex`, `removeTable`, `removeField`, `removeIndex`, `raw`, `toSQL`, `execute`
- Fixed pre-existing test type errors (missing analyzers field, wrong argument counts, incorrect Partial types)
- Removed unsupported `drop_view` code paths from DDL migration pipeline
