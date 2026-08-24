import { readdir, stat } from 'node:fs/promises';
import * as path from 'node:path';
import type { ColumnDefinition } from '../../sdk/schema/column/types.js';
import type { AccessConfig, FunctionConfig } from '../../sdk/schema.js';
import type { AnalyzerDefinition, TableDefinition } from '../../sdk/table.js';

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
        throw new Error(
          `Failed to scan schema directory: ${schemaPath} does not exist`,
        );
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

        // Also check for OrmSchema-like exports (has .tables Map or .tableDefinitions Record)
        // Check 'ormSchema', 'schema', and 'default' exports for OrmSchema instances
        const ormSchemaKeys = ['ormSchema', 'schema', 'default'] as const;
        for (const key of ormSchemaKeys) {
          const val = module[key];
          if (!val || Array.isArray(val) || typeof val !== 'object') continue;
          const obj = val as Record<string, unknown>;
          // Detect OrmSchema by its .tables Map property (preferred)
          if (obj.tables instanceof Map) {
            tablesOrExports.push(Object.fromEntries(obj.tables));
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
          // Fallback: detect OrmSchema-like objects via .tableDefinitions Record
          else if (
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
    throw new Error(
      `Failed to scan schema directory ${schemaPath}: ${String(scanError)}`,
    );
  }

  return { tables, access, functions, analyzers };
}

/**
 * Load schema from a single file path
 * Extracts table definitions from the module's exports
 */
export async function loadSchemaFromFile(
  filePath: string,
): Promise<SchemaFilesResult> {
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

    // Also check for OrmSchema-like exports (has .tables Map or .tableDefinitions Record)
    // Check 'ormSchema', 'schema', and 'default' exports for OrmSchema instances
    const ormSchemaKeys = ['ormSchema', 'schema', 'default'] as const;
    for (const key of ormSchemaKeys) {
      const val = module[key];
      if (!val || Array.isArray(val) || typeof val !== 'object') continue;
      const obj = val as Record<string, unknown>;
      // Detect OrmSchema by its .tables Map property (preferred)
      if (obj.tables instanceof Map) {
        tablesOrExports.push(Object.fromEntries(obj.tables));
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
      // Fallback: detect OrmSchema-like objects via .tableDefinitions Record
      else if (
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
    throw new Error(
      `Failed to import schema file ${filePath}: ${String(importError)}`,
    );
  }

  return { tables, access, functions, analyzers };
}

/**
 * Find files matching a glob-like pattern recursively
 * Supports: patterns like **\/*.ts (recursive) or *.ts (current dir only)
 */
export async function findMatchingFiles(
  dir: string,
  pattern: string,
): Promise<string[]> {
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
  const isSurrealTable =
    typeof obj.$name === 'string' && typeof obj.$columns === 'object';

  // Must have name (either direct or via $name), columns array, and config object
  const isValid =
    typeof name === 'string' &&
    Array.isArray(columns) &&
    typeof config === 'object';

  return isSurrealTable || isValid;
}

/**
 * Convert a SurrealTableInstance to a plain TableDefinition
 * This extracts the real name from $name and normalizes the structure
 */
export function normalizeTableDefinition(
  table: unknown,
): TableDefinition | null {
  if (!table || typeof table !== 'object') {
    return null;
  }

  const obj = table as Record<string, unknown>;

  // Get name from name property (actual name) or $name (SurrealTableInstance fallback)
  // Note: $name returns alias for proxy-wrapped tables, so prefer name
  const name = typeof obj.name === 'string' ? obj.name : obj.$name;
  let columns = obj.columns as ColumnDefinition[] | undefined;

  // Fallback: if columns is not an array, try converting $columns Record to array
  if (
    !Array.isArray(columns) &&
    obj.$columns &&
    typeof obj.$columns === 'object'
  ) {
    columns = Object.values(obj.$columns as Record<string, ColumnDefinition>);
  }
  const rawConfig = obj.config as TableDefinition['config'] | undefined;

  // Must have name, columns, and config
  if (
    typeof name !== 'string' ||
    !Array.isArray(columns) ||
    typeof rawConfig !== 'object'
  ) {
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
