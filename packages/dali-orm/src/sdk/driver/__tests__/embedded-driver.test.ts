/**
 * Comprehensive test suite for EmbeddedDriver
 *
 * Tests constructor, connection, auth methods, datetime transformation,
 * live query helpers, and live query lifecycle.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbeddedDriver } from '../embedded-driver.js';
import { transformDatetimeValues } from '../driver-utils.js';

// ============================================================================
// Mock @surrealdb/node
// ============================================================================
vi.mock('@surrealdb/node', () => ({
  createNodeEngines: vi.fn(() => ({ mockNodeEngine: true })),
}));

// ============================================================================
// Mock surrealdb
// ============================================================================
const mockConnect = vi.fn();
const mockUse = vi.fn();
const mockQuery = vi.fn();
let mockReadyValue: Promise<void> = Promise.resolve();

vi.mock('surrealdb', () => {
  class Surreal {
    connect = mockConnect;
    use = mockUse;
    query = mockQuery;
    get ready() {
      return mockReadyValue;
    }
  }
  return {
    Surreal,
    expr: (input: unknown) => {
      if (typeof input === 'symbol') throw new Error('expr compilation failed');
      const obj = input as Record<string, unknown>;
      const entries = Object.entries(obj);
      if (entries.length === 0) return { query: '', bindings: {} };
      const clauses = entries.map(([key]) => `${key} = $${key}`);
      return { query: clauses.join(' AND '), bindings: obj };
    },
  };
});

// ============================================================================
// Mock obug
// ============================================================================
vi.mock('obug', () => ({
  createDebug: vi.fn(() => {
    const fn = vi.fn() as any;
    fn.extend = vi.fn(() => vi.fn());
    return fn;
  }),
}));

// ============================================================================
// Helpers
// ============================================================================
function thenableResolve<T>(value: T) {
  const p = Promise.resolve(value);
  return {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('EmbeddedDriver', () => {
  let driver: EmbeddedDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReadyValue = Promise.resolve();
    driver = new EmbeddedDriver();
  });

  describe('constructor', () => {
    it('creates with default config (memory mode)', () => {
      const d = new EmbeddedDriver();
      expect(d.config).toMatchObject({
        driver: 'embedded',
        namespace: 'default',
        database: 'default',
        mode: 'memory',
        path: './surrealdb',
        debug: false,
      });
    });

    it('accepts custom namespace and database', () => {
      const d = new EmbeddedDriver({ namespace: 'myns', database: 'mydb' } as any);
      expect(d.config.namespace).toBe('myns');
      expect(d.config.database).toBe('mydb');
    });

    it('accepts surrealkv mode', () => {
      const d = new EmbeddedDriver({ mode: 'surrealkv' } as any);
      expect(d.config.mode).toBe('surrealkv');
    });

    it('accepts rocksdb mode', () => {
      const d = new EmbeddedDriver({ mode: 'rocksdb' } as any);
      expect(d.config.mode).toBe('rocksdb');
    });

    it('accepts custom path', () => {
      const d = new EmbeddedDriver({ mode: 'surrealkv', path: '/custom/path' } as any);
      expect(d.config.path).toBe('/custom/path');
    });

    it('accepts debug flag', () => {
      const d = new EmbeddedDriver({ debug: true } as any);
      expect(d.config.debug).toBe(true);
    });

    it('handles empty config object', () => {
      const d = new EmbeddedDriver({} as any);
      expect(d.config).toBeDefined();
      expect(d.config.mode).toBe('memory');
    });
  });

  describe('config getter', () => {
    it('returns config object', () => {
      expect(driver.config).toBeDefined();
      expect(driver.config.driver).toBe('embedded');
    });
  });

  describe('getUrl', () => {
    it('returns empty string', () => {
      expect(driver.getUrl()).toBe('');
    });
  });

  describe('connect', () => {
    beforeEach(() => {
      mockConnect.mockReturnValue(thenableResolve(undefined));
      mockUse.mockReturnValue(thenableResolve(undefined));
    });

    it('returns early if already connected', async () => {
      (driver as any).connected = true;
      await driver.connect();
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it('connects with memory connection string', async () => {
      await driver.connect();
      expect(mockConnect).toHaveBeenCalledWith('mem://');
      expect(mockUse).toHaveBeenCalledWith({ namespace: 'default', database: 'default' });
    });

    it('connects with surrealkv connection string', async () => {
      const d = new EmbeddedDriver({ mode: 'surrealkv', path: '/data/db' } as any);
      await d.connect();
      expect(mockConnect).toHaveBeenCalledWith('surrealkv:///data/db');
    });

    it('connects with rocksdb mode also uses surrealkv://', async () => {
      const d = new EmbeddedDriver({ mode: 'rocksdb', path: '/rocks/path' } as any);
      await d.connect();
      expect(mockConnect).toHaveBeenCalledWith('surrealkv:///rocks/path');
    });

    it('sets connected to true on success', async () => {
      await driver.connect();
      expect(driver.isConnected()).toBe(true);
    });

    it('wraps connection errors with descriptive message', async () => {
      mockConnect.mockReturnValue(Promise.reject(new Error('connection refused')));
      await expect(driver.connect()).rejects.toThrow('Failed to connect to embedded SurrealDB');
      expect(driver.isConnected()).toBe(false);
    });

    it('handles non-Error rejection', async () => {
      mockConnect.mockReturnValue(Promise.reject('just a string'));
      await expect(driver.connect()).rejects.toThrow('Failed to connect to embedded SurrealDB');
    });
  });

  describe('authentication methods', () => {
    it('signin throws not supported', async () => {
      await expect(driver.signin({})).rejects.toThrow('not supported in embedded mode');
    });

    it('signup throws not supported', async () => {
      await expect(driver.signup({})).rejects.toThrow('not supported in embedded mode');
    });

    it('authenticate throws not supported', async () => {
      await expect(driver.authenticate('token')).rejects.toThrow('not supported in embedded mode');
    });

    it('authenticate with object also throws', async () => {
      await expect(driver.authenticate({ access: 'tok' })).rejects.toThrow(
        'not supported in embedded mode',
      );
    });
  });

  describe('transformDatetimeValues', () => {
    it('returns null as null', () => {
      expect(transformDatetimeValues(null)).toBeNull();
    });

    it('returns undefined as undefined', () => {
      expect(transformDatetimeValues(undefined)).toBeUndefined();
    });

    it('returns primitives unchanged', () => {
      expect(transformDatetimeValues('hello')).toBe('hello');
      expect(transformDatetimeValues(42)).toBe(42);
      expect(transformDatetimeValues(true)).toBe(true);
    });

    it('transforms plain object properties recursively', () => {
      const input = { a: '2024-01-01T00:00:00Z', b: { c: 'nested' } };
      const result = transformDatetimeValues(input);
      expect(result).toEqual(input);
      expect(result).not.toBe(input); // different reference
    });

    it('transforms array items', () => {
      const input = [{ name: 'item1' }, { name: 'item2' }];
      const result = transformDatetimeValues(input);
      expect(result).toEqual(input);
      expect(result).not.toBe(input);
    });

    it('preserves non-plain objects (class instances)', () => {
      class CustomClass {
        x = 1;
      }
      const instance = new CustomClass();
      const result = transformDatetimeValues(instance);
      expect(result).toBe(instance); // same reference
    });

    it('handles null prototype objects', () => {
      const input = Object.create(null);
      input.a = 1;
      const result = transformDatetimeValues(input);
      expect(result).toEqual({ a: 1 });
    });

    it('handles empty objects', () => {
      expect(transformDatetimeValues({})).toEqual({});
    });

    it('handles empty arrays', () => {
      expect(transformDatetimeValues([])).toEqual([]);
    });

    it('handles deeply nested structures', () => {
      const input = { a: [{ b: { c: [1, { d: 2 }] } }] };
      const result = transformDatetimeValues(input);
      expect(result).toEqual(input);
    });
  });

  describe('kill', () => {
    it('returns early for empty subscription ID', async () => {
      (driver as any).connected = true;
      await driver.kill('');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('executes KILL query for valid subscription', async () => {
      mockQuery.mockReturnValue(thenableResolve([]));
      (driver as any).connected = true;
      await driver.kill('live_12345');
      expect(mockQuery).toHaveBeenCalledWith('KILL live_12345');
    });

    it('catches KILL query errors silently', async () => {
      mockQuery.mockReturnValue(Promise.reject(new Error('fail')));
      await driver.kill('live_12345');
      // should not throw
    });
  });

  // ------------------------------------------------------------------
  // Live Query - live() method
  // ------------------------------------------------------------------

  describe('live', () => {
    async function* createAsyncIterable<T>(items: T[]): AsyncIterable<T> {
      for (const item of items) {
        yield item;
      }
    }

    beforeEach(() => {
      (driver as any).connected = true;
    });

    it('throws if not connected', async () => {
      (driver as any).connected = false;
      await expect(driver.live('table', vi.fn())).rejects.toThrow('Not connected');
    });

    it('throws if table is empty string', async () => {
      await expect(driver.live('', vi.fn())).rejects.toThrow('Table name is required');
    });

    it('throws if table is whitespace only', async () => {
      await expect(driver.live('   ', vi.fn())).rejects.toThrow('Table name is required');
    });

    it('sanitizes invalid chars in table name', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        mockQuery.mockReturnValue(thenableResolve(createAsyncIterable([])));
        await driver.live('bad table!', vi.fn());
        expect(warnSpy).toHaveBeenCalledWith('Table name contains invalid characters, sanitized');
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('success: returns subscription ID', async () => {
      mockQuery.mockReturnValue(thenableResolve(createAsyncIterable([])));
      const id = await driver.live('test', vi.fn());
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^live_/);
    });

    it('success: calls query with LIVE SELECT', async () => {
      mockQuery.mockReturnValue(thenableResolve(createAsyncIterable([])));
      await driver.live('test_table', vi.fn());
      expect(mockQuery).toHaveBeenCalledWith('LIVE SELECT * FROM test_table');
    });

    it('invokes callback with parsed action and result', async () => {
      const items = [
        { action: 'CREATE', result: { id: '1', name: 'foo' } },
        { action: 'UPDATE', result: { id: '1', name: 'bar' } },
      ];
      mockQuery.mockReturnValue(thenableResolve(createAsyncIterable(items)));
      const callback = vi.fn();
      await driver.live('test', callback);
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledTimes(2);
      });
      expect(callback).toHaveBeenNthCalledWith(1, {
        action: 'CREATE',
        result: { id: '1', name: 'foo' },
      });
      expect(callback).toHaveBeenNthCalledWith(2, {
        action: 'UPDATE',
        result: { id: '1', name: 'bar' },
      });
    });

    it('handles operation-based action (numeric operation code)', async () => {
      const items = [
        { operation: 1, data: { id: '1' } },
        { operation: 3, data: { id: '2' } },
      ];
      mockQuery.mockReturnValue(thenableResolve(createAsyncIterable(items)));
      const callback = vi.fn();
      await driver.live('test', callback);
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledTimes(2);
      });
      expect(callback).toHaveBeenNthCalledWith(1, {
        action: 'CREATE',
        result: { id: '1' },
      });
      expect(callback).toHaveBeenNthCalledWith(2, {
        action: 'DELETE',
        result: { id: '2' },
      });
    });

    it('handles query rejection', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        mockQuery.mockReturnValue(Promise.reject(new Error('query failed')));
        await expect(driver.live('test', vi.fn())).rejects.toThrow('query failed');
        expect(errorSpy).toHaveBeenCalledWith('Live query setup failed:', expect.any(Error));
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  // ------------------------------------------------------------------
  // Live Query - liveWithOptions() method
  // ------------------------------------------------------------------

  describe('liveWithOptions', () => {
    async function* createAsyncIterable<T>(items: T[]): AsyncIterable<T> {
      for (const item of items) {
        yield item;
      }
    }

    beforeEach(() => {
      (driver as any).connected = true;
    });

    it('throws if not connected', async () => {
      (driver as any).connected = false;
      await expect(driver.liveWithOptions('table')).rejects.toThrow('Not connected');
    });

    it('throws if table is empty', async () => {
      await expect(driver.liveWithOptions('')).rejects.toThrow('Table name is required');
    });

    it('success with no options', async () => {
      mockQuery.mockReturnValue(thenableResolve(createAsyncIterable([])));
      const handle = await driver.liveWithOptions('test');
      expect(handle.id).toMatch(/^live_/);
      expect(handle.isAlive).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith('LIVE SELECT * FROM test', {});
    });

    it('builds fields correctly', async () => {
      mockQuery.mockReturnValue(thenableResolve(createAsyncIterable([])));
      await driver.liveWithOptions('test', { fields: ['id', 'name', 'age'] });
      expect(mockQuery).toHaveBeenCalledWith('LIVE SELECT id, name, age FROM test', {});
    });

    it('WHERE clause via expr', async () => {
      mockQuery.mockReturnValue(thenableResolve(createAsyncIterable([])));
      const where = { name: { EQUALS: 'foo' } };
      await driver.liveWithOptions('test', { where });
      expect(mockQuery).toHaveBeenCalledWith('LIVE SELECT * FROM test WHERE name = $name', {
        name: { EQUALS: 'foo' },
      });
    });

    it('FETCH clause', async () => {
      mockQuery.mockReturnValue(thenableResolve(createAsyncIterable([])));
      await driver.liveWithOptions('test', { fetch: ['author', 'editor'] });
      expect(mockQuery).toHaveBeenCalledWith('LIVE SELECT * FROM test FETCH author, editor', {});
    });

    it('DIFF mode logs warning', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        mockQuery.mockReturnValue(thenableResolve(createAsyncIterable([])));
        await driver.liveWithOptions('test', { diff: true });
        expect(warnSpy).toHaveBeenCalledWith(
          'DIFF mode is not supported in embedded live queries, ignoring',
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('WHERE compilation failure logs warn, continues without WHERE', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        mockQuery.mockReturnValue(thenableResolve(createAsyncIterable([])));
        const badWhere = Symbol('bad');
        await driver.liveWithOptions('test', { where: badWhere });
        expect(warnSpy).toHaveBeenCalledWith(
          'Failed to compile WHERE expression for embedded live query, ignoring',
        );
        expect(mockQuery).toHaveBeenCalledWith('LIVE SELECT * FROM test', {});
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('subscribe callback receives data', async () => {
      const items = [{ action: 'CREATE', result: { id: '1' } }];
      mockQuery.mockReturnValue(thenableResolve(createAsyncIterable(items)));
      const handle = await driver.liveWithOptions('test');
      const callback = vi.fn();
      handle.subscribe(callback);
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledTimes(1);
      });
      expect(callback).toHaveBeenCalledWith({
        action: 'CREATE',
        result: { id: '1' },
      });
    });

    it('subscribe returns unsubscribe function', async () => {
      mockQuery.mockReturnValue(thenableResolve(createAsyncIterable([])));
      const handle = await driver.liveWithOptions('test');
      const callback = vi.fn();
      const unsubscribe = handle.subscribe(callback);
      expect(typeof unsubscribe).toBe('function');
      expect(() => unsubscribe()).not.toThrow();
    });

    it('async iterator yields data', async () => {
      const items = [{ action: 'CREATE', result: { id: '1' } }];
      mockQuery.mockReturnValue(thenableResolve(createAsyncIterable(items)));
      const handle = await driver.liveWithOptions('test');
      const iter = handle[Symbol.asyncIterator]();
      const result = await iter.next();
      expect(result.done).toBe(false);
      expect(result.value).toEqual({
        action: 'CREATE',
        result: { id: '1' },
      });
    });

    it('kill stops subscription', async () => {
      mockQuery.mockReturnValue(thenableResolve(createAsyncIterable([])));
      const handle = await driver.liveWithOptions('test');
      expect(handle.isAlive).toBe(true);
      await handle.kill();
      expect(handle.isAlive).toBe(false);
    });
  });
});
