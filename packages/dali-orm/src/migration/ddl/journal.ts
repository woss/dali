/**
 * Meta Journal System for SurrealDB Migrations
 *
 * Follows Drizzle v7 pattern with meta/_journal.json format.
 * Each entry has: idx, when (timestamp), tag, breakpoints
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createDebug as debug } from 'obug';

const log = debug('dali-orm:kit:journal');

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
 * Default journal configuration
 */
const DEFAULT_CONFIG: JournalConfig = {
  // dir: no default — must be provided explicitly
  filename: '_journal.json',
  dialect: 'surrealdb',
};

/**
 * Migration Journal Manager
 *
 * Follows Drizzle v7 pattern with meta/_journal.json format.
 * Each entry has: idx, when (timestamp), tag, breakpoints
 */
export class MigrationJournalManager {
  private config: Required<JournalConfig>;
  private journalPath: string;

  constructor(config: JournalConfig = {}) {
    // Guard: dir is required
    if (!config.dir) {
      throw new Error(
        'MigrationJournalManager: journalDir is required. ' +
          'Set migrations.journalDir in dali-orm.config.ts or pass it explicitly.',
      );
    }
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<JournalConfig>;
    this.journalPath = path.join(this.config.dir, this.config.filename);
  }

  /**
   * Get journal file path
   */
  getPath(): string {
    return this.journalPath;
  }

  /**
   * Read journal from disk
   * Returns empty journal if file doesn't exist
   */
  async read(): Promise<MigrationJournal> {
    log('Reading journal: %s', this.journalPath);
    try {
      const content = await fs.readFile(this.journalPath, 'utf-8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        log('Corrupted journal file at %s, returning empty journal', this.journalPath);
        return this.createEmpty();
      }
      const data = parsed as {
        version?: number;
        dialect?: string;
        id?: string;
        entries?: Array<Record<string, unknown>>;
      };
      const journal: MigrationJournal = {
        version: data.version ?? 1,
        dialect: data.dialect ?? 'surrealdb',
        id: data.id ?? generateId(),
        entries: Array.isArray(data.entries) ? (data.entries as unknown as JournalEntry[]) : [],
      };

      // Normalize entries at boundary (Parse Don't Validate)
      // Handle old format: breakpoint (boolean) -> breakpoints (boolean[])
      // Handle old format: name/version -> tag, applied_at -> when
      journal.entries = journal.entries.map((entry: any) => ({
        idx: (entry.idx ?? 0) as number,
        tag: (entry.tag ??
          entry.name ??
          entry.version ??
          `migration_${String(entry.idx ?? 0)}`) as string,
        when: (entry.when ?? entry.applied_at ?? '') as string,
        breakpoints: Array.isArray(entry.breakpoints)
          ? (entry.breakpoints as boolean[])
          : [entry.breakpoint !== false],
        hash: (entry.hash ?? '') as string,
      }));

      log('Loaded journal with %d entries', journal.entries.length);
      return journal;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        log('No journal file found, returning empty journal');
        return this.createEmpty();
      }
      throw error;
    }
  }

  /**
   * Write journal to disk
   */
  async write(journal: MigrationJournal): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(this.config.dir, { recursive: true });

    const content = JSON.stringify(journal, null, 2);
    await fs.writeFile(this.journalPath, content, 'utf-8');

    log('Wrote journal with %d entries to %s', journal.entries.length, this.journalPath);
  }

  /**
   * Create empty journal with defaults
   */
  createEmpty(): MigrationJournal {
    return {
      version: 1,
      dialect: this.config.dialect,
      id: generateId(),
      entries: [],
    };
  }

  /**
   * Add a new migration entry
   */
  async addEntry(
    tag: string,
    migrationHash: string,
    statements: string[],
    when?: string,
  ): Promise<MigrationJournal> {
    // Fail fast: hash is mandatory
    if (!migrationHash) {
      throw new Error('migrationHash is required for journal entry');
    }

    const journal = await this.read();

    const nextIdx =
      journal.entries.length > 0 ? Math.max(...journal.entries.map((e) => e.idx)) + 1 : 1;

    const entry: JournalEntry = {
      idx: nextIdx,
      when: when ?? '', // caller must provide — no JS timestamp fallback
      tag,
      breakpoints: statements.map(() => true),
      hash: migrationHash,
    };

    journal.entries.push(entry);

    await this.write(journal);
    log('Added journal entry: idx=%d, tag=%s, hash=%s', nextIdx, tag, migrationHash);

    return journal;
  }

  /**
   * Get all applied migration tags
   */
  async getAppliedMigrations(): Promise<string[]> {
    const journal = await this.read();
    const tags = journal.entries.map((e) => e.tag);
    log('getAppliedMigrations: %d entries — %j', tags.length, tags);
    return tags;
  }

  /**
   * Check if a migration has been applied
   */
  async isApplied(tag: string): Promise<boolean> {
    const journal = await this.read();
    // A migration is "applied" if any entry exists with at least one true breakpoint
    // (all-false entries are stale duplicates and should be ignored)
    return journal.entries.some((e) => e.tag === tag && e.breakpoints.some((b) => b === true));
  }


  /**
   * Get journal status
   */
  async getStatus(): Promise<{
    total: number;
    lastApplied: JournalEntry | null;
    applied: string[];
  }> {
    const journal = await this.read();
    const lastApplied =
      journal.entries.length > 0 ? journal.entries[journal.entries.length - 1] : null;

    return {
      total: journal.entries.length,
      lastApplied,
      applied: journal.entries.map((e) => e.tag),
    };
  }

  /**
   * Update breakpoints for a migration entry
   */
  async updateBreakpoints(tag: string, breakpoints: boolean[]): Promise<JournalEntry | null> {
    const journal = await this.read();
    const entry = journal.entries.find((e) => e.tag === tag);

    if (!entry) {
      return null;
    }

    entry.breakpoints = breakpoints;
    await this.write(journal);
    log('Updated breakpoints for: %s', tag);

    return entry;
  }

  /**
   * Get partial migration entry (where some breakpoints are false)
   */
  async getPartialMigration(tag: string): Promise<JournalEntry | null> {
    const journal = await this.read();

    // Check ALL entries for this tag (not just first)
    const matchingEntries = journal.entries.filter((e) => e.tag === tag);

    // Return first partial entry found
    for (const entry of matchingEntries) {
      if (entry.breakpoints.some((b) => b === false)) {
        return entry;
      }
    }

    return null;
  }

  /**
   * Check if migration is fully applied (all breakpoints true)
   */
  async isMigrationComplete(tag: string): Promise<boolean> {
    const journal = await this.read();
    const matchingEntries = journal.entries.filter((e) => e.tag === tag);
    if (matchingEntries.length === 0) {
      throw new Error(`Migration not found: ${tag}`);
    }
    // Return true if ANY entry for this tag is fully applied
    return matchingEntries.some((e) => e.breakpoints.every((b) => b === true));
  }

  /**
   * Get index of last successful statement
   */
  async getLastSuccessfulStatementIdx(tag: string): Promise<number> {
    const journal = await this.read();

    // Find ALL entries matching this tag, use the one with most true breakpoints
    const matchingEntries = journal.entries.filter((e) => e.tag === tag);
    if (matchingEntries.length === 0) {
      return -1;
    }

    // Pick entry with most true breakpoints (best progress)
    let bestEntry = matchingEntries[0];
    for (const entry of matchingEntries) {
      const trueCount = entry.breakpoints.filter(Boolean).length;
      const bestTrueCount = bestEntry.breakpoints.filter(Boolean).length;
      if (trueCount > bestTrueCount) {
        bestEntry = entry;
      }
    }

    if (bestEntry.breakpoints.length === 0) {
      return -1;
    }

    return bestEntry.breakpoints.lastIndexOf(true);
  }
}

/**
 * Generate unique ID for journal
 */
function generateId(): string {
  return createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').slice(0, 12);
}

/**
 * Create journal manager with default config
 */
export function createJournal(config?: JournalConfig): MigrationJournalManager {
  return new MigrationJournalManager(config);
}

/**
 * Helper to compute migration file hash
 */
export function computeMigrationHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
