import type { SurrealDriver } from '../../sdk/driver/types.js';
import type {
  AccessConfig,
  EventConfig,
  FunctionConfig,
} from '../../sdk/schema.js';
import type { IndexDefinition, TableDefinition } from '../../sdk/table.js';
import type { Config } from '../config.js';
import {
  createEmptyDdl,
  type SurrealDbDDL,
  type SurrealIndex,
} from '../ddl/ddl.js';
import { ddlDiff } from '../ddl/diff.js';
import { introspectDatabase } from '../ddl/introspect.js';
import {
  createConnection,
  printAddedSection,
  printRemovedSection,
  printWarnings,
  safeDisconnect,
} from './operations.js';

export interface PushOptions {
  config: Config;
  tables: TableDefinition[];
  access?: AccessConfig[];
  events?: EventConfig[];
  functions?: FunctionConfig[];
  dryRun?: boolean;
  force?: boolean;
  embeddedDriver?: boolean;
}

/**
 * Convert ORM IndexDefinition to DDL SurrealIndex format
 */
function convertIndex(index: IndexDefinition, tableName: string): SurrealIndex {
  return {
    name: index.name,
    table: tableName,
    cols: index.fields,
    index: index.type ?? '',
    analyzer: index.analyzer,
    dimension: index.dimension,
    vectorType: index.vectorType,
    distance: index.distance,
  };
}

/**
 * Convert TableDefinition[] to SurrealDbDDL format
 */
export function tablesToDdl(
  tables: TableDefinition[],
  access?: AccessConfig[],
  events?: EventConfig[],
  functions?: FunctionConfig[],
): SurrealDbDDL {
  const ddl = createEmptyDdl();

  for (const table of tables) {
    // If relation type with in/out, add to relations
    if (
      table.config.type === 'relation' &&
      table.config.in &&
      table.config.out
    ) {
      ddl.relations.push({
        name: table.name,
        in: table.config.in,
        out: table.config.out,
        fields: table.columns.map((col) => ({
          table: table.name,
          name: col.name,
          kind: col.config.type,
          optional: col.config.optional ?? false,
          flex: col.config.flexible ?? false,
          readonly: col.config.readonly ?? false,
          default: col.config.default,
          assert: col.config.assert,
          permissions:
            typeof col.config.permissions === 'string'
              ? {
                  select: col.config.permissions,
                  create: col.config.permissions,
                  update: col.config.permissions,
                  delete: col.config.permissions,
                }
              : (col.config.permissions ?? {}),
        })),
      });
    }

    // Map indexes from table config
    const tableIndexes: SurrealIndex[] = (table.config.indexes || []).map(
      (idx) => convertIndex(idx, table.name),
    );

    // Extract unique indexes from columns with unique: true
    for (const col of table.columns) {
      if (col.config.unique) {
        const uniqueIndex: SurrealIndex = {
          name: `${col.name}_idx`,
          table: table.name,
          cols: [col.name],
          index: 'unique',
        };
        tableIndexes.push(uniqueIndex);
      }
    }

    ddl.tables.push({
      name: table.name,
      schema: table.config.schema ?? 'full',
      type: table.config.type ?? 'normal',
      columns: table.columns.map((col) => ({
        table: table.name,
        name: col.name,
        kind: col.config.type,
        recordTable: col.config.recordTable,
        // For SCHEMAFULL tables, columns default to NOT NULL (optional: false)
        // Only set to true if explicitly optional: true in config
        optional: col.config.optional ?? table.config.schema === 'less',
        flex: col.config.flexible ?? false,
        readonly: col.config.readonly ?? false,
        default: col.config.default,
        assert: col.config.assert,
        permissions:
          typeof col.config.permissions === 'string'
            ? {
                select: col.config.permissions,
                create: col.config.permissions,
                update: col.config.permissions,
                delete: col.config.permissions,
              }
            : (col.config.permissions ?? {}),
      })),
      indexes: tableIndexes,
      in: table.config.in,
      out: table.config.out,
      permissions: table.config.permissions,
    });

    // Also add top-level indexes for diff tracking
    ddl.indexes.push(...tableIndexes);
  }

  // Convert access definitions
  if (access && access.length > 0) {
    ddl.accessStructured = access.map((a) => ({
      name: a.name,
      type: a.type,
      table: a.table,
      signup: a.signup,
      signin: a.signin,
      identifier: a.identifier,
      algorithm: a.algorithm,
      key: a.key,
      issuer: a.issuer,
      duration: a.duration,
      tokenDuration: a.tokenDuration,
    }));
  }

  // Convert event definitions
  if (events && events.length > 0) {
    ddl.events = events.map((e) => ({
      name: e.name,
      what: e.on,
      when: e.when,
      then: e.then ?? [],
      comment: e.comment,
      async: e.async,
      retry: e.retry,
      maxdepth: e.maxdepth,
    }));
  }

  // Convert function definitions
  if (functions && functions.length > 0) {
    ddl.functions = functions.map((f) => ({
      name: f.name,
      args: f.args ? [...f.args] : undefined,
      body: f.body,
      comment: f.comment,
      permissions: f.permissions,
    }));
  }

  return ddl;
}

/**
 * Push schema changes to database
 */
export async function pushSchema(
  options: PushOptions,
  driver?: SurrealDriver,
): Promise<void> {
  const { config, tables, dryRun, embeddedDriver } = options;

  let ownsDriver = false;
  if (!driver) {
    ownsDriver = true;
    driver = await createConnection(config, embeddedDriver);
  }

  try {
    // Introspect current database schema
    const currentDdl = await introspectDatabase(driver);

    // Convert user tables to DDL format
    const targetDdl = tablesToDdl(
      tables,
      options.access,
      options.events,
      options.functions,
    );

    // Calculate diff
    const diffResult = await ddlDiff(currentDdl, targetDdl, 'push');

    if (diffResult.statements.length === 0) {
      console.log('Schema is up to date');
      return;
    }

    // Show diff
    console.log('Schema changes:');
    console.log('================\n');

    // Display added/removed/changed tables from statements
    const grouped = diffResult.groupedStatements;

    // Added/removed tables
    printAddedSection(grouped, 'create_table', 'tables');
    printRemovedSection(grouped, 'drop_table', 'tables');

    // Changed tables (add_column, alter_column, etc.)
    const changedTableNames = new Set<string>();
    const changeTypes = [
      'add_column',
      'alter_column',
      'remove_column',
      'alter_table_permissions',
    ];
    for (const changeType of changeTypes) {
      for (const stmt of grouped[changeType] || []) {
        const table = (stmt as { table: string }).table;
        if (table) changedTableNames.add(table);
      }
    }
    if (changedTableNames.size > 0) {
      console.log(`Changed tables (${changedTableNames.size}):`);
      for (const name of changedTableNames) {
        console.log(`  ~ ${name}`);
      }
      console.log();
    }

    // Indexes
    printAddedSection(grouped, 'create_index', 'indexes');
    printRemovedSection(grouped, 'drop_index', 'indexes');

    // Access definitions
    printAddedSection(grouped, 'create_access', 'access definitions');
    printRemovedSection(grouped, 'drop_access', 'access definitions');

    // Events
    printAddedSection(grouped, 'create_event', 'events');
    printRemovedSection(grouped, 'drop_event', 'events');

    // Functions
    printAddedSection(grouped, 'create_function', 'functions');
    printRemovedSection(grouped, 'drop_function', 'functions');

    // Show warnings for breaking changes
    printWarnings(diffResult.warnings);

    if (dryRun) {
      console.log('Dry run - no changes applied');
      return;
    }

    // Check for data loss operations if not forced
    if (!options.force && diffResult.dataLossOperations.length > 0) {
      console.log(
        '⚠️  Data loss operations detected. Use --force to apply anyway.',
      );
      return;
    }

    // Apply changes
    for (const stmt of diffResult.sqlStatements) {
      if (stmt && !stmt.startsWith('--')) {
        await driver.query(stmt);
      }
    }

    console.log('✓ Schema pushed successfully');
  } finally {
    if (ownsDriver) {
      await safeDisconnect(driver);
    }
  }
}
