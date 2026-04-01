import type { SurrealDriver } from '../../sdk/driver/types.js';
import type { TableDefinition } from '../../sdk/table.js';
import type { Config } from '../config.js';
import { createEmptyDdl, type SurrealColumn, type SurrealDbDDL } from '../ddl/ddl.js';
import { ddlDiff } from '../ddl/diff.js';
import { introspectDatabase } from '../ddl/introspect.js';
import { normalizeDefault } from '../utils/format.js';
import {
  createConnection,
  printAddedSection,
  printRemovedSection,
  printWarnings,
  safeDisconnect,
} from './operations.js';

export interface DiffOptions {
  config: Config;
  tables: TableDefinition[];
  verbose?: boolean;
}

/**
 * Convert core IndexDefinition to SurrealIndex format
 */
function convertIndex(
  idx: {
    name: string;
    fields: string[];
    type?: 'unique' | 'fulltext' | 'hnsw';
    analyzer?: string;
    dimension?: number;
    vectorType?: 'float' | 'float32' | 'float64';
    distance?: 'COSINE' | 'EUCLIDEAN' | 'MANHATTAN' | 'MINKOWSKI';
  },
  tableName: string,
): {
  name: string;
  table: string;
  cols: string[];
  index: string;
  analyzer?: string;
  dimension?: number;
  vectorType?: 'float' | 'float32' | 'float64';
  distance?: 'COSINE' | 'EUCLIDEAN' | 'MANHATTAN' | 'MINKOWSKI';
} {
  return {
    name: idx.name,
    table: tableName,
    cols: idx.fields,
    index: idx.type ?? '',
    analyzer: idx.analyzer,
    dimension: idx.dimension,
    vectorType: idx.vectorType,
    distance: idx.distance,
  };
}

/**
 * Convert TableDefinition[] to SurrealDbDDL format
 */
function tablesToDdl(tables: TableDefinition[]): SurrealDbDDL {
  const ddl = createEmptyDdl();

  for (const table of tables) {
    ddl.tables.push({
      name: table.name,
      schema: table.config.schema ?? 'full',
      type: table.config.type ?? 'normal',
      columns: table.columns.map((col) => ({
        table: table.name,
        name: col.name,
        kind: col.config.type,
        // Default to false if optional not specified (fields are NOT NULL by default in SurrealDB)
        optional: col.config.optional ?? false,
        flex: col.config.flexible ?? false,
        readonly: col.config.readonly ?? false,
        // Normalize default: convert string 'now' to actual value for comparison
        default: normalizeDefault(col.config.default) as string | undefined,
        assert: col.config.assert,
        permissions:
          typeof col.config.permissions === 'string'
            ? {
                select: col.config.permissions,
                create: col.config.permissions,
                update: col.config.permissions,
              }
            : (col.config.permissions ?? {}),
      })),
      indexes: (table.config.indexes || []).map((idx) => convertIndex(idx, table.name)),
      in: table.config.in,
      out: table.config.out,
      permissions: table.config.permissions,
    });

    // Extract unique indexes from columns with unique: true
    for (const col of table.columns) {
      if (col.config.unique) {
        ddl.indexes.push({
          name: `${col.name}_idx`,
          table: table.name,
          cols: [col.name],
          index: 'unique',
        });
      }
    }

    // Also populate ddl.relations for relation tables so diffRelations compares correctly
    if (table.config.type === 'relation' && table.config.in && table.config.out) {
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
          default: normalizeDefault(col.config.default) as string | undefined,
          assert: col.config.assert,
          permissions:
            typeof col.config.permissions === 'string'
              ? {
                  select: col.config.permissions,
                  create: col.config.permissions,
                  update: col.config.permissions,
                }
              : (col.config.permissions ?? {}),
        })),
      });
    }
  }

  return ddl;
}

/**
 * Show schema diff between database and schema files
 */
export async function diffSchema(options: DiffOptions, driver?: SurrealDriver): Promise<void> {
  const { config, tables, verbose } = options;

  let ownsDriver = false;
  if (!driver) {
    ownsDriver = true;
    driver = await createConnection(config);
  }

  try {
    // Guard: no tables provided
    if (tables.length === 0) {
      console.log('No schema tables found. Nothing to diff.');
      return;
    }

    // Introspect current database schema
    const currentDdl = await introspectDatabase(driver);

    // Convert user tables to DDL format
    const targetDdl = tablesToDdl(tables);

    // Calculate diff
    const diffResult = await ddlDiff(currentDdl, targetDdl, 'push');

    // Display results
    console.log('Schema Diff');
    console.log('==========\n');

    const grouped = diffResult.groupedStatements;

    // Added tables - show their columns
    const addedTables = (grouped.create_table || []) as Array<{
      name: string;
      columns: SurrealColumn[];
    }>;
    if (addedTables.length > 0) {
      console.log(`Added tables (${addedTables.length}):`);
      for (const table of addedTables) {
        const colNames = table.columns.map((c) => `${c.name}: ${formatColumnType(c)}`).join(', ');
        console.log(`  + ${table.name}: ${colNames}`);
      }
      console.log();
    }

    // Removed tables
    const removedTables = (grouped.drop_table || []) as Array<{ name: string }>;
    if (removedTables.length > 0) {
      console.log(`Removed tables (${removedTables.length}):`);
      for (const table of removedTables) {
        console.log(`  - ${table.name}`);
      }
      console.log();
    } else {
      console.log('Removed tables (0):\n  (none)\n');
    }

    /**
     * Format a column as type string for display (e.g., "string", "int", "record<user>")
     */
    function formatColumnType(col: SurrealColumn): string {
      return col.kind ?? 'any';
    }

    /**
     * Format an alter_column change for display with before/after values
     */
    function formatColumnChange(
      change: {
        type?: string;
        flexible?: boolean;
        readonly?: boolean;
        optional?: boolean;
        default?: unknown;
        assert?: string;
      },
      before?: {
        type?: string;
        flexible?: boolean;
        readonly?: boolean;
        optional?: boolean;
        default?: unknown;
        assert?: string;
      },
      after?: {
        type?: string;
        flexible?: boolean;
        readonly?: boolean;
        optional?: boolean;
        default?: unknown;
        assert?: string;
      },
    ): string {
      const parts: string[] = [];

      // Normalize defaults for display (same logic as tablesToDdl)
      const normBefore =
        before?.default !== undefined ? normalizeDefault(before.default) : undefined;
      const normAfter = after?.default !== undefined ? normalizeDefault(after.default) : undefined;

      // Type change: "string→int"
      if (change.type && before?.type && after?.type && before.type !== after.type) {
        parts.push(`${before.type}→${after.type}`);
      } else if (change.type) {
        parts.push(`+type ${change.type}`);
      }

      // Default change: "+default 'value'" or "-default"
      if (change.default !== undefined) {
        if (normBefore === undefined && normAfter !== undefined) {
          parts.push(`+default ${JSON.stringify(normAfter)}`);
        } else if (normBefore !== undefined && normAfter === undefined) {
          parts.push(`-default`);
        } else if (normBefore !== undefined && normAfter !== undefined) {
          parts.push(`default ${JSON.stringify(normBefore)}→${JSON.stringify(normAfter)}`);
        }
      }

      // Readonly change
      if (change.readonly !== undefined) {
        if (before?.readonly === false && after?.readonly === true) {
          parts.push(`+readonly`);
        } else if (before?.readonly === true && after?.readonly === false) {
          parts.push(`-readonly`);
        }
      }

      // Optional/NOT NULL change
      if (change.optional !== undefined) {
        if (before?.optional === false && after?.optional === true) {
          parts.push(`+optional`);
        } else if (before?.optional === true && after?.optional === false) {
          parts.push(`+not null`);
        }
      }

      // Flexible change
      if (change.flexible !== undefined) {
        if (before?.flexible === false && after?.flexible === true) {
          parts.push(`+flexible`);
        } else if (before?.flexible === true && after?.flexible === false) {
          parts.push(`-flexible`);
        }
      }

      // Assert change
      if (change.assert) {
        parts.push(`assert: ${change.assert}`);
      }

      return parts.join(', ');
    }

    type TableFieldChanges = Map<
      string,
      {
        added: Array<{ name: string; detail: string }>;
        removed: Array<{ name: string; detail: string }>;
        changed: Array<{ name: string; detail: string }>;
      }
    >;

    /**
     * Build field change details from grouped statements
     */
    function buildFieldChanges(grouped: Record<string, unknown[]>): TableFieldChanges {
      const changes: TableFieldChanges = new Map();

      // New fields - get full column details
      for (const stmt of grouped.add_column || []) {
        const s = stmt as { table: string; column: SurrealColumn };
        const tableName = s.table;
        if (!changes.has(tableName)) {
          changes.set(tableName, { added: [], removed: [], changed: [] });
        }
        // Format as "+field: +type string"
        const col = s.column;
        const parts: string[] = [];
        parts.push(`+type ${formatColumnType(col)}`);
        if (col.default !== undefined) {
          parts.push(`+default ${JSON.stringify(col.default)}`);
        }
        if (col.optional) parts.push('+optional');
        if (col.readonly) parts.push('+readonly');
        if (col.flex) parts.push('+flexible');

        changes.get(tableName)?.added.push({
          name: s.column.name,
          detail: parts.join(', '),
        });
      }

      // Removed fields
      for (const stmt of grouped.remove_column || []) {
        const s = stmt as { table: string; column: string };
        const tableName = s.table;
        if (!changes.has(tableName)) {
          changes.set(tableName, { added: [], removed: [], changed: [] });
        }
        changes.get(tableName)?.removed.push({
          name: s.column,
          detail: '(removed)',
        });
      }

      // Changed fields - get change details with before/after
      for (const stmt of grouped.alter_column || []) {
        const s = stmt as {
          table: string;
          column: string;
          change: {
            type?: string;
            flexible?: boolean;
            readonly?: boolean;
            optional?: boolean;
            default?: unknown;
            assert?: string;
          };
          before?: {
            type?: string;
            flexible?: boolean;
            readonly?: boolean;
            optional?: boolean;
            default?: unknown;
            assert?: string;
          };
          after?: {
            type?: string;
            flexible?: boolean;
            readonly?: boolean;
            optional?: boolean;
            default?: unknown;
            assert?: string;
          };
        };
        const tableName = s.table;
        if (!changes.has(tableName)) {
          changes.set(tableName, { added: [], removed: [], changed: [] });
        }

        // Filter out changes where before === after after normalization
        const { change, before, after } = s;
        const normBeforeDefault =
          before?.default !== undefined ? normalizeDefault(before.default) : undefined;
        const normAfterDefault =
          after?.default !== undefined ? normalizeDefault(after.default) : undefined;

        // Check if actual type changed (before vs after, not whether change object has type)
        const actualTypeChange = before?.type !== after?.type;
        const noTypeChange = !actualTypeChange;
        const noDefaultChange = normBeforeDefault === normAfterDefault;
        const noFlexibleChange =
          change.flexible === undefined || before?.flexible === after?.flexible;
        const noReadonlyChange =
          change.readonly === undefined || before?.readonly === after?.readonly;
        // Check if actual optional changed (before vs after)
        const actualOptionalChange = before?.optional !== after?.optional;
        const noOptionalChange = !actualOptionalChange;
        const noAssertChange = !change.assert || before?.assert === after?.assert;

        if (
          noTypeChange &&
          noDefaultChange &&
          noFlexibleChange &&
          noReadonlyChange &&
          noOptionalChange &&
          noAssertChange
        ) {
          continue; // Skip - no actual change
        }

        changes.get(tableName)?.changed.push({
          name: s.column,
          detail: formatColumnChange(s.change, s.before, s.after),
        });
      }

      return changes;
    }

    // Build field-level changes for changed tables
    const fieldChanges = buildFieldChanges(grouped);

    // Display changed tables with field details
    if (fieldChanges.size > 0) {
      console.log(`Changed tables (${fieldChanges.size}):`);
      for (const [tableName, fields] of fieldChanges) {
        console.log(`  ~ ${tableName}:`);
        for (const field of fields.added) {
          console.log(`    + ${field.name}: ${field.detail}`);
        }
        for (const field of fields.removed) {
          console.log(`    - ${field.name}`);
        }
        for (const field of fields.changed) {
          console.log(`    ~ ${field.name}: ${field.detail}`);
        }
      }
      console.log();
    }

    // Summary
    if (diffResult.statements.length === 0) {
      console.log('Schema is up to date');
      return;
    }

    // Indexes
    printAddedSection(grouped, 'create_index', 'indexes');
    printRemovedSection(grouped, 'drop_index', 'indexes');

    // Count field-level changes for total
    let fieldChangeCount = 0;
    for (const fields of fieldChanges.values()) {
      fieldChangeCount += fields.added.length + fields.removed.length + fields.changed.length;
    }
    const totalChanges = addedTables.length + removedTables.length + fieldChangeCount;
    console.log(`Total: ${totalChanges}`);
    console.log(`(Use 'push' to apply changes)`);

    // Show warnings for breaking changes
    if (diffResult.warnings.length > 0 && verbose) {
      printWarnings(diffResult.warnings);
    }
  } finally {
    if (ownsDriver) {
      await safeDisconnect(driver);
    }
  }
}
