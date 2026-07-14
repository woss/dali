/**
 * Shared test utilities for BaseDriver test suite.
 *
 * Extracted from base-driver.test.ts to enable per-concern test file splitting.
 * Contains: vi.mock, helper functions, TestDriver subclass, createMockDb.
 */

import { type Mock, vi } from 'vite-plus/test';
import { BaseDriver } from '../base-driver.js';
import type { DriverConfig, EmbeddedConfig } from '../types.js';

// ============================================================================
// Shared state for controlling mock DateTime behavior in tests
// ============================================================================

const { state } = vi.hoisted(() => {
  const state = { shouldDateTimeThrow: false };
  return { state };
});

export { state };

// ============================================================================
// Helper: thenable objects that mimic Surreal SDK query/promise types
// ============================================================================

/** Creates an object with .then() and .catch() that resolves to `value` */
export function thenableResolve<T>(value: T) {
  const p = Promise.resolve(value);
  return {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
  };
}

/** Creates an object with .then() and .catch() that rejects with `error` */
export function thenableReject(error: Error) {
  const p = Promise.reject(error);
  p.catch(() => {}); // Suppress unhandled rejection warning
  return {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
  };
}

/** Creates a thenable with builder methods (content, merge, where) that return `this` */
export function builderThenable<T>(resolveTo: T) {
  const base = thenableResolve(resolveTo);
  return {
    ...base,
    content: vi.fn(function (this: unknown) {
      return this;
    }),
    merge: vi.fn(function (this: unknown) {
      return this;
    }),
    where: vi.fn(function (this: unknown) {
      return this;
    }),
  };
}

/** Creates a mock DB query result with .collect() */
export function queryMock<T>(result: T) {
  return {
    collect: vi.fn().mockResolvedValue(result),
  };
}

/** Creates a mock live subscription with controllable async iterator */
export function createMockSubscription(yieldedUpdates?: Array<{ action: string; value: unknown }>) {
  const updates = yieldedUpdates ?? [
    { action: 'CREATE' as const, value: { id: '1', name: 'Alice' } },
  ];

  let index = 0;
  const asyncIterable = {
    [Symbol.asyncIterator]: () => ({
      next: () => {
        if (index < updates.length) {
          return Promise.resolve({ value: updates[index++], done: false });
        }
        return Promise.resolve({ value: undefined, done: true });
      },
    }),
  };

  return {
    [Symbol.asyncIterator]: asyncIterable[Symbol.asyncIterator],
    isAlive: true,
    kill: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn((cb: (msg: { action: string; value: unknown }) => void) => {
      cb({ action: 'CREATE', value: { id: '1' } });
      return () => {};
    }),
  };
}

/** Creates a mock live subscription whose async iterator throws (for testing error catch) */
export function createThrowingSubscription() {
  return {
    [Symbol.asyncIterator]: () => ({
      next: () => Promise.reject(new Error('stream error')),
    }),
    isAlive: true,
    kill: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn((cb: (msg: { action: string; value: unknown }) => void) => {
      cb({ action: 'CREATE', value: { id: '1' } });
      return () => {};
    }),
  };
}

// ============================================================================
// TestDriver — concrete subclass that replaces abstract members with mocks
// ============================================================================

export class TestDriver extends BaseDriver {
  // @ts-expect-error — mock db, not real Surreal instance
  public db: Record<string, Mock>;
  connected = false;
  subscriptions = new Map<string, { created: number; liveSubscription?: unknown }>();

  constructor(mockDb: Record<string, Mock>) {
    super();
    this.db = mockDb;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  getUrl(): string {
    return 'test://localhost';
  }

  async signin(): Promise<string> {
    return 'token';
  }

  async signup(): Promise<string> {
    return 'token';
  }

  async authenticate(): Promise<{ access: string }> {
    return { access: 'token' };
  }

  get config(): DriverConfig | EmbeddedConfig {
    return { driver: 'test' } as unknown as DriverConfig | EmbeddedConfig;
  }
}

// ============================================================================
// Test helpers
// ============================================================================

export function createMockDb() {
  const mockTx = {
    commit: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockReturnValue(queryMock([[]])),
    select: vi.fn().mockReturnValue(thenableResolve([])),
    create: vi.fn().mockReturnValue(builderThenable([])),
    insert: vi.fn().mockReturnValue(thenableResolve([])),
    update: vi.fn().mockReturnValue(builderThenable([])),
    delete: vi.fn().mockReturnValue(thenableResolve([])),
    relate: vi.fn().mockReturnValue(thenableResolve({})),
  };

  return {
    query: vi.fn().mockReturnValue(queryMock([[]])),
    select: vi.fn().mockReturnValue(thenableResolve([])),
    create: vi.fn().mockReturnValue(builderThenable([])),
    insert: vi.fn().mockReturnValue(thenableResolve([])),
    update: vi.fn().mockReturnValue(builderThenable([])),
    delete: vi.fn().mockReturnValue(thenableResolve([])),
    upsert: vi.fn().mockReturnValue(builderThenable({})),
    close: vi.fn().mockResolvedValue(true),
    use: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
    relate: vi.fn().mockReturnValue(thenableResolve({})),
    live: vi.fn(),
    beginTransaction: vi.fn().mockResolvedValue(mockTx),
    mockTx,
  };
}

export type MockDb = ReturnType<typeof createMockDb>;
