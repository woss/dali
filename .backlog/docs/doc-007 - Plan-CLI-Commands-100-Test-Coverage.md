---
id: doc-007
title: 'Plan: CLI Commands 100% Test Coverage'
type: other
created_date: '2026-05-17 09:01'
updated_date: '2026-05-17 09:22'
---

# Implementation Plan: CLI Commands 100% Test Coverage (TASK-050)

## Context

CLI commands in `packages/dali-orm/src/migration/cli/` have near-zero test coverage. Only pure utility functions in `generate.test.ts` are tested. The actual CLI entry point, migrate subcommands, push, pull, and diff commands have NO tests.

**Key change from original plan:** Tests use real embedded SurrealDB (memory or file-based), NOT mocks for the DB layer.

## Analysis

### Current Test Coverage (CLI-related)

| File              | Tested  | Not Tested                                                                                                                                          |
| ----------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cli.ts`          | ❌      | main(), handleMigrate(), handleGenerate(), handlePull(), handleDiff(), handleQuery(), parseGlobalOptions(), slugify()                               |
| `cli/migrate.ts`  | ❌      | migrateUp, migrateDown, migrateReset, migrateStatus, migrateResume, migrateDev, migrateDeploy, getMigrationProgressString, handleResumeWithProgress |
| `cli/push.ts`     | ❌      | pushSchema(), tablesToDdl()                                                                                                                         |
| `cli/pull.ts`     | ❌      | pullSchema(), generateAndApplyMigration(), generateTypeScriptSchema(), generateColumnDefinition()                                                   |
| `cli/diff.ts`     | ❌      | diffSchema()                                                                                                                                        |
| `cli/generate.ts` | Partial | loadSchemaFiles(), generateMigration() integration (pure utils already tested)                                                                      |

### Embedded DB Testing Approach

- Use `connect({ embeddedDriver: { driver: 'embedded', namespace: 'test', database: 'test' } })` for memory-based DB
- Each test gets a fresh embedded DB instance (memory mode = isolated)
- Real SurrealDB operations: DEFINE TABLE, INSERT, SELECT, etc. all work
- Temp directories for migration/schema files (use `node:os.tmpdir()`)
- Clean up temp dirs in `afterEach`
- Only mock: `console.log`, `console.error`, `process.exit` (for CLI behavior verification)

### Reference: Existing Integration Tests

Check existing integration test patterns in:

- `src/migration/core/__tests__/shadow.integration.test.ts`
- `src/migration/core/__tests__/runner.test.ts` (unit, but shows mock patterns)
- `src/migration/__tests__/migration-api.integration.test.ts`

## Implementation Steps

### Step 1: Create `cli/__tests__/cli.test.ts`

**Target:** `cli.ts` — entry point, option parsing, command routing

**Tests:**

- `slugify()` — various inputs (spaces, special chars, already snake_case, empty)
- `parseGlobalOptions()` — all flags, aliases, combined options, empty args
- `main()` routing — each command dispatches correctly (migrate, generate, pull, diff, query, help, version, unknown)
- `main()` error handling — catches errors, exits with code 1
- `main()` no args — prints help, exits 0
- `handleMigrate()` — each subcommand calls correct function with correct options
- `handleGenerate()` — loads config, loads schema, calls generateMigration, handles offline mode
- `handlePull()` — calls pullSchema with correct options
- `handleDiff()` — loads schema, calls diffSchema
- `handleQuery()` — connects, runs query, disconnects

**Setup:**

- Embedded DB via `connect({ embeddedDriver: ... })`
- Temp directories for schema/migration files
- Mock `process.exit`, `console.log`, `console.error`
- Mock config loading to return embedded DB config

### Step 2: Create `cli/__tests__/migrate.test.ts`

**Target:** `cli/migrate.ts` — all migrate functions

**Tests for migrateUp:**

- Happy path: connects, inits runner, applies migrations, disconnects
- With partial migrations: detects, auto-resumes
- With partial migrations no autoResume: shows message
- dryRun mode: shows what would execute
- With target version: passes `to` option
- embeddedDriver: uses embedded config
- Error: disconnect in finally even on error

**Tests for migrateDown:**

- Happy path: rolls back N migrations
- dryRun: shows message without executing
- force flag: skips confirmation
- default steps=1

**Tests for migrateReset:**

- Without force: returns without resetting
- With force: resets all, clears table

**Tests for migrateStatus:**

- Shows applied, pending, partial migrations
- No migrations: shows "No migrations applied"
- Handles disconnect error gracefully

**Tests for migrateResume:**

- No partial migrations: shows message
- Has partial migrations: resumes with progress
- dryRun: shows what would resume

**Tests for migrateDev:**

- No schema tables: early return
- Generates migration, applies to target
- Connection timeout → fallback to snapshot
- Shadow validation: passes and fails paths
- No shadow config: applies directly

**Tests for migrateDeploy:**

- No shadow config: throws error
- Shadow validation passes → applies to target
- Shadow validation fails: throws

**Tests for helpers:**

- getMigrationProgressString: various progress states
- handleResumeWithProgress: iterates partial migrations

**Setup:**

- Embedded DB for real migration operations
- Temp migration directories with real .surql files
- Mock `console.log` for output verification

### Step 3: Create `cli/__tests__/push.test.ts`

**Target:** `cli/push.ts`

**Tests for tablesToDdl():**

- Normal table → DDL format
- Relation table with in/out → relations array
- Columns with unique: true → unique indexes
- Access configs → accessStructured
- Event configs → events
- Function configs → functions

**Tests for pushSchema():**

- No changes: "Schema is up to date"
- Has changes: displays diff, applies SQL
- dryRun: displays diff, no apply
- force with data loss: applies anyway
- No force with data loss: skips
- embeddedDriver: uses embedded config

**Setup:**

- Embedded DB — push real schema changes
- Verify changes via `introspectDatabase()` after push

### Step 4: Create `cli/__tests__/pull.test.ts`

**Target:** `cli/pull.ts`

**Tests for generateColumnDefinition():**

- Each type maps to correct builder function
- Record type with recordTable
- Modifiers: optional, default, defaultRaw, flexible, readonly
- Special characters in column name → quoted

**Tests for generateTypeScriptSchema():**

- Single table schema
- Multiple tables
- Conditional imports (datetime, int, bool, array, record)
- Default export object

**Tests for pullSchema():**

- Happy path: introspects, writes schema file, generates+applies migration
- No tables found: early return
- With specific table name
- With outputDir override
- embeddedDriver with embeddedConfig

**Tests for generateAndApplyMigration():**

- Generates full migration, writes file, applies
- No tables: early return
- With access SQL from DB introspection

**Setup:**

- Embedded DB with pre-created tables (via DEFINE TABLE)
- Pull schema, verify generated TS file content
- Temp directories for output

### Step 5: Create `cli/__tests__/diff.test.ts`

**Target:** `cli/diff.ts`

**Tests for diffSchema():**

- No changes: "Schema is up to date"
- Added tables with columns
- Removed tables
- Changed tables with field changes (added/removed/changed fields)
- Added/removed indexes
- Verbose mode shows warnings
- No tables provided: early return

**Setup:**

- Embedded DB with known schema state
- Compare against schema definitions
- Verify diff output

### Step 6: Create `cli/__tests__/generate-integration.test.ts`

**Target:** `cli/generate.ts` — integration functions (not pure utils)

**Tests for loadSchemaFiles():**

- Single .ts file import
- Directory scan with pattern
- No schema files found
- Schema directory doesn't exist
- OrmSchema export pattern (tableDefinitions)
- Default export pattern
- Named exports pattern

**Tests for generateMigration() — integration:**

- Full migration (fullMigration=true)
- Snapshot-based migration
- Co-located snapshot
- Live database comparison (against embedded DB)
- No changes detected → returns empty
- Duplicate migration detection (hash match)
- Writes migration.surql and snapshot.json

**Setup:**

- Embedded DB for live comparison
- Temp directories for migrations/schema/snapshots
- Real .ts schema files in temp dirs

## Test Infrastructure

### Shared Helpers (create in `cli/__tests__/helpers.ts`)

```typescript
import { connect } from '../../sdk/driver/orm-connection.js';
import type { Config } from '../../config.js';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

/** Create fresh embedded DB driver */
export async function createTestDriver() {
  return connect({
    embeddedDriver: {
      driver: 'embedded',
      namespace: `test_${Date.now()}`,
      database: `test_${Date.now()}`,
    },
  });
}

/** Create temp directory, return path */
export async function createTempDir(prefix: string): Promise<string> {
  const dir = path.join(os.tmpdir(), `${prefix}-${Date.now()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/** Clean up temp directory */
export async function cleanupDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

/** Default test config for embedded DB */
export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    namespace: 'test',
    database: 'test',
    ...overrides,
  } as Config;
}
```

### Embedded DB Considerations

- Memory mode (`mode: 'memory'`) = isolated per connection, no cleanup needed
- File mode (`mode: 'surrealkv'`, `path: '/tmp/test-db'`) = needs cleanup between tests
- Prefer memory mode for speed and isolation
- Some features may require file mode (check as we go)

## Risk Assessment

| Risk                            | Impact | Mitigation                                                           |
| ------------------------------- | ------ | -------------------------------------------------------------------- |
| Embedded DB not available in CI | High   | Check if surrealdb embedded SDK is installed; fallback to skip tests |
| Memory mode limitations         | Medium | Use file mode if memory mode doesn't support needed features         |
| Temp directory cleanup failures | Low    | Use `afterEach` with try/catch, force rm                             |
| Test ordering dependencies      | Medium | Each test creates fresh DB + fresh dirs                              |
| Long test execution time        | Medium | Embedded DB is fast; parallel test execution via Vitest              |

## Verification

1. `pnpm test` — all new tests pass
2. `pnpm test:coverage` — CLI files show 100% coverage
3. `pnpm lint` — no lint errors in test files
4. Tests run against real embedded SurrealDB, not mocks
