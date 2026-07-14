/**
 * BaseDriver — connection management, query, showChanges, namespace/database tests.
 *
 * Extracted from base-driver.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { TestDriver, createMockDb, state, queryMock } from './driver-test-utils.js';
import type { MockDb } from './driver-test-utils.js';

describe('BaseDriver', () => {
  let mockDb: MockDb;
  let driver: TestDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    state.shouldDateTimeThrow = false;
    mockDb = createMockDb();
    driver = new TestDriver(mockDb as unknown as Record<string, import('vitest').Mock>);
  });

  // ============================================================================
  // Connection Management
  // ============================================================================

  describe('connection management', () => {
    describe('isConnected', () => {
      it('returns false when not connected', () => {
        driver.connected = false;
        expect(driver.isConnected()).toBe(false);
      });

      it('returns true when connected', () => {
        driver.connected = true;
        expect(driver.isConnected()).toBe(true);
      });
    });

    describe('disconnect', () => {
      it('is a no-op when not connected', async () => {
        driver.connected = false;
        await driver.disconnect();
        expect(mockDb.close).not.toHaveBeenCalled();
      });

      it('kills subscriptions, closes db, clears map when connected', async () => {
        driver.connected = true;
        const subKill = vi.fn().mockResolvedValue(undefined);
        driver.subscriptions.set('sub1', { created: 100, liveSubscription: { kill: subKill } });
        driver.subscriptions.set('sub2', { created: 200, liveSubscription: { kill: subKill } });

        await driver.disconnect();

        expect(subKill).toHaveBeenCalledTimes(2);
        expect(mockDb.close).toHaveBeenCalledOnce();
        expect(driver.connected).toBe(false);
        expect(driver.subscriptions.size).toBe(0);
      });
    });
  });

  // ============================================================================
  // Query
  // ============================================================================

  describe('query()', () => {
    it('throws if not connected', async () => {
      driver.connected = false;
      await expect(driver.query('SELECT * FROM user')).rejects.toThrow(
        'Not connected to SurrealDB',
      );
    });

    it('executes SQL and returns results', async () => {
      driver.connected = true;
      mockDb.query.mockReturnValue(queryMock([[{ id: '1', name: 'Alice' }]]));

      const result = await driver.query('SELECT * FROM user', { limit: 10 });

      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM user', { limit: 10 });
      expect(result).toEqual([{ id: '1', name: 'Alice' }]);
    });

    it('returns empty array when result[0] is undefined', async () => {
      driver.connected = true;
      mockDb.query.mockReturnValue(queryMock([undefined]));

      const result = await driver.query('SELECT * FROM user');

      expect(result).toEqual([]);
    });

    it('wraps SDK errors', async () => {
      driver.connected = true;
      mockDb.query.mockReturnValue({
        collect: vi.fn().mockRejectedValue(new Error('DB timeout')),
      });

      await expect(driver.query('SELECT * FROM user')).rejects.toThrow('Query failed: DB timeout');
    });

    it('wraps non-Error SDK errors as strings', async () => {
      driver.connected = true;
      mockDb.query.mockReturnValue({
        collect: vi.fn().mockRejectedValue('string error'),
      });

      await expect(driver.query('SELECT * FROM user')).rejects.toThrow(
        'Query failed: string error',
      );
    });
  });

  // ============================================================================
  // Change Feed (showChanges)
  // ============================================================================

  describe('showChanges()', () => {
    it('throws if not connected', async () => {
      driver.connected = false;
      await expect(driver.showChanges('user')).rejects.toThrow('Not connected to SurrealDB');
    });

    it('uses default options when none provided', async () => {
      driver.connected = true;
      mockDb.query.mockReturnValue(queryMock([[{ id: '1' }]]));

      const result = await driver.showChanges('user');

      expect(mockDb.query).toHaveBeenCalledWith(
        'SHOW CHANGES FOR TABLE user SINCE 0 LIMIT 10',
        undefined,
      );
      expect(result).toEqual([{ id: '1' }]);
    });

    it('uses custom since and limit', async () => {
      driver.connected = true;
      mockDb.query.mockReturnValue(queryMock([[]]));

      await driver.showChanges('user', { since: '2024-01-01T00:00:00Z', limit: 50 });

      expect(mockDb.query).toHaveBeenCalledWith(
        'SHOW CHANGES FOR TABLE user SINCE 2024-01-01T00:00:00Z LIMIT 50',
        undefined,
      );
    });

    it('warns when table name contains invalid characters', async () => {
      driver.connected = true;
      mockDb.query.mockReturnValue(queryMock([[]]));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await driver.showChanges('user table!');

      expect(warnSpy).toHaveBeenCalledWith('Table name contains invalid characters, sanitized');
      expect(mockDb.query).toHaveBeenCalledWith(
        'SHOW CHANGES FOR TABLE usertable SINCE 0 LIMIT 10',
        undefined,
      );
      warnSpy.mockRestore();
    });

    it('does not warn for clean table names', async () => {
      driver.connected = true;
      mockDb.query.mockReturnValue(queryMock([[]]));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await driver.showChanges('user');

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // ============================================================================
  // Namespace / Database
  // ============================================================================

  describe('namespace/database management', () => {
    describe('use()', () => {
      it('throws if not connected', async () => {
        driver.connected = false;
        await expect(driver.use('ns', 'db')).rejects.toThrow('Not connected to SurrealDB');
      });

      it('switches namespace and database', async () => {
        driver.connected = true;
        await driver.use('my_ns', 'my_db');
        expect(mockDb.use).toHaveBeenCalledWith({ namespace: 'my_ns', database: 'my_db' });
      });
    });

    describe('invalidate()', () => {
      it('invalidates session and sets connected to false', async () => {
        driver.connected = true;
        await driver.invalidate();
        expect(mockDb.invalidate).toHaveBeenCalledOnce();
        expect(driver.connected).toBe(false);
      });
    });

    describe('auth()', () => {
      it('throws if not connected', async () => {
        driver.connected = false;
        await expect(driver.auth()).rejects.toThrow('Not connected to SurrealDB');
      });

      it('returns auth data when present', async () => {
        driver.connected = true;
        // .collect() returns [data], where data is the first (only) result set
        mockDb.query.mockReturnValue(queryMock([{ id: 'user:1', name: 'Alice' }]));

        const result = await driver.auth();

        expect(mockDb.query).toHaveBeenCalledWith('RETURN $auth');
        expect(result).toEqual({ id: 'user:1', name: 'Alice' });
      });

      it('returns null when auth data is empty', async () => {
        driver.connected = true;
        // .collect() returns [null] → result[0] is null
        mockDb.query.mockReturnValue(queryMock([null]));

        const result = await driver.auth();

        expect(result).toBeNull();
      });
    });
  });
});
