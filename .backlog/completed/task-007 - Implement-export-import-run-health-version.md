---
id: TASK-007
title: 'Implement: export/import, run, health version'
status: Done
assignee: []
created_date: '2026-04-24 19:54'
updated_date: '2026-04-24 19:55'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Add export, import, run, health, version methods + fix test assertions for new behavior

<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

## Implemented SDK Parity Features - All Complete

### Additional Features Added

1. **export()** - Database export as SQL
   - `orm.export({ namespace, database, users, schema, data })` → Returns SQL string
2. **import()** - Import SQL into database
   - `orm.import(sql)` → Imports SQL statements

3. **run()** - Execute database functions
   - `orm.run<T>('function_name', args)` → Returns function result

4. **health()** - Check database connectivity
   - `await orm.health()` → Validates connection works

5. **version()** - Get database version
   - `orm.version()` → Returns { version: string }

### Also Fixed

- Test assertions for new behavior in driver tests

### Usage

```typescript
// Export database
const sql = await orm.export();

// Import data
await orm.import(sql);

// Run function
const result = await orm.run('my_function', arg1, arg2);

// Health check
await orm.health();

// Version
const ver = await orm.version();
```

### Verification

- Build: ✅ Pass
- Tests: ✅ 1479 passed

<!-- SECTION:FINAL_SUMMARY:END -->
