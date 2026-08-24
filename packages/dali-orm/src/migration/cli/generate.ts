import * as fs from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { createDebug as debug } from 'obug';
import { escapeIdent } from '../../core/surql.ts';
import type { SurrealDriver } from '../../sdk/driver/types.js';
import type {
  ColumnConfig,
  ColumnDefinition,
} from '../../sdk/schema/column/types.js';
import type {
  AccessConfig,
  EventConfig,
  FunctionConfig,
} from '../../sdk/schema.js';
import { accessToSQL, eventToSQL, functionToSQL } from '../../sdk/schema.js';
import type {
  AnalyzerDefinition,
  IndexDefinition,
  TableDefinition,
} from '../../sdk/table.js';
import { SchemaDiffer } from '../core/diff.js';
import { serializeColumnPermissions } from '../core/format-utils.js';
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
import {
  addSectionSeparators,
  getNonTableChanges,
  printDiffSummary,
} from './diff-summary.js';

export {
  normalizeSql,
  serializeColumnPermissions,
} from '../core/format-utils.js';
export {
  addSectionSeparators,
  detectSection,
  getNonTableChanges,
  type NonTableChangeCounts,
  printDiffSummary,
} from './diff-summary.js';
export {
  findMatchingFiles,
  isTableDefinition,
  loadSchemaFiles,
  loadSchemaFromFile,
  normalizeTableDefinition,
  type SchemaFilesResult,
} from './schema-loader.js';

const log = debug('dali-orm:kit:generate');

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
async function findCoLocatedSnapshot(
  outputDir: string,
): Promise<CoLocatedSnapshot | undefined> {
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
        console.log(
          `Found co-located snapshot from migration: ${dir} (${tables.length} tables)`,
        );
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
        const isRequired =
          !col.readonly && !isOptionType && surrealTable.schema === 'full';

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
  const migrationDir = path.join(
    options.outputDir!,
    `${timestamp}_${safeName}`,
  );
  const migrationFilePath = path.join(migrationDir, 'migration.surql');
  const snapshotFilePath = path.join(migrationDir, 'snapshot.json');

  const generator = new SurrealQLGenerator();

  let upStatements: string[];

  console.log('Generating migration: %s', options);

  // Determine which comparison strategy to use
  // Priority: fullMigration > snapshotDir > co-located snapshot > driver > full
  if (options.fullMigration) {
    // Force full migration generation
    log('Generating full migration (fullMigration=true)');
    ({ upStatements } = generateFullMigration(
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
    ({ upStatements } = await generateSnapshotMigration(
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
      log(
        'Using co-located snapshot for comparison (from migration directory)',
      );
      ({ upStatements } = await generateSnapshotMigration(
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
      ({ upStatements } = await generateLiveMigration(
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
      ({ upStatements } = generateFullMigration(
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
        console.log(
          'Migration already exists with same content (hash match), skipping:',
          entry,
        );
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
  await fs.writeFile(
    snapshotFilePath,
    JSON.stringify(snapshot, null, 2),
    'utf-8',
  );

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
): Promise<{ upStatements: string[] }> {
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
      console.log(
        `Loaded snapshot: ${lastSnapshot.name} (${lastSnapshot.version})`,
      );
      console.log(
        `Comparing against ${baseTables.length} tables from snapshot`,
      );
    } else {
      // No snapshot exists - compare against empty schema
      // This means ALL tables will be generated as new
      baseTables = [];
      console.log(
        'No snapshot found - generating initial migration for all tables',
      );
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
    upStatements.push(...generator.generateTableMigration(table));
  }

  // Add new fields to existing tables (fields that don't exist in DB)
  for (const fieldChange of diff.added.fields) {
    const column: ColumnDefinition = {
      ...fieldChange.column,
      tableName: fieldChange.table,
    };
    upStatements.push(generator.generateFieldDefinition(column));
  }

  // Add new indexes
  for (const indexChange of diff.added.indexes) {
    upStatements.push(
      generator.generateIndexDefinition(indexChange.index, indexChange.table),
    );
  }

  // Handle removed fields — emit REMOVE FIELD for fields no longer in schema
  for (const removedField of diff.removed.fields) {
    log(
      'Removed field detected: %s.%s',
      removedField.table,
      removedField.field,
    );
    // Note: snapshot-based comparison can't check data existence in DB.
    // Field removal is assumed safe — user explicitly defined the schema without this field.
    // If data exists, SurrealDB REMOVE FIELD removes the definition but NOT data values.
    // Data remains in records but field becomes unconstrained.
    upStatements.push(
      generator.generateRemoveField(removedField.table, removedField.field),
    );
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
      fieldChange.oldColumn.config.defaultRaw ??
      fieldChange.oldColumn.config.default;
    const newEffectiveDefault =
      fieldChange.newColumn.config.defaultRaw ??
      fieldChange.newColumn.config.default;
    const typeChanged =
      fieldChange.oldColumn.config.type !== fieldChange.newColumn.config.type;
    const optionalChanged =
      fieldChange.oldColumn.config.optional !==
      fieldChange.newColumn.config.optional;
    const flexibleChanged =
      fieldChange.oldColumn.config.flexible !==
      fieldChange.newColumn.config.flexible;
    const readonlyChanged =
      fieldChange.oldColumn.config.readonly !==
      fieldChange.newColumn.config.readonly;

    if (typeChanged || optionalChanged || flexibleChanged || readonlyChanged) {
      // For structural changes, emit full DEFINE FIELD (without IF NOT EXISTS)
      // This updates the field definition in SurrealDB
      const newColumn: ColumnDefinition = {
        ...fieldChange.newColumn,
        tableName: fieldChange.table,
      };
      upStatements.push(generator.generateFieldRedefine(newColumn));
      generatedFieldChanges.push({
        table: fieldChange.table,
        field: fieldChange.field,
      });
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
      generatedFieldChanges.push({
        table: fieldChange.table,
        field: fieldChange.field,
      });
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
      } catch {
        // Skip invalid function configs
      }
    }
  }

  // SKIP: Removed old event definitions

  // Print summary of changes (only showing what's being added)
  const filteredDiff = {
    added: diff.added,
    removed: {
      tables: diff.removed.tables,
      fields: diff.removed.fields,
      indexes: [],
    },
    changed: { tables: [], fields: generatedFieldChanges },
  };
  const nonTableChanges = getNonTableChanges(
    { access, events, functions, analyzers },
    {
      access: lastAccess,
      events: lastEvents,
      functions: lastFunctions,
      analyzers: lastAnalyzers,
    },
  );
  printDiffSummary(filteredDiff, access, lastAccess, nonTableChanges);

  // Filter out empty strings before returning (e.g., from id field which returns empty)
  return {
    upStatements: upStatements.filter((s) => s.trim().length > 0),
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
): Promise<{ upStatements: string[] }> {
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

  log(
    'Tables with no columns in DB (new or schemaless): %O',
    Array.from(tablesWithNoColumns),
  );
  log(
    'Tables with columns in DB (existing): %O',
    Array.from(tablesWithColumns),
  );

  // KEY FIX: Only generate SQL for NEW tables and NEW fields
  // NEVER include tables that already exist (even if they have field changes)
  // NEVER include fields that already exist (even if type is different)
  //
  // This is a safety-first approach: incremental migrations should only ADD,
  // never ALTER existing schema. Users can manually handle type/permission
  // changes or removals if needed.

  const upStatements: string[] = [];

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
        existingAnalyzerNames = Object.keys(
          info.analyzers as Record<string, unknown>,
        );
      }
    } catch {
      // DB may not exist yet
    }

    const existingAnalyzerSet = new Set(existingAnalyzerNames);

    for (const a of analyzers ?? []) {
      if (a.name && !existingAnalyzerSet.has(a.name)) {
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
  const newTables = tables.filter((t) =>
    tablesNeedingFullDefinition.has(t.name),
  );

  // Add full table definition for new/schemaless tables
  for (const table of newTables) {
    upStatements.push(...generator.generateTableMigration(table));
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
  }

  // Add new indexes: for tables already in live schema WITH columns
  const newIndexesForExistingTables = diff.added.indexes.filter(
    (i) => !tablesNeedingFullDefinition.has(i.table),
  );
  for (const indexChange of newIndexesForExistingTables) {
    upStatements.push(
      generator.generateIndexDefinition(indexChange.index, indexChange.table),
    );
  }

  // Handle removed fields — check for existing data before generating REMOVE FIELD
  for (const removedField of diff.removed.fields) {
    // Skip if field is on a table that got full definition above
    if (tablesNeedingFullDefinition.has(removedField.table)) continue;

    try {
      // Check if any records have data in this field
      const result = await driver.query<{ cnt: number }>(
        `SELECT count() as cnt FROM ${escapeIdent(removedField.table)} WHERE ${escapeIdent(removedField.field)} IS NOT NONE LIMIT 1`,
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
        upStatements.push(
          generator.generateRemoveField(removedField.table, removedField.field),
        );
        // No down statement — can't restore removed field
      }
    } catch (error) {
      // Table may not exist yet or other transient error — skip removal
      log(
        'Error checking removed field %s.%s: %O',
        removedField.table,
        removedField.field,
        error,
      );
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
        log(
          'Removed table %s — no data found, generating REMOVE TABLE',
          tableName,
        );
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
      fieldChange.oldColumn.config.defaultRaw ??
      fieldChange.oldColumn.config.default;
    const newEffectiveDefault =
      fieldChange.newColumn.config.defaultRaw ??
      fieldChange.newColumn.config.default;
    const typeChanged =
      fieldChange.oldColumn.config.type !== fieldChange.newColumn.config.type;
    const optionalChanged =
      fieldChange.oldColumn.config.optional !==
      fieldChange.newColumn.config.optional;
    const flexibleChanged =
      fieldChange.oldColumn.config.flexible !==
      fieldChange.newColumn.config.flexible;
    const readonlyChanged =
      fieldChange.oldColumn.config.readonly !==
      fieldChange.newColumn.config.readonly;

    if (typeChanged || optionalChanged || flexibleChanged || readonlyChanged) {
      // For structural changes, emit full DEFINE FIELD (without IF NOT EXISTS)
      // This updates the field definition in SurrealDB
      const newColumn: ColumnDefinition = {
        ...fieldChange.newColumn,
        tableName: fieldChange.table,
      };
      upStatements.push(generator.generateFieldRedefine(newColumn));
      liveFieldChanges.push({
        table: fieldChange.table,
        field: fieldChange.field,
      });
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
      liveFieldChanges.push({
        table: fieldChange.table,
        field: fieldChange.field,
      });
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
        existingFunctionNames = Object.keys(
          info.functions as Record<string, unknown>,
        );
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
        const infoResult = result as unknown as Array<{
          events?: Array<{ name: string }>;
        }>;
        if (infoResult?.[0]?.events) {
          for (const dbEvent of infoResult[0].events) {
            existingEvents.push({ name: dbEvent.name, what: evt.on });
          }
        }
      } catch {
        // Table may not exist yet - skip
      }
    }

    const existingEventKeys = new Set(
      existingEvents.map((e) => `${e.what}:${e.name}`),
    );

    for (const evt of events ?? []) {
      const eventKey = `${evt.on}:${evt.name}`;
      if (evt.name && !existingEventKeys.has(eventKey)) {
        nonTableCounts.added++;
        try {
          const sql = eventToSQL(evt);
          if (sql) {
            upStatements.push(sql);
          }
        } catch {
          // Skip invalid event configs
        }
      }
    }
  }

  // Print summary of changes (only showing what's being added)
  const filteredDiff = {
    added: {
      tables: newTables,
      fields: newFieldsForExistingTables,
      indexes: newIndexesForExistingTables,
    },
    removed: {
      tables: diff.removed.tables,
      fields: diff.removed.fields,
      indexes: [],
    },
    changed: { tables: [], fields: liveFieldChanges },
  };
  printDiffSummary(filteredDiff, undefined, undefined, nonTableCounts);

  // Filter out empty strings before returning (e.g., from id field which returns empty)
  return {
    upStatements: upStatements.filter((s) => s.trim().length > 0),
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
): { upStatements: string[] } {
  log('Generating full migration for all tables');

  const upStatements = generator.generateMigration(tables, analyzers);

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
      console.log(
        'acc is AccessConfig with type %s, generating SQL',
        acc,
        tablesRecord,
      );
      sql = accessToSQL(acc, tablesRecord);
    }
    // Skip access objects without toSQL() or valid type

    if (sql) {
      upStatements.push(sql);
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

  return { upStatements };
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
  migration: { up: string[] },
): string {
  // Filter out empty statements before joining
  const filteredUp = migration.up.filter((s) => s.trim() !== '');

  // Add section separators between statement categories
  const sectionedUp = addSectionSeparators(filteredUp);

  // Add semicolons between statements for proper parsing
  // Separator comments (-- ---- Section ----) are left as-is
  const upSection = sectionedUp
    .map((s) => (s.startsWith('--') ? s : `${s};`))
    .join('\n');

  return `-- Migration: ${name}
-- Version: ${version}

-- UP
${upSection}
`;
}
