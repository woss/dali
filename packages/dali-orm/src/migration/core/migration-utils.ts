/**
 * Stateless file-loading and parsing utilities for migrations.
 *
 * Extracted from MigrationRunner to keep runner focused on orchestration.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createDebug as debug } from 'obug';
import { MigrationError } from '../../core/errors.js';
import type { MigrationJournalManager } from '../ddl/journal.js';
import { computeMigrationHash } from '../ddl/journal.js';

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
export async function getMigrationProgress(
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
 * Load migration files from disk
 *
 * Format: `{version}_{name}/migration.surql` in the migrations directory
 */
export async function loadMigrationFiles(
  dir: string | undefined,
): Promise<MigrationFile[]> {
  // Guard: no dir means no files
  if (!dir) {
    return [];
  }

  try {
    const dirStat = await stat(dir);
    if (!dirStat.isDirectory()) {
      throw new MigrationError(`Migrations path is not a directory: ${dir}`);
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
      const parsed = parseMigrationFileContent(content);

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
  migrations.sort((a, b) =>
    a.version.localeCompare(b.version, undefined, { numeric: true }),
  );

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
export function parseMigrationFileContent(content: string): { up: string[] } {
  // Phase 9 removed -- DOWN sections from migration files so the (?:--\s*DOWN|$) alternation is no longer needed
  const upMatch = content.match(/--\s*UP\s*\n([\s\S]*?)$/i);
  const upStatements = upMatch ? parseStatements(upMatch[1]) : [];

  return { up: upStatements };
}

/**
 * Parse SQL statements from section
 */
export function parseStatements(sectionContent: string): string[] {
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
 * Scan migration UP statements for destructive operations that cannot be
 * automatically rolled back. Returns advisory warning messages.
 */
export function findDestructiveOps(migration: MigrationFile): string[] {
  const patterns: { pattern: RegExp; description: string }[] = [
    {
      pattern: /\bDROP\s+(TABLE|FIELD|INDEX|EVENT|FUNCTION|PARAM)\b/i,
      description: 'DROP',
    },
    {
      pattern: /\bREMOVE\s+(TABLE|FIELD|INDEX|EVENT|FUNCTION|PARAM)\b/i,
      description: 'REMOVE',
    },
    { pattern: /\bDELETE\s+FROM\b/i, description: 'DELETE FROM' },
  ];
  const warnings: string[] = [];
  for (const sql of migration.up) {
    for (const { pattern, description } of patterns) {
      if (pattern.test(sql)) {
        const truncated = sql.replace(/\s+/g, ' ').trim().slice(0, 100);
        warnings.push(
          `Migration ${migration.name} contains ${description}: "${truncated}" — cannot be rolled back automatically`,
        );
      }
    }
  }
  return warnings;
}
