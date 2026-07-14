import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { JournalEntry, MigrationJournal } from '../journal.js';
import { computeMigrationHash, createJournal, MigrationJournalManager } from '../journal.js';

// Mock filesystem
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock obug to prevent noise
vi.mock('obug', () => ({
  createDebug: () => () => {},
}));

// After mock, import fs
import * as fs from 'node:fs/promises';

const mockReadFile = vi.mocked(fs.readFile);
const mockWriteFile = vi.mocked(fs.writeFile);
const mockMkdir = vi.mocked(fs.mkdir);

// =============================================================================
// Helpers
// =============================================================================
function makeJournal(overrides: Partial<MigrationJournal> = {}): MigrationJournal {
  return {
    version: 1,
    dialect: 'surrealdb',
    id: 'abc123',
    entries: [],
    ...overrides,
  };
}

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    idx: 1,
    when: '2025-01-01T00:00:00.000Z',
    tag: 'test_migration',
    breakpoints: [true],
    hash: 'abc',
    ...overrides,
  };
}

// =============================================================================
// MigrationJournalManager
// =============================================================================
describe('MigrationJournalManager', () => {
  let manager: MigrationJournalManager;

  beforeEach(() => {
    vi.resetAllMocks();
    manager = new MigrationJournalManager({ dir: '/tmp/journals', filename: '_journal.json' });
  });

  // ---------------------------------------------------------------------------
  // constructor
  // ---------------------------------------------------------------------------
  describe('constructor', () => {
    it('throws when no dir provided', () => {
      expect(() => new MigrationJournalManager()).toThrow('journalDir is required');
    });

    it('uses provided config', () => {
      const m = new MigrationJournalManager({ dir: '/custom/path', filename: 'my_journal.json' });
      expect(m.getPath()).toBe('/custom/path/my_journal.json');
    });

    it('merges partial config with dir', () => {
      const m = new MigrationJournalManager({ dir: '/base', dialect: 'postgresql' });
      expect(m.getPath()).toBe('/base/_journal.json');
    });
  });

  // ---------------------------------------------------------------------------
  // getPath
  // ---------------------------------------------------------------------------
  describe('getPath', () => {
    it('returns the full journal path', () => {
      const m = new MigrationJournalManager({ dir: '/x', filename: 'y.json' });
      expect(m.getPath()).toBe('/x/y.json');
    });
  });

  // ---------------------------------------------------------------------------
  // createEmpty
  // ---------------------------------------------------------------------------
  describe('createEmpty', () => {
    it('creates empty journal with defaults', () => {
      const m = new MigrationJournalManager({ dir: '/test' });
      const journal = m.createEmpty();

      expect(journal.version).toBe(1);
      expect(journal.dialect).toBe('surrealdb');
      expect(journal.id).toBeTruthy();
      expect(journal.entries).toEqual([]);
    });

    it('uses configured dialect', () => {
      const m = new MigrationJournalManager({ dir: '/test', dialect: 'postgresql' });
      const journal = m.createEmpty();
      expect(journal.dialect).toBe('postgresql');
    });
  });

  // ---------------------------------------------------------------------------
  // read
  // ---------------------------------------------------------------------------
  describe('read', () => {
    it('reads and parses existing journal', async () => {
      const journal = makeJournal({
        id: 'abc123',
        entries: [makeEntry({ idx: 1, tag: 'initial' })],
      });
      mockReadFile.mockResolvedValueOnce(JSON.stringify(journal));

      const result = await manager.read();

      expect(result.version).toBe(1);
      expect(result.id).toBe('abc123');
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].tag).toBe('initial');
    });

    it('returns empty journal when file missing', async () => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      mockReadFile.mockRejectedValueOnce(err);

      const result = await manager.read();

      expect(result.version).toBe(1);
      expect(result.entries).toEqual([]);
    });

    it('rethrows non-ENOENT errors', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(manager.read()).rejects.toThrow('Permission denied');
    });

    it('normalizes old format entries', async () => {
      const oldFormat = {
        version: 1,
        dialect: 'surrealdb',
        id: 'old',
        entries: [
          {
            idx: 1,
            name: 'old_style_name',
            applied_at: '2024-01-01T00:00:00.000Z',
            breakpoint: true,
            hash: 'oldhash',
          },
        ],
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(oldFormat));

      const result = await manager.read();

      expect(result.entries[0].tag).toBe('old_style_name');
      expect(result.entries[0].when).toBe('2024-01-01T00:00:00.000Z');
      expect(result.entries[0].breakpoints).toEqual([true]);
    });

    it('normalizes old format with version field', async () => {
      const oldFormat = {
        version: 1,
        dialect: 'surrealdb',
        id: 'old',
        entries: [
          {
            idx: 1,
            version: 'v1',
            applied_at: '2024-01-01T00:00:00.000Z',
            breakpoint: false,
            hash: 'oldhash',
          },
        ],
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(oldFormat));

      const result = await manager.read();

      expect(result.entries[0].tag).toBe('v1');
      expect(result.entries[0].breakpoints).toEqual([false]);
    });

    it('handles malformed entries gracefully', async () => {
      // entries is not an array
      const bad = { version: 1, dialect: 'surrealdb', id: 'x', entries: 'not_array' };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(bad));

      const result = await manager.read();
      expect(result.entries).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // write
  // ---------------------------------------------------------------------------
  describe('write', () => {
    it('creates directory and writes JSON', async () => {
      const journal = makeJournal();

      await manager.write(journal);

      expect(mockMkdir).toHaveBeenCalledWith('/tmp/journals', { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/tmp/journals/_journal.json',
        JSON.stringify(journal, null, 2),
        'utf-8',
      );
    });

    it('writes journal with entries', async () => {
      const journal = makeJournal({
        entries: [makeEntry({ idx: 1, tag: 'init' }), makeEntry({ idx: 2, tag: 'add_users' })],
      });
      mockMkdir.mockResolvedValueOnce(undefined);
      mockWriteFile.mockResolvedValueOnce(undefined);

      await manager.write(journal);

      const written = mockWriteFile.mock.calls[0][1] as string;
      const parsed = JSON.parse(written);
      expect(parsed.entries).toHaveLength(2);
      expect(parsed.entries[1].tag).toBe('add_users');
    });
  });

  // ---------------------------------------------------------------------------
  // addEntry
  // ---------------------------------------------------------------------------
  describe('addEntry', () => {
    it('creates first entry with idx=1', async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(makeJournal()));

      await manager.addEntry('initial', 'hash123', ['CREATE TABLE t']);

      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written.entries).toHaveLength(1);
      expect(written.entries[0].idx).toBe(1);
      expect(written.entries[0].tag).toBe('initial');
      expect(written.entries[0].hash).toBe('hash123');
      expect(written.entries[0].breakpoints).toEqual([false]);
    });

    it('increments idx for subsequent entries', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify(makeJournal({ entries: [makeEntry({ idx: 1 })] })),
      );

      await manager.addEntry('second', 'hash456', ['s1', 's2']);

      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written.entries).toHaveLength(2);
      expect(written.entries[1].idx).toBe(2);
      expect(written.entries[1].tag).toBe('second');
      expect(written.entries[1].breakpoints).toEqual([false, false]);
    });

    it('creates entry with all-false breakpoints for partial-failure safety', async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(makeJournal()));
      await manager.addEntry('partial_safe', 'hash777', ['s1', 's2', 's3']);
      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      // Every breakpoint must be false so partial-execution is visible
      expect(written.entries[0].breakpoints).toEqual([false, false, false]);
      // Verify isApplied correctly returns false for all-false entry
      const isApplied = await manager.isApplied('partial_safe');
      expect(isApplied).toBe(false);
    });

    it('handles non-sequential indices correctly', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify(makeJournal({ entries: [makeEntry({ idx: 5 }), makeEntry({ idx: 10 })] })),
      );

      await manager.addEntry('next', 'hash', ['stmt']);

      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written.entries).toHaveLength(3);
      expect(written.entries[2].idx).toBe(11);
    });

    it('throws when migrationHash is missing', async () => {
      await expect(manager.addEntry('test', '', ['stmt'])).rejects.toThrow(
        'migrationHash is required for journal entry',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getAppliedMigrations
  // ---------------------------------------------------------------------------
  describe('getAppliedMigrations', () => {
    it('returns list of applied tags', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify(
          makeJournal({
            entries: [makeEntry({ tag: 'init' }), makeEntry({ idx: 2, tag: 'add_users' })],
          }),
        ),
      );

      const tags = await manager.getAppliedMigrations();

      expect(tags).toEqual(['init', 'add_users']);
    });

    it('returns empty list when no entries', async () => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      mockReadFile.mockRejectedValueOnce(err);

      const tags = await manager.getAppliedMigrations();

      expect(tags).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // isApplied
  // ---------------------------------------------------------------------------
  describe('isApplied', () => {
    it('returns true when migration is applied', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify(makeJournal({ entries: [makeEntry({ tag: 'init' })] })),
      );

      expect(await manager.isApplied('init')).toBe(true);
    });

    it('returns false when migration not applied', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify(makeJournal({ entries: [makeEntry({ tag: 'init' })] })),
      );

      expect(await manager.isApplied('other')).toBe(false);
    });

    it('returns false when journal is empty', async () => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      mockReadFile.mockRejectedValueOnce(err);

      expect(await manager.isApplied('init')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getStatus
  // ---------------------------------------------------------------------------
  describe('getStatus', () => {
    it('returns status with entries', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify(
          makeJournal({
            entries: [makeEntry({ idx: 1, tag: 'init' }), makeEntry({ idx: 2, tag: 'add_users' })],
          }),
        ),
      );

      const status = await manager.getStatus();

      expect(status.total).toBe(2);
      expect(status.lastApplied?.tag).toBe('add_users');
      expect(status.applied).toEqual(['init', 'add_users']);
    });

    it('returns empty status when no entries', async () => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      mockReadFile.mockRejectedValueOnce(err);

      const status = await manager.getStatus();

      expect(status.total).toBe(0);
      expect(status.lastApplied).toBeNull();
      expect(status.applied).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // updateBreakpoints
  // ---------------------------------------------------------------------------
  describe('updateBreakpoints', () => {
    it('updates breakpoints for existing entry', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify(
          makeJournal({
            entries: [makeEntry({ tag: 'mig1', breakpoints: [true, true, true] })],
          }),
        ),
      );

      const result = await manager.updateBreakpoints('mig1', [true, true, false]);

      expect(result).not.toBeNull();
      expect(result?.breakpoints).toEqual([true, true, false]);

      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written.entries[0].breakpoints).toEqual([true, true, false]);
    });

    it('returns null for non-existent tag', async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(makeJournal()));

      const result = await manager.updateBreakpoints('nonexistent', []);

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getPartialMigration
  // ---------------------------------------------------------------------------
  describe('getPartialMigration', () => {
    it('returns entry when some breakpoints are false', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify(
          makeJournal({
            entries: [makeEntry({ tag: 'partial_mig', breakpoints: [true, false, true] })],
          }),
        ),
      );

      const result = await manager.getPartialMigration('partial_mig');

      expect(result).not.toBeNull();
      expect(result?.tag).toBe('partial_mig');
    });

    it('returns null when all breakpoints true', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify(
          makeJournal({
            entries: [makeEntry({ tag: 'complete', breakpoints: [true, true] })],
          }),
        ),
      );

      const result = await manager.getPartialMigration('complete');

      expect(result).toBeNull();
    });

    it('returns null when entry not found', async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(makeJournal()));

      const result = await manager.getPartialMigration('missing');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // isMigrationComplete
  // ---------------------------------------------------------------------------
  describe('isMigrationComplete', () => {
    it('returns true when all breakpoints true', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify(
          makeJournal({
            entries: [makeEntry({ tag: 'done', breakpoints: [true, true] })],
          }),
        ),
      );

      expect(await manager.isMigrationComplete('done')).toBe(true);
    });

    it('returns false when any breakpoint false', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify(
          makeJournal({
            entries: [makeEntry({ tag: 'partial', breakpoints: [true, false] })],
          }),
        ),
      );

      expect(await manager.isMigrationComplete('partial')).toBe(false);
    });

    it('throws when migration not found', async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(makeJournal()));

      await expect(manager.isMigrationComplete('missing')).rejects.toThrow(
        'Migration not found: missing',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getLastSuccessfulStatementIdx
  // ---------------------------------------------------------------------------
  describe('getLastSuccessfulStatementIdx', () => {
    it('returns index of last true breakpoint', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify(
          makeJournal({
            entries: [makeEntry({ tag: 'mig', breakpoints: [true, true, false, true] })],
          }),
        ),
      );

      const idx = await manager.getLastSuccessfulStatementIdx('mig');

      expect(idx).toBe(3);
    });

    it('returns -1 when no breakpoints true', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify(
          makeJournal({
            entries: [makeEntry({ tag: 'mig', breakpoints: [false, false] })],
          }),
        ),
      );

      const idx = await manager.getLastSuccessfulStatementIdx('mig');

      expect(idx).toBe(-1); // lastIndexOf(true) on [false, false] returns -1
    });

    it('returns -1 when entry has empty breakpoints', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify(
          makeJournal({
            entries: [makeEntry({ tag: 'mig', breakpoints: [] })],
          }),
        ),
      );

      const idx = await manager.getLastSuccessfulStatementIdx('mig');

      expect(idx).toBe(-1);
    });

    it('returns -1 when entry not found', async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(makeJournal()));

      const idx = await manager.getLastSuccessfulStatementIdx('missing');

      expect(idx).toBe(-1);
    });
  });
});

// =============================================================================
// createJournal
// =============================================================================
describe('createJournal', () => {
  it('creates MigrationJournalManager with provided config', () => {
    const journal = createJournal({ dir: '/test' });
    expect(journal).toBeInstanceOf(MigrationJournalManager);
    expect(journal.getPath()).toBe('/test/_journal.json');
  });

  it('passes config to constructor', () => {
    const journal = createJournal({ dir: '/test', filename: 'test.json' });
    expect(journal.getPath()).toBe('/test/test.json');
  });
});

// =============================================================================
// computeMigrationHash
// =============================================================================
describe('computeMigrationHash', () => {
  it('returns SHA256 hex digest', () => {
    const hash = computeMigrationHash('hello');
    // SHA256 of 'hello' is known
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('is deterministic', () => {
    expect(computeMigrationHash('test content')).toBe(computeMigrationHash('test content'));
  });

  it('produces different hashes for different content', () => {
    const a = computeMigrationHash('content A');
    const b = computeMigrationHash('content B');
    expect(a).not.toBe(b);
  });

  it('handles empty string', () => {
    const hash = computeMigrationHash('');
    // SHA256 of empty string
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('returns 64-character hex string', () => {
    const hash = computeMigrationHash('any content');
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });
});
