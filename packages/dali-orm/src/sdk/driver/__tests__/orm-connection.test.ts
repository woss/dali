/**
 * Comprehensive test suite for orm-connection.ts
 *
 * Tests resolveDriverOptions, connect, execute, and showChanges.
 *
 * MOCK STRATEGY (Vitest 4.x):
 * - External packages (obug): top-level vi.fn() refs OK in factory
 * - Relative path mocks: outer variables NOT OK in factory
 *   → Use globalThis.sharedMocks pattern to share refs across boundary
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Shared mock containers — populated by vi.mock factories, read by tests
// ============================================================================

vi.mock('obug', () => ({
  createDebug: vi.fn(() => {
    const fn = vi.fn() as any;
    fn.extend = vi.fn(() => vi.fn());
    return fn;
  }),
}));

vi.mock('../node-driver.js', () => {
  const connect = vi.fn();
  const query = vi.fn();
  const getUrl = vi.fn();
  (globalThis as any).__ormTestNodeDriver = { connect, query, getUrl };
  return {
    NodeDriver: class {
      connect = connect;
      query = query;
      getUrl = getUrl;
      config = {};
    },
  };
});

vi.mock('../embedded-driver.js', () => {
  const connect = vi.fn();
  const query = vi.fn();
  const getUrl = vi.fn();
  (globalThis as any).__ormTestEmbeddedDriver = { connect, query, getUrl };
  return {
    EmbeddedDriver: class {
      connect = connect;
      query = query;
      getUrl = getUrl;
    },
  };
});

vi.mock('../orm-interfaces.js', () => {
  const fn = vi.fn() as any;
  (globalThis as any).__ormTestIsHttpProtocol = fn;
  return { isHttpProtocol: fn };
});

// ============================================================================
// Imports
// ============================================================================

import {
  connect,
  execute,
  resolveDriverOptions,
  showChanges,
} from '../orm-connection.js';

// ============================================================================
// Helpers
// ============================================================================

function getNodeMocks() {
  return (globalThis as any).__ormTestNodeDriver;
}

function getEmbedMocks() {
  return (globalThis as any).__ormTestEmbeddedDriver;
}

function getIsHttpProtocol() {
  return (globalThis as any).__ormTestIsHttpProtocol;
}

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();

  const node = getNodeMocks();
  node.connect.mockResolvedValue(undefined);
  node.query.mockResolvedValue([]);
  node.getUrl.mockReturnValue('ws://localhost:8000');

  const embed = getEmbedMocks();
  embed.connect.mockResolvedValue(undefined);
  embed.query.mockResolvedValue([]);
  embed.getUrl.mockReturnValue('mem://');

  getIsHttpProtocol().mockReturnValue(false);
});

// ============================================================================
// resolveDriverOptions
// ============================================================================

describe('resolveDriverOptions', () => {
  it('returns explicitOptions when configFromFile is undefined', () => {
    const opts = { driver: 'node' as const, url: 'ws://localhost:8000' };
    const result = resolveDriverOptions(opts, undefined);

    expect(result).toBe(opts);
  });

  it('merges configFromFile as base with explicitOptions overriding', () => {
    const explicit = { driver: 'node' as const, namespace: 'explicit-ns' };
    const fromFile = {
      url: 'ws://file:8000',
      namespace: 'file-ns',
      database: 'file-db',
    };

    const result = resolveDriverOptions(explicit, fromFile);

    expect(result).toEqual({
      driver: 'node',
      url: 'ws://file:8000',
      namespace: 'explicit-ns',
      database: 'file-db',
    });
  });

  it('includes auth from configFromFile when present', () => {
    const explicit = { driver: 'node' as const };
    const fromFile = {
      url: 'ws://localhost:8000',
      namespace: 'ns',
      database: 'db',
      auth: { type: 'root' as const, username: 'root', password: 'root' },
    };

    const result = resolveDriverOptions(explicit, fromFile);

    expect(result).toHaveProperty('auth');
    expect((result as any).auth).toEqual(fromFile.auth);
  });

  it('preserves configFromFile values when explicitOptions lacks them', () => {
    const explicit = { driver: 'node' as const };
    const fromFile = {
      url: 'ws://localhost:8000',
      namespace: 'ns',
      database: 'db',
    };

    const result = resolveDriverOptions(explicit, fromFile);

    expect(result).toEqual({
      driver: 'node',
      url: 'ws://localhost:8000',
      namespace: 'ns',
      database: 'db',
    });
  });
});

// ============================================================================
// connect
// ============================================================================

describe('connect', () => {
  it('creates a NodeDriver when nodeDriver config is provided', async () => {
    const node = getNodeMocks();
    const driver = await connect({
      nodeDriver: { driver: 'node', url: 'ws://localhost:8000' },
    });

    expect(node.connect).toHaveBeenCalledOnce();
    expect(node.getUrl).toHaveBeenCalled();
    expect(driver).toBeDefined();
  });

  it('creates an EmbeddedDriver when embeddedDriver config is provided', async () => {
    const embed = getEmbedMocks();
    const driver = await connect({
      embeddedDriver: { driver: 'embedded' },
    });

    expect(embed.connect).toHaveBeenCalledOnce();
    expect(embed.getUrl).toHaveBeenCalled();
    expect(driver).toBeDefined();
  });

  it('throws when neither nodeDriver nor embeddedDriver is provided', async () => {
    await expect(connect({})).rejects.toThrow(
      'Must provide nodeDriver or embeddedDriver config',
    );
  });

  it('loads config from file when config is true (throws if no config found)', async () => {
    await expect(
      connect({
        config: true,
        nodeDriver: { driver: 'node' },
      }),
    ).rejects.toThrow('Config file not found');
  });

  it('loads config from path when config is a string (throws if file missing)', async () => {
    await expect(
      connect({
        config: '/nonexistent/config.json',
        nodeDriver: { driver: 'node' },
      }),
    ).rejects.toThrow('Config file does not exist');
  });

  it('parses inline config object when config is an object with valid values', async () => {
    const node = getNodeMocks();
    const driver = await connect({
      config: {
        url: 'ws://localhost:8000',
        namespace: 'test',
        database: 'test',
      },
      nodeDriver: { driver: 'node' },
    });

    expect(node.connect).toHaveBeenCalledOnce();
    expect(driver).toBeDefined();
  });

  it('validates auth and throws on invalid config', async () => {
    // Pass auth with missing required fields to trigger validation error
    await expect(
      connect({
        nodeDriver: {
          driver: 'node',
          url: 'ws://localhost:8000',
          auth: { type: 'root' } as never,
        },
      }),
    ).rejects.toThrow('Auth configuration validation failed');
  });

  it('warns about HTTP endpoints when isHttpProtocol returns true', async () => {
    getIsHttpProtocol().mockReturnValue(true);

    const driver = await connect({
      nodeDriver: { driver: 'node', url: 'http://localhost:8000' },
    });

    expect(getIsHttpProtocol()).toHaveBeenCalled();
    expect(driver).toBeDefined();
  });
});

// ============================================================================
// execute
// ============================================================================

describe('execute', () => {
  it('calls driver.query with SQL and params from query object', async () => {
    const driver = { query: vi.fn().mockResolvedValue(['result']) };
    const queryObj = {
      toSQL: () => 'SELECT * FROM person WHERE name = $name',
      toParams: () => ({ name: 'John' }),
    };

    const result = await execute(driver as never, queryObj);

    expect(driver.query).toHaveBeenCalledWith(
      'SELECT * FROM person WHERE name = $name',
      {
        name: 'John',
      },
    );
    expect(result).toEqual(['result']);
  });

  it('falls back to empty params when query object lacks toParams', async () => {
    const driver = { query: vi.fn().mockResolvedValue(['result']) };
    const queryObj = {
      toSQL: () => 'SELECT * FROM person',
    };

    const result = await execute(driver as never, queryObj);

    expect(driver.query).toHaveBeenCalledWith('SELECT * FROM person', {});
    expect(result).toEqual(['result']);
  });
});

// ============================================================================
// showChanges
// ============================================================================

describe('showChanges', () => {
  it('uses default since=0 and limit=10 when no options provided', async () => {
    const driver = { query: vi.fn().mockResolvedValue([]) };
    const result = await showChanges(driver as never, 'person');

    expect(driver.query).toHaveBeenCalledWith(
      'SHOW CHANGES FOR TABLE person SINCE 0 LIMIT 10',
    );
    expect(result).toEqual([]);
  });

  it('uses custom since and limit when provided', async () => {
    const driver = { query: vi.fn().mockResolvedValue([]) };

    await showChanges(driver as never, 'person', {
      since: '2024-01-01T00:00:00Z',
      limit: 50,
    });

    expect(driver.query).toHaveBeenCalledWith(
      'SHOW CHANGES FOR TABLE person SINCE 2024-01-01T00:00:00Z LIMIT 50',
    );
  });

  it('includes special characters in table name', async () => {
    const driver = { query: vi.fn().mockResolvedValue([]) };

    await showChanges(driver as never, 'my-table');

    expect(driver.query).toHaveBeenCalledWith(
      'SHOW CHANGES FOR TABLE mytable SINCE 0 LIMIT 10',
    );
  });
});
