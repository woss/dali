/**
 * Migration Runner for DaliORM
 *
 * Uses the new DDL system and journal for tracking migrations.
 */

import { createHash } from 'node:crypto';
import { access, readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createDebug as debug } from 'obug';
import type { SurrealDriver } from '../../sdk/driver/types.js';
import { computeMigrationHash, MigrationJournalManager } from '../ddl/journal.js';

const log = debug('dali-orm:kit:runner');

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
  applied: Array<{ version: string; name: string; appliedAt: string }>;
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
async function getMigrationProgress(
  journal: MigrationJournalManager,
  migrationFiles: MigrationFile[],
  migrationName: string,
): Promise<MigrationProgress | null> {
  const migration = migrationFiles.find((f) => f.name === migrationName);

  // Guard: migration not found
  if (!migration) {
    return null;
  }

  const totalStatements = migration.up.length;
  if (totalStatements === 0) {
    return {
      name: migrationName,
      totalStatements: 0,
      appliedStatements: 0,
    };
  }

  const lastIdx = await journal.getLastSuccessfulStatementIdx(migrationName);
  const appliedStatements = lastIdx === -1 ? 0 : lastIdx + 1;

  return {
    name: migrationName,
    totalStatements,
    appliedStatements,
  };
}

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
export class MigrationRunner {
  private readonly driver: SurrealDriver;
  private readonly config: RunnerConfig;
  private readonly journal: MigrationJournalManager;
  private readonly migrationsTable: string;

  constructor(driver: SurrealDriver, config: RunnerConfig = {}) {
    this.driver = driver;
    this.config = config;
    // No default — let MigrationJournalManager throw if journalDir missing
    this.journal = new MigrationJournalManager({
      dir: config.journalDir,
    });
    const raw = config.migrationsTable ?? '__migrations';
    if (!raw.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
      throw new Error(`Invalid migrationsTable: "${raw}" — must be alphanumeric + underscore`);
    }
    this.migrationsTable = raw;
  }

  /**
   * Initialize migrations table in database
   */
  async init(): Promise<void> {
    log('Initializing migrations table: %s', this.migrationsTable);

    await this.driver.query(`
      DEFINE TABLE IF NOT EXISTS ${this.migrationsTable} SCHEMAFULL
        PERMISSIONS FOR select, create, delete WHERE true;

      DEFINE FIELD IF NOT EXISTS version ON ${this.migrationsTable} TYPE string;
      DEFINE FIELD IF NOT EXISTS name ON ${this.migrationsTable} TYPE string;
      DEFINE FIELD IF NOT EXISTS applied_at ON ${this.migrationsTable} TYPE datetime DEFAULT time::now() READONLY;
      DEFINE FIELD IF NOT EXISTS checksum ON ${this.migrationsTable} TYPE string;
      DEFINE INDEX IF NOT EXISTS idx_checksum ON ${this.migrationsTable} FIELDS checksum UNIQUE;
    `);
  }

  /**
   * Get applied migration names from database table
   */
  private async getDbAppliedMigrations(): Promise<string[]> {
    try {
      const result = await this.driver.query<{ name: string }>(
        `SELECT name FROM ${this.migrationsTable}`,
      );
      const names = result.map((r) => r.name);
      log('DB applied migrations: %d entries — %j', names.length, names);
      return names;
    } catch {
      log('DB migrations table not found or empty');
      return [];
    }
  }

  /**
   * Run pending migrations up to target version
   * DB is source of truth; journal is cache (may be stale)
   */
  async up(targetVersion?: string): Promise<MigrationResult> {
    log('Starting migration up (target: %s)', targetVersion ?? 'latest');

    const applied: string[] = [];
    const skipped: string[] = [];
    const warnings: string[] = [];

    // Load migration files
    const files = await this.loadMigrationFiles();
    if (files.length === 0) {
      log('No migration files found');
      return { applied: [], skipped: [], warnings };
    }

    // Get DB state (source of truth)
    const dbTags = await this.getDbAppliedMigrations();
    const dbTagSet = new Set(dbTags);

    // Get journal state (cache - may be stale)
    const journalTags = await this.journal.getAppliedMigrations();
    const _journalTagSet = new Set(journalTags);

    // Detect inconsistencies: journal says applied but DB missing
    const journalOnly = journalTags.filter((t) => !dbTagSet.has(t));
    if (journalOnly.length > 0) {
      const msg = `Journal out-of-sync: ${journalOnly.length} entries in journal but missing from DB`;
      log(`Warning: ${msg}`);
      warnings.push(msg);
    }

    // Pending = files NOT in DB (trust DB, not journal)
    const pending = files.filter((f) => !dbTagSet.has(f.name));
    log(
      'Pending migrations (DB source of truth): %d — %j',
      pending.length,
      pending.map((f) => f.name),
    );

    // Filter by target version
    const toApply = targetVersion ? pending.filter((f) => f.version <= targetVersion) : pending;
    log('Migrations to apply this run: %d', toApply.length);

    for (const migration of toApply) {
      await this.applyMigration(migration);
      applied.push(migration.name);
    }

    // Mark skipped (migrations after target version, only when target specified)
    if (targetVersion) {
      const afterTarget = pending.filter((f) => f.version > targetVersion);
      skipped.push(...afterTarget.map((f) => f.name));
    }

    // Sync journal to match DB state after applying
    await this.syncJournalWithDb();

    log(
      'Migration up complete: applied=%d, skipped=%d, warnings=%d',
      applied.length,
      skipped.length,
      warnings.length,
    );
    return { applied, skipped, warnings };
  }

  /**
   * Get migration status
   */
  async status(): Promise<MigrationStatus> {
    const files = await this.loadMigrationFiles();

    // Get applied from DB (__migrations table) - handle missing table gracefully
    let appliedRecords: { name: string; applied_at: string }[] = [];
    try {
      const dbResult = await this.driver.query<{ name: string; applied_at: string }>(
        `SELECT name, applied_at FROM ${this.migrationsTable} ORDER BY applied_at`,
      );
      appliedRecords = dbResult;
    } catch {
      // __migrations table doesn't exist yet - return empty
      log('Migrations table not found, returning empty status');
    }
    const appliedTags = appliedRecords.map((r) => r.name);

    // Build applied list with version from files
    const applied: MigrationStatus['applied'] = appliedRecords.map((record) => {
      const file = files.find((f) => f.name === record.name);
      return {
        version: file?.version ?? 'unknown',
        name: record.name,
        appliedAt:
          typeof record.applied_at === 'string'
            ? record.applied_at
            : String(record.applied_at ?? ''),
      };
    });

    // Pending = files not in applied
    const pending = files.filter((f) => !appliedTags.includes(f.name));

    // Current = last applied
    const current =
      applied.length > 0
        ? (files.find((f) => f.name === applied[applied.length - 1].name)?.version ?? null)
        : null;

    return { applied, pending, current };
  }

  /**
   * Load migration files from disk
   *
   * Format: `{version}_{name}/migration.surql` in the migrations directory
   */
  private async loadMigrationFiles(): Promise<MigrationFile[]> {
    const dir = this.config.migrationsDir;

    // Guard: no dir means no files
    if (!dir) {
      return [];
    }

    try {
      const dirStat = await stat(dir);
      if (!dirStat.isDirectory()) {
        throw new Error(`Migrations path is not a directory: ${dir}`);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    log('Loading migrations from: %s', dir);
    const entries = await readdir(dir);
    const migrations: MigrationFile[] = [];

    for (const entry of entries) {
      try {
        const entryPath = join(dir, entry);
        const entryStat = await stat(entryPath);

        // Only process directories containing migration.surql
        if (!entryStat.isDirectory()) continue;

        const migrationFilePath = join(entryPath, 'migration.surql');
        try {
          await stat(migrationFilePath);
        } catch {
          continue; // No migration.surql in this directory
        }

        const underscoreIndex = entry.indexOf('_');
        if (underscoreIndex === -1) continue;

        const version = entry.slice(0, underscoreIndex);
        const name = entry.slice(underscoreIndex + 1);
        if (!version || !name) continue;

        const content = await readFile(migrationFilePath, 'utf-8');
        const checksum = computeMigrationHash(content);
        const parsed = this.parseMigrationFileContent(content);

        migrations.push({
          version,
          name,
          up: parsed.up,
          checksum,
          path: migrationFilePath,
        });
      } catch (error) {
        log('Failed to load migration %s: %O', entry, error);
      }
    }

    // Sort by version
    migrations.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));

    log(
      'Loaded %d migration files: %j',
      migrations.length,
      migrations.map((m) => `${m.version}_${m.name}`),
    );
    return migrations;
  }

  /**
   * Parse migration file content
   */
  private parseMigrationFileContent(content: string): { up: string[] } {
    // Phase 9 removed -- DOWN sections from migration files so the (?:--\s*DOWN|$) alternation is no longer needed
    const upMatch = content.match(/--\s*UP\s*\n([\s\S]*?)$/i);
    const upStatements = upMatch ? this.parseStatements(upMatch[1]) : [];

    return { up: upStatements };
  }

  /**
   * Parse SQL statements from section
   */
  private parseStatements(sectionContent: string): string[] {
    const withoutComments = sectionContent
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    return withoutComments
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * Apply a single migration with resumable per-statement tracking
   */
  private async applyMigration(migration: MigrationFile): Promise<MigrationResult> {
    log('Applying migration: %s', migration.name);

    // Check for partial migration and resume if needed
    const partial = await this.journal.getPartialMigration(migration.name);
    if (partial) {
      log('Found partial migration: %s, attempting resume', migration.name);
      return this.resume(migration);
    }

    // Create breakpoints array (all false initially)
    const breakpoints = migration.up.map(() => false);

    // Compute hash from UP statements for duplicate detection
    const migrationContent = migration.up.join('\n');
    const migrationHash = computeMigrationHash(migrationContent);

    // Add journal entry BEFORE starting with empty/partial breakpoints
    const journal = await this.journal.read();

    // Remove stale all-false entries for same tag (prevents duplicate entries)
    journal.entries = journal.entries.filter(
      (e) => e.tag !== migration.name || e.breakpoints.some((b) => b === true),
    );

    // Recalculate idx after potential removal
    const nextIdx =
      journal.entries.length > 0 ? Math.max(...journal.entries.map((e) => e.idx)) + 1 : 1;

    journal.entries.push({
      idx: nextIdx,
      when: '', // placeholder — set after DB INSERT succeeds
      tag: migration.name,
      breakpoints,
      hash: migrationHash,
    });
    await this.journal.write(journal);
    log(
      'Created journal entry with empty breakpoints for: %s (hash: %s)',
      migration.name,
      migrationHash,
    );

    // Execute each statement in its own transaction
    let currentIdx = 0;
    try {
      for (const sql of migration.up) {
        // Execute each statement directly (no transaction - DDL may not support it)
        log(
          'Executing SQL[%d/%d]: %s',
          currentIdx + 1,
          migration.up.length,
          sql.replace(/\n/g, ' ').slice(0, 120),
        );
        await this.driver.query(sql);

        // Mark checkpoint as true after successful statement
        breakpoints[currentIdx] = true;
        try {
          await this.journal.updateBreakpoints(migration.name, [...breakpoints]);
        } catch (journalError) {
          log('Failed to update checkpoints (non-fatal): %O', journalError);
          // Non-fatal: SQL already succeeded, breakpoints corrected on next update
        }
        log('Statement %d completed for: %s', currentIdx + 1, migration.name);

        currentIdx++;
      }

      // All statements succeeded - record in database FIRST (source of truth)
      const insertResult = await this.driver.query<{ applied_at: string }>(
        `INSERT INTO ${this.migrationsTable} (version, name, applied_at, checksum) VALUES ($version, $name, time::now(), $checksum) RETURN applied_at`,
        {
          version: migration.version,
          name: migration.name,
          checksum: migration.checksum,
        },
      );
      // Set `when` from DB's authoritative timestamp
      if (insertResult && insertResult.length > 0 && insertResult[0]?.applied_at) {
        const appliedAt = insertResult[0].applied_at;
        try {
          const j = await this.journal.read();
          const e = j.entries.find((en: { tag: string }) => en.tag === migration.name);
          if (e) {
            e.when = typeof appliedAt === 'string' ? appliedAt : String(appliedAt);
            await this.journal.write(j);
          }
        } catch (jErr) {
          log('Failed to update `when` from DB timestamp: %O', jErr);
        }
      }

      // Then mark journal complete (cache follows reality)
      const finalBreakpoints = migration.up.map(() => true);
      try {
        await this.journal.updateBreakpoints(migration.name, finalBreakpoints);
      } catch (journalError) {
        log('Failed to mark migration complete in journal: %O', journalError);
        throw new Error(
          `Migration completion checkpoint failed: ${(journalError as Error).message}`,
        );
      }

      log('Migration fully applied: %s', migration.name);
      return { applied: [migration.name], skipped: [] };
    } catch (error) {
      log('Migration failed at statement %d: %s', currentIdx, (error as Error).message);

      // Mark migration as failed (breakpoints show partial state)
      try {
        await this.journal.updateBreakpoints(migration.name, breakpoints);
      } catch (journalError) {
        log('Failed to record failure checkpoint: %O', journalError);
        // Original error is more important, but log the journal failure
      }
      throw error;
    }
  }

  /**
   * Resume a partially applied migration
   */
  async resume(migrationFile?: MigrationFile): Promise<MigrationResult> {
    log('Attempting to resume migration');

    // If no migration file provided, we need to find the partial one
    if (!migrationFile) {
      const files = await this.loadMigrationFiles();
      const partialTags = await this.findPartialMigrations();

      if (partialTags.length === 0) {
        throw new Error('No partial migrations found to resume');
      }

      // Resume the first partial migration
      migrationFile = files.find((f) => partialTags.includes(f.name));
      if (!migrationFile) {
        throw new Error('Migration file not found for partial migration');
      }
    }

    // Get last successful statement index
    const lastSuccessfulIdx = await this.journal.getLastSuccessfulStatementIdx(migrationFile.name);

    if (lastSuccessfulIdx === -1) {
      // Check if journal entry exists (partial with all-false breakpoints vs no entry)
      const hasEntry = await this.journal.isApplied(migrationFile.name);
      if (!hasEntry) {
        throw new Error(`No journal entry found for migration: ${migrationFile.name}`);
      }
      log('No statements succeeded yet for migration: %s, retrying from start', migrationFile.name);
    }

    // Verify checksum matches before resuming
    const files = await this.loadMigrationFiles();
    const currentFile = files.find((f) => f.name === migrationFile.name);

    if (!currentFile) {
      throw new Error(`Migration file not found: ${migrationFile.name}`);
    }

    if (currentFile.checksum !== migrationFile.checksum) {
      throw new Error(
        `Checksum mismatch! File has changed since last attempt. ` +
          `Expected: ${migrationFile.checksum}, Got: ${currentFile.checksum}`,
      );
    }

    log('Resuming from statement index: %d', lastSuccessfulIdx + 1);

    // Continue applying from the next statement
    const breakpoints = migrationFile.up.map((_, i) => i <= lastSuccessfulIdx);
    let currentIdx = lastSuccessfulIdx + 1;
    try {
      for (let i = currentIdx; i < migrationFile.up.length; i++) {
        const sql = migrationFile.up[i];

        // Execute directly (no transaction - DDL may not support it)
        await this.driver.query(sql);

        breakpoints[i] = true;
        try {
          await this.journal.updateBreakpoints(migrationFile.name, [...breakpoints]);
        } catch (journalError) {
          log('Failed to update resume checkpoints (non-fatal): %O', journalError);
          // Non-fatal: SQL already succeeded, breakpoints corrected on next update
        }
        log('Resumed statement %d completed for: %s', i + 1, migrationFile.name);

        currentIdx = i + 1;
      }

      // All statements succeeded - record in database FIRST (source of truth)
      await this.driver.query(
        `INSERT INTO ${this.migrationsTable} (version, name, applied_at, checksum) VALUES ($version, $name, time::now(), $checksum)`,
        {
          version: migrationFile.version,
          name: migrationFile.name,
          checksum: migrationFile.checksum,
        },
      );

      // Then mark journal complete (cache follows reality)
      const finalBreakpoints = migrationFile.up.map(() => true);
      try {
        await this.journal.updateBreakpoints(migrationFile.name, finalBreakpoints);
      } catch (journalError) {
        log('Failed to mark resume migration complete: %O', journalError);
        throw new Error(`Resume completion checkpoint failed: ${(journalError as Error).message}`);
      }

      log('Migration fully applied after resume: %s', migrationFile.name);
      return { applied: [migrationFile.name], skipped: [] };
    } catch (error) {
      log('Resume failed at statement %d: %s', currentIdx, (error as Error).message);

      try {
        await this.journal.updateBreakpoints(migrationFile.name, breakpoints);
      } catch (journalError) {
        log('Failed to record resume failure checkpoint: %O', journalError);
      }
      throw error;
    }
  }

  /**
   * Find all partially applied migrations
   *
   * Uses `getLastSuccessfulStatementIdx` to compare applied vs total statements
   * instead of raw breakpoint inspection. This correctly handles stale journal
   * entries where a duplicate entry has trailing false breakpoints but the
   * migration is fully applied in DB.
   */
  async findPartialMigrations(): Promise<string[]> {
    const journal = await this.journal.read();
    const files = await this.loadMigrationFiles();
    const seen = new Set<string>();
    const partial: string[] = [];

    for (const entry of journal.entries) {
      if (seen.has(entry.tag)) continue;
      seen.add(entry.tag);

      const migrationFile = files.find((f) => f.name === entry.tag);
      if (!migrationFile) {
        // Migration file missing — fall back to breakpoint check
        if (entry.breakpoints.some((b) => b === false)) {
          partial.push(entry.tag);
        }
        continue;
      }

      const totalStatements = migrationFile.up.length;
      if (totalStatements === 0) continue;

      const lastIdx = await this.journal.getLastSuccessfulStatementIdx(entry.tag);
      const appliedStatements = lastIdx === -1 ? 0 : lastIdx + 1;

      if (appliedStatements < totalStatements) {
        partial.push(entry.tag);
      }
    }

    return partial;
  }

  /**
   * Get progress for a specific migration
   */
  async getMigrationProgress(migrationName: string): Promise<MigrationProgress | null> {
    const files = await this.loadMigrationFiles();
    return getMigrationProgress(this.journal, files, migrationName);
  }

  /**
   * Get progress for all partial migrations
   */
  async getPartialMigrationsProgress(): Promise<MigrationProgress[]> {
    const partialTags = await this.findPartialMigrations();
    const files = await this.loadMigrationFiles();
    const progress: MigrationProgress[] = [];

    for (const tag of partialTags) {
      const p = await getMigrationProgress(this.journal, files, tag);
      if (p) {
        progress.push(p);
      }
    }

    return progress;
  }

  /**
   * Load migration files (exposed for CLI)
   */
  async getMigrationFiles(): Promise<MigrationFile[]> {
    return this.loadMigrationFiles();
  }

  /**
   * Sync journal to match DB state.
   * Journal should reflect reality (DB), not vice versa.
   * Preserves existing entries' `when` values — immutable after first set.
   */
  public async syncJournalWithDb(): Promise<void> {
    log('Syncing journal with DB state');

    const dbRecords = await this.driver.query<{
      name: string;
      checksum: string;
      applied_at: string;
    }>(`SELECT name, checksum, applied_at FROM ${this.migrationsTable} ORDER BY applied_at`);

    const journal = await this.journal.read();
    const migrationFiles = await this.loadMigrationFiles();
    log('Sync: found %d DB migration records', dbRecords.length);

    // Build map of existing entries by tag — preserve `when` values
    const existingByTag = new Map<string, (typeof journal.entries)[0]>();
    for (const entry of journal.entries) {
      existingByTag.set(entry.tag, entry);
    }

    // Only add entries from DB that don't exist in journal
    const merged: typeof journal.entries = [];
    for (const record of dbRecords) {
      const existing = existingByTag.get(record.name);
      if (existing) {
        // Preserve existing entry with original `when` — immutable after first set
        merged.push(existing);
      } else {
        // New entry — use DB `applied_at`
        const hash = record.checksum || createHash('sha256').update(record.name).digest('hex');
        const migrationFile = migrationFiles.find((f) => f.name === record.name);
        const breakpoints = migrationFile ? migrationFile.up.map(() => true) : [true];
        merged.push({
          idx: merged.length + 1,
          when: typeof record.applied_at === 'string' ? record.applied_at : '',
          tag: record.name,
          breakpoints,
          hash,
        });
      }
    }

    // Only write if entries changed or journal file doesn't exist yet
    let journalExists = false;
    try {
      await access(this.journal.getPath());
      journalExists = true;
    } catch {
      // File doesn't exist — always write to create it
    }

    const currentJson = JSON.stringify(journal.entries);
    const newJson = JSON.stringify(merged);
    if (!journalExists || currentJson !== newJson) {
      await this.journal.write({
        version: journal.version,
        dialect: journal.dialect,
        id: journal.id,
        entries: merged,
      });
      log('Journal synced with %d DB records', merged.length);
    } else {
      log('Journal already in sync — no write needed');
    }
  }
}

/**
 * Create migration runner
 */
export function createRunner(driver: SurrealDriver, config?: RunnerConfig): MigrationRunner {
  return new MigrationRunner(driver, config);
}
