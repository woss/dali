/**
 * Comprehensive tests for CLI handler functions in cli.ts
 *
 * Tests main() routing to all sub-handlers:
 * - handleMigrate (up, status, sync, resume, dev, deploy)
 * - handleGenerate (with name, offline, schema option, connection failure)
 * - handlePull, handleDiff, handleQuery
 * - printHelp, printMigrateHelp (via main routing)
 *
 * All external modules are mocked for isolated testing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { main, parseGlobalOptions } from '../../cli.js';

// ============================================================================
// Mock Setup
//
// vi.hoisted() must be used for ALL variables referenced inside vi.mock()
// factory callbacks because vitest hoists vi.mock() calls above imports.
// ============================================================================

const {
  mockDriver,
  mockCreateConnection,
  mockCreateConnectionWithTimeout,
  mockSafeDisconnect,
  mockFormatError,
  mockRunnerInstance,
  mockLoadSchemaFiles,
  mockGenerateMigration,
  mockMigrateUp,
  mockMigrateDev,
  mockMigrateDeploy,
  mockMigrateSync,
  mockMigrateResume,
  mockPullSchema,
  mockDiffSchema,
  mockLoadConfig,
} = vi.hoisted(() => {
  const driver = {
    query: vi.fn().mockResolvedValue([{ id: '1', name: 'test' }]),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };

  const runner = {
    init: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockResolvedValue({
      applied: [
        { version: '001', name: 'initial', appliedAt: '2024-01-01T00:00:00Z' },
        { version: '002', name: 'add_users', appliedAt: '2024-01-02T12:30:00Z' },
      ],
      pending: [],
      current: '002',
    }),
    up: vi.fn().mockResolvedValue({ applied: ['002_add_users'] }),
    findPartialMigrations: vi.fn().mockResolvedValue([]),
    getMigrationProgress: vi.fn().mockResolvedValue(null),
    getMigrationFiles: vi.fn().mockResolvedValue([]),
    syncJournalWithDb: vi.fn().mockResolvedValue(undefined),
  };

  return {
    mockDriver: driver,
    mockCreateConnection: vi.fn().mockResolvedValue(driver),
    mockCreateConnectionWithTimeout: vi.fn().mockResolvedValue(driver),
    mockSafeDisconnect: vi.fn().mockResolvedValue(undefined),
    mockFormatError: vi.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
    mockRunnerInstance: runner,
    mockLoadSchemaFiles: vi.fn().mockResolvedValue({
      tables: [
        {
          name: 'users',
          columns: [{ name: 'id', tableName: 'users', config: { type: 'string' } }],
          config: { schema: 'full', type: 'normal' },
        },
      ],
      access: [],
      functions: [],
      analyzers: [],
    }),
    mockGenerateMigration: vi
      .fn()
      .mockResolvedValue('/tmp/migrations/001_create_users/migration.surql'),
    mockMigrateUp: vi.fn().mockResolvedValue(undefined),
    mockMigrateDev: vi.fn().mockResolvedValue(undefined),
    mockMigrateDeploy: vi.fn().mockResolvedValue(undefined),
    mockMigrateSync: vi.fn().mockResolvedValue(undefined),
    mockMigrateResume: vi.fn().mockResolvedValue(undefined),
    mockPullSchema: vi.fn().mockResolvedValue(undefined),
    mockDiffSchema: vi.fn().mockResolvedValue(undefined),
    mockLoadConfig: vi.fn().mockResolvedValue({
      url: 'ws://localhost:10101',
      namespace: 'test_ns',
      database: 'test_db',
      auth: { type: 'root' as const, username: 'root', password: 'root' },
      schema: { dir: './schema', pattern: '**/*.{js,ts}' },
      migrations: { dir: './migrations', table: '__migrations' },
      snapshots: { dir: './snapshots' },
    }),
  };
});

// ============================================================================
// Module-level vi.mock() calls
// These are hoisted above imports by vitest
// ============================================================================

vi.mock('obug', () => ({
  createDebug: vi.fn(() => {
    const fn = vi.fn() as unknown as ReturnType<typeof vi.fn> & {
      extend: ReturnType<typeof vi.fn>;
    };
    fn.extend = vi.fn(() => vi.fn());
    return fn;
  }),
}));

vi.mock('../../config.js', () => ({
  loadConfig: mockLoadConfig,
}));

vi.mock('../operations.js', () => ({
  createConnection: mockCreateConnection,
  createConnectionWithTimeout: mockCreateConnectionWithTimeout,
  safeDisconnect: mockSafeDisconnect,
  formatError: mockFormatError,
}));

vi.mock('../../core/runner.js', () => ({
  MigrationRunner: vi.fn().mockImplementation(function fn() {
    return mockRunnerInstance;
  }),
}));

vi.mock('../migrate.js', () => ({
  migrateUp: mockMigrateUp,
  migrateDev: mockMigrateDev,
  migrateDeploy: mockMigrateDeploy,
  migrateSync: mockMigrateSync,
  migrateResume: mockMigrateResume,
}));

vi.mock('../generate.js', () => ({
  loadSchemaFiles: mockLoadSchemaFiles,
  generateMigration: mockGenerateMigration,
}));

vi.mock('../pull.js', () => ({
  pullSchema: mockPullSchema,
}));

vi.mock('../diff.js', () => ({
  diffSchema: mockDiffSchema,
}));

// ============================================================================
// Test helpers
// ============================================================================

/** Reusable empty-schema response for loadSchemaFiles */
const EMPTY_SCHEMA = {
  tables: [],
  access: [],
  functions: [],
  analyzers: [],
};

// ============================================================================
// main() — Command routing and handler integration
// ============================================================================

describe('main', () => {
  let exitSpy: ReturnType<typeof vi.fn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.fn(() => {
      throw new Error('process.exit prevented in test');
    });
    process.exit = exitSpy as unknown as typeof process.exit;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // migrate subcommands
  // ============================================================================

  describe('migrate subcommand', () => {
    it('calls handleMigrate for migrate command', async () => {
      await main(['migrate', 'status']);
      expect(mockRunnerInstance.status).toHaveBeenCalled();
    });

    it('migrate up calls migrateUp', async () => {
      await main(['migrate', 'up']);
      expect(mockMigrateUp).toHaveBeenCalledWith(
        expect.objectContaining({ config: expect.anything() }),
      );
    });

    it('migrate up --to passes target version', async () => {
      await main(['migrate', 'up', '--to', '002']);
      expect(mockMigrateUp).toHaveBeenCalledWith(expect.objectContaining({ to: '002' }));
    });

    it('migrate status creates connection and calls runner.status', async () => {
      await main(['migrate', 'status']);
      expect(mockCreateConnection).toHaveBeenCalled();
      expect(mockRunnerInstance.init).toHaveBeenCalled();
      expect(mockRunnerInstance.status).toHaveBeenCalled();
    });

    it('migrate status prints migration status output', async () => {
      await main(['migrate', 'status']);
      const logOutput = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
      expect(logOutput).toContain('Migration Status');
      expect(logOutput).toContain('initial');
      expect(logOutput).toContain('001');
    });

    it('migrate sync calls migrateSync', async () => {
      await main(['migrate', 'sync']);
      expect(mockMigrateSync).toHaveBeenCalledWith({
        config: expect.anything(),
      });
    });

    it('migrate resume calls migrateResume', async () => {
      await main(['migrate', 'resume']);
      expect(mockMigrateResume).toHaveBeenCalled();
    });

    it('migrate dev with name calls migrateDev', async () => {
      await main(['migrate', 'dev', 'add_users']);
      expect(mockMigrateDev).toHaveBeenCalledWith(expect.objectContaining({ name: 'add_users' }));
    });

    it('migrate dev without name prints usage and exits', async () => {
      await expect(main(['migrate', 'dev'])).rejects.toThrow('process.exit prevented in test');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('migrate dev --name option overrides positional argument', async () => {
      await main(['migrate', 'dev', '--name', 'explicit_name']);
      expect(mockMigrateDev).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'explicit_name' }),
      );
    });

    it('migrate dev slugifies migration name', async () => {
      await main(['migrate', 'dev', 'Add User Table']);
      expect(mockMigrateDev).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'add_user_table' }),
      );
    });

    it('migrate dev --dry-run passes dryRun option', async () => {
      await main(['migrate', 'dev', 'test_mig', '--dry-run']);
      expect(mockMigrateDev).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
    });

    it('migrate dev slugification info printed when name differs', async () => {
      await main(['migrate', 'dev', 'My Migration!']);
      const logOutput = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
      expect(logOutput).toContain('slugified');
    });

    it('migrate deploy calls migrateDeploy', async () => {
      await main(['migrate', 'deploy']);
      expect(mockMigrateDeploy).toHaveBeenCalled();
    });

    it('migrate help prints migrate help text', async () => {
      await main(['migrate', 'help']);
      const logOutput = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
      expect(logOutput).toContain('Migrate Commands');
    });

    it('migrate --help prints migrate help text', async () => {
      await main(['migrate', '--help']);
      const logOutput = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
      expect(logOutput).toContain('Migrate Commands');
    });

    it('migrate -h prints migrate help text', async () => {
      await main(['migrate', '-h']);
      const logOutput = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
      expect(logOutput).toContain('Migrate Commands');
    });

    it('migrate with no subcommand defaults to status', async () => {
      await main(['migrate']);
      expect(mockCreateConnection).toHaveBeenCalled();
      expect(mockRunnerInstance.init).toHaveBeenCalled();
      expect(mockRunnerInstance.status).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // generate command
  // ============================================================================

  describe('generate command', () => {
    it('generate calls handleGenerate with correct args', async () => {
      await main(['generate', 'create_users']);
      expect(mockLoadSchemaFiles).toHaveBeenCalled();
      expect(mockGenerateMigration).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'users' })]),
        expect.objectContaining({ name: 'create_users' }),
        expect.anything(),
        undefined,
        expect.anything(),
        expect.anything(),
      );
    });

    it('generate without name prints usage and exits', async () => {
      await expect(main(['generate'])).rejects.toThrow('process.exit prevented in test');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('generate slugifies name from positional arg', async () => {
      await main(['generate', 'Create User Table!']);
      expect(mockGenerateMigration).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'create_user_table' }),
        expect.anything(),
        undefined,
        expect.anything(),
        expect.anything(),
      );
    });

    it('generate --name option takes precedence', async () => {
      await main(['generate', 'ignored_name', '--name', 'explicit_name']);
      expect(mockGenerateMigration).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'explicit_name' }),
        expect.anything(),
        undefined,
        expect.anything(),
        expect.anything(),
      );
    });

    it('generate --offline skips database connection', async () => {
      await main(['generate', 'test_mig', '--offline']);
      expect(mockCreateConnectionWithTimeout).not.toHaveBeenCalled();
      expect(mockGenerateMigration).toHaveBeenCalled();
    });

    it('generate with no DB config skips connection attempt', async () => {
      mockLoadConfig.mockResolvedValueOnce({
        url: '',
        namespace: '',
        database: '',
        schema: { dir: './schema', pattern: '**/*.{js,ts}' },
        migrations: { dir: './migrations', table: '__migrations' },
      });
      await main(['generate', 'test_mig']);
      expect(mockCreateConnectionWithTimeout).not.toHaveBeenCalled();
    });

    it('generate handles connection failure and falls back', async () => {
      mockCreateConnectionWithTimeout.mockRejectedValueOnce(new Error('Connection refused'));
      await main(['generate', 'test_mig']);
      const logOutput = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
      expect(logOutput).toContain('Could not connect');
      expect(mockGenerateMigration).toHaveBeenCalled();
    });

    it('generate --schema uses custom schema path', async () => {
      await main(['generate', 'test_mig', '--schema', './custom-schema']);
      expect(mockLoadSchemaFiles).toHaveBeenCalledWith('./custom-schema', expect.any(String));
    });

    it('generate with empty schema prints error and exits', async () => {
      mockLoadSchemaFiles.mockResolvedValueOnce(EMPTY_SCHEMA);
      await expect(main(['generate', 'test_mig'])).rejects.toThrow(
        'process.exit prevented in test',
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('generate --snapshots uses custom snapshot directory', async () => {
      await main(['generate', 'test_mig', '--snapshots', './custom-snapshots']);
      expect(mockGenerateMigration).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          snapshotDir: expect.stringContaining('custom-snapshots'),
        }),
        expect.anything(),
        undefined,
        expect.anything(),
        expect.anything(),
      );
    });

    it('generate --full forces full migration', async () => {
      await main(['generate', 'test_mig', '--full']);
      expect(mockGenerateMigration).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ fullMigration: true }),
        expect.anything(),
        undefined,
        expect.anything(),
        expect.anything(),
      );
    });

    it('generate --output sets output directory', async () => {
      await main(['generate', 'test_mig', '--output', './custom-migrations']);
      expect(mockGenerateMigration).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ outputDir: './custom-migrations' }),
        expect.anything(),
        undefined,
        expect.anything(),
        expect.anything(),
      );
    });

    it('generate --version sets version number', async () => {
      await main(['generate', 'test_mig', '--version', '20250101000000']);
      expect(mockGenerateMigration).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ version: '20250101000000' }),
        expect.anything(),
        undefined,
        expect.anything(),
        expect.anything(),
      );
    });

    it('generate with --dry-run does not prevent generation (errors if no driver)', async () => {
      // --dry-run in globalOptions doesn't affect generate flow, just passes through
      await main(['generate', 'test_mig', '--dry-run']);
      expect(mockGenerateMigration).toHaveBeenCalled();
    });

    it('generate prints success message with output path', async () => {
      await main(['generate', 'test_mig']);
      const logOutput = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
      expect(logOutput).toContain('Migration created');
    });

    it('generate prints "No migration file" when outputPath is empty', async () => {
      mockGenerateMigration.mockResolvedValueOnce('');
      await main(['generate', 'test_mig']);
      const logOutput = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
      expect(logOutput).toContain('No migration file was created');
    });
  });

  // ============================================================================
  // pull command
  // ============================================================================

  describe('pull command', () => {
    it('pull calls pullSchema without table arg', async () => {
      await main(['pull']);
      expect(mockPullSchema).toHaveBeenCalledWith(expect.objectContaining({ table: undefined }));
    });

    it('pull <table> calls pullSchema with table name', async () => {
      await main(['pull', 'users']);
      expect(mockPullSchema).toHaveBeenCalledWith(expect.objectContaining({ table: 'users' }));
    });

    it('pull --output passes outputDir option', async () => {
      await main(['pull', '--output', './custom-schema']);
      expect(mockPullSchema).toHaveBeenCalledWith(
        expect.objectContaining({ outputDir: './custom-schema' }),
      );
    });
  });

  // ============================================================================
  // diff command
  // ============================================================================

  describe('diff command', () => {
    it('diff calls diffSchema', async () => {
      await main(['diff']);
      expect(mockDiffSchema).toHaveBeenCalled();
    });

    it('diff --verbose passes verbose option', async () => {
      await main(['diff', '--verbose']);
      expect(mockDiffSchema).toHaveBeenCalledWith(expect.objectContaining({ verbose: true }));
    });

    it('diff -V passes verbose option', async () => {
      await main(['diff', '-V']);
      expect(mockDiffSchema).toHaveBeenCalledWith(expect.objectContaining({ verbose: true }));
    });

    it('diff passes tables from schema files', async () => {
      await main(['diff']);
      expect(mockLoadSchemaFiles).toHaveBeenCalled();
      expect(mockDiffSchema).toHaveBeenCalledWith(
        expect.objectContaining({
          tables: expect.arrayContaining([expect.objectContaining({ name: 'users' })]),
        }),
      );
    });
  });

  // ============================================================================
  // query command
  // ============================================================================

  describe('query command', () => {
    it('query executes SQL and prints JSON result', async () => {
      await main(['query', 'SELECT * FROM users']);
      expect(mockCreateConnection).toHaveBeenCalled();
    });

    it('query passes SQL string to driver.query', async () => {
      await main(['query', 'SELECT * FROM users']);
      expect(mockDriver.query).toHaveBeenCalledWith('SELECT * FROM users');
    });

    it('query output is JSON formatted', async () => {
      mockDriver.query.mockResolvedValueOnce([{ id: '1', name: 'Alice' }]);
      await main(['query', 'SELECT * FROM users']);
      const logOutput = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
      expect(logOutput).toContain('"id"');
      expect(logOutput).toContain('"Alice"');
    });

    it('query without SQL prints usage and exits', async () => {
      await expect(main(['query'])).rejects.toThrow('process.exit prevented in test');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ============================================================================
  // help and version commands
  // ============================================================================

  describe('help and version', () => {
    it('help command prints help text', async () => {
      await main(['help']);
      const logOutput = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
      expect(logOutput).toContain('DaliORM CLI');
    });

    it('--help flag prints help text', async () => {
      await main(['--help']);
      const logOutput = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
      expect(logOutput).toContain('DaliORM CLI');
    });

    it('-h flag prints help text', async () => {
      await main(['-h']);
      const logOutput = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
      expect(logOutput).toContain('DaliORM CLI');
    });

    it('--version prints version string', async () => {
      await main(['--version']);
      expect(consoleLogSpy).toHaveBeenCalledWith('dali-orm v0.1.0');
    });

    it('-v prints version string', async () => {
      await main(['-v']);
      expect(consoleLogSpy).toHaveBeenCalledWith('dali-orm v0.1.0');
    });

    it('no arguments prints help and exits 0', async () => {
      await expect(main([])).rejects.toThrow('process.exit prevented in test');
      expect(exitSpy).toHaveBeenCalledWith(0);
      const logOutput = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
      expect(logOutput).toContain('DaliORM CLI');
    });
  });

  // ============================================================================
  // init command
  // ============================================================================

  describe('init command', () => {
    it('init prints initialization message', async () => {
      await main(['init']);
      const logOutput = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
      expect(logOutput).toContain('Initializing DaliORM project');
    });
  });

  // ============================================================================
  // error handling and edge cases
  // ============================================================================

  describe('error handling', () => {
    it('unknown command prints error and exits 1', async () => {
      await expect(main(['unknown-cmd'])).rejects.toThrow('process.exit prevented in test');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('error in handler is caught and exits 1', async () => {
      mockPullSchema.mockRejectedValueOnce(new Error('Handler failed'));
      await expect(main(['pull'])).rejects.toThrow('process.exit prevented in test');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('error handler logs error message', async () => {
      mockPullSchema.mockRejectedValueOnce(new Error('DB failure'));
      await expect(main(['pull'])).rejects.toThrow('process.exit prevented in test');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', 'DB failure');
    });

    it('handleGenerate error propagates to main catch', async () => {
      mockLoadSchemaFiles.mockRejectedValueOnce(new Error('Schema load failed'));
      await expect(main(['generate', 'test'])).rejects.toThrow('process.exit prevented in test');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('prints unknown command to stderr', async () => {
      await expect(main(['bogus'])).rejects.toThrow('process.exit prevented in test');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
    });
  });
});

// ============================================================================
// parseGlobalOptions (edge cases not covered in cli.test.ts)
// ============================================================================

describe('parseGlobalOptions (additional edge cases)', () => {
  it('handles --snapshots with value', () => {
    expect(parseGlobalOptions(['--snapshots', './my-snapshots']).snapshots).toBe('./my-snapshots');
  });

  it('parses --offline flag combined with other options', () => {
    const opts = parseGlobalOptions(['--offline', '--schema', './sch', '--full']);
    expect(opts.offline).toBe(true);
    expect(opts.schema).toBe('./sch');
    expect(opts.full).toBe(true);
  });

  it('parses --to before positional args', () => {
    // In real usage, --to is parsed from the full args array
    const opts = parseGlobalOptions(['--to', '005', 'status']);
    expect(opts.to).toBe('005');
  });
});
