# Drizzle ORM SQLite Migration Management - Technical Report (Beta Branch)

## Overview

Drizzle ORM handles SQLite migrations through two primary mechanisms:

1. **drizzle-kit** - CLI tool for schema introspection, migration generation, and database push
2. **drizzle-orm/migrator** - Runtime library for applying migrations programmatically

**Note:** In the beta branch, the code structure has changed significantly. SQLite code is now in `drizzle-kit/src/dialects/sqlite/` and uses schema version 7.

---

## 1. Introspection of Database - HOW IT WORKS

### Core Files (Beta Branch)

| File                                            | Purpose                              |
| ----------------------------------------------- | ------------------------------------ |
| `drizzle-kit/src/dialects/sqlite/introspect.ts` | Main introspection logic (653 lines) |
| `drizzle-kit/src/dialects/sqlite/ddl.ts`        | DDL type definitions                 |
| `drizzle-kit/src/dialects/sqlite/grammar.ts`    | SQL parsing utilities                |

---

### 1.1 Main Entry Point: `fromDatabase` Function

**File:** `drizzle-kit/src/dialects/sqlite/introspect.ts`
**Lines:** 52-653

```typescript
export async function fromDatabase(
  db: DB,
  filter: EntityFilter,
  progressCallback?: (entity: EntityStats) => void,
  queryCallback?: (query: string) => void,
): Promise<SqliteEntities> {
```

---

### 1.2 Table/Column Introspection

**File:** `drizzle-kit/src/dialects/sqlite/introspect.ts`
**Lines:** 67-105

**Exact Query:**

```typescript
const tables = await db.query.raw<SqliteTableRow>(`
  SELECT m.name as table_name, p.name as column_name, p.type as column_type,
    p.notnull as not_null, p.dflt_value as default_value, p.pk as pk,
    p.hidden as hidden, m.sql as sql
  FROM sqlite_master AS m 
  JOIN pragma_table_xinfo(m.name) AS p
  WHERE m.type = 'table'
    and m.tbl_name NOT LIKE '\\_cf\\_%' ESCAPE '\\'
    and m.tbl_name NOT LIKE '\\_litestream\\_%' ESCAPE '\\'
    and m.tbl_name NOT LIKE 'libsql\\_%' ESCAPE '\\'
    and m.tbl_name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
    and m.tbl_name NOT LIKE 'd1\\_%' ESCAPE '\\'
`);
```

**System tables filtered:**

- `_cf_*` - Cloudflare D1
- `_litestream_*` - Litestream
- `libsql_*` - libSQL/WASM
- `sqlite_*` - SQLite internal
- `d1_*` - D1 internal

---

### 1.3 Primary Key Detection

**File:** `drizzle-kit/src/dialects/sqlite/introspect.ts`
**Lines:** 314-385

```typescript
// Build tableToPk map from column data (pk !== 0)
if (column.pk !== 0) {
  if (!tableToPk[tableName]) {
    tableToPk[tableName] = [columnName];
  } else {
    tableToPk[tableName].push(columnName);
  }
}

// For composite PKs, parses DDL using parseSqliteDdl()
```

---

### 1.4 Generated Columns Detection

**File:** `drizzle-kit/src/dialects/sqlite/introspect.ts`
**Lines:** 326-330

**Detection via `hidden` field:**

- `hidden = 0` - visible column
- `hidden = 1` - hidden column
- `hidden = 2` - VIRTUAL generated column
- `hidden = 3` - STORED generated column

```typescript
if (column.hidden === 2 || column.hidden === 3) {
  // Detected as generated column
  // Uses extractGeneratedColumns() from grammar
}
```

---

### 1.5 Foreign Keys Detection

**File:** `drizzle-kit/src/dialects/sqlite/introspect.ts`
**Lines:** 466-547

**Exact Query:**

```typescript
const fks = await db.query.raw<SqliteForeignKeyRow>(`
  SELECT m.name as table_from, f.id as id, f."table" as table_to,
    f."from" as from_col, f."to" as to_col,
    f.on_update as on_update, f.on_delete as on_delete
  FROM sqlite_master m, pragma_foreign_key_list(m.name) as f 
  WHERE m.tbl_name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
`);
```

---

### 1.6 Indexes Detection

**File:** `drizzle-kit/src/dialects/sqlite/introspect.ts`
**Lines:** 255-287, 551-572

**Pragmas used:**

- `pragma_index_list(table_name)` - List indexes
- `pragma_index_info(index_name)` - Index column info

**Index origin tracking:**

- `'u'` - auto-generated
- `'c'` - manual (created by user)
- `'pk'` - auto primary key index

---

### 1.7 Check Constraints Extraction

**File:** `drizzle-kit/src/dialects/sqlite/introspect.ts`
**Lines:** 595-612

```typescript
// Parses table SQL using parseTableSQL()
const tableDDL = parseTableSQL(table.sql);
```

---

## 2. Schema DDL Structure

### 2.1 DDL Types

**File:** `drizzle-kit/src/dialects/sqlite/ddl.ts`
**Lines:** 79-108

```typescript
// Main DDL container
type SQLiteDDL = {
  tables: TableFull[];
  views: View[];
  uniqueConstraints: UniqueConstraint[];
  checkConstraints: CheckConstraint[];
  foreignKeys: ForeignKey[];
  indexes: Index[];
};

// Table structure
type TableFull = {
  name: string;
  columns: Column[];
  indexes: Index[];
  checks: CheckConstraint[];
  uniques: UniqueConstraint[];
  pk: PrimaryKey;
  fks: ForeignKey[];
};

// Column structure
type Column = {
  table: string;
  name: string;
  type: string;
  notNull: boolean;
  autoincrement: boolean;
  default: any;
  generated: { type: 'stored' | 'virtual'; as: string } | undefined;
};
```

---

### 2.2 Schema Snapshot (Version 7)

**File:** `drizzle-kit/src/dialects/sqlite/snapshot.ts`
**Lines:** 183, 162-170

**Snapshot Version History:**

- **V5**: Basic tables with squashed structure
- **V6**: Added views
- **V7** (current): Uses DDL array instead of squashed tables

```typescript
type SqliteSnapshot = {
  version: '7';
  dialect: 'sqlite';
  id: string;
  prevIds: string[];
  ddl: SQLiteDDL; // DDL array instead of squashed tables
  renames: string[];
};
```

---

## 3. Schema Delta Generation - HOW IT WORKS

### 3.1 Diff Function: `ddlDiff`

**File:** `drizzle-kit/src/dialects/sqlite/diff.ts`
**Lines:** 18-443

```typescript
export async function ddlDiff(
  ddl1: SQLiteDDL,
  ddl2: SQLiteDDL,
  tablesResolver: TableResolver,
  columnsResolver: ColumnResolver,
  mode: 'push' | 'migrate',
): Promise<{
  statements: JsonStatement[];
  sqlStatements: string[];
  groupedStatements: Record<string, JsonStatement[]>;
  renames: RenameMap;
  warnings: string[];
}> {
```

**How it works:**

1. Compute table diffs (create/drop/rename)
2. Resolve table renames via resolver callbacks
3. Compute column diffs per table
4. Propagate renames to indexes, FKs, PKs, uniques, checks
5. Determine tables requiring recreation (SQLite limitations)
6. Generate JSON statements in order

---

### 3.2 Tables Requiring Recreation

**File:** `drizzle-kit/src/dialects/sqlite/diff.ts`
**Lines:** 276-303

SQLite requires table recreation for:

- **Check constraints** - creation/deletion
- **Unique constraints** - creation/deletion
- **Primary key changes** - add/remove/alter
- **Foreign key changes** - add/remove
- **Auto-generated unique indexes** - can't be dropped
- **Columns becoming stored generated columns**
- **New stored generated columns**

---

### 3.3 Statement Generation Order

**File:** `drizzle-kit/src/dialects/sqlite/diff.ts`
**Lines:** 312-428

Statements are generated in this order:

1. **Create tables**
2. **Rename tables**
3. **Rename columns**
4. **Add columns**
5. **Table alterations** (non-recreate)
6. **Recreate tables**
7. **Drop indexes**
8. **Create indexes**
9. **Drop tables**
10. **Drop columns**
11. **Drop/Create views**

---

## 4. Statement Types

### 4.1 JsonStatement Union Type

**File:** `drizzle-kit/src/dialects/sqlite/statements.ts`
**Lines:** 91-105

```typescript
type JsonStatement =
  | JsonRecreateTableStatement // type: 'recreate_table'
  | JsonRecreateColumnStatement // type: 'recreate_column'
  | JsonRenameColumnStatement // type: 'rename_column'
  | JsonDropTableStatement // type: 'drop_table'
  | JsonRenameTableStatement // type: 'rename_table'
  | JsonDropColumnStatement // type: 'drop_column'
  | JsonCreateIndexStatement // type: 'create_index'
  | JsonDropIndexStatement // type: 'drop_index'
  | JsonCreateTableStatement // type: 'create_table'
  | JsonAddColumnStatement // type: 'add_column'
  | JsonDropViewStatement // type: 'drop_view'
  | JsonRenameViewStatement // type: 'rename_view'
  | JsonCreateViewStatement; // type: 'create_view'
```

---

## 5. Applying Migrations - HOW IT WORKS

### 5.1 Runtime Migration: `migrate()` Function

**File:** `drizzle-orm/src/sqlite-core/dialect.ts`
**Lines:** 939-995 (sync) / 1001-1046 (async)

**Migration Table Schema:**

```sql
CREATE TABLE IF NOT EXISTS __drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at numeric
)
```

**Application Logic:**

- Reads `meta/_journal.json` to get migration entries
- Each entry has: `idx`, `when` (timestamp), `tag`, `breakpoints`
- Splits SQL by `-- statement-breakpoint`
- Applies migrations where `folderMillis > lastDbMigration.created_at`

---

### 5.2 Push Command: `sqlitePush`

**File:** `drizzle-kit/src/cli/commands/push.ts`
**Lines:** 413-532

**Flow:**

1. Connect to SQLite database
2. Introspect current schema via `fromDatabase`
3. Prepare push via `ddlDiff`
4. Run data loss detection
5. Execute with transaction

---

### 5.3 Data Loss Detection

**File:** `drizzle-kit/src/cli/commands/sqlitePushUtils.ts`
**Lines:** 127-322

Detected operations:

- DROP TABLE with data
- DROP COLUMN with data
- ADD NOT NULL without default on existing table
- RECREATE_TABLE with column changes

---

### 5.4 Table Recreation Pattern

**File:** `drizzle-kit/src/cli/commands/sqlitePushUtils.ts`
**Lines:** 15-99

```typescript
// 1. Create __new_tablename with new schema
// 2. Copy data (unless data loss mode)
// 3. Drop old table
// 4. Rename new to original
// 5. Recreate indexes
```

---

### 5.5 Transaction Handling

**File:** `drizzle-kit/src/cli/commands/push.ts`
**Lines:** 514-528

```typescript
const isNotD1 = !('driver' in credentials && credentials.driver === 'd1-http');
isNotD1 ?? (await db.run('begin'));
try {
  for (const dStmnt of statementsToExecute) {
    await db.run(dStmnt);
  }
  isNotD1 ?? (await db.run('commit'));
} catch (e) {
  isNotD1 ?? (await db.run('rollback'));
  process.exit(1);
}
```

---

## Summary Table

| Aspect        | File            | Lines    | Key Details                                       |
| ------------- | --------------- | -------- | ------------------------------------------------- |
| Introspection | `introspect.ts` | 52-653   | Uses sqlite_master + pragma_table_xinfo           |
| DDL Types     | `ddl.ts`        | 79-108   | tables, views, columns, indexes, FKs, constraints |
| Snapshot      | `snapshot.ts`   | 183      | Version 7 - uses DDL array                        |
| Diff          | `diff.ts`       | 18-443   | ddlDiff function                                  |
| Statements    | `statements.ts` | 91-105   | 13 statement types                                |
| Migration     | `dialect.ts`    | 939-1046 | migrate() with transaction                        |
| Push          | `push.ts`       | 413-532  | sqlitePush with data loss detection               |

---

## Key Differences from Stable Branch

| Aspect           | Stable (v6)                   | Beta (v7)                          |
| ---------------- | ----------------------------- | ---------------------------------- |
| Schema format    | Squashed tables object        | DDL array                          |
| Snapshot version | 6                             | 7                                  |
| Code location    | `drizzle-kit/src/serializer/` | `drizzle-kit/src/dialects/sqlite/` |
| Diff function    | `applySqliteSnapshotsDiff`    | `ddlDiff`                          |
| Statement types  | More complex                  | Simplified (13 types)              |
