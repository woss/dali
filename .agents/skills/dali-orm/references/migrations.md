# Migration System

SurrealDB schema migrations with CLI and programmatic API.

## CLI Usage

```bash
dali-orm generate <name>          # Generate migration from schema diff
dali-orm generate <name> --offline # Use snapshot comparison (preferred)
dali-orm generate <name> -f       # Full migration (all tables)
dali-orm migrate dev <name>       # Generate + validate on shadow + apply
dali-orm migrate deploy           # Validate pending on shadow + apply (requires shadow config)
dali-orm migrate up               # Apply pending migrations
dali-orm migrate down             # Rollback last migration
dali-orm migrate reset            # Rollback all, then apply all
dali-orm migrate status           # Show applied/pending migrations
dali-orm pull                     # Pull DB schema -> TypeScript file
```

## Generate Priority

1. `-f`/`--full` flag → Full migration of all tables
2. Snapshot dir (`--offline`) → Snapshot comparison (incremental)
3. Live DB connection → Compare schema vs DB (incremental)
4. Fallback → Full migration (all tables)

**Always use `--offline`** for incremental migrations after up1. Snapshot comparison is more reliable than live DB comparison.

## Project Structure

```
my-project/
  dali-orm.config.ts        # Optional config file
  migrations/
    20260509223626_init.surql
    20260509231405_up1.surql
  meta/
    _journal.json            # Migration tracking
    snapshots/
      20260509223626.json
      20260509231405.json
  schema.ts                  # Table definitions
```

## Config File

```typescript
// dali-orm.config.ts
import { defineConfig } from '@woss/dali-orm/migration/config';

export default defineConfig({
  url: 'ws://localhost:10101',
  namespace: 'memory',
  database: 'memory',
  auth: { username: 'root', password: 'root' },
  migrations: { dir: './migrations' },
  schema: { dir: './src', pattern: 'schema.ts' },
  shadow: {
    // Optional shadow DB for pre-validation
    namespace: 'memory_shadow',
    database: 'shadow_db',
  },
});
```

## Programmatic API

```typescript
import { DaliORM, createOrmSchema, defineTable } from '@woss/dali-orm';
import { string, datetime } from '@woss/dali-orm/sdk/schema/column/simple-builders';
import {
  migrateToDatabase,
  rollbackMigrations,
  getMigrationStatus,
  generateAndApplyMigration,
  pushSchemaFromTableDefs,
} from '@woss/dali-orm/migration/api';
import { MigrationRunner } from '@woss/dali-orm/migration/api';

// Direct push (no migration file)
const driver = orm.getDriver();
const result = await pushSchemaFromTableDefs(driver, schema.getTables());
console.log(`Applied ${result.sqlStatements.length} statements`);

// Dry run
const result = await pushSchemaFromTableDefs(driver, tables, { dryRun: true });
console.log('Warnings:', result.warnings);

// Apply migrations
const result = await migrateToDatabase(driver, {
  migrationsDir: './migrations',
  migrationsTable: '__migrations',
});

// Rollback
const result = await rollbackMigrations(driver, { steps: 2 });

// Check status
const status = await getMigrationStatus(driver);
console.log('Current:', status.current);
console.log('Pending:', status.pending);
console.log('Applied:', status.applied);

// Generate + apply in one step
const { outputPath, result } = await generateAndApplyMigration(driver, tables, {
  name: 'add_comments',
  fullMigration: false,
});
```

## Migration Runner (low-level)

```typescript
import { MigrationRunner } from '@woss/dali-orm/migration/api';

const runner = new MigrationRunner(driver, {
  migrationsDir: './migrations',
  migrationsTable: '__migrations',
  journalDir: './meta',
});

await runner.init();
await runner.up(); // Apply pending
await runner.down(2); // Rollback 2 steps
await runner.reset(); // Full reset
const status = await runner.status();
```

## Migration Format

Generated migration files are `.surql` files with UP/DOWN sections:

```sql
-- ---- Tables ----
DEFINE TABLE IF NOT EXISTS users TYPE NORMAL SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS name ON TABLE users TYPE string;
DEFINE FIELD IF NOT EXISTS email ON TABLE users TYPE string;

-- DOWN ----
REMOVE TABLE users;
```
