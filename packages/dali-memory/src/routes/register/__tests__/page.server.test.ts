import { describe, test, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Hoisted mocks
// =============================================================================

const { mockGetConfig, mockConnect, mockGetDB, mockFail, mockRedirect } = vi.hoisted(() => {
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

function createRegisterRequest(
  email?: string,
  password?: string,
  confirmPassword?: string,
  name?: string,
): Request {
  const form = new FormData();
  if (email !== undefined) form.set('email', email);
  if (password !== undefined) form.set('password', password);
  if (confirmPassword !== undefined) form.set('confirm_password', confirmPassword);
  if (name !== undefined) form.set('name', name);
  return new Request('http://localhost:7777/register', { method: 'POST', body: form });
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

describe('register actions.default — signSession and cookie creation', () => {
  test('missing all fields: returns fail 400', async () => {
    const result = await actions.default({
      request: createRegisterRequest(),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(400, expect.objectContaining({ missing: true }));
    expect(result).toEqual({
      status: 400,
      data: { error: 'All fields are required', missing: true },
    });
    expect(mockCookies.set).not.toHaveBeenCalled();
  });

  test('missing confirm_password: returns fail 400', async () => {
    const result = await actions.default({
      request: createRegisterRequest('user@example.com', 'password123'),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(400, expect.objectContaining({ missing: true }));
  });

  test('short password (< 8 chars): returns fail 400', async () => {
    const result = await actions.default({
      request: createRegisterRequest('user@example.com', '1234567', '1234567', 'Test User'),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(400, expect.objectContaining({ weak: true }));
    expect(result).toEqual({
      status: 400,
      data: { error: 'Password must be at least 8 characters', weak: true },
    });
  });

  test('password mismatch: returns fail 400', async () => {
    const result = await actions.default({
      request: createRegisterRequest('user@example.com', 'password123', 'different', 'Test User'),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(400, expect.objectContaining({ mismatch: true }));
  });

  test('duplicate email (UNIQUE constraint): returns fail 409', async () => {
    (mockGetDB().getDriver() as any).query.mockRejectedValueOnce(
      new Error('UNIQUE constraint failed: idx_users_email'),
    );

    const result = await actions.default({
      request: createRegisterRequest('existing@example.com', 'password123', 'password123', 'Test User'),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(409, expect.objectContaining({ duplicate: true }));
    expect(result).toEqual({
      status: 409,
      data: { error: 'An account with this email already exists', duplicate: true },
    });
    expect(mockCookies.set).not.toHaveBeenCalled();
  });

  test('duplicate email ("already exists" message): returns fail 409', async () => {
    (mockGetDB().getDriver() as any).query.mockRejectedValueOnce(
      new Error('Record already exists'),
    );

    const result = await actions.default({
      request: createRegisterRequest('existing@example.com', 'password123', 'password123', 'Test User'),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(409, expect.objectContaining({ duplicate: true }));
  });

  test('valid registration: creates user, signs session cookie with email, redirects', async () => {
    (mockGetDB().getDriver() as any).query.mockResolvedValueOnce(undefined);

    try {
      await actions.default({
        request: createRegisterRequest('newuser@example.com', 'password123', 'password123', 'New User'),
        cookies: mockCookies,
      } as any);
      expect.unreachable('Expected redirect to be thrown');
    } catch (err: any) {
      // Expected redirect
    }

    // Verify user creation was called with correct params
    const queryCall = (mockGetDB().getDriver() as any).query.mock.calls[0];
    expect(queryCall[0]).toContain('CREATE users');
    expect(queryCall[0]).toContain('crypto::argon2::generate');
    expect(queryCall[1]).toEqual({ email: 'newuser@example.com', pass: 'password123', name: 'New User' });

    // Verify cookie was set with signed email
    expect(mockCookies.set).toHaveBeenCalledTimes(1);
    const [name, signed, opts] = mockCookies.set.mock.calls[0];
    expect(name).toBe('dali_session');
    expect(signed).toMatch(/^[0-9a-f]+\.newuser@example\.com$/);
    expect(opts).toMatchObject({ path: '/', httpOnly: true, sameSite: 'strict' });
    expect(opts.maxAge).toBe(60 * 60 * 24 * 30);
  });

  test('valid registration: redirects to /memories', async () => {
    (mockGetDB().getDriver() as any).query.mockResolvedValueOnce(undefined);

    try {
      await actions.default({
        request: createRegisterRequest('newuser@example.com', 'password123', 'password123', 'New User'),
        cookies: mockCookies,
      } as any);
      expect.unreachable('Expected redirect to be thrown');
    } catch (err: any) {
      expect(err.status).toBe(303);
      expect(err.location).toBe('/memories');
    }
  });

  test('DB error (non-duplicate): returns fail 500', async () => {
    (mockGetDB().getDriver() as any).query.mockRejectedValueOnce(
      new Error('Database connection lost'),
    );

    const result = await actions.default({
      request: createRegisterRequest('user@example.com', 'password123', 'password123', 'Test User'),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(500, expect.objectContaining({ serverError: true }));
  });
});
