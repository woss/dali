/**
 * Meta Journal System for SurrealDB Migrations
 *
 * Follows Drizzle v7 pattern with meta/_journal.json format.
 * Each entry has: idx, when (timestamp), tag, breakpoints
 */
/**
 * Journal entry for a single migration folder
 */
export interface JournalEntry {
    /** Sequential index */
    idx: number;
    /** ISO timestamp when migration was applied */
    when: string;
    /** Migration folder/tag name */
    tag: string;
    /** Breakpoints for batch migrations */
    breakpoints: boolean[];
    /** Hash of migration content for duplicate detection */
    hash: string;
}
/**
 * Complete journal structure (matches Drizzle's _journal.json)
 */
export interface MigrationJournal {
    /** Journal version */
    version: number;
    /** dialect identifier */
    dialect: string;
    /** Unique journal ID */
    id: string;
    /** Array of migration entries (sorted by idx) */
    entries: JournalEntry[];
}
/**
 * Journal configuration
 */
export interface JournalConfig {
    /** Directory for journal file (default: ./meta) */
    dir?: string;
    /** Journal filename (default: _journal.json) */
    filename?: string;
    /** Dialect name (default: 'surrealdb') */
    dialect?: string;
}
/**
 * Migration Journal Manager
 *
 * Follows Drizzle v7 pattern with meta/_journal.json format.
 * Each entry has: idx, when (timestamp), tag, breakpoints
 */
export declare class MigrationJournalManager {
    private config;
    private journalPath;
    constructor(config?: JournalConfig);
    /**
     * Get journal file path
     */
    getPath(): string;
    /**
     * Read journal from disk
     * Returns empty journal if file doesn't exist
     */
    read(): Promise<MigrationJournal>;
    /**
     * Write journal to disk
     */
    write(journal: MigrationJournal): Promise<void>;
    /**
     * Create empty journal with defaults
     */
    createEmpty(): MigrationJournal;
    /**
     * Add a new migration entry
     */
    addEntry(tag: string, migrationHash: string, statements: string[], when?: string): Promise<MigrationJournal>;
    /**
     * Get all applied migration tags
     */
    getAppliedMigrations(): Promise<string[]>;
    /**
     * Check if a migration has been applied
     */
    isApplied(tag: string): Promise<boolean>;
    /**
     * Get journal status
     */
    getStatus(): Promise<{
        total: number;
        lastApplied: JournalEntry | null;
        applied: string[];
    }>;
    /**
     * Update breakpoints for a migration entry
     */
    updateBreakpoints(tag: string, breakpoints: boolean[]): Promise<JournalEntry | null>;
    /**
     * Get partial migration entry (where some breakpoints are false)
     */
    getPartialMigration(tag: string): Promise<JournalEntry | null>;
    /**
     * Check if migration is fully applied (all breakpoints true)
     */
    isMigrationComplete(tag: string): Promise<boolean>;
    /**
     * Get index of last successful statement
     */
    getLastSuccessfulStatementIdx(tag: string): Promise<number>;
}
/**
 * Create journal manager with default config
 */
export declare function createJournal(config?: JournalConfig): MigrationJournalManager;
/**
 * Helper to compute migration file hash
 */
export declare function computeMigrationHash(content: string): string;
//# sourceMappingURL=journal.d.ts.map