import { describe, test, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Hoisted mocks
// =============================================================================

const { mockGetConfig, mockConnect, mockGetDB, mockFail, mockRedirect, mockSignSession } = vi.hoisted(() => {
  const mockDriver = {
    query: vi.fn(),
  };
  return {
    mockGetConfig: vi.fn(),
    mockConnect: vi.fn().mockResolvedValue(undefined),
    mockGetDB: vi.fn(() => ({
      getDriver: () => mockDriver,
    })),
    mockFail: vi.fn((status: number, data: any) => ({ status, data })),
    mockRedirect: vi.fn((status: number, location: string) => {
      const err: any = new Error(`Redirect: ${status} -> ${location}`);
      err.status = status;
      err.location = location;
      throw err;
    }),
    mockSignSession: vi.fn().mockResolvedValue('mock-signed-token'),
    mockDriver,
  };
});

// =============================================================================
// Module mocks — hoisted before imports
// =============================================================================

vi.mock('$lib/server/db/connection', () => ({
  connect: mockConnect,
  getDB: mockGetDB,
}));

vi.mock('$lib/server/config', () => ({
  getConfig: mockGetConfig,
}));

vi.mock('$lib/server/auth/session', () => ({
  signSession: mockSignSession,
}));

vi.mock('@sveltejs/kit', () => ({
  fail: mockFail,
  redirect: mockRedirect,
}));

vi.mock('../$types', () => ({}));

// =============================================================================
// Module under test
// =============================================================================

import { actions } from '../+page.server';

// =============================================================================
// Helpers
// =============================================================================

function createLoginRequest(email?: string, password?: string): Request {
  const form = new FormData();
  if (email !== undefined) form.set('email', email);
  if (password !== undefined) form.set('password', password);
  return new Request('http://localhost:7777/login', { method: 'POST', body: form });
}

const mockCookies = {
  set: vi.fn(),
};

const TEST_SECRET = 'XETrs1y4LgkB9T4B5Mlpv7v18FQ40Zh32LpdesRqy5iWRD90HpSg+392MvRyp0jn';

// =============================================================================
// Tests
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfig.mockReturnValue({
    DALI_MEMORY_AUTH_ENABLED: true,
    DALI_MEMORY_SECRET: TEST_SECRET,
  });
});

describe('login actions.default — signSession and cookie creation', () => {
  test('missing email and password: returns fail 400', async () => {
    const result = await actions.default({
      request: createLoginRequest(),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(400, expect.objectContaining({ missing: true }));
    expect(result).toEqual({
      status: 400,
      data: { error: 'Email and password are required', missing: true },
    });
    expect(mockCookies.set).not.toHaveBeenCalled();
  });

  test('missing password: returns fail 400', async () => {
    const result = await actions.default({
      request: createLoginRequest('user@example.com'),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(400, expect.objectContaining({ missing: true }));
  });

  test('invalid credentials (no matching user): returns fail 401', async () => {
    (mockGetDB().getDriver() as any).query.mockResolvedValueOnce([]);

    const result = await actions.default({
      request: createLoginRequest('user@example.com', 'wrong-password'),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(401, expect.objectContaining({ invalid: true }));
    expect(result).toEqual({
      status: 401,
      data: { error: 'Invalid email or password', invalid: true },
    });
    expect(mockCookies.set).not.toHaveBeenCalled();
  });

  test('invalid credentials (null result from query): returns fail 401', async () => {
    (mockGetDB().getDriver() as any).query.mockResolvedValueOnce(null);

    const result = await actions.default({
      request: createLoginRequest('user@example.com', 'wrong-password'),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(401, expect.objectContaining({ invalid: true }));
  });

  test('valid credentials: signs session cookie with email and redirects', async () => {
    (mockGetDB().getDriver() as any).query.mockResolvedValueOnce([{ id: 'user:abc123' }]);

    try {
      await actions.default({
        request: createLoginRequest('test@example.com', 'correct-password'),
        cookies: mockCookies,
      } as any);
      // Should not reach here — redirect throws
      expect.unreachable('Expected redirect to be thrown');
    } catch (err: any) {
      // We need to catch the redirect throw from our mock
    }

    // On success: sign cookie with the email, then redirect
    expect(mockCookies.set).toHaveBeenCalledTimes(1);
    const [name, signed, opts] = mockCookies.set.mock.calls[0];
    expect(name).toBe('dali_session');

    // Verify signSession called with the email as session payload
    expect(mockSignSession).toHaveBeenCalledWith('test@example.com', expect.any(String));
    expect(signed).toBe('mock-signed-token');

    // Verify cookie options
    expect(opts).toMatchObject({
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
    });
    expect(opts.maxAge).toBe(60 * 60 * 24 * 30);
  });

  test('valid credentials with plus-address email: preserves email in cookie', async () => {
    (mockGetDB().getDriver() as any).query.mockResolvedValueOnce([{ id: 'user:def456' }]);

    try {
      await actions.default({
        request: createLoginRequest('user+tag@example.com', 'correct-password'),
        cookies: mockCookies,
      } as any);
      expect.unreachable('Expected redirect to be thrown');
    } catch (err: any) {
      // Expected
    }

    const signed = mockCookies.set.mock.calls[0][1];
    expect(mockSignSession).toHaveBeenCalledWith('user+tag@example.com', expect.any(String));
    expect(signed).toBe('mock-signed-token');
  });

  test('valid credentials with dotted email: preserves full email', async () => {
    (mockGetDB().getDriver() as any).query.mockResolvedValueOnce([{ id: 'user:ghi789' }]);

    try {
      await actions.default({
        request: createLoginRequest('first.last@example.co.uk', 'correct-password'),
        cookies: mockCookies,
      } as any);
      expect.unreachable('Expected redirect to be thrown');
    } catch (err: any) {
      // Expected
    }

    const signed = mockCookies.set.mock.calls[0][1];
    expect(mockSignSession).toHaveBeenCalledWith('first.last@example.co.uk', expect.any(String));
    expect(signed).toBe('mock-signed-token');
  });

  test('DB query throws error: returns fail 401', async () => {
    (mockGetDB().getDriver() as any).query.mockRejectedValueOnce(new Error('Connection lost'));

    const result = await actions.default({
      request: createLoginRequest('user@example.com', 'password'),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(401, expect.objectContaining({ invalid: true }));
    expect(mockCookies.set).not.toHaveBeenCalled();
  });

  test('valid credentials: redirects to /workspaces', async () => {
    (mockGetDB().getDriver() as any).query.mockResolvedValueOnce([{ id: 'user:abc123' }]);

    try {
      await actions.default({
        request: createLoginRequest('test@example.com', 'correct-password'),
        cookies: mockCookies,
      } as any);
      expect.unreachable('Expected redirect to be thrown');
    } catch (err: any) {
      expect(err.status).toBe(303);
      expect(err.location).toBe('/workspaces');
    }
  });
});
