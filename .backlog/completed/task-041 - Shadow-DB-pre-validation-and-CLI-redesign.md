---
id: TASK-041
title: Shadow DB pre-validation and CLI redesign
status: Done
assignee: []
created_date: '2026-05-11'
updated_date: '2026-05-12'
labels: []
dependencies: []
priority: high
---

## Description

Add shadow ns/db for safe migration pre-validation. Redesign CLI to Prisma-style workflow: `migrate dev` (generate + apply), `migrate deploy` (apply pending). Remove `push` command (no backward compat). Shadow validation runs all SQL against shadow DB first. If shadow fails, target DB untouched.

## Design Decisions

1. `migrate dev` with no changes → stop and notify (no empty migration)
2. `migrate deploy` without shadow config → fail hard
3. `push` → removed (replaced by migrate dev/deploy)
4. Shadow persistent config (fixed ns/db names), destroyed after each run
5. Shadow auto-created, destroyed after validation via `REMOVE DATABASE IF EXISTS`
6. Both pipelines (migrate dev + migrate deploy) use shadow validation

## Implementation Plan

### 1. Config — migration/config.ts

Add to ConfigSchema:

```typescript
shadow: optional(object({
  namespace: string(),
  database: string(),
})),
```

Also add to SDK driver schema/types for consistency.

### 2. Shadow helper — migration/core/shadow.ts (NEW)

```typescript
// connectToShadow(config) → SurrealDriver
// destroyShadow(shadowDriver, shadowConfig) → void (REMOVE DATABASE IF EXISTS)
// validateOnShadow(config, fn) → void (connect, run fn, cleanup, throw on fail)
```

### 3. CLI — migration/cli.ts

- Add `migrate dev` and `migrate deploy` subcommand handlers
- Remove `push` case from command switch
- Remove `handlePush` function
- Update help text

### 4. Migrate handlers — migration/cli/migrate.ts

Add:

- `migrateDev(config, name?)` — load schema → generate migration → shadow validate → apply to target
- `migrateDeploy(config)` — load pending → shadow validate → apply to target
- Both wrap existing `migrateUp()` with shadow validation step

### 5. Shadow validation flow

For `migrate dev`:

1. Load schema files from disk
2. Call `generateMigration()` → creates .surql file
3. If no changes → stop, notify "No schema changes detected"
4. Shadow: connect → run .surql on shadow → `REMOVE DATABASE IF EXISTS` → disconnect
5. Target: `migrateUp()` to apply only the new migration
6. Report success

For `migrate deploy`:

1. If no shadow config → FAIL with error "migrate deploy requires shadow config"
2. Load pending migrations
3. Shadow: connect → run `runner.init()` + `runner.up()` on shadow → `REMOVE DATABASE IF EXISTS` → disconnect
4. Target: `migrateUp()` to apply to production
5. Report success

### 6. API — migration/api.ts

Add shadow validation to:

- `migrateToDatabase()` — before `runner.up()`
- `pushSchemaFromTableDefs()` — before apply loop

### 7. Package exports — package.json + index.ts

- Remove `push` from exports if explicitly listed
- Add `migrateDev`, `migrateDeploy` to exports
- Ensure `ShadowConfig` type exported if needed

### 8. Tests

- Test shadow validation passes when SQL is valid
- Test shadow validation fails when SQL is invalid (target untouched)
- Test `migrate deploy` fails if shadow not configured
- Test `migrate dev` reports no changes when schema unchanged
- Test shadow cleanup on both success and failure paths

## Files to Modify/Create

| File                                 | Change                                              |
| ------------------------------------ | --------------------------------------------------- |
| `.backlog/tasks/task-041 - ...`      | (this file)                                         |
| `migration/config.ts`                | Add `shadow` to ConfigSchema                        |
| `migration/core/shadow.ts`           | NEW — connect/destroy/validate helpers              |
| `migration/cli.ts`                   | Add dev/deploy, remove push                         |
| `migration/cli/migrate.ts`           | Add `migrateDev()`, `migrateDeploy()`               |
| `migration/api.ts`                   | Shadow in migrateToDatabase/pushSchemaFromTableDefs |
| `sdk/driver/config/schema.ts`        | Shadow in OrmConfigSchema                           |
| `sdk/driver/config/types.ts`         | Shadow in ValidatedOrmConfig                        |
| `package.json`                       | Update exports (remove push if listed)              |
| `migration/__tests__/shadow.test.ts` | NEW — shadow validation tests                       |

## Edge Cases

- Shadow ns/db === real ns/db → throw, don't validate against yourself
- Shadow DB doesn't exist → auto-created on first USE
- Connection to shadow fails → validation failure → throw
- Drop shadow fails (cleanup) → non-fatal, log warning
- No pending migrations → `runner.up()` returns early, still pass
- `migrate deploy` without shadow → fail with clear error message
- `migrate dev` no schema changes → notify, don't generate empty migration

## Not In Scope

- Changes to dali-memory (separate task task-039)
- Changes to `generate`, `pull`, `diff`, `query` commands (kept as-is)
- `migrate up/down/reset/status/resume` (kept as-is)
