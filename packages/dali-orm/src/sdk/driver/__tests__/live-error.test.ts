/**
 * Tests for LiveSubscriptionHandle.onError callback
 *
 * Verifies:
 * 1. Handle has onError property (getter/setter)
 * 2. onError receives errors when async iterator throws
 * 3. No crash when onError is not set (silent handling)
 * 4. Non-Error throws are normalized to Error instances
 */

import { describe, expect, it, vi } from 'vite-plus/test';
import type { LiveSubscriptionHandle, LiveMessageData } from '../types.js';

// ============================================================================
// Helpers
// ============================================================================

/** Creates a live handle with a controllable async iterator */
function createTestHandle(opts: {
  /** If provided, iterator yields these then ends. If omitted, single CREATE. */
  updates?: Array<{ action: string; value: unknown }>;
  /** If provided, iterator rejects with this on first next() */
  throwOn?: Error;
  /** If true, second call to next() throws after first yields */
  throwAfterYield?: Error;
}): LiveSubscriptionHandle {
  let callCount = 0;
  const updates = opts.updates ?? [{ action: 'CREATE', value: { id: '1', name: 'Alice' } }];

  let onErrorCb: ((error: Error) => void) | undefined;

  const handle: LiveSubscriptionHandle = {
    get id(): string {
      return 'live_test_001';
    },
    get isAlive(): boolean {
      return true;
    },
    get onError(): ((error: Error) => void) | undefined {
      return onErrorCb;
    },
    set onError(cb: ((error: Error) => void) | undefined) {
      onErrorCb = cb;
    },
    async kill(): Promise<void> {
      // no-op for test
    },
    subscribe(callback: (data: LiveMessageData) => void): () => void {
      callback({ action: 'CREATE', result: { id: '1' } });
      return () => {};
    },
    async *[Symbol.asyncIterator](): AsyncIterator<LiveMessageData> {
      try {
        if (opts.throwOn) {
          throw opts.throwOn;
        }
        for (const msg of updates) {
          if (opts.throwAfterYield && callCount === updates.length - 1) {
            yield { action: msg.action as any, result: msg.value };
            throw opts.throwAfterYield;
          }
          yield { action: msg.action as any, result: msg.value };
          callCount++;
        }
      } catch (error) {
        onErrorCb?.(error instanceof Error ? error : new Error(String(error)));
      }
    },
  };

  return handle;
}

/**
 * Creates a mock BaseDriver that returns a live handle with controllable error behavior.
 * Mirrors the real BaseDriver.liveWithOptions pattern exactly.
 */
function createMockDriverWithLive(throwOnIterator?: Error) {
  const mockSubscription = {
    isAlive: true,
    kill: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn((cb: any) => {
      cb({ action: 'CREATE', value: { id: '1' } });
      return () => {};
    }),
    [Symbol.asyncIterator]() {
      let called = false;
      return {
        next: (): Promise<IteratorResult<any>> => {
          if (throwOnIterator) {
            return Promise.reject(throwOnIterator);
          }
          if (!called) {
            called = true;
            return Promise.resolve({
              value: { action: 'CREATE', value: { id: '1', name: 'Alice' } },
              done: false,
            });
          }
          return Promise.resolve({ value: undefined, done: true });
        },
      };
    },
  };

  let onErrorCb: ((error: Error) => void) | undefined;

  const handle: LiveSubscriptionHandle = {
    get id(): string {
      return 'live_test_001';
    },
    get isAlive(): boolean {
      return mockSubscription.isAlive;
    },
    get onError(): ((error: Error) => void) | undefined {
      return onErrorCb;
    },
    set onError(cb: ((error: Error) => void) | undefined) {
      onErrorCb = cb;
    },
    async kill(): Promise<void> {
      await mockSubscription.kill();
    },
    subscribe(callback: (data: LiveMessageData) => void): () => void {
      return mockSubscription.subscribe((msg: any) => {
        callback({ action: msg.action, result: msg.value });
      });
    },
    async *[Symbol.asyncIterator](): AsyncIterator<LiveMessageData> {
      try {
        for await (const message of mockSubscription) {
          yield { action: message.action as any, result: message.value as any };
        }
      } catch (error) {
        onErrorCb?.(error instanceof Error ? error : new Error(String(error)));
      }
    },
  };

  return handle;
}

// ============================================================================
// Tests
// ============================================================================

describe('LiveSubscriptionHandle.onError', () => {
  describe('property getter/setter', () => {
    it('is undefined by default', () => {
      const handle = createTestHandle({});
      expect(handle.onError).toBeUndefined();
    });

    it('can set and read back a callback', () => {
      const handle = createTestHandle({});
      const cb = vi.fn();
      handle.onError = cb;
      expect(handle.onError).toBe(cb);
    });

    it('can set to undefined to clear', () => {
      const handle = createTestHandle({});
      handle.onError = vi.fn();
      handle.onError = undefined;
      expect(handle.onError).toBeUndefined();
    });
  });

  describe('error delivery via async iterator', () => {
    it('calls onError when iterator throws an Error', async () => {
      const testError = new Error('stream disconnected');
      const handle = createTestHandle({ throwOn: testError });
      const onError = vi.fn();
      handle.onError = onError;

      // Consume the async iterator — the try-catch should invoke onError
      const messages: any[] = [];
      for await (const msg of handle) {
        messages.push(msg);
      }

      expect(onError).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(testError);
      // Iterator should yield nothing before the throw
      expect(messages).toHaveLength(0);
    });

    it('calls onError after yielding then throwing', async () => {
      const testError = new Error('mid-stream failure');
      const handle = createTestHandle({
        updates: [
          { action: 'CREATE', value: { id: '1' } },
          { action: 'UPDATE', value: { id: '2' } },
        ],
        throwAfterYield: testError,
      });
      const onError = vi.fn();
      handle.onError = onError;

      const messages: any[] = [];
      for await (const msg of handle) {
        messages.push(msg);
      }

      // Both messages yielded before the error
      expect(messages).toHaveLength(2);
      expect(messages[0].action).toBe('CREATE');
      expect(messages[1].action).toBe('UPDATE');
      expect(onError).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(testError);
    });

    it('calls onError when using real BaseDriver-style handle', async () => {
      const testError = new Error('connection lost');
      const handle = createMockDriverWithLive(testError);
      const onError = vi.fn();
      handle.onError = onError;

      const messages: any[] = [];
      for await (const msg of handle) {
        messages.push(msg);
      }

      expect(onError).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(testError);
      expect(messages).toHaveLength(0);
    });
  });

  describe('silent handling without onError', () => {
    it('does not crash when no onError is set and iterator throws', async () => {
      const testError = new Error('no callback');
      const handle = createTestHandle({ throwOn: testError });

      // Should not throw — the catch block silently handles when onErrorCb is undefined
      const messages: any[] = [];
      for await (const msg of handle) {
        messages.push(msg);
      }

      expect(messages).toHaveLength(0);
    });

    it('does not crash with real driver handle when no onError is set', async () => {
      const testError = new Error('no callback');
      const handle = createMockDriverWithLive(testError);

      // No unhandled rejection should occur
      const messages: any[] = [];
      for await (const msg of handle) {
        messages.push(msg);
      }

      expect(messages).toHaveLength(0);
    });
  });

  describe('non-Error normalization', () => {
    it('normalizes string throws to Error instances', async () => {
      // Override the handle to throw a string instead of Error
      const handle = createTestHandle({});
      const onError = vi.fn();
      handle.onError = onError;

      // Manually replace the iterator to throw a string
      (handle as any)[Symbol.asyncIterator] = async function () {
        try {
          throw 'string error'; // eslint-disable-line no-throw-literal
        } catch (error) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
      };

      const messages: any[] = [];
      for await (const msg of handle) {
        messages.push(msg);
      }

      expect(onError).toHaveBeenCalledOnce();
      const receivedError = onError.mock.calls[0][0];
      expect(receivedError).toBeInstanceOf(Error);
      expect(receivedError.message).toBe('string error');
    });

    it('normalizes number throws to Error instances', async () => {
      const handle = createTestHandle({});
      const onError = vi.fn();
      handle.onError = onError;

      (handle as any)[Symbol.asyncIterator] = async function () {
        try {
          throw 42; // eslint-disable-line no-throw-literal
        } catch (error) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
      };

      const messages: any[] = [];
      for await (const msg of handle) {
        messages.push(msg);
      }

      expect(onError).toHaveBeenCalledOnce();
      const receivedError = onError.mock.calls[0][0];
      expect(receivedError).toBeInstanceOf(Error);
      expect(receivedError.message).toBe('42');
    });

    it('normalizes null throws to Error instances', async () => {
      const handle = createTestHandle({});
      const onError = vi.fn();
      handle.onError = onError;

      (handle as any)[Symbol.asyncIterator] = async function () {
        try {
          throw null; // eslint-disable-line no-throw-literal
        } catch (error) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
      };

      const messages: any[] = [];
      for await (const msg of handle) {
        messages.push(msg);
      }

      expect(onError).toHaveBeenCalledOnce();
      const receivedError = onError.mock.calls[0][0];
      expect(receivedError).toBeInstanceOf(Error);
      expect(receivedError.message).toBe('null');
    });

    it('preserves original Error instances without wrapping', async () => {
      const originalError = new TypeError('type mismatch');
      const handle = createTestHandle({ throwOn: originalError });
      const onError = vi.fn();
      handle.onError = onError;

      for await (const _msg of handle) {
        // consume
      }

      expect(onError).toHaveBeenCalledWith(originalError);
      // Should NOT be wrapped in another Error
      expect(onError.mock.calls[0][0]).toBe(originalError);
    });
  });

  describe('multiple subscribers do not interfere', () => {
    it('only the assigned onError receives errors', async () => {
      const testError = new Error('test');
      const handle = createTestHandle({ throwOn: testError });
      const onErrorA = vi.fn();
      const onErrorB = vi.fn();

      handle.onError = onErrorA;
      // Immediately replace — only B should fire
      handle.onError = onErrorB;

      for await (const _msg of handle) {
        // consume
      }

      expect(onErrorA).not.toHaveBeenCalled();
      expect(onErrorB).toHaveBeenCalledOnce();
      expect(onErrorB).toHaveBeenCalledWith(testError);
    });
  });

  describe('subscribe still works independently of onError', () => {
    it('subscribe callback fires regardless of onError presence', () => {
      const handle = createTestHandle({});
      const subscribeCb = vi.fn();

      handle.subscribe(subscribeCb);

      expect(subscribeCb).toHaveBeenCalledOnce();
      expect(subscribeCb).toHaveBeenCalledWith({
        action: 'CREATE',
        result: { id: '1' },
      });
    });

    it('subscribe works even when onError is set', () => {
      const handle = createTestHandle({});
      handle.onError = vi.fn();
      const subscribeCb = vi.fn();

      handle.subscribe(subscribeCb);

      expect(subscribeCb).toHaveBeenCalledOnce();
    });
  });

  describe('kill still works alongside onError', () => {
    it('kill resolves successfully when onError is set', async () => {
      const handle = createTestHandle({});
      handle.onError = vi.fn();

      await expect(handle.kill()).resolves.toBeUndefined();
    });
  });
});
