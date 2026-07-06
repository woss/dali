import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// Hoisted mocks — referenced inside vi.mock() factories
// =============================================================================

const { mockConnect, mockGenerateAndApplyMigration, mockDisconnect, mockDriver } = vi.hoisted(
  () => {
    const mockDriver = {};
    const mockDisconnect = vi.fn();
    const mockConnect = vi.fn().mockResolvedValue({
      getDriver: () => mockDriver,
      disconnect: mockDisconnect,
    });
    const mockGenerateAndApplyMigration = vi.fn();
    return { mockConnect, mockGenerateAndApplyMigration, mockDisconnect, mockDriver };
  },
);

// =============================================================================
// Module mocks — hoisted before imports
// =============================================================================

vi.mock('@woss/dali-orm', () => ({
  DaliORM: { connect: mockConnect },
}));

vi.mock('@woss/dali-orm/migration/api', () => ({
  generateAndApplyMigration: mockGenerateAndApplyMigration,
}));

// $env/dynamic/private is a SvelteKit virtual module — mock it at module level
vi.mock('$env/dynamic/private', () => ({
  env: {
    DALI_MEMORY_SURREAL_URL: 'ws://localhost:10101',
    DALI_MEMORY_SURREAL_NS: 'memory',
    DALI_MEMORY_SURREAL_DB: 'memory',
    DALI_MEMORY_SURREAL_USER: 'root',
    DALI_MEMORY_SURREAL_PASS: 'root',
    DALI_MEMORY_SECRET: 'test-secret',
    DALI_MEMORY_LOG_LEVEL: 'info',
  },
}));

vi.mock('../logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

// =============================================================================
// Module under test — imported AFTER mocks
// =============================================================================

import { connect, disconnect, getDB } from '../connection';

// =============================================================================
// Tests
// =============================================================================

// Top-level beforeEach: clears mock call counts so tests don't leak state
beforeEach(() => {
  vi.clearAllMocks();
});

describe('connect()', () => {
  afterEach(async () => {
    await disconnect();
  });

  test('happy path: creates connection and applies migration on first call', async () => {
    const orm = await connect();

    expect(orm).toBeDefined();
    expect(mockConnect).toHaveBeenCalledTimes(1);

    // Verify DaliORM.connect was called with the correct config structure
    const connectCall = mockConnect.mock.calls[0][0];
    expect(connectCall).toHaveProperty('nodeDriver');
    expect(connectCall.nodeDriver).toHaveProperty('driver', 'node');
    expect(connectCall.nodeDriver).toHaveProperty('url');
    expect(connectCall.nodeDriver).toHaveProperty('namespace');
    expect(connectCall.nodeDriver).toHaveProperty('database');
    expect(connectCall).toHaveProperty('schema');

    // Verify generateAndApplyMigration was called with correct args
    expect(mockGenerateAndApplyMigration).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndApplyMigration).toHaveBeenCalledWith(
      mockDriver,
      expect.any(Array),
      expect.objectContaining({
        name: 'init',
        fullMigration: false,
        access: expect.any(Array),
        analyzers: expect.any(Array),
      }),
    );
  });

  test('singleton: second call returns cached instance without re-connecting', async () => {
    const orm1 = await connect();
    const orm2 = await connect();

    expect(orm1).toBe(orm2);
    // DaliORM.connect should only be called once
    expect(mockConnect).toHaveBeenCalledTimes(1);
    // generateAndApplyMigration should only be called once
    expect(mockGenerateAndApplyMigration).toHaveBeenCalledTimes(1);
  });

  test('restart: catches "No schema changes detected" and continues successfully', async () => {
    mockGenerateAndApplyMigration.mockRejectedValueOnce(
      new Error('No schema changes detected. Migration not generated.'),
    );

    const orm = await connect();

    expect(orm).toBeDefined();
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndApplyMigration).toHaveBeenCalledTimes(1);
    // Instance should still be set after catching the error
    expect(getDB()).toBe(orm);
  });

  test('error: propagates migration errors that are not "No schema changes"', async () => {
    mockGenerateAndApplyMigration.mockRejectedValueOnce(new Error('Database connection lost'));

    await expect(connect()).rejects.toThrow('Database connection lost');
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  test('error: propagates DaliORM.connect failures', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Connection refused'));

    await expect(connect()).rejects.toThrow('Connection refused');
    expect(mockGenerateAndApplyMigration).not.toHaveBeenCalled();
  });
});

describe('getDB()', () => {
  afterEach(async () => {
    await disconnect();
  });

  test('returns the connected DaliORM instance', async () => {
    await connect();
    const db = getDB();
    expect(db).toBeDefined();
    expect(db.getDriver).toBeDefined();
  });

  test('throws when connect() has not been called', () => {
    expect(() => getDB()).toThrow('Database not connected');
  });
});

describe('disconnect()', () => {
  afterEach(async () => {
    await disconnect();
  });

  test('disconnects and clears the cached instance', async () => {
    await connect();
    expect(() => getDB()).not.toThrow();

    await disconnect();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(() => getDB()).toThrow('Database not connected');
  });

  test('is safe to call when no connection exists', async () => {
    await expect(disconnect()).resolves.toBeUndefined();
  });
});
