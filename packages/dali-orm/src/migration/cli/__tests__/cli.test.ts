/**
 * Tests for cli.ts
 *
 * Covers: slugify(), parseGlobalOptions(), main()
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ──────────────────────────────────────────

vi.mock('../../config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    url: 'http://localhost:8000',
    namespace: 'test_ns',
    database: 'test_db',
    schema: { dir: './schema', pattern: '**/*.ts' },
    migrations: { dir: './migrations', table: '__migrations' },
  }),
}));

vi.mock('../../cli/operations.js', () => ({
  createConnection: vi.fn().mockResolvedValue({ query: vi.fn(), disconnect: vi.fn() }),
  createConnectionWithTimeout: vi.fn().mockResolvedValue({ query: vi.fn(), disconnect: vi.fn() }),
  safeDisconnect: vi.fn().mockResolvedValue(undefined),
  formatError: vi.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
}));

vi.mock('../../cli/diff.js', () => ({
  diffSchema: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../cli/generate.js', () => ({
  loadSchemaFiles: vi.fn().mockResolvedValue({
    tables: [{ name: 'test_table', columns: [] }],
    access: [],
    functions: [],
    analyzers: [],
  }),
  generateMigration: vi.fn().mockResolvedValue('/mock/path/migration.ts'),
}));

vi.mock('../../core/runner.js', () => ({
  MigrationRunner: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockResolvedValue({ applied: [], pending: [] }),
    up: vi.fn().mockResolvedValue({ applied: [] }),
  })),
}));

vi.mock('../../cli/migrate.js', () => ({
  migrateUp: vi.fn().mockResolvedValue(undefined),
  migrateDeploy: vi.fn().mockResolvedValue(undefined),
  migrateDev: vi.fn().mockResolvedValue(undefined),
  migrateSync: vi.fn().mockResolvedValue(undefined),
  migrateResume: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../cli/pull.js', () => ({
  pullSchema: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { loadConfig } from '../../config.js';
import { createConnection, safeDisconnect } from '../../cli/operations.js';
import { diffSchema } from '../../cli/diff.js';
import { generateMigration, loadSchemaFiles } from '../../cli/generate.js';
import {
  migrateUp,
  migrateDeploy,
  migrateDev,
  migrateSync,
  migrateResume,
} from '../../cli/migrate.js';
import { pullSchema } from '../../cli/pull.js';
import { parseGlobalOptions, slugify, main } from '../../cli.js';

// ============================================================================
// slugify
// ============================================================================

describe('slugify', () => {
  it('converts spaces to underscores', () => {
    expect(slugify('add user table')).toBe('add_user_table');
  });

  it('removes special characters', () => {
    expect(slugify('Fix Bug!')).toBe('fix_bug');
    expect(slugify('Create @User Table')).toBe('create_user_table');
  });

  it('handles already snake_case', () => {
    expect(slugify('already_snake_case')).toBe('already_snake_case');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('lowercases mixed case', () => {
    expect(slugify('AddUserTable')).toBe('addusertable');
    expect(slugify('ADD USER TABLE')).toBe('add_user_table');
  });

  it('trims leading/trailing underscores', () => {
    expect(slugify('_add_user_')).toBe('add_user');
  });

  it('collapses multiple spaces', () => {
    expect(slugify('add   user   table')).toBe('add_user_table');
  });

  it('replaces hyphens with underscores', () => {
    expect(slugify('add-user-table')).toBe('add_user_table');
  });

  it('handles mixed spaces and hyphens', () => {
    expect(slugify('add-user  table test')).toBe('add_user_table_test');
  });

  it('trims leading/trailing whitespace before processing', () => {
    expect(slugify('  add user  ')).toBe('add_user');
  });
});

// ============================================================================
// parseGlobalOptions
// ============================================================================

describe('parseGlobalOptions', () => {
  it('parses --config with value', () => {
    const opts = parseGlobalOptions(['--config', 'my-config.ts']);
    expect(opts.config).toBe('my-config.ts');
  });

  it('parses -c alias for --config', () => {
    const opts = parseGlobalOptions(['-c', 'config.ts']);
    expect(opts.config).toBe('config.ts');
  });

  it('parses --dry-run', () => {
    const opts = parseGlobalOptions(['--dry-run']);
    expect(opts.dryRun).toBe(true);
  });

  it('parses -n alias for --dry-run', () => {
    const opts = parseGlobalOptions(['-n']);
    expect(opts.dryRun).toBe(true);
  });

  it('parses --force / -f', () => {
    expect(parseGlobalOptions(['--force']).force).toBe(true);
    expect(parseGlobalOptions(['-f']).force).toBe(true);
  });

  it('parses --to with value', () => {
    const opts = parseGlobalOptions(['--to', '001']);
    expect(opts.to).toBe('001');
  });

  it('parses --name / -m', () => {
    expect(parseGlobalOptions(['--name', 'test']).name).toBe('test');
    expect(parseGlobalOptions(['-m', 'test']).name).toBe('test');
  });

  it('parses --output / -o', () => {
    expect(parseGlobalOptions(['--output', './out']).output).toBe('./out');
    expect(parseGlobalOptions(['-o', './out']).output).toBe('./out');
  });

  it('parses --schema / -s', () => {
    expect(parseGlobalOptions(['--schema', './sch']).schema).toBe('./sch');
    expect(parseGlobalOptions(['-s', './sch']).schema).toBe('./sch');
  });

  it('parses --offline', () => {
    expect(parseGlobalOptions(['--offline']).offline).toBe(true);
  });

  it('parses --full', () => {
    expect(parseGlobalOptions(['--full']).full).toBe(true);
  });

  it('parses --verbose / -V', () => {
    expect(parseGlobalOptions(['--verbose']).verbose).toBe(true);
    expect(parseGlobalOptions(['-V']).verbose).toBe(true);
  });

  it('parses --version / -v', () => {
    expect(parseGlobalOptions(['--version', '1.0']).version).toBe('1.0');
    expect(parseGlobalOptions(['-v', '2.0']).version).toBe('2.0');
  });

  it('parses --snapshots with value', () => {
    const opts = parseGlobalOptions(['--snapshots', './my-snapshots']);
    expect(opts.snapshots).toBe('./my-snapshots');
  });

  it('parses combined options', () => {
    const opts = parseGlobalOptions(['--dry-run', '--force', '--to', '002']);
    expect(opts.dryRun).toBe(true);
    expect(opts.force).toBe(true);
    expect(opts.to).toBe('002');
  });

  it('returns empty object for empty args', () => {
    expect(parseGlobalOptions([])).toEqual({});
  });

  it('ignores unknown flags', () => {
    const opts = parseGlobalOptions(['--unknown']);
    expect(opts).toEqual({});
  });

  it('handles multiple value options', () => {
    const opts = parseGlobalOptions([
      '--config',
      'config.ts',
      '--name',
      'my_migration',
      '--output',
      './migrations',
      '--schema',
      './schema',
      '--to',
      '003',
    ]);
    expect(opts.config).toBe('config.ts');
    expect(opts.name).toBe('my_migration');
    expect(opts.output).toBe('./migrations');
    expect(opts.schema).toBe('./schema');
    expect(opts.to).toBe('003');
  });

  it('handles dry-run before --config', () => {
    const opts = parseGlobalOptions(['--dry-run', '--config', 'cfg.ts']);
    expect(opts.dryRun).toBe(true);
    expect(opts.config).toBe('cfg.ts');
  });

  it('does not consume next arg as flag value for boolean flags', () => {
    // --dry-run is boolean, should not consume the next arg
    const opts = parseGlobalOptions(['--dry-run', '--force']);
    expect(opts.dryRun).toBe(true);
    expect(opts.force).toBe(true);
  });
});

// ============================================================================
// main() — command dispatch
// ============================================================================

describe('main()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── No command / help ───────────────────────────────────────────────────

  it('prints help and exits when no command given', async () => {
    await main([]);
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('prints help for "help" command', async () => {
    await main(['help']);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('prints help for "--help" flag', async () => {
    await main(['--help']);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('prints help for "-h" flag', async () => {
    await main(['-h']);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  // ── Version ─────────────────────────────────────────────────────────────

  it('prints version for "--version"', async () => {
    await main(['--version']);
    expect(consoleLogSpy).toHaveBeenCalledWith('dali-orm v0.1.0');
  });

  it('prints version for "-v"', async () => {
    await main(['-v']);
    expect(consoleLogSpy).toHaveBeenCalledWith('dali-orm v0.1.0');
  });

  // ── Unknown command ─────────────────────────────────────────────────────

  it('exits on unknown command', async () => {
    await main(['foobar']);
    expect(consoleErrSpy).toHaveBeenCalledWith('Unknown command: foobar');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── Init ────────────────────────────────────────────────────────────────

  it('handles init command', async () => {
    await main(['init']);
    expect(consoleLogSpy).toHaveBeenCalledWith('Initializing DaliORM project...');
  });

  // ── Migrate ─────────────────────────────────────────────────────────────

  it('dispatches migrate up', async () => {
    await main(['migrate', 'up']);
    expect(migrateUp).toHaveBeenCalled();
  });

  it('dispatches migrate deploy', async () => {
    await main(['migrate', 'deploy']);
    expect(migrateDeploy).toHaveBeenCalled();
  });

  it('dispatches migrate sync', async () => {
    await main(['migrate', 'sync']);
    expect(migrateSync).toHaveBeenCalled();
  });

  it('dispatches migrate resume', async () => {
    await main(['migrate', 'resume']);
    expect(migrateResume).toHaveBeenCalled();
  });

  it('dispatches migrate dev with name', async () => {
    await main(['migrate', 'dev', 'add_users']);
    expect(migrateDev).toHaveBeenCalledWith(expect.objectContaining({ name: 'add_users' }));
  });

  it('exits when migrate dev has no name', async () => {
    await main(['migrate', 'dev']);
    expect(consoleErrSpy).toHaveBeenCalledWith('Usage: dali-orm migrate dev <name> [options]');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('dispatches migrate help', async () => {
    await main(['migrate', 'help']);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('defaults migrate to status when no subcommand', async () => {
    await main(['migrate']);
    expect(createConnection).toHaveBeenCalled();
  });

  // ── Generate ────────────────────────────────────────────────────────────

  it('dispatches generate with name', async () => {
    await main(['generate', 'add_users']);
    expect(generateMigration).toHaveBeenCalled();
  });

  it('exits when generate has no name', async () => {
    await main(['generate']);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── Pull ────────────────────────────────────────────────────────────────

  it('dispatches pull command', async () => {
    await main(['pull']);
    expect(pullSchema).toHaveBeenCalled();
  });

  it('passes table arg to pull', async () => {
    await main(['pull', 'users']);
    expect(pullSchema).toHaveBeenCalledWith(expect.objectContaining({ table: 'users' }));
  });

  // ── Diff ────────────────────────────────────────────────────────────────

  it('dispatches diff command', async () => {
    await main(['diff']);
    expect(diffSchema).toHaveBeenCalled();
  });

  // ── Query ───────────────────────────────────────────────────────────────

  it('dispatches query command', async () => {
    const mockQuery = vi.fn().mockResolvedValue([{ result: 'ok' }]);
    vi.mocked(createConnection).mockResolvedValue({ query: mockQuery } as never);
    await main(['query', 'SELECT * FROM users']);
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users');
  });

  it('exits when query has no string', async () => {
    await main(['query']);
    expect(consoleErrSpy).toHaveBeenCalledWith('Usage: dali-orm query "<SURREALQL>" [options]');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── Error handling ──────────────────────────────────────────────────────

  it('catches handler errors and exits', async () => {
    vi.mocked(migrateUp).mockRejectedValueOnce(new Error('migration failed'));
    await main(['migrate', 'up']);
    expect(consoleErrSpy).toHaveBeenCalledWith('Error:', 'migration failed');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
