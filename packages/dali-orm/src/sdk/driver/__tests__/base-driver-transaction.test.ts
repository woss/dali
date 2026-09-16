/**
 * BaseDriver — transaction tests.
 *
 * Extracted from base-driver.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { RecordId, Table } from 'surrealdb';
import type { MockDb } from './driver-test-utils.js';
import {
  builderThenable,
  createMockDb,
  queryMock,
  state,
  TestDriver,
  thenableResolve,
} from './driver-test-utils.js';

describe('BaseDriver', () => {
  let mockDb: MockDb;
  let driver: TestDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    state.shouldDateTimeThrow = false;
    mockDb = createMockDb();
    driver = new TestDriver(
      mockDb as unknown as Record<string, import('vitest').Mock>,
    );
  });

  // ============================================================================
  // Transaction
  // ============================================================================

  describe('transaction()', () => {
    it('throws if not connected', async () => {
      driver.connected = false;
      await expect(driver.transaction(async () => 'ok')).rejects.toThrow(
        'Not connected to SurrealDB',
      );
    });

    it('commits on successful fn', async () => {
      driver.connected = true;
      const result = await driver.transaction(async (tx) => {
        const data = await tx.query('SELECT * FROM user');
        return data;
      });

      expect(mockDb.beginTransaction).toHaveBeenCalledOnce();
      expect(mockDb.mockTx.commit).toHaveBeenCalledOnce();
      expect(mockDb.mockTx.cancel).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('rolls back via cancel on fn error', async () => {
      driver.connected = true;
      mockDb.mockTx.query.mockReturnValue(queryMock([[]]));

      await expect(
        driver.transaction(async () => {
          throw new Error('tx error');
        }),
      ).rejects.toThrow('tx error');

      expect(mockDb.mockTx.cancel).toHaveBeenCalledOnce();
      expect(mockDb.mockTx.commit).not.toHaveBeenCalled();
    });

    it('calls wrapper commit from inside transaction fn', async () => {
      driver.connected = true;

      await driver.transaction(async (tx) => {
        await tx.commit();
        return 'done';
      });

      // Called once: wrapper's commit() skips auto-commit
      expect(mockDb.mockTx.commit).toHaveBeenCalledOnce();
    });

    it('calls wrapper rollback from inside transaction fn', async () => {
      driver.connected = true;

      await driver.transaction(async (tx) => {
        await tx.rollback();
        return 'rolled back';
      });

      expect(mockDb.mockTx.cancel).toHaveBeenCalledOnce();
      // Explicit rollback suppresses auto-commit
      expect(mockDb.mockTx.commit).not.toHaveBeenCalled();
    });

    describe('transaction operations', () => {
      beforeEach(() => {
        driver.connected = true;
      });

      it('tx.select by table', async () => {
        mockDb.mockTx.select.mockReturnValue(thenableResolve([{ id: '1' }]));

        await driver.transaction(async (tx) => {
          const r = await tx.select('user');
          expect(r).toEqual([{ id: '1' }]);
        });
      });

      it('tx.select by record ID', async () => {
        mockDb.mockTx.select.mockReturnValue(thenableResolve({ id: '1' }));

        await driver.transaction(async (tx) => {
          const r = await tx.select('user:1');
          expect(r).toEqual([{ id: '1' }]);
        });
      });

      it('tx.create by table', async () => {
        const builder = builderThenable([{ id: '1' }]);
        mockDb.mockTx.create.mockReturnValue(builder);

        await driver.transaction(async (tx) => {
          const r = await tx.create('user', { name: 'Alice' });
          expect(r).toEqual([{ id: '1' }]);
        });

        expect(mockDb.mockTx.create).toHaveBeenCalledWith(expect.any(Table));
      });

      it('tx.create by record ID', async () => {
        const builder = builderThenable({ id: '1' });
        mockDb.mockTx.create.mockReturnValue(builder);

        await driver.transaction(async (tx) => {
          const r = await tx.create('user:1', { name: 'Alice' });
          expect(r).toEqual([{ id: '1' }]);
        });

        expect(mockDb.mockTx.create).toHaveBeenCalledWith(expect.any(RecordId));
      });

      it('tx.insert', async () => {
        mockDb.mockTx.insert.mockReturnValue(thenableResolve([{ id: '1' }]));

        await driver.transaction(async (tx) => {
          const r = await tx.insert('user', { name: 'Alice' });
          expect(r).toEqual([{ id: '1' }]);
        });
      });

      it('tx.update by table', async () => {
        const builder = builderThenable([{ id: '1' }]);
        mockDb.mockTx.update.mockReturnValue(builder);

        await driver.transaction(async (tx) => {
          const r = await tx.update('user', { name: 'Bob' });
          expect(r).toEqual([{ id: '1' }]);
        });
      });

      it('tx.update by record ID', async () => {
        const builder = builderThenable({ id: '1' });
        mockDb.mockTx.update.mockReturnValue(builder);

        await driver.transaction(async (tx) => {
          const r = await tx.update('user:1', { name: 'Bob' });
          expect(r).toEqual([{ id: '1' }]);
        });
      });

      it('tx.delete by table', async () => {
        mockDb.mockTx.delete.mockReturnValue(thenableResolve([{ id: '1' }]));

        await driver.transaction(async (tx) => {
          const r = await tx.delete('user');
          expect(r).toEqual([{ id: '1' }]);
        });
      });

      it('tx.delete by record ID', async () => {
        mockDb.mockTx.delete.mockReturnValue(thenableResolve({ id: '1' }));

        await driver.transaction(async (tx) => {
          const r = await tx.delete('user:1');
          expect(r).toEqual([{ id: '1' }]);
        });
      });

      it('tx.relate', async () => {
        mockDb.mockTx.relate.mockReturnValue(
          thenableResolve({ id: 'edge:abc' }),
        );

        await driver.transaction(async (tx) => {
          const r = await tx.relate('user:1', 'follows', 'user:2');
          expect(r).toEqual([{ id: 'edge:abc' }]);
        });
      });

      it('tx.relate throws without from record ID', async () => {
        await expect(
          driver.transaction(async (tx) => {
            await tx.relate('user', 'follows', 'user:2');
          }),
        ).rejects.toThrow('From record ID is required for relate');
      });

      it('tx.relate throws without to record ID', async () => {
        await expect(
          driver.transaction(async (tx) => {
            await tx.relate('user:1', 'follows', 'user');
          }),
        ).rejects.toThrow('To record ID is required for relate');
      });

      it('tx.relate with data (covers line 404 truthy branch)', async () => {
        mockDb.mockTx.relate.mockReturnValue(
          thenableResolve({ id: 'edge:abc' }),
        );
        await driver.transaction(async (tx) => {
          const r = await tx.relate('user:1', 'follows', 'user:2', {
            since: '2024',
          });
          expect(r).toEqual([{ id: 'edge:abc' }]);
        });
      });
    });
  });
});
