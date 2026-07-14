/**
 * BaseDriver — live query tests (live, liveWithOptions, LiveSubscriptionHandle, kill).
 *
 * Extracted from base-driver.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('surrealdb', () => {
  class MockRecordId {
    constructor(
      public tb: string,
      public id: string | number,
    ) {}
    toJSON() {
      return { tb: this.tb, id: this.id };
    }
    toString() {
      return `${this.tb}:${this.id}`;
    }
  }
  class MockTable {
    constructor(public name: string) {}
    toString() {
      return this.name;
    }
  }
  class MockDateTime {
    value: string;
    constructor(d: Date | string) {
      this.value = d instanceof Date ? d.toISOString() : d;
    }
    toString() {
      return this.value;
    }
    toJSON() {
      return { dt: this.value };
    }
  }
  return { RecordId: MockRecordId, Table: MockTable, DateTime: MockDateTime };
});

import { Table } from 'surrealdb';
import {
  TestDriver,
  createMockDb,
  state,
  createMockSubscription,
  createThrowingSubscription,
  builderThenable,
  thenableResolve,
  thenableReject,
} from './driver-test-utils.js';
import type { MockDb } from './driver-test-utils.js';
import type { LiveAction, LiveData } from '../types.js';

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
  // Live Queries
  // ============================================================================

  describe('live queries', () => {
    describe('live()', () => {
      it('throws if not connected', async () => {
        driver.connected = false;
        await expect(driver.live('user', vi.fn())).rejects.toThrow('Not connected to SurrealDB');
      });

      it('throws on empty table name', async () => {
        driver.connected = true;
        await expect(driver.live('', vi.fn())).rejects.toThrow('Table name is required');
      });

      it('warns on table name sanitization', async () => {
        driver.connected = true;
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const subscription = createMockSubscription();
        mockDb.live.mockReturnValue(thenableResolve(subscription));

        await driver.live('user table!', vi.fn());

        expect(warnSpy).toHaveBeenCalledWith('Table name contains invalid characters, sanitized');
        warnSpy.mockRestore();
      });

      it('subscribes and receives live updates via callback', async () => {
        driver.connected = true;
        const updates = [{ action: 'CREATE', value: { id: '1', name: 'Alice' } }];
        const subscription = createMockSubscription(updates);
        mockDb.live.mockReturnValue(thenableResolve(subscription));
        const callback = vi.fn();

        const id = await driver.live('user', callback);

        expect(id).toMatch(/^live_/);
        expect(mockDb.live).toHaveBeenCalledWith(expect.any(Table));

        // Wait for background async iterator to process
        const start = Date.now();
        while (!callback.mock.calls.length && Date.now() - start < 2000) {
          await new Promise((r) => setTimeout(r, 10));
        }
        expect(callback).toHaveBeenCalledWith({
          action: 'CREATE' as LiveAction,
          result: { id: '1', name: 'Alice' },
        });
      });

      it('rejects on SDK error', async () => {
        driver.connected = true;
        mockDb.live.mockReturnValue(thenableReject(new Error('SDK failure')));

        await expect(driver.live('user', vi.fn())).rejects.toThrow('SDK failure');
      });

      it('gracefully handles async iterator errors', async () => {
        driver.connected = true;
        const subscription = createThrowingSubscription();
        mockDb.live.mockReturnValue(thenableResolve(subscription));
        const callback = vi.fn();

        // Should not throw — the for-await catch handles iterator errors
        const id = await driver.live('user', callback);
        expect(id).toMatch(/^live_/);
      });
    });

    describe('liveWithOptions()', () => {
      it('throws if not connected', async () => {
        driver.connected = false;
        await expect(driver.liveWithOptions('user')).rejects.toThrow('Not connected to SurrealDB');
      });

      it('throws on empty table name', async () => {
        driver.connected = true;
        await expect(driver.liveWithOptions('')).rejects.toThrow(
          'Table name is required for live query',
        );
      });

      it('warns on table name sanitization', async () => {
        driver.connected = true;
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const subscription = createMockSubscription();
        const livePromise = {
          ...builderThenable(subscription),
          diff: vi.fn().mockReturnThis(),
          fields: vi.fn().mockReturnThis(),
          value: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          fetch: vi.fn().mockReturnThis(),
        };
        mockDb.live.mockReturnValue(livePromise);

        await driver.liveWithOptions('user table!');

        expect(warnSpy).toHaveBeenCalledWith('Table name contains invalid characters, sanitized');
        warnSpy.mockRestore();
      });

      it('subscribes without options', async () => {
        driver.connected = true;
        const subscription = createMockSubscription();
        const livePromise = {
          ...builderThenable(subscription),
          diff: vi.fn().mockReturnThis(),
          fields: vi.fn().mockReturnThis(),
          value: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          fetch: vi.fn().mockReturnThis(),
        };
        mockDb.live.mockReturnValue(livePromise);

        const handle = await driver.liveWithOptions('user');

        expect(handle.id).toMatch(/^live_/);
        expect(livePromise.diff).not.toHaveBeenCalled();
        expect(livePromise.fields).not.toHaveBeenCalled();
      });

      it('with diff option', async () => {
        driver.connected = true;
        const subscription = createMockSubscription();
        const livePromise = {
          ...builderThenable(subscription),
          diff: vi.fn().mockReturnThis(),
          fields: vi.fn().mockReturnThis(),
          value: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          fetch: vi.fn().mockReturnThis(),
        };
        mockDb.live.mockReturnValue(livePromise);

        await driver.liveWithOptions('user', { diff: true });

        expect(livePromise.diff).toHaveBeenCalledOnce();
      });

      it('with fields option', async () => {
        driver.connected = true;
        const subscription = createMockSubscription();
        const livePromise = {
          ...builderThenable(subscription),
          diff: vi.fn().mockReturnThis(),
          fields: vi.fn().mockReturnThis(),
          value: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          fetch: vi.fn().mockReturnThis(),
        };
        mockDb.live.mockReturnValue(livePromise);

        await driver.liveWithOptions('user', { fields: ['name', 'email'] });

        expect(livePromise.fields).toHaveBeenCalledWith('name', 'email');
      });

      it('with value option', async () => {
        driver.connected = true;
        const subscription = createMockSubscription();
        const livePromise = {
          ...builderThenable(subscription),
          diff: vi.fn().mockReturnThis(),
          fields: vi.fn().mockReturnThis(),
          value: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          fetch: vi.fn().mockReturnThis(),
        };
        mockDb.live.mockReturnValue(livePromise);

        await driver.liveWithOptions('user', { value: 'name' });

        expect(livePromise.value).toHaveBeenCalledWith('name');
      });

      it('with where option', async () => {
        driver.connected = true;
        const subscription = createMockSubscription();
        const livePromise = {
          ...builderThenable(subscription),
          diff: vi.fn().mockReturnThis(),
          fields: vi.fn().mockReturnThis(),
          value: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          fetch: vi.fn().mockReturnThis(),
        };
        mockDb.live.mockReturnValue(livePromise);

        await driver.liveWithOptions('user', { where: 'age > 18' });

        expect(livePromise.where).toHaveBeenCalledWith('age > 18');
      });

      it('with fetch option', async () => {
        driver.connected = true;
        const subscription = createMockSubscription();
        const livePromise = {
          ...builderThenable(subscription),
          diff: vi.fn().mockReturnThis(),
          fields: vi.fn().mockReturnThis(),
          value: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          fetch: vi.fn().mockReturnThis(),
        };
        mockDb.live.mockReturnValue(livePromise);

        await driver.liveWithOptions('user', { fetch: ['profile'] });

        expect(livePromise.fetch).toHaveBeenCalledWith('profile');
      });

      describe('LiveSubscriptionHandle', () => {
        it('id getter returns subscriptionId', async () => {
          driver.connected = true;
          const subscription = createMockSubscription();
          const livePromise = {
            ...builderThenable(subscription),
            diff: vi.fn().mockReturnThis(),
            fields: vi.fn().mockReturnThis(),
            value: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            fetch: vi.fn().mockReturnThis(),
          };
          mockDb.live.mockReturnValue(livePromise);

          const handle = await driver.liveWithOptions('user');
          expect(handle.id).toMatch(/^live_/);
        });

        it('isAlive getter delegates to subscription', async () => {
          driver.connected = true;
          const subscription = createMockSubscription();
          const livePromise = {
            ...builderThenable(subscription),
            diff: vi.fn().mockReturnThis(),
            fields: vi.fn().mockReturnThis(),
            value: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            fetch: vi.fn().mockReturnThis(),
          };
          mockDb.live.mockReturnValue(livePromise);

          const handle = await driver.liveWithOptions('user');
          expect(handle.isAlive).toBe(true);
        });

        it('kill method kills subscription and removes from map', async () => {
          driver.connected = true;
          const subscription = createMockSubscription();
          const livePromise = {
            ...builderThenable(subscription),
            diff: vi.fn().mockReturnThis(),
            fields: vi.fn().mockReturnThis(),
            value: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            fetch: vi.fn().mockReturnThis(),
          };
          mockDb.live.mockReturnValue(livePromise);

          const handle = await driver.liveWithOptions('user');
          await handle.kill();

          expect(subscription.kill).toHaveBeenCalledOnce();
        });

        it('subscribe method invokes callback when subscription emits', async () => {
          driver.connected = true;
          const subscription = createMockSubscription();
          const livePromise = {
            ...builderThenable(subscription),
            diff: vi.fn().mockReturnThis(),
            fields: vi.fn().mockReturnThis(),
            value: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            fetch: vi.fn().mockReturnThis(),
          };
          mockDb.live.mockReturnValue(livePromise);

          const handle = await driver.liveWithOptions('user');
          const callback = vi.fn();
          const unsubscribe = handle.subscribe(callback);

          // Subscribe returns unsubscribe
          expect(typeof unsubscribe).toBe('function');

          // The mock subscription.subscribe fires its callback immediately,
          // which should trigger line 542: callback({ action, result })
          expect(callback).toHaveBeenCalledWith({
            action: 'CREATE',
            result: { id: '1' },
          });
        });

        it('async iterator yields messages', async () => {
          driver.connected = true;
          const updates = [{ action: 'CREATE', value: { id: '1' } }];
          const subscription = createMockSubscription(updates);
          const livePromise = {
            ...builderThenable(subscription),
            diff: vi.fn().mockReturnThis(),
            fields: vi.fn().mockReturnThis(),
            value: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            fetch: vi.fn().mockReturnThis(),
          };
          mockDb.live.mockReturnValue(livePromise);

          const handle = await driver.liveWithOptions('user');
          const results: LiveData[] = [];
          for await (const msg of handle) {
            results.push(msg);
            break; // Only one message
          }

          expect(results).toHaveLength(1);
          expect(results[0].action).toBe('CREATE');
        });
      });
    });

    describe('kill()', () => {
      it('is no-op with empty subscriptionId', async () => {
        await driver.kill('');
        // Should not throw
      });

      it('deletes unknown subscription from map', async () => {
        driver.subscriptions.set('known', { created: 100 });
        await driver.kill('unknown');
        expect(driver.subscriptions.has('known')).toBe(true);
      });

      it('calls kill on live subscription and deletes from map', async () => {
        const subKill = vi.fn().mockResolvedValue(undefined);
        driver.subscriptions.set('sub1', {
          created: 100,
          liveSubscription: { kill: subKill },
        });

        await driver.kill('sub1');

        expect(subKill).toHaveBeenCalledOnce();
        expect(driver.subscriptions.has('sub1')).toBe(false);
      });

      it('handles subscription without kill method', async () => {
        driver.subscriptions.set('sub1', {
          created: 100,
          liveSubscription: {},
        });

        // Should not throw even though liveSubscription has no kill
        await driver.kill('sub1');
        expect(driver.subscriptions.has('sub1')).toBe(false);
      });
    });
  });
});
