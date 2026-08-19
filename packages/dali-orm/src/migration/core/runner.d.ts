/**
 * Migration Runner for DaliORM
 *
 * Uses the new DDL system and journal for tracking migrations.
 */
import type { SurrealDriver } from '../../sdk/driver/types.js';
import type { MigrationFile, MigrationResult, MigrationStatus, MigrationProgress } from './migration-utils.js';
export type { MigrationFile, MigrationResult, MigrationStatus, MigrationProgress, } from './migration-utils.js';
/**
 * Runner configuration
 */
export interface RunnerConfig {
    /** Migrations directory (required) */
    migrationsDir?: string;
    /** Journal directory (required) — no default, must be provided */
    journalDir?: string;
    /** Migrations table in database (default: __migrations) */
    migrationsTable?: string;
}
/**
 * Migration Runner
 */
export declare class MigrationRunner {
    private readonly driver;
    private readonly config;
    private readonly journal;
    private readonly migrationsTable;
    constructor(driver: SurrealDriver, config?: RunnerConfig);
    /**
     * Initialize migrations table in database
     */
    init(): Promise<void>;
    /**
     * Get applied migration names from database table
     */
    private getDbAppliedMigrations;
    /**
     * Run pending migrations up to target version
     * DB is source of truth; journal is cache (may be stale)
     */
    up(targetVersion?: string): Promise<MigrationResult>;
    /**
     * Get migration status
     */
    status(): Promise<MigrationStatus>;
    /**
     * Apply a single migration with resumable per-statement tracking
     */
    private applyMigration;
    /**
     * Resume a partially applied migration
     */
    resume(migrationFile?: MigrationFile): Promise<MigrationResult>;
    /**
     * Find all partially applied migrations
     *
     * Uses `getLastSuccessfulStatementIdx` to compare applied vs total statements
     * instead of raw breakpoint inspection. This correctly handles stale journal
     * entries where a duplicate entry has trailing false breakpoints but the
     * migration is fully applied in DB.
     */
    findPartialMigrations(): Promise<string[]>;
    /**
     * Get progress for a specific migration
     */
    getMigrationProgress(migrationName: string): Promise<MigrationProgress | null>;
    /**
     * Get progress for all partial migrations
     */
    getPartialMigrationsProgress(): Promise<MigrationProgress[]>;
    /**
     * Load migration files (exposed for CLI)
     */
    getMigrationFiles(): Promise<MigrationFile[]>;
    /**
     * Sync journal to match DB state.
     * Journal should reflect reality (DB), not vice versa.
     * Preserves existing entries' `when` values — immutable after first set.
     */
    syncJournalWithDb(): Promise<void>;
}
/**
 * Create migration runner
 */
export declare function createRunner(driver: SurrealDriver, config?: RunnerConfig): MigrationRunner;
//# sourceMappingURL=runner.d.ts.map