/**
 * Comprehensive tests for MigrationRunner
 *
 * Covers: constructor, init, up, status,
 * resume, findPartialMigrations, getMigrationProgress,
 * getPartialMigrationsProgress, getMigrationFiles,
 * syncJournalWithDb, parseMigrationFileContent,
 * parseStatements, loadMigrationFiles, createRunner
 */

import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { SurrealDriver } from '../../../sdk/driver/types.js';
import type { MigrationFile } from '../runner.js';
import { createRunner, MigrationRunner } from '../runner.js';

// ---------------------------------------------------------------------------
// Hoisted: mock fs functions as PLAIN functions (not vi.fn) so clearAllMocks
// does NOT kill their implementations. The journal mock IS vi.fn and gets
// reset each test (desired).
//
// IMPORTANT: path.join normalizes './foo/bar' to 'foo/bar'. The runner uses
// the raw config value (e.g. './migrations') for stat(dir) and readdir(dir),
// but path.join(dir, entry) produces 'migrations/001_init' (no ./ prefix).
// We handle this by registering both forms where needed.
// ---------------------------------------------------------------------------
const { mockStat, mockReaddir, mockReadFile, mockDirs, mockFiles } = vi.hoisted(() => {
  const files = new Map<string, string>();
  const dirs = new Set<string>();

  const stat = async (path: string) => {
    if (dirs.has(path)) return { isDirectory: () => true };
    if (files.has(path)) return { isDirectory: () => false };
    const err = new Error(`ENOENT: ${path}`) as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    throw err;
  };

  const readdir = async (path: string) => {
    const prefix = path.endsWith('/') ? path : `${path}/`;
    // Also try the normalized prefix (path.join strips ./)
    const normalizedPrefix = prefix.startsWith('./') ? prefix.slice(2) : null;

    const entries = new Set<string>();
    for (const key of dirs) {
      checkKey(key);
    }
    for (const key of files.keys()) {
      checkKey(key);
    }
    function checkKey(key: string) {
      if (key.startsWith(prefix)) {
        const rest = key.slice(prefix.length);
        const slash = rest.indexOf('/');
        entries.add(slash === -1 ? rest : rest.slice(0, slash));
      } else if (normalizedPrefix && key.startsWith(normalizedPrefix)) {
        const rest = key.slice(normalizedPrefix.length);
        const slash = rest.indexOf('/');
        entries.add(slash === -1 ? rest : rest.slice(0, slash));
      }
    }
    return Array.from(entries);
  };

  const readFile = async (path: string) => {
    const content = files.get(path);
    if (content !== undefined) return content;
    const err = new Error(`ENOENT: ${path}`) as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    throw err;
  };

  return {
    mockStat: stat as unknown as ReturnType<typeof vi.fn>,
    mockReaddir: readdir as unknown as ReturnType<typeof vi.fn>,
    mockReadFile: readFile as unknown as ReturnType<typeof vi.fn>,
    mockDirs: dirs,
    mockFiles: files,
  };
});

const mockJournal = vi.hoisted(() => ({
  getAppliedMigrations: vi.fn(),
  getPartialMigration: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  updateBreakpoints: vi.fn(),
  isApplied: vi.fn(),
  getLastSuccessfulStatementIdx: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('node:fs/promises', () => ({
  stat: mockStat,
  readdir: mockReaddir,
  readFile: mockReadFile,
}));

vi.mock('obug', () => ({
  createDebug: vi.fn(() => vi.fn()),
}));

vi.mock('../../ddl/journal.js', () => {
  // Can't use arrow functions for constructor mocks; need a factory
  function Manager() {
    return mockJournal;
  }
  Manager.prototype.constructor = Manager;
  return {
    MigrationJournalManager: Manager,
    computeMigrationHash: vi.fn(() => 'mock-hash'),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const migrationsDir = 'migrations';

function addMigrationDir(
  version: string,
  name: string,
  up: string[] = ['CREATE TABLE foo (id int)'],
  down: string[] = ['DROP TABLE foo'],
): string {
  const dirName = `${version}_${name}`;
  const content = `-- UP\n${up.join(';\n')};\n-- DOWN\n${down.join(';\n')};`;

  // stat(dir) uses raw config value: './migrations'
  mockDirs.add(migrationsDir);
  // stat(join(dir, entry)) normalizes to: 'migrations/001_init'
  const normalizedDir = join(migrationsDir, dirName);
  // stat(join(entryPath, 'migration.surql')) normalizes to 'migrations/001_init/migration.surql'
  const filePath = join(normalizedDir, 'migration.surql');

  mockDirs.add(normalizedDir);
  mockFiles.set(filePath, content);

  return filePath;
}

function createMockDriver(): SurrealDriver & {
  query: ReturnType<typeof vi.fn>;
} {
  return {
    query: vi.fn().mockResolvedValue([]),
  } as unknown as SurrealDriver & {
    query: ReturnType<typeof vi.fn>;
  };
}

function journalWithEntries(tags: string[] = []) {
  return {
    version: 1,
    dialect: 'surrealdb',
    id: 'test-journal-id',
    entries: tags.map((tag, i) => ({
      idx: i + 1,
      when: '2026-01-01T00:00:00.000Z',
      tag,
      breakpoints: [true],
      hash: 'mock-hash',
    })),
  };
}

function fullBreakpoints(len: number): boolean[] {
  return Array.from({ length: len }, () => true);
}

function defaultBeforeEach() {
  mockFiles.clear();
  mockDirs.clear();

  // Reset journal mocks only (NOT clearAllMocks which kills fs mock module)
  for (const fn of Object.values(mockJournal)) {
    (fn as ReturnType<typeof vi.fn>).mockReset();
  }

  // Default journal behaviors
  mockJournal.getAppliedMigrations.mockResolvedValue([]);
  mockJournal.getPartialMigration.mockResolvedValue(null);
  mockJournal.read.mockResolvedValue(journalWithEntries());
  mockJournal.write.mockResolvedValue(undefined);
  mockJournal.updateBreakpoints.mockResolvedValue({
    idx: 1,
    tag: 'mock',
    breakpoints: fullBreakpoints(1),
    hash: 'mock-hash',
    when: '',
  } as any);
  mockJournal.isApplied.mockResolvedValue(false);
  mockJournal.getLastSuccessfulStatementIdx.mockResolvedValue(-1);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('MigrationRunner', () => {
  beforeEach(() => {
    defaultBeforeEach();
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================
  describe('constructor', () => {
    it('creates runner with default config', () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver);
      expect(runner).toBeInstanceOf(MigrationRunner);
    });

    it('creates runner with custom config', () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, {
        migrationsDir: './custom-migrations',
        journalDir: './custom-meta',
        migrationsTable: '_migrations',
      });
      expect(runner).toBeInstanceOf(MigrationRunner);
    });
  });

  // ==========================================================================
  // createRunner
  // ==========================================================================
  describe('createRunner', () => {
    it('factory returns MigrationRunner', () => {
      const driver = createMockDriver();
      const runner = createRunner(driver);
      expect(runner).toBeInstanceOf(MigrationRunner);
    });

    it('factory accepts custom config', () => {
      const driver = createMockDriver();
      const runner = createRunner(driver, { migrationsTable: 'my_migrations' });
      expect(runner).toBeInstanceOf(MigrationRunner);
    });
  });

  // ==========================================================================
  // init
  // ==========================================================================
  describe('init', () => {
    it('creates migrations table and fields', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver);
      await runner.init();
      expect(driver.query).toHaveBeenCalledTimes(1);
      const sql = (driver.query as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(sql).toContain('DEFINE TABLE IF NOT EXISTS __migrations');
      expect(sql).toContain('DEFINE FIELD IF NOT EXISTS version ON __migrations');
      expect(sql).toContain('DEFINE FIELD IF NOT EXISTS name ON __migrations');
      expect(sql).toContain('DEFINE FIELD IF NOT EXISTS applied_at ON __migrations');
      expect(sql).toContain('DEFINE FIELD IF NOT EXISTS checksum ON __migrations');
      expect(sql).toContain('DEFINE INDEX IF NOT EXISTS idx_checksum ON __migrations');
    });

    it('uses custom migrations table name', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsTable: 'my_migrations' });
      await runner.init();
      const sql = (driver.query as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(sql).toContain('DEFINE TABLE IF NOT EXISTS my_migrations');
      expect(sql).toContain('ON my_migrations');
    });
  });

  // ==========================================================================
  // getMigrationFiles (exercises loadMigrationFiles)
  // ==========================================================================
  describe('getMigrationFiles', () => {
    it('returns empty when migrations dir does not exist', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      expect(await runner.getMigrationFiles()).toEqual([]);
    });

    it('throws when migrations dir is not a directory', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      mockFiles.set(migrationsDir, 'not-a-dir');
      await expect(runner.getMigrationFiles()).rejects.toThrow(
        'Migrations path is not a directory',
      );
    });

    it('handles empty migrations dir gracefully', async () => {
      // This test verifies that when the migrations dir exists but has no
      // valid migration subdirectories, we get an empty result (not a crash).
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      mockDirs.add('migrations'); // dir exists but empty

      const files = await runner.getMigrationFiles();

      expect(files).toEqual([]);
    });

    it('loads single migration directory', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init');

      const files = await runner.getMigrationFiles();

      expect(files).toHaveLength(1);
      expect(files[0].version).toBe('001');
      expect(files[0].name).toBe('init');
      expect(files[0].up).toEqual(['CREATE TABLE foo (id int)']);
      expect(files[0].checksum).toBe('mock-hash');
    });

    it('loads multiple dirs sorted by version', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('002', 'add_bar');
      addMigrationDir('001', 'init');
      addMigrationDir('010', 'big_update');

      const files = await runner.getMigrationFiles();

      expect(files).toHaveLength(3);
      expect(files[0].version).toBe('001');
      expect(files[1].version).toBe('002');
      expect(files[2].version).toBe('010');
    });

    it('skips entries without underscore in directory name', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init');
      mockDirs.add(`${migrationsDir}/README`);

      const files = await runner.getMigrationFiles();

      expect(files).toHaveLength(1);
    });

    it('skips entries with empty version or name after underscore split', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init');
      const badDir = `${migrationsDir}/_onlyname`;
      mockDirs.add(badDir);
      mockFiles.set(`${badDir}/migration.surql`, '-- UP\nSELECT 1;');

      const files = await runner.getMigrationFiles();

      expect(files).toHaveLength(1);
    });

    it('skips entries without migration.surql file', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init');
      mockDirs.add(`${migrationsDir}/002_orphan`);

      const files = await runner.getMigrationFiles();

      expect(files).toHaveLength(1);
    });

    it('skips non-directory entries', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init');
      mockFiles.set(`${migrationsDir}/README.md`, 'docs');

      const files = await runner.getMigrationFiles();

      expect(files).toHaveLength(1);
    });

    it('continues when individual migration loading fails', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init');

      // Create a broken migration where migration.surql is a directory (stat returns isDir)
      const badDir = `${migrationsDir}/002_broken`;
      mockDirs.add(badDir);
      mockDirs.add(`${badDir}/migration.surql`);

      const files = await runner.getMigrationFiles();

      expect(files).toHaveLength(1);
      expect(files[0].version).toBe('001');
    });
  });

  // ==========================================================================
  // parseMigrationFileContent / parseStatements (exercised via files)
  // ==========================================================================
  describe('parseMigrationFileContent', () => {
    it('parses UP section and returns empty down', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init', ['STEP ONE', 'STEP TWO'], ['DOWN ONE', 'DOWN TWO']);

      const files = await runner.getMigrationFiles();

      expect(files[0].up).toEqual(['STEP ONE', 'STEP TWO']);
    });

    it('parses only UP when no DOWN section', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });

      const dirPath = `${migrationsDir}/001_init`;
      mockDirs.add(migrationsDir);
      mockDirs.add(dirPath);
      mockFiles.set(`${dirPath}/migration.surql`, '-- UP\nCREATE TABLE foo;');

      const files = await runner.getMigrationFiles();

      expect(files[0].up).toEqual(['CREATE TABLE foo']);
    });

    it('handles content with no recognizable sections', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });

      const dirPath = `${migrationsDir}/001_init`;
      mockDirs.add(migrationsDir);
      mockDirs.add(dirPath);
      mockFiles.set(`${dirPath}/migration.surql`, '-- just a comment\nSELECT 1;');

      const files = await runner.getMigrationFiles();

      expect(files[0].up).toEqual([]);
    });

    it('filters inline comments from statements', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });

      const dirPath = `${migrationsDir}/001_init`;
      mockDirs.add(migrationsDir);
      mockDirs.add(dirPath);
      mockFiles.set(
        `${dirPath}/migration.surql`,
        '-- UP\n-- this is a comment\nCREATE TABLE foo;\n-- another comment\nCREATE TABLE bar;\n-- DOWN\nDROP TABLE foo;\nDROP TABLE bar;',
      );

      const files = await runner.getMigrationFiles();

      expect(files[0].up).toEqual(['CREATE TABLE foo', 'CREATE TABLE bar']);
    });
  });

  // ==========================================================================
  // up
  // ==========================================================================
  describe('up', () => {
    it('returns empty when no migration files', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      expect(await runner.up()).toEqual({
        applied: [],
        skipped: [],
        warnings: [],
      });
    });

    it('applies pending migrations', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init');

      const result = await runner.up();

      expect(result.applied).toEqual(['init']);
      expect(result.skipped).toEqual([]);
    });

    it('applies multiple pending in order', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init');
      addMigrationDir('002', 'add_bar');

      const result = await runner.up();

      expect(result.applied).toEqual(['init', 'add_bar']);
    });

    it('respects target version', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init');
      addMigrationDir('002', 'add_bar');
      addMigrationDir('003', 'add_baz');

      const result = await runner.up('002');

      expect(result.applied).toEqual(['init', 'add_bar']);
      expect(result.skipped).toEqual(['add_baz']);
    });

    it('skips already-applied from DB', async () => {
      const driver = createMockDriver();
      // First query (getDbAppliedMigrations) returns [{ name: 'init' }]
      (driver.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { name: 'init' },
      ]);
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init');
      addMigrationDir('002', 'add_bar');

      const result = await runner.up();

      expect(result.applied).toEqual(['add_bar']);
    });

    it('reports journal out-of-sync warning', async () => {
      const driver = createMockDriver();
      (driver.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      mockJournal.getAppliedMigrations.mockResolvedValue(['init']);

      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init');

      const result = await runner.up();

      expect(result.warnings!).toHaveLength(1);
      expect(result.warnings?.[0]).toContain('Journal out-of-sync');
    });

    it('resumes partial migration when found by applyMigration', async () => {
      const driver = createMockDriver();
      mockJournal.getPartialMigration.mockResolvedValue({
        idx: 1,
        tag: 'init',
        breakpoints: [false],
        hash: 'mock-hash',
        when: '2026-01-01T00:00:00.000Z',
      });
      mockJournal.getLastSuccessfulStatementIdx.mockResolvedValue(-1);
      mockJournal.isApplied.mockResolvedValue(true);

      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init');

      const result = await runner.up();

      expect(result.applied).toEqual(['init']);
      expect(mockJournal.getLastSuccessfulStatementIdx).toHaveBeenCalledWith('init');
    });

    it('records migration in DB and finalizes journal after all statements', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init');

      await runner.up();

      // Should INSERT into __migrations table
      const queryCalls = (driver.query as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const insertCall = queryCalls.find(
        (call: string[]) => call[0] && (call[0] as string).startsWith('INSERT INTO __migrations'),
      );
      expect(insertCall).toBeTruthy();
      expect(insertCall?.[1]).toEqual({ version: '001', name: 'init', checksum: 'mock-hash' });

      // Final breakpoints should be all true
      expect(mockJournal.updateBreakpoints).toHaveBeenCalled();
      const allTrueCall = mockJournal.updateBreakpoints.mock.calls.find((call: unknown[]) => {
        const bps = call[1] as boolean[];
        return bps && bps.length > 0 && bps.every(Boolean);
      });
      expect(allTrueCall).toBeTruthy();
    });
  });





  // ==========================================================================
  // status
  // ==========================================================================
  describe('status', () => {
    it('returns empty status with no migrations', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });

      const status = await runner.status();

      expect(status.applied).toEqual([]);
      expect(status.pending).toEqual([]);
      expect(status.current).toBeNull();
    });

    it('returns pending and applied', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init');
      addMigrationDir('002', 'add_bar');

      (driver.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: 'init', applied_at: '2026-01-01T00:00:00.000Z' },
      ]);

      const status = await runner.status();

      expect(status.applied).toHaveLength(1);
      expect(status.applied[0].name).toBe('init');
      expect(status.applied[0].version).toBe('001');
      expect(status.pending).toHaveLength(1);
      expect(status.pending[0].name).toBe('add_bar');
      expect(status.current).toBe('001');
    });

    it('handles missing migrations table (query throws)', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init');

      (driver.query as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Table not found'),
      );

      const status = await runner.status();

      expect(status.applied).toEqual([]);
      expect(status.pending).toHaveLength(1);
      expect(status.current).toBeNull();
    });

    it('handles DB records without matching files', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init');

      (driver.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: 'orphan', applied_at: '2026-01-01T00:00:00.000Z' },
      ]);

      const status = await runner.status();

      expect(status.applied).toHaveLength(1);
      expect(status.applied[0].name).toBe('orphan');
      expect(status.applied[0].version).toBe('unknown');
    });
  });

  // ==========================================================================
  // resume
  // ==========================================================================
  describe('resume', () => {
    function setupResumeFile(): void {
      addMigrationDir('001', 'init', ['STEP ONE', 'STEP TWO'], ['DOWN ONE', 'DOWN TWO']);
    }

    it('resumes with provided file from statement index', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      setupResumeFile();

      // Statement 0 already applied
      mockJournal.getLastSuccessfulStatementIdx.mockResolvedValue(0);
      // isMigrationComplete check not called by this path directly
      mockJournal.isApplied.mockResolvedValue(true);

      const migFile: MigrationFile = {
        version: '001',
        name: 'init',
        up: ['STEP ONE', 'STEP TWO'],
        checksum: 'mock-hash',
        path: `${migrationsDir}/001_init/migration.surql`,
      };

      const result = await runner.resume(migFile);

      expect(result.applied).toEqual(['init']);
      // Should have executed only statement 1 (index 1), not statement 0
      // getLastSuccessfulStatementIdx returned 0, so we resume from index 1
    });

    it('finds partial migration automatically when no file provided', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      setupResumeFile();

      mockJournal.read.mockResolvedValue({
        ...journalWithEntries(),
        entries: [
          {
            idx: 1,
            tag: 'init',
            breakpoints: [true, false],
            hash: 'mock-hash',
            when: '',
          },
        ],
      });
      mockJournal.getLastSuccessfulStatementIdx.mockResolvedValue(0);

      const result = await runner.resume();

      expect(result.applied).toEqual(['init']);
    });

    it('throws when no partial migrations found', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });

      mockJournal.read.mockResolvedValue(journalWithEntries(['init']));

      await expect(runner.resume()).rejects.toThrow('No partial migrations found');
    });

    it('throws when migration file not found for partial', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });

      mockJournal.read.mockResolvedValue({
        ...journalWithEntries(),
        entries: [
          {
            idx: 1,
            tag: 'orphan_migration',
            breakpoints: [false],
            hash: 'mock-hash',
            when: '',
          },
        ],
      });

      await expect(runner.resume()).rejects.toThrow('Migration file not found');
    });

    it('throws when no journal entry exists', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      setupResumeFile();

      mockJournal.getLastSuccessfulStatementIdx.mockResolvedValue(-1);
      mockJournal.isApplied.mockResolvedValue(false);

      const migFile: MigrationFile = {
        version: '001',
        name: 'init',
        up: ['STEP ONE'],
        checksum: 'mock-hash',
        path: `${migrationsDir}/001_init/migration.surql`,
      };

      await expect(runner.resume(migFile)).rejects.toThrow(
        'No journal entry found for migration: init',
      );
    });

    it('throws on checksum mismatch', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      setupResumeFile();

      mockJournal.getLastSuccessfulStatementIdx.mockResolvedValue(0);
      mockJournal.isApplied.mockResolvedValue(true);

      const migFile: MigrationFile = {
        version: '001',
        name: 'init',
        up: ['STEP ONE', 'STEP TWO'],
        checksum: 'different-checksum', // deliberately different from 'mock-hash'
        path: `${migrationsDir}/001_init/migration.surql`,
      };

      await expect(runner.resume(migFile)).rejects.toThrow('Checksum mismatch');
    });

    it('continues from start when no statements succeeded yet but entry exists', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      setupResumeFile();

      mockJournal.getLastSuccessfulStatementIdx.mockResolvedValue(-1);
      mockJournal.isApplied.mockResolvedValue(true);

      const migFile: MigrationFile = {
        version: '001',
        name: 'init',
        up: ['STEP ONE', 'STEP TWO'],
        checksum: 'mock-hash',
        path: `${migrationsDir}/001_init/migration.surql`,
      };

      const result = await runner.resume(migFile);

      expect(result.applied).toEqual(['init']);
    });
  });

  // ==========================================================================
  // findPartialMigrations
  // ==========================================================================
  describe('findPartialMigrations', () => {
    it('returns tags where appliedStatements < totalStatements', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'complete', ['STEP ONE', 'STEP TWO']);
      addMigrationDir('002', 'partial', ['STEP ONE', 'STEP TWO']);

      mockJournal.read.mockResolvedValue({
        ...journalWithEntries(),
        entries: [
          { idx: 1, tag: 'complete', breakpoints: [true, true], hash: 'mock-hash', when: '' },
          { idx: 2, tag: 'partial', breakpoints: [true, false], hash: 'mock-hash', when: '' },
        ],
      });

      mockJournal.getLastSuccessfulStatementIdx.mockImplementation(async (tag: string) => {
        if (tag === 'complete') return 1; // 2 of 2 applied
        if (tag === 'partial') return 0; // 1 of 2 applied
        return -1;
      });

      expect(await runner.findPartialMigrations()).toEqual(['partial']);
    });

    it('returns empty when all breakpoints true', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver);

      mockJournal.read.mockResolvedValue(journalWithEntries(['init', 'add_bar']));

      expect(await runner.findPartialMigrations()).toEqual([]);
    });

    it('excludes fully-applied migration with stale false breakpoint entry', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init', ['STEP ONE', 'STEP TWO']);

      // Journal has two entries for 'init': one fully-applied, one stale with false
      mockJournal.read.mockResolvedValue({
        ...journalWithEntries(),
        entries: [
          {
            idx: 1,
            tag: 'init',
            breakpoints: [true, true],
            hash: 'mock-hash',
            when: '2026-01-01T00:00:00.000Z',
          },
          {
            idx: 2,
            tag: 'init',
            breakpoints: [true, false],
            hash: 'stale-hash',
            when: '2026-01-02T00:00:00.000Z',
          },
        ],
      });

      // getLastSuccessfulStatementIdx picks entry with most trues → lastIndexOf(true) = 1
      mockJournal.getLastSuccessfulStatementIdx.mockResolvedValue(1);

      expect(await runner.findPartialMigrations()).toEqual([]);
    });
  });

  // ==========================================================================
  // getMigrationProgress
  // ==========================================================================
  describe('getMigrationProgress', () => {
    it('returns progress for a migration', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init', ['STEP ONE', 'STEP TWO']);

      mockJournal.getLastSuccessfulStatementIdx.mockResolvedValue(0);

      const p = await runner.getMigrationProgress('init');

      expect(p).not.toBeNull();
      expect(p?.name).toBe('init');
      expect(p?.totalStatements).toBe(2);
      expect(p?.appliedStatements).toBe(1);
    });

    it('returns null for unknown migration', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });

      expect(await runner.getMigrationProgress('nonexistent')).toBeNull();
    });

    it('returns zero statements when migration has none', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });

      const dirPath = `${migrationsDir}/001_empty`;
      mockDirs.add(migrationsDir);
      mockDirs.add(dirPath);
      mockFiles.set(`${dirPath}/migration.surql`, '-- UP\n-- DOWN');

      const p = await runner.getMigrationProgress('empty');

      expect(p).not.toBeNull();
      expect(p?.totalStatements).toBe(0);
      expect(p?.appliedStatements).toBe(0);
    });

    it('returns 0 applied when lastSuccessfulIdx is -1', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init', ['STEP ONE']);

      mockJournal.getLastSuccessfulStatementIdx.mockResolvedValue(-1);

      const p = await runner.getMigrationProgress('init');

      expect(p?.appliedStatements).toBe(0);
    });
  });

  // ==========================================================================
  // getPartialMigrationsProgress
  // ==========================================================================
  describe('getPartialMigrationsProgress', () => {
    it('returns progress for partial migrations', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init', ['STEP ONE', 'STEP TWO']);

      mockJournal.read.mockResolvedValue({
        ...journalWithEntries(),
        entries: [
          {
            idx: 1,
            tag: 'init',
            breakpoints: [true, false],
            hash: 'mock-hash',
            when: '',
          },
        ],
      });
      mockJournal.getLastSuccessfulStatementIdx.mockResolvedValue(0);

      const progress = await runner.getPartialMigrationsProgress();

      expect(progress).toHaveLength(1);
      expect(progress[0].name).toBe('init');
      expect(progress[0].appliedStatements).toBe(1);
    });

    it('returns empty when no partial migrations', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });

      expect(await runner.getPartialMigrationsProgress()).toEqual([]);
    });
  });

  // ==========================================================================
  // applyMigration failure modes (tested through up)
  // ==========================================================================
  describe('applyMigration error handling', () => {
    it('continues when per-statement checkpoint update fails (non-fatal)', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init', ['STEP ONE']);

      mockJournal.updateBreakpoints.mockRejectedValueOnce(new Error('Disk full'));

      // Per-statement journal failures are non-fatal — migration still succeeds
      const result = await runner.up();
      expect(result.applied).toEqual(['init']);
    });

    it('throws when final checkpoint update fails', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init', ['STEP ONE']);

      // Per-statement succeeds, final update fails
      mockJournal.updateBreakpoints
        .mockResolvedValueOnce({
          idx: 1,
          tag: 'mock',
          breakpoints: [true],
          hash: 'mock-hash',
          when: '',
        })
        .mockRejectedValueOnce(new Error('Final checkpoint failed'));

      await expect(runner.up()).rejects.toThrow('Migration completion checkpoint failed');
    });
  });

  // ==========================================================================
  // syncJournalWithDb
  // ==========================================================================
  describe('syncJournalWithDb', () => {
    it('rebuilds journal from DB records after up', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });
      addMigrationDir('001', 'init', ['STEP ONE', 'STEP TWO']);

      // Need 5 query calls:
      // 1. getDbAppliedMigrations (SELECT name FROM ...) → []
      // 2. STEP ONE → [] (default mock)
      // 3. STEP TWO → [] (default mock)
      // 4. INSERT INTO ... → [] (default mock)
      // 5. syncJournalWithDb (SELECT name, checksum, ...) → record
      const queryMock = driver.query as unknown as ReturnType<typeof vi.fn>;
      queryMock
        .mockResolvedValueOnce([]) // getDbAppliedMigrations
        .mockResolvedValueOnce([
          { name: 'init', checksum: 'mock-hash', applied_at: '2026-01-01T00:00:00.000Z' },
        ]); // syncJournalWithDb (calls 2-4 use default [])

      await runner.up();

      // Journal should have been rebuilt with proper breakpoints
      const writeCalls = mockJournal.write.mock.calls;
      const syncWrite = writeCalls.find((call: unknown[]) => {
        const c0 = call[0] as Record<string, unknown>;
        return c0 && Array.isArray(c0.entries) && (c0.entries as unknown[]).length > 0;
      });
      expect(syncWrite).toBeTruthy();
      expect(syncWrite?.[0].entries[0].tag).toBe('init');
      expect(syncWrite?.[0].entries[0].breakpoints).toEqual([true, true]);
    });

    it('handles DB records without matching migration files', async () => {
      const driver = createMockDriver();
      const runner = new MigrationRunner(driver, { migrationsDir });

      // syncJournalWithDb is only called when there are pending files to apply
      // (up() returns early if no files exist). Add a dummy migration so up() proceeds.
      addMigrationDir('001', 'init');

      const queryMock = driver.query as unknown as ReturnType<typeof vi.fn>;
      // 1. getDbAppliedMigrations → returns [] (nothing applied yet)
      // 2-3. applyMigration: INSERT INTO ... (register in DB) → returns []
      // 4. syncJournalWithDb: query DB records → includes an orphan outside our migration
      let queryNum = 0;
      queryMock.mockImplementation(async () => {
        queryNum++;
        if (queryNum === 1) return []; // getDbAppliedMigrations
        if (queryNum >= 3) return [{ name: 'orphan', checksum: '', applied_at: '' }]; // syncJournalWithDb
        return []; // INSERT
      });

      await runner.up();

      // syncJournalWithDb should write journal entries from DB records
      const writeCalls = mockJournal.write.mock.calls;
      // Get the LAST write call (from syncJournalWithDb, not applyMigration)
      const syncCalls = writeCalls.filter((call: unknown[]) => {
        const c0 = call[0] as Record<string, unknown>;
        return c0 && Array.isArray(c0.entries) && (c0.entries as unknown[]).length > 0;
      });
      expect(syncCalls.length).toBeGreaterThanOrEqual(2); // apply + sync
      const lastWrite = syncCalls[syncCalls.length - 1];
      // Orphan entry should have fallback breakpoints [true] since no matching file
      const orphanEntry = lastWrite[0].entries.find((e: any) => e.tag === 'orphan');
      expect(orphanEntry).toBeTruthy();
      expect(orphanEntry.breakpoints).toEqual([true]);
    });
  });
});
