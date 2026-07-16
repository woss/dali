/**
 * Tests for the connect() function in db/connection.ts.
 *
 * Covers:
 * 1. DaliORM.connect() throws generic Error → wrapped in ConnectionError with context
 * 2. Original error accessible via ConnectionError.context.cause
 * 3. generateAndApplyMigration() throws MigrationError with 'No schema changes detected' → no throw, returns ORM
 * 4. generateAndApplyMigration() throws MigrationError with other message → re-throws MigrationError (NOT wrapped)
 * 5. ConnectionError includes correct url, namespace, database in context
 * 6. Singleton: second call returns same instance (no re-connection)
 * 7. Non-Error values thrown by DaliORM.connect() are wrapped in ConnectionError
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionError, MigrationError } from '@woss/dali-orm/core/errors';

// ─── Mock modules (hoisted by vi.mock) ──────────────────────────────────────

vi.mock('@woss/dali-orm', () => ({
  DaliORM: {
    connect: vi.fn(),
  },
}));

vi.mock('@woss/dali-orm/migration/api', () => ({
  generateAndApplyMigration: vi.fn(),
}));

vi.mock('../src/lib/server/db/schema', () => ({
  schema: {
    getTables: vi.fn().mockReturnValue([]),
    getAccess: vi.fn().mockReturnValue([]),
    getAnalyzers: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../src/lib/server/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));

// ─── Import mocked modules ───────────────────────────────────────────────────

import { DaliORM } from '@woss/dali-orm';
import { generateAndApplyMigration } from '@woss/dali-orm/migration/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockORM() {
  return {
    getDriver: vi.fn().mockReturnValue({}),
    disconnect: vi.fn(),
  } as any;
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('connect — error handling', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the singleton between tests
    const { connect, disconnect } = await import('../src/lib/server/db/connection');
    await disconnect();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Test 1: DaliORM.connect() throws generic Error ──────────────────────

  test('wraps generic Error from DaliORM.connect() in ConnectionError', async () => {
    const originalError = new Error('SurrealDB unreachable');
    vi.mocked(DaliORM.connect).mockRejectedValue(originalError);

    const { connect } = await import('../src/lib/server/db/connection');

    await expect(connect()).rejects.toThrow(ConnectionError);
  });

  // ── Test 2: ConnectionError context includes url, namespace, database ──

  test('ConnectionError includes url, namespace, database in context', async () => {
    const originalError = new Error('connection refused');
    vi.mocked(DaliORM.connect).mockRejectedValue(originalError);

    const { connect } = await import('../src/lib/server/db/connection');

    try {
      await connect();
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConnectionError);
      expect(err.message).toBe('Failed to connect to SurrealDB');
      expect(err.context).toBeDefined();
      expect(err.context.url).toBe('ws://localhost:10101');
      expect(err.context.namespace).toBe('memory');
      expect(err.context.database).toBe('memory');
    }
  });

  // ── Test 3: Original error accessible via context.cause ────────────────

  test('original error is accessible via ConnectionError.context.cause', async () => {
    const originalError = new Error('TLS handshake failed');
    vi.mocked(DaliORM.connect).mockRejectedValue(originalError);

    const { connect } = await import('../src/lib/server/db/connection');

    try {
      await connect();
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConnectionError);
      expect(err.context.cause).toBeInstanceOf(Error);
      expect(err.context.cause.message).toBe('TLS handshake failed');
    }
  });

  // ── Test 4: 'No schema changes detected' — returns ORM, no throw ──────

  test('MigrationError with "No schema changes detected" does NOT throw', async () => {
    const mockORM = createMockORM();
    vi.mocked(DaliORM.connect).mockResolvedValue(mockORM);
    vi.mocked(generateAndApplyMigration).mockRejectedValue(
      new MigrationError('No schema changes detected'),
    );

    const { connect } = await import('../src/lib/server/db/connection');

    const result = await connect();
    expect(result).toBe(mockORM);
  });

  // ── Test 5: MigrationError with other message — re-throws as-is ────────
  //
  // POST-FIX: outer catch (line 59) checks `error instanceof MigrationError`
  // and re-throws it directly — NOT wrapped in ConnectionError.

  test('MigrationError with different message is re-thrown as-is (NOT wrapped in ConnectionError)', async () => {
    const mockORM = createMockORM();
    vi.mocked(DaliORM.connect).mockResolvedValue(mockORM);

    const migrationErr = new MigrationError('Table already exists', {
      table: 'users',
    });
    vi.mocked(generateAndApplyMigration).mockRejectedValue(migrationErr);

    const { connect } = await import('../src/lib/server/db/connection');

    try {
      await connect();
      expect.fail('Should have thrown');
    } catch (err: any) {
      // POST-FIX: MigrationError re-thrown as-is
      expect(err).toBeInstanceOf(MigrationError);
      expect(err).not.toBeInstanceOf(ConnectionError);
      expect(err.message).toBe('Table already exists');
    }
  });

  // ── Test 6: Non-Error value from DaliORM.connect() wrapped ─────────────

  test('wraps non-Error value from DaliORM.connect() in ConnectionError', async () => {
    vi.mocked(DaliORM.connect).mockRejectedValue('string error');

    const { connect } = await import('../src/lib/server/db/connection');

    try {
      await connect();
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConnectionError);
      expect(err.context.cause).toBeInstanceOf(Error);
      expect(err.context.cause.message).toBe('string error');
    }
  });

  // ── Test 7: Successful connect() returns ORM instance ──────────────────

  test('successful connect() returns ORM instance', async () => {
    const mockORM = createMockORM();
    vi.mocked(DaliORM.connect).mockResolvedValue(mockORM);
    vi.mocked(generateAndApplyMigration).mockResolvedValue(undefined as any);

    const { connect } = await import('../src/lib/server/db/connection');

    const result = await connect();
    expect(result).toBe(mockORM);
  });

  // ── Test 8: Singleton — second call returns cached instance ─────────────

  test('second call returns cached instance without reconnecting', async () => {
    const mockORM = createMockORM();
    vi.mocked(DaliORM.connect).mockResolvedValue(mockORM);
    vi.mocked(generateAndApplyMigration).mockResolvedValue(undefined as any);

    const { connect } = await import('../src/lib/server/db/connection');

    const first = await connect();
    const second = await connect();

    expect(first).toBe(second);
    expect(DaliORM.connect).toHaveBeenCalledTimes(1);
  });

  // ── Test 9: DaliORM.connect() call args match expected config ──────────

  test('DaliORM.connect() is called with correct config', async () => {
    const mockORM = createMockORM();
    vi.mocked(DaliORM.connect).mockResolvedValue(mockORM);
    vi.mocked(generateAndApplyMigration).mockResolvedValue(undefined as any);

    const { connect } = await import('../src/lib/server/db/connection');

    await connect();

    expect(DaliORM.connect).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(DaliORM.connect).mock.calls[0][0] as any;
    expect(callArgs.nodeDriver).toBeDefined();
    expect(callArgs.nodeDriver.url).toBe('ws://localhost:10101');
    expect(callArgs.nodeDriver.namespace).toBe('memory');
    expect(callArgs.nodeDriver.database).toBe('memory');
    expect(callArgs.nodeDriver.auth.type).toBe('root');
  });
});
