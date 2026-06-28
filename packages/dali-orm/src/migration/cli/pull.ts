import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { connect } from '../../sdk/driver/orm-connection.js';
import type { EmbeddedConfig, SurrealDriver } from '../../sdk/driver/types.js';
import type { ColumnConfig, SurrealColumnType } from '../../sdk/schema/column/types.js';
import type { AccessConfig } from '../../sdk/schema.js';
import type { AnalyzerDefinition, TableDefinition } from '../../sdk/table.js';
import type { Config } from '../config.js';
import { SurrealQLGenerator } from '../core/generator.js';
import { MigrationRunner } from '../core/runner.js';
import { introspectDatabase } from '../ddl/introspect.js';
import { generateFullMigration, generateMigrationFile, loadSchemaFiles } from './generate.js';
import { safeDisconnect } from './operations.js';

export interface PullOptions {
  config: Config;
  outputDir?: string;
  table?: string;
  embeddedDriver?: boolean;
  /** Embedded driver configuration (mode, path) - fixes memory-only default */
  embeddedConfig?: EmbeddedConfig;
}

export async function pullSchema(options: PullOptions, driver?: SurrealDriver): Promise<void> {
  const { config, outputDir, table, embeddedDriver, embeddedConfig } = options;

  const resolvedOutputDir = outputDir ?? config.schema?.dir ?? './schema';
  const absoluteOutputDir = path.resolve(process.cwd(), resolvedOutputDir);
  const filename = deriveOutputFilename(config.schema?.pattern, table);

  let ownsDriver = false;
  if (!driver) {
    ownsDriver = true;
    driver = await connect(
      embeddedDriver
        ? {
            embeddedDriver: {
              driver: 'embedded',
              namespace: config.namespace,
              database: config.database,
              mode: embeddedConfig?.mode,
              path: embeddedConfig?.path,
            },
          }
        : {
            nodeDriver: {
              driver: 'node',
              url: config.url,
              namespace: config.namespace,
              database: config.database,
              auth: config.auth,
            },
          },
    );
  }

  try {
    console.log('Pulling schema from database...');
    console.log(`Output directory: ${absoluteOutputDir}`);
    console.log(`Output file: ${filename}`);

    const ddl = await introspectDatabase(driver, {
      onlyTables: table ? [table] : undefined,
    });

    if (ddl.tables.length === 0) {
      console.log('No tables found in database. Nothing to pull.');
      return;
    }

    console.log(`Found ${ddl.tables.length} table(s).`);

    const schemaContent = generateTypeScriptSchema(ddl, table);
    const outputPath = path.join(absoluteOutputDir, filename);
    await fs.mkdir(absoluteOutputDir, { recursive: true });
    await fs.writeFile(outputPath, schemaContent, 'utf-8');

    console.log(`✓ Schema written to ${outputPath}`);

    await generateAndApplyMigration(
      driver,
      absoluteOutputDir,
      config,
      ddl.tables,
      ddl.access,
      config.migrations?.journalDir,
    );
  } finally {
    if (ownsDriver) {
      await safeDisconnect(driver);
    }
  }
}

function deriveOutputFilename(pattern: string | undefined, table?: string): string {
  if (table) {
    return `${table}.schema.ts`;
  }
  if (pattern && !pattern.includes('*') && !pattern.includes('{')) {
    return pattern;
  }
  return 'schema.ts';
}

/**
 * Generate FULL init migration for all pulled tables (no diff), apply and mark applied.
 * @param tables - DDL format tables from introspectDatabase
 */
async function generateAndApplyMigration(
  driver: SurrealDriver,
  schemaDir: string,
  config: Config,
  tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      kind?: string;
      optional?: boolean;
      default?: unknown;
      flexible?: boolean;
      readonly?: boolean;
      recordTable?: string;
    }>;
  }>,
  accessSQL: string[] = [],
  journalDir?: string,
): Promise<void> {
  console.log('Generating init migration from pulled schema...');

  if (tables.length === 0) {
    console.log('No tables provided. Skipping migration generation.');
    return;
  }

  // Convert DDL tables to TableDefinition[] for generateFullMigration
  const tablesAsTableDef: TableDefinition[] = tables.map((table) => ({
    name: table.name,
    columns: table.columns.map((col) => ({
      name: col.name,
      tableName: table.name,
      config: {
        type: col.kind ?? 'string',
        optional: col.optional,
        default: col.default as string | undefined,
        flexible: col.flexible,
        readonly: col.readonly,
      } as ColumnConfig,
    })),
    config: {
      schema: 'full' as const,
      type: 'normal' as const,
    },
  }));

  // Generate full migration SQL for ALL tables (no diff, no driver)
  const generator = new SurrealQLGenerator();

  // Get access/analyzer definitions: prefer DB introspection, fall back to schema files
  let accessForMigration: AccessConfig[] = [];
  let analyzersForMigration: AnalyzerDefinition[] = [];
  if (accessSQL.length === 0) {
    const pattern = config.schema?.pattern ?? '**/*.ts';
    const schemaFiles = await loadSchemaFiles(schemaDir, pattern);
    accessForMigration = schemaFiles.access ?? [];
    analyzersForMigration = schemaFiles.analyzers ?? [];
  }

  const { upStatements, downStatements } = generateFullMigration(
    tablesAsTableDef,
    generator,
    accessForMigration,
    undefined,
    undefined,
    analyzersForMigration,
  );

  // Inject raw access SQL from DB introspection if available
  if (accessSQL.length > 0) {
    for (const sql of accessSQL) {
      upStatements.push(sql);
      // Extract access name from SQL: "DEFINE ACCESS name ON DATABASE ..."
      const match = /DEFINE ACCESS (\w+)/i.exec(sql);
      if (match) {
        downStatements.push(`REMOVE ACCESS IF EXISTS ${match[1]} ON DATABASE`);
      }
    }
  }

  if (upStatements.length === 0) {
    console.log('No SQL generated. Skipping migration.');
    return;
  }

  // Write migration file
  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:Z.]/g, '')
    .slice(0, 14);
  const migrationsDir = config.migrations?.dir;
  if (!migrationsDir) {
    throw new Error(
      'migrations.dir is required in config. Set migrations.dir in dali-orm.config.ts.',
    );
  }
  await fs.mkdir(migrationsDir, { recursive: true });
  const migrationContent = generateMigrationFile(timestamp, 'init_from_pull', {
    up: upStatements,
    down: downStatements,
  });
  const migrationDir = path.join(migrationsDir, `${timestamp}_init_from_pull`);
  const migrationFilePath = path.join(migrationDir, 'migration.surql');
  await fs.mkdir(migrationDir, { recursive: true });
  await fs.writeFile(migrationFilePath, migrationContent, 'utf-8');

  console.log(`✓ Init migration generated: ${migrationDir}`);

  // Apply the migration
  const runner = new MigrationRunner(driver, {
    migrationsDir,
    migrationsTable: config.migrations?.table ?? '__migrations',
    journalDir,
  });

  await runner.init();
  const result = await runner.up();

  if (result.applied.length > 0) {
    console.log(`✓ Init migration applied: ${result.applied.join(', ')}`);
  } else {
    console.log('Migration was already applied or skipped.');
  }
}

function generateTypeScriptSchema(
  ddl: {
    tables: Array<{
      name: string;
      columns: Array<{
        name: string;
        kind?: SurrealColumnType;
        optional?: boolean;
        default?: unknown;
        flexible?: boolean;
        readonly?: boolean;
        recordTable?: string;
      }>;
    }>;
  },
  tableName?: string,
): string {
  const needsDateTime = ddl.tables.some((t) => t.columns.some((c) => c.kind === 'datetime'));
  const needsNumber = ddl.tables.some((t) =>
    t.columns.some((c) => c.kind === 'int' || c.kind === 'float' || c.kind === 'decimal'),
  );
  const needsBool = ddl.tables.some((t) => t.columns.some((c) => c.kind === 'bool'));
  const needsRecord = ddl.tables.some((t) => t.columns.some((c) => c.recordTable));
  const needsArray = ddl.tables.some((t) => t.columns.some((c) => c.kind === 'array'));

  const imports = [
    `import { defineTable } from '@woss/dali-orm/sdk/table';`,
    needsDateTime
      ? `import { datetime } from '@woss/dali-orm/sdk/schema/column/simple-builders';`
      : '',
    needsNumber ? `import { int } from '@woss/dali-orm/sdk/schema/column/simple-builders';` : '',
    needsBool ? `import { bool } from '@woss/dali-orm/sdk/schema/column/simple-builders';` : '',
    needsArray ? `import { array } from '@woss/dali-orm/sdk/schema/column/simple-builders';` : '',
    needsRecord ? `import { record } from '@woss/dali-orm/sdk/schema/column/record';` : '',
    `import { string } from '@woss/dali-orm/sdk/schema/column/simple-builders';`,
  ]
    .filter(Boolean)
    .join('\n');

  const lines: string[] = [
    `// Generated schema${tableName ? ` for ${tableName}` : ''}`,
    "// DO NOT EDIT - run 'dali-orm pull' to regenerate",
    '',
    imports,
    '',
  ];

  const schemaExports: string[] = [];

  for (const table of ddl.tables) {
    lines.push(`export const ${table.name}Schema = defineTable('${table.name}', {`);
    schemaExports.push(`${table.name}: ${table.name}Schema`);

    for (const column of table.columns) {
      const columnDef = generateColumnDefinition(column);
      lines.push(`  ${columnDef},`);
    }

    lines.push('});');
    lines.push('');
  }

  if (schemaExports.length > 0) {
    lines.push('export default {');
    for (const exportEntry of schemaExports) {
      lines.push(`  ${exportEntry},`);
    }
    lines.push('};');
    lines.push('');
  }

  return lines.join('\n');
}

export function generateColumnDefinition(column: {
  name: string;
  kind?: SurrealColumnType;
  optional?: boolean;
  default?: unknown;
  defaultRaw?: string;
  flexible?: boolean;
  readonly?: boolean;
  recordTable?: string;
}): string {
  const typeMap: Record<string, string> = {
    string: 'string',
    int: 'int',
    integer: 'int',
    float: 'float',
    decimal: 'decimal',
    bool: 'bool',
    boolean: 'bool',
    datetime: 'datetime',
    date: 'datetime',
    time: 'datetime',
    timestamp: 'datetime',
    duration: 'duration',
    array: 'array',
    object: 'object',
    record: 'record',
    geometry: 'geometry',
    bytes: 'bytes',
  };

  const builderFn = typeMap[column.kind ?? ''] ?? 'string';
  const propName = /[^a-zA-Z0-9_$]/.test(column.name) ? `'${column.name}'` : column.name;

  if (column.kind === 'record' && column.recordTable) {
    let def = `${propName}: record('${column.recordTable}')`;
    def = applyModifiers(def, column);
    return def;
  }

  if (!column.kind) {
    let def = `${propName}: string('${column.name}')`;
    def = applyModifiers(def, column);
    return def;
  }

  let def = `${propName}: ${builderFn}('${column.name}')`;
  def = applyModifiers(def, column);
  return def;
}

function applyModifiers(
  def: string,
  column: {
    optional?: boolean;
    default?: unknown;
    defaultRaw?: string;
    flexible?: boolean;
    readonly?: boolean;
  },
): string {
  if (column.optional) {
    def += '.optional()';
  }
  if (column.defaultRaw !== undefined) {
    def += `.defaultRaw('${column.defaultRaw.replace(/'/g, "\\'")}')`;
  } else if (column.default !== undefined) {
    def += `.default(${formatDefaultValueForTS(column.default)})`;
  }
  if (column.flexible) {
    def += '.flexible()';
  }
  if (column.readonly) {
    def += '.readonly()';
  }
  return def;
}

function formatDefaultValueForTS(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === true) {
    return 'true';
  }
  if (value === false) {
    return 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    // Handle SQL-quoted strings: 'active' → dequote then re-wrap
    const unquoted =
      value.startsWith("'") && value.endsWith("'") && value.length >= 2
        ? value.slice(1, -1)
        : value;
    if (unquoted.includes("'")) {
      const escaped = unquoted.replace(/"/g, '\\"');
      return `"${escaped}"`;
    }
    const escaped = unquoted.replace(/'/g, "\\'");
    return `'${escaped}'`;
  }
  return JSON.stringify(value);
}
