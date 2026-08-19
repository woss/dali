/**
 * Schema Snapshots for Incremental Migration
 *
 * This module provides snapshot functionality inspired by Drizzle ORM:
 * - Snapshots represent the schema state AFTER each migration
 * - Compare current code schema vs last snapshot for incremental generation
 * - Fallback to empty schema if no snapshot exists (first migration)
 */
import type { SurrealColumnType } from '../../sdk/schema/column/types.js';
import type { EventConfig, FunctionConfig } from '../../sdk/schema.js';
import type { AnalyzerDefinition, TableDefinition } from '../../sdk/table.js';
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
    /** Serialized analyzer definitions */
    analyzers: SerializedAnalyzer[];
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
 * Serializable analyzer definition
 */
export interface SerializedAnalyzer {
    name: string;
    tokenizers?: string;
    filters?: string;
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
export declare class SnapshotManager {
    private readonly snapshotsDir;
    constructor(snapshotsDir: string);
    /**
     * Get the path to a snapshot file for a given version
     */
    getSnapshotPath(version: string): string;
    /**
     * Get the path to the latest snapshot
     * Returns null if no snapshots exist
     */
    getLatestSnapshotPath(): Promise<string | null>;
    /**
     * Load the most recent snapshot
     * Returns null if no snapshots exist
     */
    loadLatestSnapshot(): Promise<SchemaSnapshot | null>;
    /**
     * Load a snapshot by version or path
     */
    loadSnapshot(versionOrPath: string): Promise<SchemaSnapshot | null>;
    /**
     * Save a snapshot
     */
    saveSnapshot(snapshot: SchemaSnapshot): Promise<string>;
    /**
     * Convert TableDefinition[] to SchemaSnapshot
     *
     * @param tables - Table definitions to serialize
     * @param version - Snapshot version identifier
     * @param name - Human-readable migration name
     * @param access - Raw DefineAccessQuery objects (serialized to SerializedAccess format)
     * @param events - EventConfig objects to serialize (optional)
     */
    createSnapshot(tables: TableDefinition[], version: string, name: string, access?: any[], events?: EventConfig[], functions?: FunctionConfig[], analyzers?: AnalyzerDefinition[]): SchemaSnapshot;
    /**
     * Convert SerializedAccess[] to SchemaSnapshot access
     */
    restoreAccess(snapshot: SchemaSnapshot): SerializedAccess[];
    /**
     * Convert SchemaSnapshot to SerializedAnalyzer[]
     */
    restoreAnalyzer(snapshot: SchemaSnapshot): SerializedAnalyzer[];
    /**
     * Convert SchemaSnapshot to TableDefinition[]
     */
    restoreSnapshot(snapshot: SchemaSnapshot): TableDefinition[];
}
//# sourceMappingURL=snapshot.d.ts.map