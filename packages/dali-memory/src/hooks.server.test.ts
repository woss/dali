import { describe, test, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Hoisted mocks — referenced inside vi.mock() factories
// =============================================================================

const { mockInitLogger, mockGetLog, mockGetConfig } = vi.hoisted(() => {
  const mockDebug = vi.fn();
  return {
    mockInitLogger: vi.fn(),
    mockGetLog: vi.fn(() => ({ debug: mockDebug })),
    mockGetConfig: vi.fn(),
  };
});

// =============================================================================
// Module mocks — hoisted before imports
// =============================================================================

vi.mock('$lib/server/logger', () => ({
  initLogger: mockInitLogger,
  getLog: mockGetLog,
}));

vi.mock('$lib/server/config', () => ({
  getConfig: mockGetConfig,
}));

// =============================================================================
// Module under test — imported AFTER mocks
// =============================================================================

import { handle } from './hooks.server';

// =============================================================================
// Helpers — replicate signSession to create valid test cookies
// =============================================================================

async function signSession(sessionId: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(sessionId));
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex}.${sessionId}`;
}

function createMockEvent(urlPath: string, cookieValue?: string, method = 'GET') {
  const locals: Record<string, unknown> = {};
  return {
    url: new URL(urlPath, 'http://localhost:7777'),
    request: { method },
    cookies: {
      get: vi.fn((name: string) => (name === 'dali_session' ? cookieValue : undefined)),
    },
    locals,
  };
}

const TEST_SECRET = 'XETrs1y4LgkB9T4B5Mlpv7v18FQ40Zh32LpdesRqy5iWRD90HpSg+392MvRyp0jn';

function enableAuth() {
  mockGetConfig.mockReturnValue({
    DALI_MEMORY_AUTH_ENABLED: true,
    DALI_MEMORY_SECRET: TEST_SECRET,
  });
}

function disableAuth() {
  mockGetConfig.mockReturnValue({
    DALI_MEMORY_AUTH_ENABLED: false,
    DALI_MEMORY_SECRET: TEST_SECRET,
  });
}

// =============================================================================
// Tests
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handle() — verifyCookie flow', () => {
  test('auth disabled: resolves without verification', async () => {
    disableAuth();
    const event = createMockEvent('/memories');
    const resolve = vi.fn(async (e: unknown) => new Response('ok'));

    const result = await handle({ event, resolve } as any);

    expect(result).toBeInstanceOf(Response);
    expect(event.locals.authenticated).toBeUndefined();
    expect(event.locals.userEmail).toBeUndefined();
    expect(cookiesGet(event)).not.toHaveBeenCalled();
  });

  test('public path: skips auth verification', async () => {
    enableAuth();
    const event = createMockEvent('/login');
    const resolve = vi.fn(async (e: unknown) => new Response('ok'));

    const result = await handle({ event, resolve } as any);

    expect(result).toBeInstanceOf(Response);
    expect(event.locals.authenticated).toBeUndefined();
    expect(cookiesGet(event)).not.toHaveBeenCalled();
  });

  test('public /api/mcp path: skips auth verification', async () => {
    enableAuth();
    const event = createMockEvent('/api/mcp');
    const resolve = vi.fn(async (e: unknown) => new Response('ok'));

    const result = await handle({ event, resolve } as any);

    expect(result).toBeInstanceOf(Response);
    expect(event.locals.authenticated).toBeUndefined();
  });

  test('public /logout path: skips auth verification', async () => {
    enableAuth();
    const event = createMockEvent('/logout');
    const resolve = vi.fn(async (e: unknown) => new Response('ok'));

    const result = await handle({ event, resolve } as any);

    expect(result).toBeInstanceOf(Response);
    expect(event.locals.authenticated).toBeUndefined();
  });

  test('protected path with no cookie: redirects to /login', async () => {
    enableAuth();
    const event = createMockEvent('/memories');
    const resolve = vi.fn(async (e: unknown) => new Response('ok'));

    const result = (await handle({ event, resolve } as any)) as Response;

    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toBe('http://localhost:7777/login');
    expect(event.locals.authenticated).toBeUndefined();
    expect(event.locals.userEmail).toBeUndefined();
  });

  test('protected path with empty cookie string: redirects to /login', async () => {
    enableAuth();
    const event = createMockEvent('/memories', '');
    const resolve = vi.fn(async (e: unknown) => new Response('ok'));

    const result = (await handle({ event, resolve } as any)) as Response;

    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toBe('http://localhost:7777/login');
  });

  test('protected path with malformed cookie (no dot): redirects to /login', async () => {
    enableAuth();
    const event = createMockEvent('/memories', 'invalid-no-dot');
    const resolve = vi.fn(async (e: unknown) => new Response('ok'));

    const result = (await handle({ event, resolve } as any)) as Response;

    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toBe('http://localhost:7777/login');
  });

  test('protected path with valid cookie: sets locals and resolves', async () => {
    enableAuth();
    const email = 'user@example.com';
    const signed = await signSession(email, TEST_SECRET);
    const event = createMockEvent('/memories', signed);
    const resolve = vi.fn(async (e: unknown) => new Response('ok'));

    const result = await handle({ event, resolve } as any);

    expect(result).toBeInstanceOf(Response);
    expect(event.locals.authenticated).toBe(true);
    expect(event.locals.userEmail).toBe(email);
  });

  test('protected path with tampered signature: redirects to /login', async () => {
    enableAuth();
    const email = 'user@example.com';
    const signed = await signSession(email, TEST_SECRET);
    // Corrupt the hex signature
    const tampered =
      '0000000000000000000000000000000000000000000000000000000000000000' + '.' + email;
    const event = createMockEvent('/memories', tampered);
    const resolve = vi.fn(async (e: unknown) => new Response('ok'));

    const result = (await handle({ event, resolve } as any)) as Response;

    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toBe('http://localhost:7777/login');
    expect(event.locals.authenticated).toBeUndefined();
  });

  test('protected path with cookie signed by wrong secret: redirects to /login', async () => {
    enableAuth();
    const email = 'user@example.com';
    const wrongSecret = 'this-is-the-wrong-secret';
    const signed = await signSession(email, wrongSecret);
    const event = createMockEvent('/memories', signed);
    const resolve = vi.fn(async (e: unknown) => new Response('ok'));

    const result = (await handle({ event, resolve } as any)) as Response;

    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toBe('http://localhost:7777/login');
  });

  test('protected path with email containing dots: preserves full email', async () => {
    enableAuth();
    const email = 'firstname.lastname+tag@example.co.uk';
    const signed = await signSession(email, TEST_SECRET);
    const event = createMockEvent('/memories', signed);
    const resolve = vi.fn(async (e: unknown) => new Response('ok'));

    const result = await handle({ event, resolve } as any);

    expect(result).toBeInstanceOf(Response);
    expect(event.locals.userEmail).toBe(email);
  });

  test('protected path with short hex signature: redirects to /login (length check)', async () => {
    enableAuth();
    const event = createMockEvent('/memories', 'short.user@example.com');
    const resolve = vi.fn(async (e: unknown) => new Response('ok'));

    const result = (await handle({ event, resolve } as any)) as Response;

    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toBe('http://localhost:7777/login');
  });

  test('protected /settings path requires auth', async () => {
    enableAuth();
    const event = createMockEvent('/settings');
    const resolve = vi.fn(async (e: unknown) => new Response('ok'));

    const result = (await handle({ event, resolve } as any)) as Response;

    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toBe('http://localhost:7777/login');
  });

  test('protected /workspaces path requires auth', async () => {
    enableAuth();
    const event = createMockEvent('/workspaces');
    const resolve = vi.fn(async (e: unknown) => new Response('ok'));

    const result = (await handle({ event, resolve } as any)) as Response;

    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toBe('http://localhost:7777/login');
  });

  test('unprotected root path passes through without auth', async () => {
    enableAuth();
    const event = createMockEvent('/');
    const resolve = vi.fn(async (e: unknown) => new Response('ok'));

    const result = await handle({ event, resolve } as any);

    expect(result).toBeInstanceOf(Response);
    expect(event.locals.authenticated).toBeUndefined();
  });

  test('verifyCookie constant-time comparison: wrong-length sig caught', async () => {
    enableAuth();
    const email = 'user@example.com';
    const signed = await signSession(email, TEST_SECRET);
    // Truncate the hex part to trigger the length mismatch check
    const [hex] = signed.split('.');
    const shortSig = hex.slice(0, 16) + '.' + email;
    const event = createMockEvent('/memories', shortSig);
    const resolve = vi.fn(async (e: unknown) => new Response('ok'));

    const result = (await handle({ event, resolve } as any)) as Response;

    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toBe('http://localhost:7777/login');
  });
});

// Helper to access cookies.get mock
function cookiesGet(event: any) {
  return event.cookies.get;
}
