import * as fs from 'node:fs/promises';
import { readdir, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { createDebug as debug } from 'obug';
import type { SurrealDriver } from '../../sdk/driver/types.js';
import type { ColumnConfig, ColumnDefinition } from '../../sdk/schema/column/types.js';
import type { AccessConfig, EventConfig, FunctionConfig } from '../../sdk/schema.js';
import { accessToSQL, eventToSQL, functionToSQL } from '../../sdk/schema.js';
import type { AnalyzerDefinition, IndexDefinition, TableDefinition } from '../../sdk/table.js';
import { SchemaDiffer } from '../core/diff.js';
import { SurrealQLGenerator } from '../core/generator.js';
import type {
  SchemaSnapshot,
  SerializedAccess,
  SerializedAnalyzer,
  SerializedEvent,
  SerializedFunction,
} from '../core/snapshot.js';
import { SnapshotManager } from '../core/snapshot.js';
import { introspectAccess, introspectTable } from '../ddl/introspect.js';
import { computeMigrationHash } from '../ddl/journal.js';

const log = debug('dali-orm:kit:generate');

/**
 * Serialize column permissions object to SQL string for ColumnDefinition
 */
export function serializeColumnPermissions(
  perms:
    | {
        select?: string | boolean;
        create?: string | boolean;
        update?: string | boolean;
        delete?: string | boolean;
      }
    | undefined,
): string | undefined {
  if (!perms) return undefined;
  const parts: string[] = [];
  if (perms.select !== undefined)
    parts.push(
      `FOR select ${typeof perms.select === 'string' ? perms.select : perms.select ? 'FULL' : 'NONE'}`,
    );
  if (perms.create !== undefined)
    parts.push(
      `FOR create ${typeof perms.create === 'string' ? perms.create : perms.create ? 'FULL' : 'NONE'}`,
    );
  if (perms.update !== undefined)
    parts.push(
      `FOR update ${typeof perms.update === 'string' ? perms.update : perms.update ? 'FULL' : 'NONE'}`,
    );
  if (perms.delete !== undefined)
    parts.push(
      `FOR delete ${typeof perms.delete === 'string' ? perms.delete : perms.delete ? 'FULL' : 'NONE'}`,
    );
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Normalize SQL for comparison: strip whitespace, sort lines
 */
export function normalizeSql(sql: string): string {
  return sql
    .split('\n')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0)
    .sort()
    .join('\n');
}

export interface GenerateOptions {
  name: string; // Migration name
  outputDir?: string; // Output directory
  tables?: string[]; // Specific tables to generate for
  version?: string; // Version number (defaults to timestamp-based)
  driver?: SurrealDriver; // Driver for live schema comparison
  /** Snapshot directory for incremental migration (default: ./meta/snapshots) */
  snapshotDir?: string;
  /** Skip snapshot comparison and generate full migration */
  fullMigration?: boolean;
}

/**
 * Co-located snapshot loaded from a migration directory's snapshot.json
 */
export interface CoLocatedSnapshot {
  tables: TableDefinition[];
  access?: SerializedAccess[];
  events?: SerializedEvent[];
  functions?: SerializedFunction[];
  analyzers?: SerializedAnalyzer[];
}

/**
 * Find the most recent co-located snapshot in migration directories
 * Scans outputDir for {timestamp}_{name}/snapshot.json files
 */
async function findCoLocatedSnapshot(outputDir: string): Promise<CoLocatedSnapshot | undefined> {
  try {
    const entries = await readdir(outputDir);
    // Filter directories with migration pattern: {timestamp}_{name}
    const dirs = entries
      .filter((e) => e.includes('_'))
      .sort()
      .reverse();

    for (const dir of dirs) {
      const snapPath = path.join(outputDir, dir, 'snapshot.json');
      try {
        const content = await fs.readFile(snapPath, 'utf-8');
        const snapshot: SchemaSnapshot = JSON.parse(content);
        const snapManager = new SnapshotManager('');
        const tables = snapManager.restoreSnapshot(snapshot);
        console.log(`Found co-located snapshot from migration: ${dir} (${tables.length} tables)`);
        return {
          tables,
          access: snapshot.access,
          events: snapshot.events,
          functions: snapshot.functions,
          analyzers: snapshot.analyzers,
        };
      } catch {}
    }
  } catch {
    // migrations dir doesn't exist or can't read
    log('No migrations directory found at: %s', outputDir);
  }
  return undefined;
}

/**
 * Get current database schema using STRUCTURE clause via introspectTable.
 * Maps SurrealTable → TableDefinition for use by SchemaDiffer.
 */
export async function getLiveSchema(
  driver: SurrealDriver,
  tableNames: string[],
): Promise<TableDefinition[]> {
  // Early exit: empty input
  if (!tableNames.length) {
    log('No table names provided, returning empty schema');
    return [];
  }

  const tables: TableDefinition[] = [];

  log('Getting live schema for tables: %O', tableNames);

  for (const tableName of tableNames) {
    try {
      const surrealTable = await introspectTable(driver, tableName);

      // Map SurrealColumn[] → ColumnDefinition[]
      const columns: ColumnDefinition[] = surrealTable.columns.map((col) => {
        // Determine if field is optional (option type or not required in schema)
        const isOptionType =
          col.kind &&
          (String(col.kind).includes('option<') ||
            String(col.kind).includes('| none') ||
            String(col.kind).startsWith('none |'));
        const isRequired = !col.readonly && !isOptionType && surrealTable.schema === 'full';

        return {
          name: col.name,
          tableName: surrealTable.name,
          config: {
            type: col.kind ?? 'string',
            optional: !isRequired,
            default: col.default as string | undefined,
            assert: col.assert,
            readonly: col.readonly,
            permissions: serializeColumnPermissions(col.permissions),
            flexible: col.flex,
          } as ColumnConfig,
        };
      });

      // Map SurrealIndex[] → IndexDefinition[]
      const indexes: IndexDefinition[] | undefined =
        surrealTable.indexes.length > 0
          ? surrealTable.indexes.map((idx) => ({
              name: idx.name,
              fields: idx.cols,
              type: idx.index as IndexDefinition['type'],
            }))
          : undefined;

      tables.push({
        name: surrealTable.name,
        columns,
        config: {
          schema: surrealTable.schema,
          type: surrealTable.type,
          in: surrealTable.in,
          out: surrealTable.out,
          indexes,
          permissions: surrealTable.permissions,
        },
      });
    } catch (error) {
      console.warn(`Failed to get schema for table ${tableName}:`, error);
    }
  }

  log(
    'Found %d tables from live schema: %O',
    tables.length,
    tables.map((t) => t.name),
  );
  return tables;
}

/**
 * Generate migration file from schema
 */
export async function generateMigration(
  tables: TableDefinition[],
  options: GenerateOptions,
  access?: AccessConfig[],
  events?: EventConfig[],
  functions?: FunctionConfig[],
  analyzers?: AnalyzerDefinition[],
): Promise<string> {
  // Early exit: fail fast if no tables provided
  if (!tables || tables.length === 0) {
    throw new Error('No tables provided for migration generation');
  }

  // Format: YYYYMMDDHHmmss (14 digits, no separators)
  // e.g., 20260403212634
  // Use provided version or generate from timestamp
  const timestamp =
    options.version ??
    (() => {
      const now = new Date();
      return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0'),
      ].join('');
    })();
  const safeName = options.name.toLowerCase().replace(/\s+/g, '_');
  const migrationDir = path.join(options.outputDir!, `${timestamp}_${safeName}`);
  const migrationFilePath = path.join(migrationDir, 'migration.surql');
  const snapshotFilePath = path.join(migrationDir, 'snapshot.json');

  const generator = new SurrealQLGenerator();

  let upStatements: string[];
  let downStatements: string[];

  console.log('Generating migration: %s', options);

  // Determine which comparison strategy to use
  // Priority: fullMigration > snapshotDir > co-located snapshot > driver > full
  if (options.fullMigration) {
    // Force full migration generation
    log('Generating full migration (fullMigration=true)');
    ({ upStatements, downStatements } = generateFullMigration(
      tables,
      generator,
      access,
      events,
      functions,
      analyzers,
    ));
  } else if (options.snapshotDir) {
    // Use snapshot-based incremental migration (preferred over live comparison)
    // loadLatestSnapshot() handles missing snapshots: compares against empty DB
    log('Using snapshot-based incremental migration');
    ({ upStatements, downStatements } = await generateSnapshotMigration(
      tables,
      options.snapshotDir,
      generator,
      timestamp,
      access,
      events,
      functions,
      analyzers,
    ));
  } else {
    // No explicit snapshot dir — try co-located snapshot from latest migration dir
    const coLocated = await findCoLocatedSnapshot(options.outputDir!);
    if (coLocated) {
      log('Using co-located snapshot for comparison (from migration directory)');
      ({ upStatements, downStatements } = await generateSnapshotMigration(
        tables,
        coLocated,
        generator,
        timestamp,
        access,
        events,
        functions,
        analyzers,
      ));
    } else if (options.driver) {
      // Use live database comparison - fallback when no snapshots configured
      log('Using live database comparison');
      ({ upStatements, downStatements } = await generateLiveMigration(
        tables,
        options.driver,
        generator,
        access,
        events,
        functions,
        analyzers,
      ));
    } else {
      // Fall back to full generation
      log('No comparison strategy specified, generating full migration');
      ({ upStatements, downStatements } = generateFullMigration(
        tables,
        generator,
        access,
        events,
        functions,
        analyzers,
      ));
    }
  }

  // Combine table statements (access handled by inner migration functions)
  const allUpStatements = [...upStatements];
  const allDownStatements = [...downStatements];

  // If no changes, return early
  if (allUpStatements.length === 0) {
    console.log('No schema changes detected. Migration not generated.');
    if (tables.length > 0) {
      console.log(`  Checked ${tables.length} tables`);
    }
    if (access && access.length > 0) {
      console.log(`  Checked ${access.length} access definitions`);
    }
    if (events && events.length > 0) {
      console.log(`  Checked ${events.length} event definitions`);
    }
    if (functions && functions.length > 0) {
      console.log(`  Checked ${functions.length} function definitions`);
    }
    if (analyzers && analyzers.length > 0) {
      console.log(`  Checked ${analyzers.length} analyzer definitions`);
    }
    return '';
  }

  // Create migration content
  const content = generateMigrationFile(timestamp, safeName, {
    up: allUpStatements,
    down: allDownStatements,
  });

  // Compute hash of new migration content for duplicate detection
  const newHash = computeMigrationHash(content);

  // Check for duplicate migration by comparing hashes
  // Scan existing migration directories for matching content
  const outputDir = options.outputDir!;
  await fs.mkdir(outputDir, { recursive: true });

  try {
    const existingMigrations = await fs.readdir(outputDir);

    for (const entry of existingMigrations) {
      const entryPath = path.join(outputDir, entry);
      const entryStat = await fs.stat(entryPath);

      if (!entryStat.isDirectory()) continue;

      const surqlPath = path.join(entryPath, 'migration.surql');
      let fileContent: string | null = null;
      try {
        fileContent = await fs.readFile(surqlPath, 'utf-8');
      } catch {
        continue;
      }

      const existingHash = computeMigrationHash(fileContent);
      if (existingHash === newHash) {
        console.log('Migration already exists with same content (hash match), skipping:', entry);
        console.log('Nothing to do.');
        return migrationDir;
      }
    }
  } catch {
    // Directory doesn't exist yet, will create below
  }

  // Write migration.surql
  await fs.mkdir(migrationDir, { recursive: true });
  await fs.writeFile(migrationFilePath, content, 'utf-8');

  // Save snapshot inside migration directory
  const snapshotManager = new SnapshotManager(options.snapshotDir ?? '');
  const snapshot = snapshotManager.createSnapshot(
    tables,
    timestamp,
    safeName,
    access,
    events,
    functions,
    analyzers,
  );
  await fs.writeFile(snapshotFilePath, JSON.stringify(snapshot, null, 2), 'utf-8');

  // Also save snapshot to meta/snapshots/ if configured (backward compat for diffing)
  if (options.snapshotDir && allUpStatements.length > 0) {
    await snapshotManager.saveSnapshot(snapshot);
    log('Snapshot also saved to: %s', options.snapshotDir);
  }

  console.log(`Migration created: ${migrationDir}`);
  return migrationDir;
}

/**
 * Generate incremental migration by comparing against the last snapshot
 *
 * This is the Drizzle-style approach:
 * 1. Load the last snapshot (if exists)
 * 2. Compare last snapshot against current schema.ts
 * 3. Generate SQL for only the differences
 * 4. If no snapshot exists, compare against empty schema (generate all tables)
 */
export async function generateSnapshotMigration(
  tables: TableDefinition[],
  snapshotDir: string | CoLocatedSnapshot,
  generator: SurrealQLGenerator,
  _version: string,
  access?: AccessConfig[],
  events?: EventConfig[],
  functions?: FunctionConfig[],
  analyzers?: AnalyzerDefinition[],
): Promise<{ upStatements: string[]; downStatements: string[] }> {
  let baseTables: TableDefinition[];
  let lastAccess: SerializedAccess[] = [];
  let lastEvents: SerializedEvent[] = [];
  let lastFunctions: SerializedFunction[] = [];
  let lastAnalyzers: SerializedAnalyzer[] = [];

  if (typeof snapshotDir === 'string') {
    const snapshotManager = new SnapshotManager(snapshotDir);

    // Load the last snapshot
    const lastSnapshot = await snapshotManager.loadLatestSnapshot();

    if (lastSnapshot) {
      // Compare against the snapshot
      baseTables = snapshotManager.restoreSnapshot(lastSnapshot);
      lastAccess = lastSnapshot.access ?? [];
      lastEvents = lastSnapshot.events ?? [];
      lastFunctions = lastSnapshot.functions ?? [];
      lastAnalyzers = lastSnapshot.analyzers ?? [];
      console.log(`Loaded snapshot: ${lastSnapshot.name} (${lastSnapshot.version})`);
      console.log(`Comparing against ${baseTables.length} tables from snapshot`);
    } else {
      // No snapshot exists - compare against empty schema
      // This means ALL tables will be generated as new
      baseTables = [];
      console.log('No snapshot found - generating initial migration for all tables');
    }
  } else {
    baseTables = snapshotDir.tables;
    lastAccess = snapshotDir.access ?? [];
    lastEvents = snapshotDir.events ?? [];
    lastFunctions = snapshotDir.functions ?? [];
    lastAnalyzers = snapshotDir.analyzers ?? [];
    console.log(`Loaded co-located snapshot with ${baseTables.length} tables`);
  }

  console.log(`Current schema has ${tables.length} tables`);

  // Debug: Log all table names from current schema
  log('=== DEBUG: Tables from schema ===');
  log(
    'Table names from schema: %O',
    tables.map((t) => t.name),
  );
  log('=================================');

  // Debug: Log all table names from snapshot
  log('=== DEBUG: Tables from snapshot ===');
  log(
    'Table names from snapshot: %O',
    baseTables.map((t) => t.name),
  );
  log('====================================');

  // Compare using SchemaDiffer
  const differ = new SchemaDiffer();
  const diff = differ.diff(baseTables, tables);

  // Debug: Log the diff result
  log('=== DEBUG: Diff result ===');
  log(
    'Added tables: %O',
    diff.added.tables.map((t) => t.name),
  );
  log(
    'Added fields: %O',
    diff.added.fields.map((f) => `${f.table}.${f.column.name}`),
  );
  log('Removed tables: %O', diff.removed.tables);
  log(
    'Removed fields: %O',
    diff.removed.fields.map((f) => `${f.table}.${f.field}`),
  );
  log(
    'Changed tables: %O',
    diff.changed.tables.map((t) => t.name),
  );
  log(
    'Changed fields: %O',
    diff.changed.fields.map((f) => `${f.table}.${f.field}`),
  );
  log('=========================');

  // Safe incremental migration: generates ADD statements for new schema elements
  // and REMOVE statements for deleted schema elements (tables and fields).
  // User explicitly defined the schema — match database to schema definition.

  const upStatements: string[] = [];
  const downStatements: string[] = [];

  // Handle analyzer definitions (UP) — must come before tables/indexes that reference them
  const lastAnalyzerNames = new Set(lastAnalyzers.map((a) => a.name));

  for (const a of analyzers ?? []) {
    if (a.name && !lastAnalyzerNames.has(a.name)) {
      try {
        const sql = generator.generateAnalyzerDefinition(a);
        if (sql) upStatements.push(sql);
      } catch {
        // Skip invalid analyzer configs
      }
    }
  }

  // Add new tables (tables that don't exist in DB)
  for (const table of diff.added.tables) {
    upStatements.push(...generator.generateTableMigration(table, 'up'));
    downStatements.push(generator.generateRemoveTable(table.name));
  }

  // Add new fields to existing tables (fields that don't exist in DB)
  for (const fieldChange of diff.added.fields) {
    const column: ColumnDefinition = {
      ...fieldChange.column,
      tableName: fieldChange.table,
    };
    upStatements.push(generator.generateFieldDefinition(column));

    // DOWN: Skip REMOVE FIELD entirely
    // REMOVE TABLE handles new tables (removes whole table with fields)
    // REMOVE FIELD for existing tables is dangerous for incremental migrations
    // Users can manually handle field removal if needed
  }

  // Add new indexes
  for (const indexChange of diff.added.indexes) {
    upStatements.push(generator.generateIndexDefinition(indexChange.index, indexChange.table));
    downStatements.push(generator.generateRemoveIndex(indexChange.index.name, indexChange.table));
  }

  // Handle removed fields — emit REMOVE FIELD for fields no longer in schema
  for (const removedField of diff.removed.fields) {
    log('Removed field detected: %s.%s', removedField.table, removedField.field);
    // Note: snapshot-based comparison can't check data existence in DB.
    // Field removal is assumed safe — user explicitly defined the schema without this field.
    // If data exists, SurrealDB REMOVE FIELD removes the definition but NOT data values.
    // Data remains in records but field becomes unconstrained.
    upStatements.push(generator.generateRemoveField(removedField.table, removedField.field));
    // No down statement — can't restore removed field definition without snapshot of old state
  }

  // Handle removed tables — generate REMOVE TABLE for tables no longer in schema
  for (const tableName of diff.removed.tables) {
    log('Removed table detected: %s', tableName);
    // Note: snapshot-based comparison can't check data existence in DB.
    // Table removal is assumed safe — user explicitly removed it from schema.
    // REMOVE TABLE removes table definition AND all data in the table.
    upStatements.push(generator.generateRemoveTable(tableName));
    // No down statement — can't restore removed table without snapshot of old state
  }

  // Handle field changes on existing tables
  // Emits DEFINE FIELD (without IF NOT EXISTS) for type/optional/flexible/readonly changes
  // Emits ALTER FIELD DEFAULT for default-only changes (simpler SQL)
  const generatedFieldChanges: Array<{ table: string; field: string }> = [];
  for (const fieldChange of diff.changed.fields) {
    const oldEffectiveDefault =
      fieldChange.oldColumn.config.defaultRaw ?? fieldChange.oldColumn.config.default;
    const newEffectiveDefault =
      fieldChange.newColumn.config.defaultRaw ?? fieldChange.newColumn.config.default;
    const typeChanged = fieldChange.oldColumn.config.type !== fieldChange.newColumn.config.type;
    const optionalChanged =
      fieldChange.oldColumn.config.optional !== fieldChange.newColumn.config.optional;
    const flexibleChanged =
      fieldChange.oldColumn.config.flexible !== fieldChange.newColumn.config.flexible;
    const readonlyChanged =
      fieldChange.oldColumn.config.readonly !== fieldChange.newColumn.config.readonly;

    if (typeChanged || optionalChanged || flexibleChanged || readonlyChanged) {
      // For structural changes, emit full DEFINE FIELD (without IF NOT EXISTS)
      // This updates the field definition in SurrealDB
      const newColumn: ColumnDefinition = {
        ...fieldChange.newColumn,
        tableName: fieldChange.table,
      };
      upStatements.push(generator.generateFieldRedefine(newColumn));
      generatedFieldChanges.push({ table: fieldChange.table, field: fieldChange.field });
      // No down statement for field redefines (would need to know old definition)
    } else if (oldEffectiveDefault !== newEffectiveDefault) {
      // Default-only changes: simpler ALTER FIELD DEFAULT
      upStatements.push(
        generator.generateAlterFieldDefault(
          fieldChange.table,
          fieldChange.field,
          fieldChange.newColumn.config.default,
          fieldChange.newColumn.config.defaultRaw,
        ),
      );
      generatedFieldChanges.push({ table: fieldChange.table, field: fieldChange.field });
    }
  }

  // Handle access comparison (only adding new access, not removing)
  const _currentAccessNames = new Set((access ?? []).map((a) => a.name));
  const lastAccessNames = new Set(lastAccess.map((a) => a.name));

  // Convert tables array to record for accessToSQL
  const tablesRecord = Object.fromEntries(tables.map((t) => [t.name, t]));

  // Add new access definitions
  for (const acc of access ?? []) {
    const accessName = acc.name;
    if (accessName && !lastAccessNames.has(accessName)) {
      // Handle both AccessConfig objects and legacy objects with toSQL()
      let sql: string | undefined;
      if (typeof (acc as any).toSQL === 'function') {
        // Legacy: object with toSQL method
        sql = (acc as any).toSQL();
      } else {
        // New: AccessConfig object
        sql = accessToSQL(acc, tablesRecord);
      }
      if (sql) {
        upStatements.push(sql);
      }
      if (accessName) {
        downStatements.push(generator.generateRemoveAccess(accessName));
      }
    }
  }

  // Handle event comparison (only adding new events, not removing)
  const lastEventKeys = new Set(lastEvents.map((e) => `${e.what}:${e.name}`));

  for (const evt of events ?? []) {
    const eventKey = `${evt.on}:${evt.name}`;
    if (evt.name && !lastEventKeys.has(eventKey)) {
      try {
        const sql = eventToSQL(evt);
        if (sql) upStatements.push(sql);
        downStatements.push(generator.generateRemoveEvent(evt.name, evt.on));
      } catch {
        // Skip invalid event configs
      }
    }
  }

  // Handle function comparison (only adding new functions, not removing)
  const lastFunctionNames = new Set(lastFunctions.map((f) => f.name));

  for (const fn of functions ?? []) {
    if (fn.name && !lastFunctionNames.has(fn.name)) {
      try {
        const sql = functionToSQL(fn);
        if (sql) upStatements.push(sql);
        downStatements.push(generator.generateRemoveFunction(fn.name));
      } catch {
        // Skip invalid function configs
      }
    }
  }

  // Handle analyzer removal (DOWN only) — must come after table/index removals
  const lastAnalyzerDownNames = new Set(lastAnalyzers.map((a) => a.name));

  for (const a of analyzers ?? []) {
    if (a.name && !lastAnalyzerDownNames.has(a.name)) {
      try {
        downStatements.push(generator.generateRemoveAnalyzer(a.name));
      } catch {
        // Skip invalid analyzer configs
      }
    }
  }

  // SKIP: Removed old event definitions

  // Print summary of changes (only showing what's being added)
  const filteredDiff = {
    added: diff.added,
    removed: { tables: diff.removed.tables, fields: diff.removed.fields, indexes: [] },
    changed: { tables: [], fields: generatedFieldChanges },
  };
  const nonTableChanges = getNonTableChanges(
    { access, events, functions, analyzers },
    { access: lastAccess, events: lastEvents, functions: lastFunctions, analyzers: lastAnalyzers },
  );
  printDiffSummary(filteredDiff, access, lastAccess, nonTableChanges);

  // Filter out empty strings before returning (e.g., from id field which returns empty)
  return {
    upStatements: upStatements.filter((s) => s.trim().length > 0),
    downStatements: downStatements.filter((s) => s.trim().length > 0),
  };
}

export async function generateLiveMigration(
  tables: TableDefinition[],
  driver: SurrealDriver,
  generator: SurrealQLGenerator,
  access?: AccessConfig[],
  events?: EventConfig[],
  functions?: FunctionConfig[],
  analyzers?: AnalyzerDefinition[],
): Promise<{ upStatements: string[]; downStatements: string[] }> {
  // Non-table change counters for summary
  const nonTableCounts = { added: 0, removed: 0 };

  // Get current live schema from database
  const tableNames = tables.map((t) => t.name);
  log('Fetching live schema for tables: %O', tableNames);
  const liveTables = await getLiveSchema(driver, tableNames);

  log('Live tables fetched: %O', liveTables);
  log('Provided tables: %O', tables);

  // Compare live schema with provided schema
  const differ = new SchemaDiffer();

  // Debug logging: show comparison details for each table
  log('=== Schema Comparison Debug ===');
  for (const table of tables) {
    const liveTable = liveTables.find((t) => t.name === table.name);
    log(
      'Table %s: inLiveSchema=%s, liveColumns=%d, schemaColumns=%d',
      table.name,
      !!liveTable,
      liveTable?.columns.length ?? 0,
      table.columns.length,
    );
  }
  log('================================');

  const diff = differ.diff(liveTables, tables);

  log('Schema diff result: %O', diff);

  // KEY FIX: Determine which tables truly DON'T exist in DB
  // A table "doesn't exist" in DB if it's either:
  // 1. Not returned by INFO FOR TABLE at all (tableInfo is undefined), OR
  // 2. Exists but is schemaless (columns: [] and config.schema: 'less')
  //
  // For tables that exist WITH columns (schemafull), only add new fields.
  // For tables that don't exist OR are schemaless, add full table definition.
  const _tableInfoMap = new Map(tableNames.map((name) => [name, false])); // false = not checked
  // Tables with NO columns in DB are either new (no schema) or schemaless
  const tablesWithNoColumns = new Set(
    liveTables.filter((t) => t.columns.length === 0).map((t) => t.name),
  );
  // Tables WITH columns in DB are existing schemafull tables
  const tablesWithColumns = new Set(
    liveTables.filter((t) => t.columns.length > 0).map((t) => t.name),
  );

  log('Tables with no columns in DB (new or schemaless): %O', Array.from(tablesWithNoColumns));
  log('Tables with columns in DB (existing): %O', Array.from(tablesWithColumns));

  // KEY FIX: Only generate SQL for NEW tables and NEW fields
  // NEVER include tables that already exist (even if they have field changes)
  // NEVER include fields that already exist (even if type is different)
  //
  // This is a safety-first approach: incremental migrations should only ADD,
  // never ALTER existing schema. Users can manually handle type/permission
  // changes or removals if needed.

  const upStatements: string[] = [];
  const downStatements: string[] = [];
  const newAnalyzerNames: string[] = [];

  // Handle analyzer definitions (UP) — must come before indexes that reference them
  if (analyzers && analyzers.length > 0) {
    let existingAnalyzerNames: string[] = [];
    try {
      const result = await driver.query('INFO FOR DB');
      const dbInfo = Array.isArray(result) ? result[0] : result;
      if (
        dbInfo &&
        typeof dbInfo === 'object' &&
        'analyzers' in (dbInfo as Record<string, unknown>)
      ) {
        const info = dbInfo as Record<string, unknown>;
        existingAnalyzerNames = Object.keys(info.analyzers as Record<string, unknown>);
      }
    } catch {
      // DB may not exist yet
    }

    const existingAnalyzerSet = new Set(existingAnalyzerNames);

    for (const a of analyzers ?? []) {
      if (a.name && !existingAnalyzerSet.has(a.name)) {
        newAnalyzerNames.push(a.name);
        nonTableCounts.added++;
        try {
          const sql = generator.generateAnalyzerDefinition(a);
          if (sql) upStatements.push(sql);
        } catch {
          // Skip invalid analyzer configs
        }
      }
    }
  }

  // KEY FIX: Determine what to include based on live schema state
  // 1. Tables NOT in live schema OR with NO columns (schemaless): include full table + all fields
  // 2. Tables WITH columns in live schema: only include NEW fields

  // Tables that either:
  // 1. Don't exist in live schema at all (new tables), OR
  // 2. Exist but with no columns (schemaless tables)
  // These need full table definitions
  const tablesInLiveSchema = new Set(liveTables.map((t) => t.name));
  const tablesNeedingFullDefinition = new Set([
    ...tablesWithNoColumns,
    ...tables.filter((t) => !tablesInLiveSchema.has(t.name)).map((t) => t.name),
  ]);

  // Get tables that need full definition (not in live schema with columns)
  // SchemaDiffer already filtered for diff.added.tables, but we need to add
  // tables that exist but have no columns
  const newTables = tables.filter((t) => tablesNeedingFullDefinition.has(t.name));

  // Add full table definition for new/schemaless tables
  for (const table of newTables) {
    upStatements.push(...generator.generateTableMigration(table, 'up'));
    downStatements.push(generator.generateRemoveTable(table.name));
  }

  // Add new fields: for tables already in live schema WITH columns (existing tables)
  // Skip tables that got full definition above
  const newFieldsForExistingTables = diff.added.fields.filter(
    (f) => !tablesNeedingFullDefinition.has(f.table),
  );
  for (const fieldChange of newFieldsForExistingTables) {
    const column: ColumnDefinition = {
      ...fieldChange.column,
      tableName: fieldChange.table,
    };
    upStatements.push(generator.generateFieldDefinition(column));
    downStatements.push(generator.generateRemoveField(fieldChange.table, fieldChange.column.name));
  }

  // Add new indexes: for tables already in live schema WITH columns
  const newIndexesForExistingTables = diff.added.indexes.filter(
    (i) => !tablesNeedingFullDefinition.has(i.table),
  );
  for (const indexChange of newIndexesForExistingTables) {
    upStatements.push(generator.generateIndexDefinition(indexChange.index, indexChange.table));
    downStatements.push(generator.generateRemoveIndex(indexChange.index.name, indexChange.table));
  }

  // Handle removed fields — check for existing data before generating REMOVE FIELD
  for (const removedField of diff.removed.fields) {
    // Skip if field is on a table that got full definition above
    if (tablesNeedingFullDefinition.has(removedField.table)) continue;

    try {
      // Check if any records have data in this field
      const result = await driver.query<{ cnt: number }>(
        `SELECT count() as cnt FROM ${removedField.table} WHERE ${removedField.field} IS NOT NONE LIMIT 1`,
      );
      const count = result[0]?.cnt ?? 0;
      if (count > 0) {
        log(
          'WARNING: Cannot remove field %s.%s — %d record(s) have data in this field. Remove or migrate data first.',
          removedField.table,
          removedField.field,
          count,
        );
      } else {
        log(
          'Removed field %s.%s — no data found, generating REMOVE FIELD',
          removedField.table,
          removedField.field,
        );
        upStatements.push(generator.generateRemoveField(removedField.table, removedField.field));
        // No down statement — can't restore removed field
      }
    } catch (error) {
      // Table may not exist yet or other transient error — skip removal
      log('Error checking removed field %s.%s: %O', removedField.table, removedField.field, error);
    }
  }

  // Handle removed tables — check for existing data before generating REMOVE TABLE
  for (const tableName of diff.removed.tables) {
    try {
      const result = await driver.query<{ cnt: number }>(
        `SELECT count() as cnt FROM ${tableName} LIMIT 1`,
      );
      const count = result[0]?.cnt ?? 0;
      if (count > 0) {
        log(
          'WARNING: Cannot remove table %s — %d record(s) exist. Remove or migrate data first.',
          tableName,
          count,
        );
      } else {
        log('Removed table %s — no data found, generating REMOVE TABLE', tableName);
        upStatements.push(generator.generateRemoveTable(tableName));
        // No down statement — can't restore removed table's full definition
      }
    } catch (error) {
      // Table may not exist yet or other transient error — skip removal
      log('Error checking removed table %s: %O', tableName, error);
    }
  }

  // Handle field changes on existing tables
  // Emits DEFINE FIELD (without IF NOT EXISTS) for type/optional/flexible/readonly changes
  // Emits ALTER FIELD DEFAULT for default-only changes (simpler SQL)
  const liveFieldChanges: Array<{ table: string; field: string }> = [];
  for (const fieldChange of diff.changed.fields) {
    // Skip if field is on a table that got full definition above
    if (tablesNeedingFullDefinition.has(fieldChange.table)) continue;

    const oldEffectiveDefault =
      fieldChange.oldColumn.config.defaultRaw ?? fieldChange.oldColumn.config.default;
    const newEffectiveDefault =
      fieldChange.newColumn.config.defaultRaw ?? fieldChange.newColumn.config.default;
    const typeChanged = fieldChange.oldColumn.config.type !== fieldChange.newColumn.config.type;
    const optionalChanged =
      fieldChange.oldColumn.config.optional !== fieldChange.newColumn.config.optional;
    const flexibleChanged =
      fieldChange.oldColumn.config.flexible !== fieldChange.newColumn.config.flexible;
    const readonlyChanged =
      fieldChange.oldColumn.config.readonly !== fieldChange.newColumn.config.readonly;

    if (typeChanged || optionalChanged || flexibleChanged || readonlyChanged) {
      // For structural changes, emit full DEFINE FIELD (without IF NOT EXISTS)
      // This updates the field definition in SurrealDB
      const newColumn: ColumnDefinition = {
        ...fieldChange.newColumn,
        tableName: fieldChange.table,
      };
      upStatements.push(generator.generateFieldRedefine(newColumn));
      liveFieldChanges.push({ table: fieldChange.table, field: fieldChange.field });
      // No down statement for field redefines (would need to know old definition)
    } else if (oldEffectiveDefault !== newEffectiveDefault) {
      // Default-only changes: simpler ALTER FIELD DEFAULT
      upStatements.push(
        generator.generateAlterFieldDefault(
          fieldChange.table,
          fieldChange.field,
          fieldChange.newColumn.config.default,
          fieldChange.newColumn.config.defaultRaw,
        ),
      );
      liveFieldChanges.push({ table: fieldChange.table, field: fieldChange.field });
    }
  }

  // SKIP: Changed tables - table type/permission changes on existing tables

  // Handle access comparison against live database
  if (access && access.length > 0) {
    const existingAccessNames = await introspectAccess(driver);
    const existingAccessSet = new Set(existingAccessNames);
    const tablesRecord = Object.fromEntries(tables.map((t) => [t.name, t]));

    for (const acc of access) {
      const accessName = acc.name;
      if (accessName && !existingAccessSet.has(accessName)) {
        nonTableCounts.added++;
        let sql: string | undefined;
        if (typeof (acc as any).toSQL === 'function') {
          sql = (acc as any).toSQL();
        } else if (acc.type) {
          sql = accessToSQL(acc, tablesRecord);
        }
        if (sql) {
          upStatements.push(sql);
        }
        downStatements.push(generator.generateRemoveAccess(accessName));
      }
    }
  }

  // Handle function comparison against live database
  if (functions && functions.length > 0) {
    let existingFunctionNames: string[] = [];
    try {
      const result = await driver.query('INFO FOR DB');
      const dbInfo = Array.isArray(result) ? result[0] : result;
      if (
        dbInfo &&
        typeof dbInfo === 'object' &&
        'functions' in (dbInfo as Record<string, unknown>)
      ) {
        const info = dbInfo as Record<string, unknown>;
        existingFunctionNames = Object.keys(info.functions as Record<string, unknown>);
      }
    } catch {
      // DB may not exist yet
    }

    const existingFunctionSet = new Set(existingFunctionNames);

    for (const fn of functions ?? []) {
      if (fn.name && !existingFunctionSet.has(fn.name)) {
        nonTableCounts.added++;
        try {
          const sql = functionToSQL(fn);
          if (sql) upStatements.push(sql);
          downStatements.push(generator.generateRemoveFunction(fn.name));
        } catch {
          // Skip invalid function configs
        }
      }
    }
  }

  // Handle event comparison against live database
  if (events && events.length > 0) {
    const existingEvents: Array<{ name: string; what: string }> = [];
    for (const evt of events) {
      if (!evt.on) continue;
      try {
        const result = await driver.query(`INFO FOR TABLE ${evt.on} STRUCTURE`);
        const infoResult = result as unknown as Array<{ events?: Array<{ name: string }> }>;
        if (infoResult?.[0]?.events) {
          for (const dbEvent of infoResult[0].events) {
            existingEvents.push({ name: dbEvent.name, what: evt.on });
          }
        }
      } catch {
        // Table may not exist yet - skip
      }
    }

    const existingEventKeys = new Set(existingEvents.map((e) => `${e.what}:${e.name}`));

    for (const evt of events ?? []) {
      const eventKey = `${evt.on}:${evt.name}`;
      if (evt.name && !existingEventKeys.has(eventKey)) {
        nonTableCounts.added++;
        try {
          const sql = eventToSQL(evt);
          if (sql) {
            upStatements.push(sql);
          }
          downStatements.push(generator.generateRemoveEvent(evt.name, evt.on));
        } catch {
          // Skip invalid event configs
        }
      }
    }
  }

  // Handle analyzer removal (DOWN only) — must come after table/index removals
  for (const name of newAnalyzerNames) {
    try {
      downStatements.push(generator.generateRemoveAnalyzer(name));
    } catch {
      // Skip invalid analyzer configs
    }
  }

  // Print summary of changes (only showing what's being added)
  const filteredDiff = {
    added: {
      tables: newTables,
      fields: newFieldsForExistingTables,
      indexes: newIndexesForExistingTables,
    },
    removed: { tables: diff.removed.tables, fields: diff.removed.fields, indexes: [] },
    changed: { tables: [], fields: liveFieldChanges },
  };
  printDiffSummary(filteredDiff, undefined, undefined, nonTableCounts);

  // Filter out empty strings before returning (e.g., from id field which returns empty)
  return {
    upStatements: upStatements.filter((s) => s.trim().length > 0),
    downStatements: downStatements.filter((s) => s.trim().length > 0),
  };
}

/**
 * Generate full migration for all tables
 */
export function generateFullMigration(
  tables: TableDefinition[],
  generator: SurrealQLGenerator,
  access?: AccessConfig[],
  events?: EventConfig[],
  functions?: FunctionConfig[],
  analyzers?: AnalyzerDefinition[],
): { upStatements: string[]; downStatements: string[] } {
  log('Generating full migration for all tables');

  const upStatements = generator.generateMigration(tables, 'up', analyzers);
  const downStatements: string[] = [];

  // DOWN: Remove indexes first (before tables), then tables
  for (const table of tables) {
    if (table.config.indexes) {
      for (const index of table.config.indexes) {
        downStatements.push(generator.generateRemoveIndex(index.name, table.name));
      }
    }
  }
  for (const table of tables) {
    downStatements.push(...generator.generateTableMigration(table, 'down'));
  }

  // DOWN: Remove analyzers after tables (DEFINE ANALYZER must precede DEFINE INDEX,
  // so REMOVE ANALYZER must come after tables)
  if (analyzers) {
    for (const analyzer of analyzers) {
      downStatements.push(generator.generateRemoveAnalyzer(analyzer.name));
    }
  }

  for (const table of tables) {
    console.log(`  - ${table.name}: ${table.columns.length} columns`);
  }

  // Generate ACCESS statements for full migration
  // Convert tables array to record for accessToSQL
  const tablesRecord = Object.fromEntries(tables.map((t) => [t.name, t]));
  for (const acc of access ?? []) {
    const accessName = acc.name;
    if (!accessName) continue;

    // Handle both AccessConfig objects and legacy objects with toSQL()
    let sql: string | undefined;
    if (typeof (acc as any).toSQL === 'function') {
      // Legacy: object with toSQL method
      sql = (acc as any).toSQL();
    } else if (acc.type) {
      // New: AccessConfig object with type
      console.log('acc is AccessConfig with type %s, generating SQL', acc, tablesRecord);
      sql = accessToSQL(acc, tablesRecord);
    }
    // Skip access objects without toSQL() or valid type

    if (sql) {
      upStatements.push(sql);
    }
    if (accessName) {
      downStatements.push(generator.generateRemoveAccess(accessName));
    }
  }

  // Generate EVENT statements for full migration
  for (const evt of events ?? []) {
    const eventName = evt.name;
    if (!eventName) continue;
    if (!evt.on || !evt.when || !evt.then || evt.then.length === 0) continue;

    try {
      const sql = eventToSQL(evt);
      if (sql) {
        upStatements.push(sql);
      }
      downStatements.push(generator.generateRemoveEvent(eventName, evt.on));
    } catch {
      // Skip invalid event configs
    }
  }

  // Generate FUNCTION statements for full migration
  for (const fn of functions ?? []) {
    const fnName = fn.name;
    if (!fnName) continue;
    if (!fn.body) continue;

    try {
      const sql = functionToSQL(fn);
      if (sql) {
        upStatements.push(sql);
      }
      downStatements.push(generator.generateRemoveFunction(fnName));
    } catch {
      // Skip invalid function configs
    }
  }

  if (access && access.length > 0) {
    console.log(`Generating ${access.length} access definitions`);
    for (const acc of access) {
      const name = acc.name ?? 'unknown';
      console.log(`  - ACCESS ${name}`);
    }
  }

  if (events && events.length > 0) {
    console.log(`Generating ${events.length} event definitions`);
    for (const evt of events) {
      console.log(`  - EVENT ${evt.on}.${evt.name}`);
    }
  }

  if (functions && functions.length > 0) {
    console.log(`Generating ${functions.length} function definitions`);
    for (const fn of functions) {
      console.log(`  - FUNCTION ${fn.name}`);
    }
  }

  if (analyzers && analyzers.length > 0) {
    console.log(`Generating ${analyzers.length} analyzer definitions`);
    for (const a of analyzers) {
      console.log(`  - ANALYZER ${a.name}`);
    }
  }

  return { upStatements, downStatements };
}

/**
 * Print a summary of schema changes
 */
export interface NonTableChangeCounts {
  added: number;
  removed: number;
}

export function getNonTableChanges(
  current: {
    access?: AccessConfig[];
    events?: EventConfig[];
    functions?: FunctionConfig[];
    analyzers?: AnalyzerDefinition[];
  },
  last: {
    access: SerializedAccess[];
    events: SerializedEvent[];
    functions: SerializedFunction[];
    analyzers: SerializedAnalyzer[];
  },
): NonTableChangeCounts {
  let added = 0;
  let removed = 0;

  const lastAccessNames = new Set(last.access.map((a) => a.name));
  const currentAccessNames = new Set((current.access ?? []).map((a) => a.name));
  added += current.access?.filter((a) => a.name && !lastAccessNames.has(a.name)).length ?? 0;
  removed += last.access.filter((a) => !currentAccessNames.has(a.name)).length;

  const lastEventKeys = new Set(last.events.map((e) => `${e.what}:${e.name}`));
  const currentEventKeys = new Set((current.events ?? []).map((e) => `${e.on}:${e.name}`));
  added +=
    current.events?.filter((e) => e.name && !lastEventKeys.has(`${e.on}:${e.name}`)).length ?? 0;
  removed += last.events.filter((e) => !currentEventKeys.has(`${e.what}:${e.name}`)).length;

  const lastFunctionNames = new Set(last.functions.map((f) => f.name));
  const currentFunctionNames = new Set((current.functions ?? []).map((f) => f.name));
  added += current.functions?.filter((f) => f.name && !lastFunctionNames.has(f.name)).length ?? 0;
  removed += last.functions.filter((f) => !currentFunctionNames.has(f.name)).length;

  const lastAnalyzerNames = new Set(last.analyzers.map((a) => a.name));
  const currentAnalyzerNames = new Set((current.analyzers ?? []).map((a) => a.name));
  added += current.analyzers?.filter((a) => a.name && !lastAnalyzerNames.has(a.name)).length ?? 0;
  removed += last.analyzers.filter((a) => !currentAnalyzerNames.has(a.name)).length;

  return { added, removed };
}

export function printDiffSummary(
  diff: {
    added: {
      tables: TableDefinition[];
      fields: Array<{ table: string; column: ColumnDefinition }>;
      indexes: Array<{ table: string; index: { name: string } }>;
    };
    removed: {
      tables: string[];
      fields: Array<{ table: string; field: string }>;
      indexes: Array<{ table: string; name: string }>;
    };
    changed: { tables: Array<{ name: string }>; fields: Array<{ table: string; field: string }> };
  },
  _currentAccess?: any[],
  _lastAccess?: { name: string }[],
  nonTable?: NonTableChangeCounts,
): void {
  const nonTableAdded = nonTable?.added ?? 0;
  const nonTableRemoved = nonTable?.removed ?? 0;
  const totalChanges =
    diff.added.tables.length +
    diff.added.fields.length +
    diff.added.indexes.length +
    diff.removed.tables.length +
    diff.removed.fields.length +
    diff.removed.indexes.length +
    diff.changed.tables.length +
    diff.changed.fields.length +
    nonTableAdded +
    nonTableRemoved;

  if (totalChanges === 0) {
    console.log('No changes detected.');
    return;
  }

  console.log('\nMigration Summary:');
  console.log('==================');

  if (diff.added.tables.length > 0) {
    console.log(`+ Tables: ${diff.added.tables.map((t) => t.name).join(', ')}`);
  }
  if (diff.added.fields.length > 0) {
    console.log(
      `+ Fields: ${diff.added.fields.map((f) => `${f.table}.${f.column.name}`).join(', ')}`,
    );
  }
  if (diff.added.indexes.length > 0) {
    console.log(
      `+ Indexes: ${diff.added.indexes.map((i) => `${i.table}.${i.index.name}`).join(', ')}`,
    );
  }
  if (diff.removed.tables.length > 0) {
    console.log(`- Tables: ${diff.removed.tables.join(', ')}`);
  }
  if (diff.removed.fields.length > 0) {
    console.log(`- Fields: ${diff.removed.fields.map((f) => `${f.table}.${f.field}`).join(', ')}`);
  }
  if (diff.removed.indexes.length > 0) {
    console.log(`- Indexes: ${diff.removed.indexes.map((i) => `${i.table}.${i.name}`).join(', ')}`);
  }
  if (diff.changed.tables.length > 0) {
    console.log(`~ Changed tables: ${diff.changed.tables.map((t) => t.name).join(', ')}`);
  }
  if (diff.changed.fields.length > 0) {
    console.log(
      `~ Changed fields: ${diff.changed.fields.map((f) => `${f.table}.${f.field}`).join(', ')}`,
    );
  }
  if (nonTableAdded > 0) {
    console.log(`+ Analyzers/Access/Events/Functions: ${nonTableAdded} new`);
  }
  if (nonTableRemoved > 0) {
    console.log(`- Analyzers/Access/Events/Functions: ${nonTableRemoved} removed`);
  }
}

/**
 * Detect section category for a SurrealQL statement
 */
export function detectSection(stmt: string): string {
  const upper = stmt.trim().toUpperCase();
  if (
    upper.startsWith('DEFINE TABLE') ||
    upper.startsWith('REMOVE TABLE') ||
    upper.startsWith('DEFINE FIELD') ||
    upper.startsWith('REMOVE FIELD') ||
    upper.startsWith('DEFINE INDEX') ||
    upper.startsWith('REMOVE INDEX')
  ) {
    return 'Tables';
  }
  if (upper.startsWith('DEFINE ACCESS') || upper.startsWith('REMOVE ACCESS')) {
    return 'Access';
  }
  if (upper.startsWith('DEFINE PARAM') || upper.startsWith('REMOVE PARAM')) {
    return 'Params';
  }
  if (upper.startsWith('DEFINE VIEW') || upper.startsWith('REMOVE VIEW')) {
    return 'Views';
  }
  if (upper.startsWith('DEFINE FUNCTION') || upper.startsWith('REMOVE FUNCTION')) {
    return 'Functions';
  }
  if (upper.startsWith('DEFINE EVENT') || upper.startsWith('REMOVE EVENT')) {
    return 'Events';
  }
  if (upper.startsWith('DEFINE ANALYZER') || upper.startsWith('REMOVE ANALYZER')) {
    return 'Analyzers';
  }
  return 'Other';
}

/**
 * Insert section separator comments between statement categories
 */
export function addSectionSeparators(statements: string[]): string[] {
  const result: string[] = [];
  let currentSection = '';

  for (const stmt of statements) {
    const section = detectSection(stmt);
    if (section !== currentSection) {
      result.push(`-- ---- ${section} ----`);
      currentSection = section;
    }
    result.push(stmt);
  }

  return result;
}

/**
 * Generate .surql migration file content
 *
 * Format:
 * -- Migration: create_user
 * -- Version: 001
 *
 * -- UP
 * DEFINE TABLE user SCHEMAFULL;
 * DEFINE FIELD id ON user TYPE string;
 * ...
 *
 * -- DOWN
 * DROP TABLE user;
 */
export function generateMigrationFile(
  version: string,
  name: string,
  migration: { up: string[]; down: string[] },
): string {
  // Filter out empty statements before joining
  const filteredUp = migration.up.filter((s) => s.trim() !== '');
  const filteredDown = migration.down.filter((s) => s.trim() !== '');

  // Add section separators between statement categories
  const sectionedUp = addSectionSeparators(filteredUp);
  const sectionedDown = addSectionSeparators(filteredDown);

  // Add semicolons between statements for proper parsing
  // Separator comments (-- ---- Section ----) are left as-is
  const upSection = sectionedUp.map((s) => (s.startsWith('--') ? s : `${s};`)).join('\n');
  const downSection = sectionedDown.map((s) => (s.startsWith('--') ? s : `${s};`)).join('\n');

  return `-- Migration: ${name}
-- Version: ${version}

-- UP
${upSection}

-- DOWN
${downSection}
`;
}

export interface SchemaFilesResult {
  tables: TableDefinition[];
  access?: AccessConfig[];
  functions?: FunctionConfig[];
  analyzers?: AnalyzerDefinition[];
}

/**
 * Load schema files from directory or file
 *
 * If schemaPath is a file (ends with .ts), imports it directly.
 * If schemaPath is a directory, recursively finds .ts files,
 * dynamically imports them, and extracts table definitions.
 */
export async function loadSchemaFiles(
  schemaPath: string,
  pattern: string = '**/*.ts',
): Promise<SchemaFilesResult> {
  // Early exit: fail fast if no schema path provided
  if (!schemaPath) {
    throw new Error('Schema path is required');
  }

  // Validate directory exists for non-file paths
  if (!schemaPath.endsWith('.ts')) {
    try {
      const pathStat = await stat(schemaPath);
      if (!pathStat.isDirectory()) {
        throw new Error(`Schema path is not a directory: ${schemaPath}`);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Failed to scan schema directory: ${schemaPath} does not exist`);
      }
      throw err;
    }
  }

  const tables: TableDefinition[] = [];
  const access: any[] = [];
  const functions: FunctionConfig[] = [];
  const analyzers: AnalyzerDefinition[] = [];

  // Parse at boundary: check if path is a file or directory

  if (schemaPath.endsWith('.ts')) {
    // File path: import directly
    const result = await loadSchemaFromFile(schemaPath);
    return {
      tables: result.tables,
      access: result.access,
      functions: result.functions,
      analyzers: result.analyzers,
    };
  }

  // Directory path: scan for matching files
  try {
    const files = await findMatchingFiles(schemaPath, pattern);

    // Early exit: no files found
    if (files.length === 0) {
      console.log(`No schema files found in ${schemaPath} matching ${pattern}`);
      return { tables: [], functions: [] };
    }

    // Process each schema file
    for (const file of files) {
      try {
        // Dynamically import the schema file
        // Use file:// URL for proper ESM resolution with TypeScript files
        const modulePath = path.join(schemaPath, file);
        const resolvedPath = path.resolve(modulePath);

        // Try importing with file:// URL - works with tsx/ts-node loaders
        // or Node.js experimental loader support
        let module: Record<string, unknown>;
        try {
          module = await import(`file://${resolvedPath}`);
        } catch {
          // Fallback: try importing directly (works if already compiled)
          module = await import(modulePath);
        }

        // Extract table definitions from the module
        // Look for common export patterns
        const tablesOrExports = [module.default, module.tables, module.schema];
        const accessExports = [module.access];
        const functionsExports = [module.functions];
        const analyzersExports = [module.analyzers];

        // Also check for OrmSchema-like exports (has .tableDefinitions as Record)
        // Check 'ormSchema', 'schema', and 'default' exports for OrmSchema instances
        const ormSchemaKeys = ['ormSchema', 'schema', 'default'] as const;
        for (const key of ormSchemaKeys) {
          const val = module[key];
          if (!val || Array.isArray(val) || typeof val !== 'object') continue;
          const obj = val as Record<string, unknown>;
          // Detect OrmSchema by its tableDefinitions Record property
          if (
            obj.tableDefinitions &&
            typeof obj.tableDefinitions === 'object' &&
            !Array.isArray(obj.tableDefinitions)
          ) {
            tablesOrExports.push(obj.tableDefinitions);
            if (Array.isArray(obj.access)) {
              accessExports.push(obj.access);
            }
            if (Array.isArray(obj.functions)) {
              functionsExports.push(obj.functions);
            }
            if (Array.isArray(obj.analyzers)) {
              analyzersExports.push(obj.analyzers);
            }
          }
        }

        // Also check for tableDefinitions export (array of table definitions)
        if (Array.isArray(module.tableDefinitions)) {
          tablesOrExports.push(...module.tableDefinitions);
        }

        for (const exportValue of tablesOrExports) {
          if (!exportValue) continue;

          // Single table definition
          if (isTableDefinition(exportValue)) {
            const normalized = normalizeTableDefinition(exportValue);
            if (normalized) {
              tables.push(normalized);
            }
          }
          // Array of table definitions
          else if (Array.isArray(exportValue)) {
            for (const item of exportValue) {
              if (isTableDefinition(item)) {
                const normalized = normalizeTableDefinition(item);
                if (normalized) {
                  tables.push(normalized);
                }
              }
            }
          }
          // Object with table definitions as properties
          else if (typeof exportValue === 'object') {
            for (const value of Object.values(exportValue)) {
              if (isTableDefinition(value)) {
                const normalized = normalizeTableDefinition(value);
                if (normalized) {
                  tables.push(normalized);
                }
              }
            }
          }
        }

        // Extract explicit access array exports
        for (const exportValue of accessExports) {
          if (!exportValue) continue;

          // Array of ACCESS definitions (check FIRST - arrays are objects too)
          if (Array.isArray(exportValue)) {
            for (const item of exportValue) {
              if (item && typeof item === 'object') {
                const hasToSQL = 'toSQL' in item;
                const hasAccessShape = 'name' in item && 'type' in item;
                if (hasToSQL || hasAccessShape) {
                  if (!access.find((a: any) => a.name === item.name)) {
                    access.push(item);
                  }
                }
              }
            }
          }
          // Single ACCESS definition (either with toSQL method or AccessConfig shape)
          else if (typeof exportValue === 'object' && exportValue !== null) {
            const obj = exportValue as Record<string, unknown>;
            const hasToSQL = 'toSQL' in obj;
            const hasAccessShape = 'name' in obj && 'type' in obj;
            if (hasToSQL || hasAccessShape) {
              const name = obj.name as string | undefined;
              if (name && !access.find((a: any) => a.name === name)) {
                access.push(exportValue);
              }
            }
          }
        }

        // Extract explicit functions array exports
        for (const exportValue of functionsExports) {
          if (!exportValue) continue;

          if (Array.isArray(exportValue)) {
            for (const item of exportValue) {
              if (item && typeof item === 'object') {
                const hasFunctionShape = 'name' in item && 'body' in item;
                if (hasFunctionShape) {
                  const fnItem = item as FunctionConfig;
                  if (!functions.find((f) => f.name === fnItem.name)) {
                    functions.push(fnItem);
                  }
                }
              }
            }
          } else if (typeof exportValue === 'object' && exportValue !== null) {
            const obj = exportValue as Record<string, unknown>;
            const hasFunctionShape = 'name' in obj && 'body' in obj;
            if (hasFunctionShape) {
              const fnObj = obj as unknown as FunctionConfig;
              if (!functions.find((f) => f.name === fnObj.name)) {
                functions.push(fnObj);
              }
            }
          }
        }

        // Extract explicit analyzers array exports
        for (const exportValue of analyzersExports) {
          if (!exportValue) continue;

          if (Array.isArray(exportValue)) {
            for (const item of exportValue) {
              if (item && typeof item === 'object') {
                const hasAnalyzerShape = 'name' in item;
                if (hasAnalyzerShape) {
                  const aItem = item as AnalyzerDefinition;
                  if (!analyzers.find((a) => a.name === aItem.name)) {
                    analyzers.push(aItem);
                  }
                }
              }
            }
          } else if (typeof exportValue === 'object' && exportValue !== null) {
            const obj = exportValue as Record<string, unknown>;
            const hasAnalyzerShape = 'name' in obj;
            if (hasAnalyzerShape) {
              const aObj = obj as unknown as AnalyzerDefinition;
              if (!analyzers.find((a) => a.name === aObj.name)) {
                analyzers.push(aObj);
              }
            }
          }
        }
      } catch (importError) {
        console.warn(`Failed to import schema file ${file}:`, importError);
      }
    }
  } catch (scanError) {
    // Fail loud for directory scan errors
    throw new Error(`Failed to scan schema directory ${schemaPath}: ${String(scanError)}`);
  }

  return { tables, access, functions, analyzers };
}

/**
 * Load schema from a single file path
 * Extracts table definitions from the module's exports
 */
export async function loadSchemaFromFile(filePath: string): Promise<SchemaFilesResult> {
  const tables: TableDefinition[] = [];
  const access: any[] = [];
  const functions: FunctionConfig[] = [];
  const analyzers: AnalyzerDefinition[] = [];

  try {
    // Resolve absolute path for dynamic import
    const absolutePath = path.resolve(filePath);
    const module = await import(absolutePath);

    // Extract table definitions from the module
    // Look for common export patterns
    const tablesOrExports = [module.default, module.tables, module.schema];
    const accessExports = [module.access];
    const functionsExports = [module.functions];
    const analyzersExports = [module.analyzers];

    // Also check for OrmSchema-like exports (has .tableDefinitions as Record)
    // Check 'ormSchema', 'schema', and 'default' exports for OrmSchema instances
    const ormSchemaKeys = ['ormSchema', 'schema', 'default'] as const;
    for (const key of ormSchemaKeys) {
      const val = module[key];
      if (!val || Array.isArray(val) || typeof val !== 'object') continue;
      const obj = val as Record<string, unknown>;
      // Detect OrmSchema by its tableDefinitions Record property
      if (
        obj.tableDefinitions &&
        typeof obj.tableDefinitions === 'object' &&
        !Array.isArray(obj.tableDefinitions)
      ) {
        tablesOrExports.push(obj.tableDefinitions);
        if (Array.isArray(obj.access)) {
          accessExports.push(obj.access);
        }
        if (Array.isArray(obj.functions)) {
          functionsExports.push(obj.functions);
        }
        if (Array.isArray(obj.analyzers)) {
          analyzersExports.push(obj.analyzers);
        }
      }
    }

    // Also check for tableDefinitions export (array of table definitions)
    if (Array.isArray(module.tableDefinitions)) {
      tablesOrExports.push(...module.tableDefinitions);
    }

    for (const exportValue of tablesOrExports) {
      if (!exportValue) continue;

      // Single table definition
      if (isTableDefinition(exportValue)) {
        const normalized = normalizeTableDefinition(exportValue);
        if (normalized) {
          tables.push(normalized);
        }
      }
      // Array of table definitions
      else if (Array.isArray(exportValue)) {
        for (const item of exportValue) {
          if (isTableDefinition(item)) {
            const normalized = normalizeTableDefinition(item);
            if (normalized) {
              tables.push(normalized);
            }
          }
        }
      }
      // Object with table definitions as properties
      else if (typeof exportValue === 'object') {
        for (const value of Object.values(exportValue)) {
          if (isTableDefinition(value)) {
            const normalized = normalizeTableDefinition(value);
            if (normalized) {
              tables.push(normalized);
            }
          }
        }
      }
    }

    // Extract explicit access array exports
    for (const exportValue of accessExports) {
      if (!exportValue) continue;

      // Array of ACCESS definitions (check FIRST - arrays are objects too)
      if (Array.isArray(exportValue)) {
        for (const item of exportValue) {
          if (item && typeof item === 'object') {
            const hasToSQL = 'toSQL' in item;
            const hasAccessShape = 'name' in item && 'type' in item;
            if (hasToSQL || hasAccessShape) {
              if (!access.find((a: any) => a.name === item.name)) {
                access.push(item);
              }
            }
          }
        }
      }
      // Single ACCESS definition (either with toSQL method or AccessConfig shape)
      else if (typeof exportValue === 'object') {
        const hasToSQL = 'toSQL' in exportValue;
        const hasAccessShape = 'name' in exportValue && 'type' in exportValue;
        if (hasToSQL || hasAccessShape) {
          if (!access.find((a: any) => a.name === exportValue.name)) {
            access.push(exportValue);
          }
        }
      }
    }

    // Extract explicit functions array exports
    for (const exportValue of functionsExports) {
      if (!exportValue) continue;

      if (Array.isArray(exportValue)) {
        for (const item of exportValue) {
          if (item && typeof item === 'object') {
            const hasFunctionShape = 'name' in item && 'body' in item;
            if (hasFunctionShape) {
              const fnItem = item as FunctionConfig;
              if (!functions.find((f) => f.name === fnItem.name)) {
                functions.push(fnItem);
              }
            }
          }
        }
      } else if (typeof exportValue === 'object' && exportValue !== null) {
        const obj = exportValue as Record<string, unknown>;
        const hasFunctionShape = 'name' in obj && 'body' in obj;
        if (hasFunctionShape) {
          const fnObj = obj as unknown as FunctionConfig;
          if (!functions.find((f) => f.name === fnObj.name)) {
            functions.push(fnObj);
          }
        }
      }
    }

    // Extract explicit analyzers array exports
    for (const exportValue of analyzersExports) {
      if (!exportValue) continue;

      if (Array.isArray(exportValue)) {
        for (const item of exportValue) {
          if (item && typeof item === 'object') {
            const hasAnalyzerShape = 'name' in item;
            if (hasAnalyzerShape) {
              const aItem = item as AnalyzerDefinition;
              if (!analyzers.find((a) => a.name === aItem.name)) {
                analyzers.push(aItem);
              }
            }
          }
        }
      } else if (typeof exportValue === 'object' && exportValue !== null) {
        const obj = exportValue as Record<string, unknown>;
        const hasAnalyzerShape = 'name' in obj;
        if (hasAnalyzerShape) {
          const aObj = obj as unknown as AnalyzerDefinition;
          if (!analyzers.find((a) => a.name === aObj.name)) {
            analyzers.push(aObj);
          }
        }
      }
    }
  } catch (importError) {
    throw new Error(`Failed to import schema file ${filePath}: ${String(importError)}`);
  }

  return { tables, access, functions, analyzers };
}

/**
 * Find files matching a glob-like pattern recursively
 * Supports: patterns like **\/*.ts (recursive) or *.ts (current dir only)
 */
export async function findMatchingFiles(dir: string, pattern: string): Promise<string[]> {
  const results: string[] = [];
  const isRecursive = pattern.startsWith('**/');
  const searchPattern = isRecursive ? pattern.slice(3) : pattern;

  async function scan(currentDir: string, depth: number): Promise<void> {
    // Limit recursion depth to prevent infinite loops
    if (depth > 10) return;

    try {
      const entries = await readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(dir, fullPath);

        if (entry.isDirectory() && isRecursive) {
          await scan(fullPath, depth + 1);
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          // Check if matches pattern
          const fileName = entry.name;

          if (isRecursive) {
            // For recursive patterns like **/*.ts, any .ts file matches
            results.push(relativePath);
          } else {
            // For non-recursive patterns like *.ts, match against the pattern prefix
            // e.g., "*.ts" matches "schema.ts", "demo.ts", etc.
            const patternBase = searchPattern.replace('*', '');
            if (fileName.endsWith(patternBase)) {
              results.push(relativePath);
            }
          }
        }
      }
    } catch {
      // Skip directories that can't be read
    }
  }

  await scan(dir, 0);
  return results;
}

/**
 * Type guard to check if value is a TableDefinition
 *
 * Note: TableDefinition can be either:
 * 1. Plain object with name/columns/config (from defineTable/defineRelationTable)
 * 2. SurrealTableInstance (proxy) with $name/$columns properties
 *
 * The type guard needs to handle both cases and normalize the table name.
 */
export function isTableDefinition(value: unknown): value is TableDefinition {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Get name - could be in 'name' property (plain object) or '$name' property (SurrealTableInstance)
  const name = typeof obj.name === 'string' ? obj.name : obj.$name;
  const columns = obj.columns as unknown[] | undefined;
  const config = obj.config as Record<string, unknown> | undefined;

  // Check for SurrealTableInstance (has $name and $columns)
  const isSurrealTable = typeof obj.$name === 'string' && typeof obj.$columns === 'object';

  // Must have name (either direct or via $name), columns array, and config object
  const isValid = typeof name === 'string' && Array.isArray(columns) && typeof config === 'object';

  return isSurrealTable || isValid;
}

/**
 * Convert a SurrealTableInstance to a plain TableDefinition
 * This extracts the real name from $name and normalizes the structure
 */
export function normalizeTableDefinition(table: unknown): TableDefinition | null {
  if (!table || typeof table !== 'object') {
    return null;
  }

  const obj = table as Record<string, unknown>;

  // Get name from name property (actual name) or $name (SurrealTableInstance fallback)
  // Note: $name returns alias for proxy-wrapped tables, so prefer name
  const name = typeof obj.name === 'string' ? obj.name : obj.$name;
  let columns = obj.columns as ColumnDefinition[] | undefined;

  // Fallback: if columns is not an array, try converting $columns Record to array
  if (!Array.isArray(columns) && obj.$columns && typeof obj.$columns === 'object') {
    columns = Object.values(obj.$columns as Record<string, ColumnDefinition>);
  }
  const rawConfig = obj.config as TableDefinition['config'] | undefined;

  // Must have name, columns, and config
  if (typeof name !== 'string' || !Array.isArray(columns) || typeof rawConfig !== 'object') {
    return null;
  }

  // Normalize config with defaults to match snapshot restore behavior
  // This ensures schema from code matches schema from snapshot
  const config: TableDefinition['config'] = {
    schema: rawConfig.schema ?? 'full',
    type: rawConfig.type ?? 'normal',
    in: rawConfig.in,
    out: rawConfig.out,
    permissions: rawConfig.permissions,
    indexes: rawConfig.indexes,
    changefeed: rawConfig.changefeed,
  };

  return {
    name,
    columns,
    config,
  };
}
