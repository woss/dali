# RecordId Conventions

SurrealDB v2 uses `RecordId` objects (`{ table: Table, id: Id }`) as the canonical record identifier. The SDK accepts `RecordId` natively — never extract bare strings for query params.

## Core Rule

**RecordId inside, strings at I/O boundary.**

- Services accept `RecordId | string` — convert string → RecordId at the entry point, not inside business logic
- String-to-RecordId conversion happens only in routes (`+page.server.ts`), MCP handlers (`mcp.ts`), or API adapters — never in service methods
- SurrealDB SDK methods (`select`, `create`, `update`, `delete`, `relate`) all accept `RecordId` directly — no need to extract bare slugs

## String Extraction — Only for Human-readable Output

Extract the bare ID value only when needed for API responses or URLs:

```typescript
const slug = String(record.id.id); // clean value, no SurrealQL escaping
// NOT: record.id.toString()         // adds ⟨⟩ escaping, breaks comparisons
// NOT: custom helpers like rawId()  // removed — use record.id.id directly
```

`RecordId.toString()` adds SurrealQL `⟨⟩` escaping — never use for string-to-string comparisons.
`RecordId.toJSON()` and `String(recordId)` produce clean unescaped output.

## What NOT to Do

- No `String(record.id)` when passing to services — pass the `RecordId` directly
- No string-parsing helpers (`toQualifiedId`, `stripBrackets`, `rawId`, `normalizeId`) — the SDK handles RecordId natively
- No `toString()` for comparisons — use `.id` getter for raw value

## Pattern: Service Method Signature

```typescript
// Service accepts RecordId | string, converts at entry
async getMemory(id: RecordId | string): Promise<MemoryRecord | null> {
  const recordId = typeof id === 'string' ? new RecordId('memory', id) : id;
  return this.db.select<MemoryRecord>(recordId);
}
```

## TypeScript Type Caveat

`InferSelectResult<T>` types `id` as `string` — this is a known type/runtime mismatch. Service code handles `RecordId` at runtime even if types say `string`. Cast or use `as RecordId` at the service boundary where needed.

## RecordId API Reference

| Property/Method | Returns | Notes |
| ------------------ | ---------- | ---------------------------------------- | ------ | ------ |
| `.table` | `Table` | Table name wrapper |
| `.id` | `Id` | Raw ID value (string | number | array) |
| `.toString()` | `string` | SurrealQL-escaped (includes ⟨⟩ wrapping) |
| `.toJSON()` | `string` | Clean unescaped string |
| `String(id)` | `string` | Same as `.toJSON()` — clean output |
| `RecordId.parse()` | `RecordId` | Parse `"table:id"` string → RecordId |
