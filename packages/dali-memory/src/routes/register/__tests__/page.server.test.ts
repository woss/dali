import { describe, test, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Hoisted mocks
// =============================================================================

const {
  mockGetConfig,
  mockConnect,
  mockGetDB,
  mockFail,
  mockRedirect,
  mockTx,
  mockDriver,
  mockSignSession,
} = vi.hoisted(() => {
  const mockTx = {
    query: vi.fn(),
  };

  const mockDriver = {
    transaction: vi.fn(),
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
    mockTx,
    mockSignSession: vi.fn().mockResolvedValue('mock-signed-token'),
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

// Shared RecordId-like values used across transaction-success tests
const USER_RECORD_ID = { tb: 'users', id: 'abc123' };
const WORKSPACE_RECORD_ID = { tb: 'workspaces', id: 'def456' };

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfig.mockReturnValue({
    DALI_MEMORY_AUTH_ENABLED: true,
    DALI_MEMORY_SECRET: TEST_SECRET,
  });

  // Wire transaction(fn) to invoke fn(mockTx) so errors flow through
  mockDriver.transaction.mockImplementation((fn: any) => fn(mockTx));
});

// =============================================================================
// Tests — Input validation (no database calls)
// =============================================================================

describe('register actions.default — input validation', () => {
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
    expect(mockDriver.transaction).not.toHaveBeenCalled();
  });

  test('missing confirm_password: returns fail 400', async () => {
    const result = await actions.default({
      request: createRegisterRequest('user@example.com', 'Password123'),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(400, expect.objectContaining({ missing: true }));
    expect(mockDriver.transaction).not.toHaveBeenCalled();
  });

  test('short password (< 8 chars): returns fail 400', async () => {
    const result = await actions.default({
      request: createRegisterRequest('user@example.com', '1234567', '1234567', 'Test User'),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(400, expect.objectContaining({ weak: true }));
    expect(result).toEqual({
      status: 400,
      data: {
        error:
          'Password must be at least 8 characters with at least 1 uppercase, 1 lowercase, and 1 digit',
        weak: true,
      },
    });
    expect(mockDriver.transaction).not.toHaveBeenCalled();
  });

  test('password mismatch: returns fail 400', async () => {
    const result = await actions.default({
      request: createRegisterRequest('user@example.com', 'Password123', 'different', 'Test User'),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(400, expect.objectContaining({ mismatch: true }));
    expect(mockDriver.transaction).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Tests — Transaction error handling (duplicate detection, server errors)
// =============================================================================

describe('register actions.default — transaction error handling', () => {
  test('duplicate email (UNIQUE constraint): returns fail 409', async () => {
    // Step 1 inside the transaction throws a UNIQUE error
    mockTx.query.mockRejectedValueOnce(new Error('UNIQUE constraint failed: idx_users_email'));

    const result = await actions.default({
      request: createRegisterRequest(
        'existing@example.com',
        'Password123',
        'Password123',
        'Test User',
      ),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(409, expect.objectContaining({ duplicate: true }));
    expect(result).toEqual({
      status: 409,
      data: { error: 'An account with this email already exists', duplicate: true },
    });
    expect(mockCookies.set).not.toHaveBeenCalled();
    // Transaction was called
    expect(mockDriver.transaction).toHaveBeenCalledTimes(1);
  });

  test('duplicate email ("already exists" message): returns fail 409', async () => {
    mockTx.query.mockRejectedValueOnce(new Error('Record already exists'));

    const result = await actions.default({
      request: createRegisterRequest(
        'existing@example.com',
        'Password123',
        'Password123',
        'Test User',
      ),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(409, expect.objectContaining({ duplicate: true }));
    expect(mockDriver.transaction).toHaveBeenCalledTimes(1);
  });

  test('step 1 fails with non-duplicate error: returns fail 500', async () => {
    mockTx.query.mockRejectedValueOnce(new Error('Database connection lost'));

    const result = await actions.default({
      request: createRegisterRequest('user@example.com', 'Password123', 'Password123', 'Test User'),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(500, expect.objectContaining({ serverError: true }));
    expect(result).toEqual({
      status: 500,
      data: { error: 'Registration failed. Please try again.', serverError: true },
    });
    expect(mockCookies.set).not.toHaveBeenCalled();
  });

  test('step 1 returns null/empty result: throws then returns fail 500', async () => {
    // tx.query resolves but returns empty array — user creation returned nothing
    mockTx.query.mockResolvedValueOnce([]);

    const result = await actions.default({
      request: createRegisterRequest(
        'newuser@example.com',
        'Password123',
        'Password123',
        'New User',
      ),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(500, expect.objectContaining({ serverError: true }));
  });

  test('step 1 succeeds but step 2 fails with non-duplicate error: returns fail 500', async () => {
    // Step 1: create user succeeds
    mockTx.query.mockResolvedValueOnce([
      { id: USER_RECORD_ID, name: 'New User', email: 'newuser@example.com' },
    ]);
    // Step 2: create workspace fails
    mockTx.query.mockRejectedValueOnce(new Error('Connection timeout'));

    const result = await actions.default({
      request: createRegisterRequest(
        'newuser@example.com',
        'Password123',
        'Password123',
        'New User',
      ),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(500, expect.objectContaining({ serverError: true }));
    expect(mockCookies.set).not.toHaveBeenCalled();
  });

  test('step 2 returns null/empty workspace result: throws then returns fail 500', async () => {
    mockTx.query.mockResolvedValueOnce([
      { id: USER_RECORD_ID, name: 'New User', email: 'newuser@example.com' },
    ]);
    mockTx.query.mockResolvedValueOnce([]);

    const result = await actions.default({
      request: createRegisterRequest(
        'newuser@example.com',
        'Password123',
        'Password123',
        'New User',
      ),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(500, expect.objectContaining({ serverError: true }));
  });
});

// =============================================================================
// Tests — Successful transaction with workspace creation
// =============================================================================

describe('register actions.default — successful transaction (user + workspace)', () => {
  function arrangeSuccess() {
    // Step 1: create user
    mockTx.query.mockResolvedValueOnce([
      { id: USER_RECORD_ID, name: 'New User', email: 'newuser@example.com' },
    ]);
    // Step 2: create personal workspace
    mockTx.query.mockResolvedValueOnce([{ id: WORKSPACE_RECORD_ID }]);
    // Step 3: update user default_workspace_id
    mockTx.query.mockResolvedValueOnce(undefined);
  }

  test('all 3 transaction steps are called in order', async () => {
    arrangeSuccess();

    try {
      await actions.default({
        request: createRegisterRequest(
          'newuser@example.com',
          'Password123',
          'Password123',
          'New User',
        ),
        cookies: mockCookies,
      } as any);
      expect.unreachable('Expected redirect to be thrown');
    } catch (err: any) {
      // Expected redirect
    }

    // transaction was called once
    expect(mockDriver.transaction).toHaveBeenCalledTimes(1);
    // tx.query was called 3 times inside the transaction
    expect(mockTx.query).toHaveBeenCalledTimes(3);
  });

  test('step 1: creates user with name, email, and argon2 password', async () => {
    arrangeSuccess();

    try {
      await actions.default({
        request: createRegisterRequest(
          'newuser@example.com',
          'Password123',
          'Password123',
          'New User',
        ),
        cookies: mockCookies,
      } as any);
      expect.unreachable('Expected redirect to be thrown');
    } catch (err: any) {
      // Expected redirect
    }

    const step1Call = mockTx.query.mock.calls[0];
    expect(step1Call[0]).toContain('CREATE users');
    expect(step1Call[0]).toContain('crypto::argon2::generate');
    expect(step1Call[1]).toEqual({
      name: 'New User',
      email: 'newuser@example.com',
      pass: 'Password123',
    });
  });

  test('step 2: creates personal workspace with is_personal=true and user_id', async () => {
    arrangeSuccess();

    try {
      await actions.default({
        request: createRegisterRequest(
          'newuser@example.com',
          'Password123',
          'Password123',
          'New User',
        ),
        cookies: mockCookies,
      } as any);
      expect.unreachable('Expected redirect to be thrown');
    } catch (err: any) {
      // Expected redirect
    }

    const step2Call = mockTx.query.mock.calls[1];
    expect(step2Call[0]).toContain('CREATE workspaces');
    expect(step2Call[0]).toContain('is_personal = true');
    expect(step2Call[1]).toMatchObject({
      userId: USER_RECORD_ID,
      name: 'New User',
      description: 'newuser@example.com',
    });
  });

  test('step 3: sets user default_workspace_id to workspace record id', async () => {
    arrangeSuccess();

    try {
      await actions.default({
        request: createRegisterRequest(
          'newuser@example.com',
          'Password123',
          'Password123',
          'New User',
        ),
        cookies: mockCookies,
      } as any);
      expect.unreachable('Expected redirect to be thrown');
    } catch (err: any) {
      // Expected redirect
    }

    const step3Call = mockTx.query.mock.calls[2];
    expect(step3Call[0]).toContain('UPDATE');
    expect(step3Call[0]).toContain('default_workspace_id');
    expect(step3Call[1]).toEqual({
      userId: USER_RECORD_ID,
      workspaceId: WORKSPACE_RECORD_ID,
    });
  });

  test('valid registration: creates user, signs session cookie with email, redirects', async () => {
    arrangeSuccess();

    try {
      await actions.default({
        request: createRegisterRequest(
          'newuser@example.com',
          'Password123',
          'Password123',
          'New User',
        ),
        cookies: mockCookies,
      } as any);
      expect.unreachable('Expected redirect to be thrown');
    } catch (err: any) {
      // Expected redirect
    }

    // Verify cookie was set with signed email
    expect(mockCookies.set).toHaveBeenCalledTimes(1);
    const [name, signed, opts] = mockCookies.set.mock.calls[0];
    expect(name).toBe('dali_session');
    expect(mockSignSession).toHaveBeenCalledWith('newuser@example.com', expect.any(String));
    expect(signed).toBe('mock-signed-token');
    expect(opts).toMatchObject({ path: '/', httpOnly: true, sameSite: 'strict' });
    expect(opts.maxAge).toBe(60 * 60 * 24 * 30);
  });
});

// =============================================================================
// Tests — Redirect and sign-in after successful registration
// =============================================================================

describe('register actions.default — redirect and sign-in', () => {
  test('valid registration: redirects to /workspaces', async () => {
    mockTx.query
      .mockResolvedValueOnce([
        { id: USER_RECORD_ID, name: 'New User', email: 'newuser@example.com' },
      ])
      .mockResolvedValueOnce([{ id: WORKSPACE_RECORD_ID }])
      .mockResolvedValueOnce(undefined);

    try {
      await actions.default({
        request: createRegisterRequest(
          'newuser@example.com',
          'Password123',
          'Password123',
          'New User',
        ),
        cookies: mockCookies,
      } as any);
      expect.unreachable('Expected redirect to be thrown');
    } catch (err: any) {
      expect(err.status).toBe(303);
      expect(err.location).toBe('/workspaces');
    }
  });

  test('sign-in cookie uses email as session payload', async () => {
    mockTx.query
      .mockResolvedValueOnce([{ id: USER_RECORD_ID, name: 'User', email: 'user+tag@example.com' }])
      .mockResolvedValueOnce([{ id: WORKSPACE_RECORD_ID }])
      .mockResolvedValueOnce(undefined);

    try {
      await actions.default({
        request: createRegisterRequest(
          'user+tag@example.com',
          'Password123',
          'Password123',
          'User',
        ),
        cookies: mockCookies,
      } as any);
      expect.unreachable('Expected redirect to be thrown');
    } catch (err: any) {
      // Expected redirect
    }

    const signed = mockCookies.set.mock.calls[0][1];
    expect(mockSignSession).toHaveBeenCalledWith('user+tag@example.com', expect.any(String));
    expect(signed).toBe('mock-signed-token');
  });
});

// =============================================================================
// Tests — Transaction boundary (rollback semantics)
// =============================================================================

describe('register actions.default — transaction rollback semantics', () => {
  test('transaction callback receives a tx object with query method', async () => {
    mockTx.query
      .mockResolvedValueOnce([
        { id: USER_RECORD_ID, name: 'New User', email: 'newuser@example.com' },
      ])
      .mockResolvedValueOnce([{ id: WORKSPACE_RECORD_ID }])
      .mockResolvedValueOnce(undefined);

    try {
      await actions.default({
        request: createRegisterRequest(
          'newuser@example.com',
          'Password123',
          'Password123',
          'New User',
        ),
        cookies: mockCookies,
      } as any);
      expect.unreachable('Expected redirect to be thrown');
    } catch (err: any) {
      // Expected redirect
    }

    // Verify transaction received a function
    expect(mockDriver.transaction).toHaveBeenCalledTimes(1);
    expect(typeof mockDriver.transaction.mock.calls[0][0]).toBe('function');
    // Verify all mockTx.query calls were made (not driver.query)
    expect(mockTx.query).toHaveBeenCalledTimes(3);
    expect(mockDriver.query).not.toHaveBeenCalled();
  });

  test('driver.query (non-transactional) is never called during registration', async () => {
    mockTx.query
      .mockResolvedValueOnce([
        { id: USER_RECORD_ID, name: 'New User', email: 'newuser@example.com' },
      ])
      .mockResolvedValueOnce([{ id: WORKSPACE_RECORD_ID }])
      .mockResolvedValueOnce(undefined);

    try {
      await actions.default({
        request: createRegisterRequest(
          'newuser@example.com',
          'Password123',
          'Password123',
          'New User',
        ),
        cookies: mockCookies,
      } as any);
      expect.unreachable('Expected redirect to be thrown');
    } catch (err: any) {
      // Expected redirect
    }

    // All queries went through tx.query, not driver.query
    expect(mockDriver.query).not.toHaveBeenCalled();
  });

  test('error in step 2 rolls back step 1 (error propagates from transaction)', async () => {
    // Step 1 succeeds
    mockTx.query.mockResolvedValueOnce([
      { id: USER_RECORD_ID, name: 'New User', email: 'newuser@example.com' },
    ]);
    // Step 2 fails — the error propagates out of the transaction callback,
    // then out of driver.transaction(), and into the action catch block.
    // The real BaseDriver.transaction catches and calls tx.cancel().
    // At the mock level, the error rejects the promise from the mock.
    mockTx.query.mockRejectedValueOnce(new Error('Failed to create workspace'));

    const result = await actions.default({
      request: createRegisterRequest(
        'newuser@example.com',
        'Password123',
        'Password123',
        'New User',
      ),
      cookies: mockCookies,
    } as any);

    // Error is caught by the action handler
    expect(mockFail).toHaveBeenCalledWith(500, expect.objectContaining({ serverError: true }));
    // Step 3 was never reached
    expect(mockTx.query).toHaveBeenCalledTimes(2);
    // No cookie set
    expect(mockCookies.set).not.toHaveBeenCalled();
  });

  test('error in step 3 rolls back steps 1 and 2', async () => {
    // Step 1 succeeds
    mockTx.query.mockResolvedValueOnce([
      { id: USER_RECORD_ID, name: 'New User', email: 'newuser@example.com' },
    ]);
    // Step 2 succeeds
    mockTx.query.mockResolvedValueOnce([{ id: WORKSPACE_RECORD_ID }]);
    // Step 3 fails
    mockTx.query.mockRejectedValueOnce(new Error('Failed to update user'));

    const result = await actions.default({
      request: createRegisterRequest(
        'newuser@example.com',
        'Password123',
        'Password123',
        'New User',
      ),
      cookies: mockCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(500, expect.objectContaining({ serverError: true }));
    // All 3 steps were attempted
    expect(mockTx.query).toHaveBeenCalledTimes(3);
    // No cookie set (redirect not reached)
    expect(mockCookies.set).not.toHaveBeenCalled();
  });
});
