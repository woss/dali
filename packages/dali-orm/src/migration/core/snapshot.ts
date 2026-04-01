/**
 * Schema Snapshots for Incremental Migration
 *
 * This module provides snapshot functionality inspired by Drizzle ORM:
 * - Snapshots represent the schema state AFTER each migration
 * - Compare current code schema vs last snapshot for incremental generation
 * - Fallback to empty schema if no snapshot exists (first migration)
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createDebug as debug } from 'obug';
import type { ColumnDefinition, SurrealColumnType } from '../../sdk/schema/column/types.js';
import type { EventConfig, FunctionConfig } from '../../sdk/schema.js';
import type { IndexDefinition, TableDefinition } from '../../sdk/table.js';

const log = debug('dali-orm:migrations:snapshot');

/**
 * Serializable snapshot format for schema state
 * Uses simple JSON-serializable types for cross-runtime compatibility
 */
export interface SchemaSnapshot {
  /** Snapshot version identifier (matches migration version) */
  version: string;
  /** Human-readable migration name */
  name: string;
  /** ISO timestamp when snapshot was created */
  createdAt: string;
  /** Serialized table definitions */
  tables: SerializedTable[];
  /** Serialized access definitions */
  access: SerializedAccess[];
  /** Serialized event definitions */
  events: SerializedEvent[];
  /** Serialized function definitions */
  functions: SerializedFunction[];
}

/**
 * Serializable access definition
 */
export interface SerializedAccess {
  name: string;
  type: string;
  level?: string;
  signup?: string;
  signin?: string;
  duration?: string;
}

/**
 * Serializable event definition
 */
export interface SerializedEvent {
  name: string;
  what: string;
  when: string;
  then: string[];
  comment?: string;
  async?: boolean;
  retry?: number;
  maxdepth?: number;
}

/**
 * Serializable function definition
 */
export interface SerializedFunction {
  name: string;
  args?: string[];
  body: string;
  comment?: string;
  permissions?: string;
}

/**
 * Serializable table definition
 */
export interface SerializedTable {
  name: string;
  columns: SerializedColumn[];
  config: SerializedTableConfig;
}

/**
 * Serializable column definition
 */
export interface SerializedColumn {
  name: string;
  tableName: string;
  config: SerializedColumnConfig;
}

/**
 * Serializable column configuration
 */
export interface SerializedColumnConfig {
  type: SurrealColumnType;
  optional?: boolean;
  readonly?: boolean;
  flexible?: boolean;
  default?: string;
  /** Raw SurrealDB expression for DEFAULT (e.g., `crypto::blake3(content)`), emitted unquoted */
  defaultRaw?: string;
  assert?: string;
  permissions?: string;
}

/**
 * Serializable table configuration
 */
export interface SerializedTableConfig {
  schema?: 'full' | 'less';
  type?: 'normal' | 'relation';
  in?: string | string[];
  out?: string | string[];
  permissions?: {
    select?: string;
    create?: string;
    update?: string;
    delete?: string;
  };
  indexes?: SerializedIndex[];
}

/**
 * Serializable index definition
 */
export interface SerializedIndex {
  name: string;
  fields: string[];
  type?: 'unique' | 'fulltext' | 'hnsw';
  analyzer?: string;
  dimension?: number;
  vectorType?: 'float' | 'float32' | 'float64';
  distance?: 'COSINE' | 'EUCLIDEAN' | 'MANHATTAN' | 'MINKOWSKI';
}

/**
 * Snapshot manager for reading and writing schema snapshots
 */
export class SnapshotManager {
  private readonly snapshotsDir: string;

  constructor(snapshotsDir: string) {
    this.snapshotsDir = snapshotsDir;
  }

  /**
   * Get the path to a snapshot file for a given version
   */
  getSnapshotPath(version: string): string {
    return join(this.snapshotsDir, `${version}.json`);
  }

  /**
   * Get the path to the latest snapshot
   * Returns null if no snapshots exist
   */
  async getLatestSnapshotPath(): Promise<string | null> {
    const { readdir } = await import('node:fs/promises');

    try {
      const entries = await readdir(this.snapshotsDir);
      const snapshotFiles = entries
        .filter((e) => e.endsWith('.json'))
        .sort()
        .reverse();

      if (snapshotFiles.length === 0) {
        return null;
      }

      return join(this.snapshotsDir, snapshotFiles[0]);
    } catch {
      return null;
    }
  }

  /**
   * Load the most recent snapshot
   * Returns null if no snapshots exist
   */
  async loadLatestSnapshot(): Promise<SchemaSnapshot | null> {
    const latestPath = await this.getLatestSnapshotPath();

    if (!latestPath) {
      log('No snapshots found in %s', this.snapshotsDir);
      return null;
    }

    return this.loadSnapshot(latestPath);
  }

  /**
   * Load a snapshot by version or path
   */
  async loadSnapshot(versionOrPath: string): Promise<SchemaSnapshot | null> {
    // Check if it's a path (contains / or \)
    const isPath = versionOrPath.includes('/') || versionOrPath.includes('\\');
    const path = isPath ? versionOrPath : this.getSnapshotPath(versionOrPath);

    try {
      const content = await readFile(path, 'utf-8');
      const snapshot = JSON.parse(content) as SchemaSnapshot;

      log('Loaded snapshot: %s (version: %s)', path, snapshot.version);
      return snapshot;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        log('Snapshot not found: %s', path);
        return null;
      }
      throw error;
    }
  }

  /**
   * Save a snapshot
   */
  async saveSnapshot(snapshot: SchemaSnapshot): Promise<string> {
    // Ensure directory exists
    await mkdir(this.snapshotsDir, { recursive: true });

    const path = this.getSnapshotPath(snapshot.version);
    const content = JSON.stringify(snapshot, null, 2);

    await writeFile(path, content, 'utf-8');

    log('Saved snapshot: %s', path);
    return path;
  }

  /**
   * Convert TableDefinition[] to SchemaSnapshot
   *
   * @param tables - Table definitions to serialize
   * @param version - Snapshot version identifier
   * @param name - Human-readable migration name
   * @param access - Raw DefineAccessQuery objects (serialized to SerializedAccess format)
   * @param events - EventConfig objects to serialize (optional)
   */
  createSnapshot(
    tables: TableDefinition[],
    version: string,
    name: string,
    access?: any[],
    events?: EventConfig[],
    functions?: FunctionConfig[],
  ): SchemaSnapshot {
    return {
      version,
      name,
      createdAt: new Date().toISOString(),
      tables: tables.map(serializeTable),
      access: serializeAccess(access),
      events: serializeEvent(events),
      functions: serializeFunction(functions),
    };
  }

  /**
   * Convert SerializedAccess[] to SchemaSnapshot access
   */
  restoreAccess(snapshot: SchemaSnapshot): SerializedAccess[] {
    return snapshot.access ?? [];
  }

  /**
   * Convert SchemaSnapshot to TableDefinition[]
   */
  restoreSnapshot(snapshot: SchemaSnapshot): TableDefinition[] {
    return snapshot.tables.map(restoreTable);
  }
}

/**
 * Serialize a TableDefinition to snapshot format
 */
function serializeTable(table: TableDefinition): SerializedTable {
  return {
    name: table.name,
    columns: table.columns.map(serializeColumn),
    config: serializeTableConfig(table.config),
  };
}

/**
 * Serialize a ColumnDefinition to snapshot format
 */
function serializeColumn(column: ColumnDefinition): SerializedColumn {
  return {
    name: column.name,
    tableName: column.tableName ?? '',
    config: serializeColumnConfig(column.config),
  };
}

/**
 * Serialize column config
 */
function serializeColumnConfig(config: ColumnDefinition['config']): SerializedColumnConfig {
  return {
    type: config.type,
    optional: config.optional,
    readonly: config.readonly,
    flexible: config.flexible,
    default: config.default,
    defaultRaw: config.defaultRaw,
    assert: config.assert,
    permissions: config.permissions,
  };
}

/**
 * Serialize table config
 */
function serializeTableConfig(config: TableDefinition['config']): SerializedTableConfig {
  return {
    schema: config.schema,
    type: config.type,
    in: config.in,
    out: config.out,
    permissions: config.permissions,
    indexes: config.indexes?.map(serializeIndex),
  };
}

/**
 * Serialize an index definition
 */
function serializeIndex(index: IndexDefinition): SerializedIndex {
  return {
    name: index.name,
    fields: index.fields,
    type: index.type,
    analyzer: index.analyzer,
    dimension: index.dimension,
    vectorType: index.vectorType,
    distance: index.distance,
  };
}

/**
 * Serialize access definitions from DefineAccessQuery objects
 *
 * DefineAccessQuery stores config in `acc.config`, so we extract properties
 * from there rather than directly on the object.
 */
function serializeAccess(access: any[] | undefined): SerializedAccess[] {
  return (access ?? []).map((a) => ({
    name: a.config?.name ?? a.name,
    type: a.config?.type ?? a.type,
    level: a.config?.level,
    signup: a.config?.record?.signup,
    signin: a.config?.record?.signin,
    duration: a.config?.duration?.session,
  }));
}

/**
 * Serialize event definitions from EventConfig objects
 *
 * EventConfig uses `on` for table name field; snapshot uses `what`
 * to match SurrealDB's INFO FOR TABLE STRUCTURE convention.
 */
function serializeEvent(events: EventConfig[] | undefined): SerializedEvent[] {
  return (events ?? []).map((e) => ({
    name: e.name,
    what: e.on,
    when: e.when,
    then: [...e.then],
    comment: e.comment,
    async: e.async,
    retry: e.retry,
    maxdepth: e.maxdepth,
  }));
}

/**
 * Serialize function definitions from FunctionConfig objects
 */
function serializeFunction(functions: FunctionConfig[] | undefined): SerializedFunction[] {
  return (functions ?? []).map((f) => ({
    name: f.name,
    args: f.args ? [...f.args] : undefined,
    body: f.body,
    comment: f.comment,
    permissions: f.permissions,
  }));
}

/**
 * Restore a serialized table to TableDefinition
 */
function restoreTable(table: SerializedTable): TableDefinition {
  return {
    name: table.name,
    columns: table.columns.map(restoreColumn),
    config: restoreTableConfig(table.config),
  };
}

/**
 * Restore a serialized column to ColumnDefinition
 */
function restoreColumn(column: SerializedColumn): ColumnDefinition {
  return {
    name: column.name,
    tableName: column.tableName,
    config: restoreColumnConfig(column.config),
  };
}

/**
 * Restore column config
 */
function restoreColumnConfig(config: SerializedColumnConfig): ColumnDefinition['config'] {
  return {
    type: config.type,
    optional: config.optional,
    readonly: config.readonly,
    flexible: config.flexible,
    default: config.default,
    defaultRaw: config.defaultRaw,
    assert: config.assert,
    permissions: config.permissions,
  };
}

/**
 * Restore table config
 */
function restoreTableConfig(config: SerializedTableConfig): TableDefinition['config'] {
  return {
    schema: config.schema ?? 'full',
    type: config.type ?? 'normal',
    in: config.in,
    out: config.out,
    permissions: config.permissions,
    indexes: config.indexes?.map(restoreIndex),
  };
}

/**
 * Restore an index definition
 */
function restoreIndex(index: SerializedIndex): IndexDefinition {
  return {
    name: index.name,
    fields: index.fields,
    type: index.type,
    analyzer: index.analyzer,
    dimension: index.dimension,
    vectorType: index.vectorType,
    distance: index.distance,
  };
}
