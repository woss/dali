/**
 * Stateless file-loading and parsing utilities for migrations.
 *
 * Extracted from MigrationRunner to keep runner focused on orchestration.
 */
import type { MigrationJournalManager } from '../ddl/journal.js';
/**
 * Migration file structure
 */
export interface MigrationFile {
    /** Version/timestamp from filename */
    version: string;
    /** Human-readable name from filename */
    name: string;
    /** SQL statements for applying */
    up: string[];
    /** Hash of content for verification */
    checksum: string;
    /** Full file path */
    path: string;
}
/**
 * Migration result
 */
export interface MigrationResult {
    applied: string[];
    skipped: string[];
    warnings?: string[];
}
/**
 * Migration status
 */
export interface MigrationStatus {
    applied: Array<{
        version: string;
        name: string;
        appliedAt: string;
    }>;
    pending: MigrationFile[];
    current: string | null;
}
/**
 * Migration progress info
 */
export interface MigrationProgress {
    name: string;
    totalStatements: number;
    appliedStatements: number;
}
/**
 * Get migration progress for a specific migration
 */
export declare function getMigrationProgress(journal: MigrationJournalManager, migrationFiles: MigrationFile[], migrationName: string): Promise<MigrationProgress | null>;
/**
 * Load migration files from disk
 *
 * Format: `{version}_{name}/migration.surql` in the migrations directory
 */
export declare function loadMigrationFiles(dir: string | undefined): Promise<MigrationFile[]>;
/**
 * Parse migration file content
 */
export declare function parseMigrationFileContent(content: string): {
    up: string[];
};
/**
 * Parse SQL statements from section
 */
export declare function parseStatements(sectionContent: string): string[];
/**
 * Scan migration UP statements for destructive operations that cannot be
 * automatically rolled back. Returns advisory warning messages.
 */
export declare function findDestructiveOps(migration: MigrationFile): string[];
//# sourceMappingURL=migration-utils.d.ts.map