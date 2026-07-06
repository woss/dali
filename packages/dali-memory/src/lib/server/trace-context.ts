import { AsyncLocalStorage } from 'node:async_hooks';

// LogTape's contextLocalStorage — typed as Record<string, unknown>
export const contextLocalStorage = new AsyncLocalStorage<Record<string, unknown>>();

// Request-scoped trace storage
export const requestStorage = new AsyncLocalStorage<{ traceId: string; spanId?: string }>();

// Wrap a function with request-scoped trace context
export function withTrace<T>(traceId: string, fn: () => T): T {
  return requestStorage.run({ traceId }, fn);
}

// Get the current request's trace context (or undefined outside a request)
export function getTrace(): { traceId: string; spanId?: string } | undefined {
  return requestStorage.getStore();
}
