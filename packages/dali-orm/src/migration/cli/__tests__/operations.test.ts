/**
 * Tests for shared CLI operations in operations.ts
 *
 * Covers: createConnectionWithTimeout, safeDisconnect, formatError,
 *         printAddedSection, printRemovedSection, printWarnings
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock connect before importing operations
vi.mock('../../../sdk/driver/orm-connection.js', () => ({
  connect: vi.fn(),
}));

import type { Config } from '../../config.js';
import {
  createConnectionWithTimeout,
  formatError,
  printAddedSection,
  printRemovedSection,
  printWarnings,
  safeDisconnect,
} from '../operations.js';

// ============================================================================
// Helpers
// ============================================================================

function mockConsole(): () => void {
  const origLog = console.log;
  const origErr = console.error;
  console.log = vi.fn();
  console.error = vi.fn();
  return () => {
    console.log = origLog;
    console.error = origErr;
  };
}

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    url: 'http://localhost:10101',
    namespace: 'test_ns',
    database: 'test_db',
    schema: { dir: './schema', pattern: '**/*.{js,ts}' },
    migrations: { dir: './migrations', table: '__migrations' },
    ...overrides,
  } as Config;
}

// ============================================================================
// createConnectionWithTimeout
// ============================================================================

describe('createConnectionWithTimeout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves when connection succeeds before timeout', async () => {
    const mod = (await import(
      '../../../sdk/driver/orm-connection.js'
    )) as unknown as {
      connect: ReturnType<typeof vi.fn>;
    };
    const mockDriver = { disconnect: vi.fn() };
    mod.connect.mockResolvedValue(mockDriver);

    const config = makeConfig();
    const result = await createConnectionWithTimeout(config, 5000);
    expect(result).toBe(mockDriver);
  });

  it('rejects on timeout when connection hangs', async () => {
    const mod = (await import(
      '../../../sdk/driver/orm-connection.js'
    )) as unknown as {
      connect: ReturnType<typeof vi.fn>;
    };
    // Make connect never settle
    mod.connect.mockReturnValue(new Promise(() => {}));

    const config = makeConfig();
    await expect(createConnectionWithTimeout(config, 10)).rejects.toThrow(
      'Connection timeout',
    );
  });
});

// ============================================================================
// safeDisconnect
// ============================================================================

describe('safeDisconnect', () => {
  let restoreConsole: () => void;

  beforeEach(() => {
    restoreConsole = mockConsole();
  });

  afterEach(() => {
    restoreConsole();
  });

  it('does nothing when driver is undefined', async () => {
    await safeDisconnect(undefined);
    expect(console.log).not.toHaveBeenCalled();
  });

  it('disconnects successfully', async () => {
    const driver = { disconnect: vi.fn().mockResolvedValue(undefined) };
    await safeDisconnect(driver as any);
    expect(driver.disconnect).toHaveBeenCalledTimes(1);
  });

  it('logs non-fatal error on disconnect failure', async () => {
    const driver = {
      disconnect: vi.fn().mockRejectedValue(new Error('connection lost')),
    };
    await safeDisconnect(driver as any);
    expect(console.log).toHaveBeenCalledWith(
      'Disconnect error (non-fatal):',
      'connection lost',
    );
  });

  it('logs string error on disconnect failure', async () => {
    const driver = {
      disconnect: vi.fn().mockRejectedValue('raw error string'),
    };
    await safeDisconnect(driver as any);
    expect(console.log).toHaveBeenCalledWith(
      'Disconnect error (non-fatal):',
      'raw error string',
    );
  });
});

// ============================================================================
// formatError
// ============================================================================

describe('formatError', () => {
  it('returns Error.message for Error instances', () => {
    expect(formatError(new Error('something went wrong'))).toBe(
      'something went wrong',
    );
  });

  it('returns string value directly', () => {
    expect(formatError('plain string error')).toBe('plain string error');
  });

  it('converts non-Error non-string values to string', () => {
    expect(formatError(42)).toBe('42');
    expect(formatError(null)).toBe('null');
    expect(formatError({ key: 'val' })).toBe('[object Object]');
  });
});

// ============================================================================
// printAddedSection
// ============================================================================

describe('printAddedSection', () => {
  let restoreConsole: () => void;

  beforeEach(() => {
    restoreConsole = mockConsole();
  });

  afterEach(() => {
    restoreConsole();
  });

  it('prints nothing for empty category', () => {
    printAddedSection({}, 'tables', 'Tables');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('prints added items with name property', () => {
    const grouped = { tables: [{ name: 'user' }, { name: 'post' }] };
    printAddedSection(grouped, 'tables', 'Tables');
    expect(console.log).toHaveBeenCalledWith('Added Tables (2):');
    expect(console.log).toHaveBeenCalledWith('  + user');
    expect(console.log).toHaveBeenCalledWith('  + post');
  });

  it('extracts name from index.shape', () => {
    const grouped = { indexes: [{ index: { name: 'idx_name' } }] };
    printAddedSection(grouped, 'indexes', 'Indexes');
    expect(console.log).toHaveBeenCalledWith('Added Indexes (1):');
    expect(console.log).toHaveBeenCalledWith('  + idx_name');
  });

  it('extracts name from access.shape', () => {
    const grouped = { accesses: [{ access: { name: 'admin_access' } }] };
    printAddedSection(grouped, 'accesses', 'Accesses');
    expect(console.log).toHaveBeenCalledWith('Added Accesses (1):');
    expect(console.log).toHaveBeenCalledWith('  + admin_access');
  });

  it('extracts name from event.shape', () => {
    const grouped = { events: [{ event: { name: 'on_create' } }] };
    printAddedSection(grouped, 'events', 'Events');
    expect(console.log).toHaveBeenCalledWith('Added Events (1):');
    expect(console.log).toHaveBeenCalledWith('  + on_create');
  });

  it('extracts name from function.shape', () => {
    const grouped = { funcs: [{ function: { name: 'fn::hello' } }] };
    printAddedSection(grouped, 'funcs', 'Functions');
    expect(console.log).toHaveBeenCalledWith('Added Functions (1):');
    expect(console.log).toHaveBeenCalledWith('  + fn::hello');
  });

  it('skips items with no recognizable name', () => {
    const grouped = { tables: [{ noName: true }, { name: 'valid' }] };
    printAddedSection(grouped, 'tables', 'Tables');
    expect(console.log).toHaveBeenCalledWith('Added Tables (1):');
    expect(console.log).toHaveBeenCalledWith('  + valid');
    // Only 'valid' should appear — the item without a name is filtered out
  });
});

// ============================================================================
// printRemovedSection
// ============================================================================

describe('printRemovedSection', () => {
  let restoreConsole: () => void;

  beforeEach(() => {
    restoreConsole = mockConsole();
  });

  afterEach(() => {
    restoreConsole();
  });

  it('prints nothing for empty category', () => {
    printRemovedSection({}, 'tables', 'Tables');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('prints removed items with - prefix', () => {
    const grouped = { tables: [{ name: 'user' }, { name: 'post' }] };
    printRemovedSection(grouped, 'tables', 'Tables');
    expect(console.log).toHaveBeenCalledWith('Removed Tables (2):');
    expect(console.log).toHaveBeenCalledWith('  - user');
    expect(console.log).toHaveBeenCalledWith('  - post');
  });

  it('extracts name from index.shape', () => {
    const grouped = { indexes: [{ index: { name: 'old_idx' } }] };
    printRemovedSection(grouped, 'indexes', 'Indexes');
    expect(console.log).toHaveBeenCalledWith('Removed Indexes (1):');
    expect(console.log).toHaveBeenCalledWith('  - old_idx');
  });

  it('skips items with no recognizable name', () => {
    const grouped = { tables: [{ noName: true }] };
    printRemovedSection(grouped, 'tables', 'Tables');
    expect(console.log).not.toHaveBeenCalled();
  });
});

// ============================================================================
// printWarnings
// ============================================================================

describe('printWarnings', () => {
  let restoreConsole: () => void;

  beforeEach(() => {
    restoreConsole = mockConsole();
  });

  afterEach(() => {
    restoreConsole();
  });

  it('prints nothing for empty warnings', () => {
    printWarnings([]);
    expect(console.log).not.toHaveBeenCalled();
  });

  it('prints each warning with warning symbol', () => {
    printWarnings(['Field x is deprecated', 'Table y has no primary key']);
    expect(console.log).toHaveBeenCalledWith('Warnings:');
    expect(console.log).toHaveBeenCalledWith('  ⚠ Field x is deprecated');
    expect(console.log).toHaveBeenCalledWith('  ⚠ Table y has no primary key');
  });
});
