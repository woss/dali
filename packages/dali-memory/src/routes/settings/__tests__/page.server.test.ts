import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// Hoisted mocks
// =============================================================================

const { mockGetConfig, mockConnect, mockGetDB, mockHashApiKey, mockFail, mockDB } = vi.hoisted(
  () => {
    // Single stable mock driver + DB instance reused across calls
    const _mockDriver = { query: vi.fn() };
    const _mockDB = {
      getDriver: () => _mockDriver,
      query: vi.fn(),
    };
    return {
      mockGetConfig: vi.fn(),
      mockConnect: vi.fn().mockResolvedValue(undefined),
      mockGetDB: vi.fn(() => _mockDB),
      mockHashApiKey: vi.fn(),
      mockFail: vi.fn((status: number, data: any) => ({ status, data })),
      mockDB: _mockDB,
    };
  },
);

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

vi.mock('$lib/server/auth/api-keys', () => ({
  hashApiKey: mockHashApiKey,
}));

vi.mock('@sveltejs/kit', () => ({
  fail: mockFail,
}));

vi.mock('../$types', () => ({}));

// toPlain is a pure utility; resolves from disk fine

// =============================================================================
// Module under test
// =============================================================================

import { actions, load } from '../+page.server';

// =============================================================================
// Helpers
// =============================================================================

function createGenerateKeyRequest(name?: string): Request {
  const form = new FormData();
  if (name !== undefined) form.set('name', name);
  return new Request('http://localhost:7777/settings', { method: 'POST', body: form });
}

function createDeleteKeyRequest(id?: string): Request {
  const form = new FormData();
  if (id !== undefined) form.set('id', id);
  return new Request('http://localhost:7777/settings', { method: 'POST', body: form });
}

// UUIDs matching the 8-4-4-4-12 pattern for crypto.randomUUID mock
const UUID1 = 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c';
const UUID2 = 'b2c3d4e5-f6a7-48b9-0c1d-2e3f4a5b6c7d';
// prettier-ignore
const UUID3 = 'c3d4e5f6-a7b8-49c0-1d2e-3f4a5b6c7d8e';
const UUID4 = 'd4e5f6a7-b8c9-4ad1-2e3f-4a5b6c7d8e9f';
const UUID5 = 'e5f6a7b8-c9d0-4be2-3f4a-5b6c7d8e9f0a';
const UUID6 = 'f6a7b8c9-d0e1-4cf3-4a5b-6c7d8e9f0a1b';
const UUID7 = 'aabbccdd-eeff-4a5b-6c7d-8e9f0a1b2c3d';
const UUID8 = '11223344-5566-4a5b-6c7d-8e9f0a1b2c3d';
const UUID9 = 'deadbeef-dead-4a5b-6c7d-8e9f0a1b2c3d';
const UUID10 = 'cafebabe-cafe-4a5b-6c7d-8e9f0a1b2c3d';
const UUID11 = '11111111-2222-4a5b-6c7d-8e9f0a1b2c3d';
const UUID12 = '66666666-7777-4a5b-6c7d-8e9f0a1b2c3d';
const UUID13 = '00000000-0000-4000-8000-000000000001';
const UUID14 = '00000000-0000-4000-8000-000000000002';

// =============================================================================
// Tests
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfig.mockReturnValue({
    DALI_MEMORY_AUTH_ENABLED: true,
    DALI_MEMORY_SECRET: 'test-secret',
  });
});

describe('settings load', () => {
  test('returns safe config and api keys', async () => {
    // Extend config mock to include settings-specific fields
    mockGetConfig.mockReturnValue({
      DALI_MEMORY_AUTH_ENABLED: true,
      DALI_MEMORY_SECRET: 'test-secret',
      DALI_MEMORY_EMBEDDING_PROVIDER: 'openai',
      DALI_MEMORY_EMBEDDING_MODEL: 'text-embedding-3-small',
      DALI_MEMORY_SURREAL_URL: 'http://localhost:8000',
      DALI_MEMORY_SURREAL_NS: 'test',
      DALI_MEMORY_SURREAL_DB: 'test',
      DALI_MEMORY_LOG_LEVEL: 'info',
    });
    mockDB.query.mockResolvedValueOnce([
      [{ id: 'key:abc', name: 'my-key', created_at: new Date(), last_used_at: null }],
    ]);

    const result = await load({} as any);

    expect(mockGetConfig).toHaveBeenCalled();
    expect(mockDB.query).toHaveBeenCalledWith(
      'SELECT id, name, created_at, last_used_at FROM api_keys ORDER BY created_at DESC',
    );
    expect(result).toHaveProperty('config');
    expect((result as any).config).toMatchObject({
      embeddingProvider: 'openai',
      embeddingModel: 'text-embedding-3-small',
      surrealUrl: 'http://localhost:8000',
      surrealNs: 'test',
      surrealDb: 'test',
      logLevel: 'info',
    });
    // toPlain preserves the nested-array structure from db.query; Date passes through
    expect((result as any).apiKeys).toHaveLength(1);
    expect((result as any).apiKeys[0]).toHaveLength(1);
    expect((result as any).apiKeys[0][0]).toMatchObject({
      id: 'key:abc',
      name: 'my-key',
      last_used_at: null,
    });
    expect((result as any).apiKeys[0][0].created_at).toBeInstanceOf(Date);
  });

  test('handles empty api keys', async () => {
    mockGetConfig.mockReturnValue({
      DALI_MEMORY_AUTH_ENABLED: true,
      DALI_MEMORY_SECRET: 'test-secret',
      DALI_MEMORY_EMBEDDING_PROVIDER: 'openai',
      DALI_MEMORY_EMBEDDING_MODEL: 'text-embedding-3-small',
      DALI_MEMORY_SURREAL_URL: 'http://localhost:8000',
      DALI_MEMORY_SURREAL_NS: 'test',
      DALI_MEMORY_SURREAL_DB: 'test',
      DALI_MEMORY_LOG_LEVEL: 'info',
    });
    mockDB.query.mockResolvedValueOnce([[]]);

    const result = await load({} as any);

    // Empty result is [[]] before toPlain — stays [[]] after
    expect((result as any).apiKeys).toEqual([[]]);
  });
});

describe('settings actions.generate-key — user_id linkage with api_keys', () => {
  test('with userEmail and matching user: stores key with user_id', async () => {
    mockHashApiKey.mockResolvedValue('mocked-hash-value');
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(UUID1);
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(UUID2);

    // User lookup returns a matching user
    mockDB.query.mockResolvedValueOnce([[{ id: 'users:abc123' }]]);
    // Key creation succeeds
    mockDB.query.mockResolvedValueOnce(undefined);

    const result = await actions['generate-key']({
      request: createGenerateKeyRequest('test-key'),
      locals: { userEmail: 'user@example.com', authenticated: true },
    } as any);

    // Verify user lookup query
    expect(mockDB.query).toHaveBeenNthCalledWith(1, 'SELECT id FROM users WHERE email = $email', {
      email: 'user@example.com',
    });

    // Verify key creation includes user_id
    expect(mockDB.query).toHaveBeenNthCalledWith(
      2,
      'CREATE api_keys CONTENT { key_hash: $hash, name: $name, user_id: $user_id }',
      { hash: 'mocked-hash-value', name: 'test-key', user_id: 'users:abc123' },
    );

    expect(result).toEqual({
      success: true,
      newKey: expect.stringMatching(/^[0-9a-f-]+$/),
      keyName: 'test-key',
    });

    vi.restoreAllMocks();
  });

  test('with userEmail but no matching user: stores key without user_id', async () => {
    mockHashApiKey.mockResolvedValue('mocked-hash-value');
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(UUID3);
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(UUID4);

    // User lookup returns empty/no results
    mockDB.query.mockResolvedValueOnce([undefined]);
    mockDB.query.mockResolvedValueOnce(undefined);

    const result = await actions['generate-key']({
      request: createGenerateKeyRequest('orphan-key'),
      locals: { userEmail: 'ghost@example.com', authenticated: true },
    } as any);

    // Key creation omits user_id when null
    expect(mockDB.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('CREATE api_keys'),
      expect.objectContaining({ hash: 'mocked-hash-value', name: 'orphan-key' }),
    );
    expect(mockDB.query.mock.calls[1][0]).not.toContain('user_id');
    expect(result).toEqual({
      success: true,
      newKey: expect.any(String),
      keyName: 'orphan-key',
    });

    vi.restoreAllMocks();
  });

  test('with userEmail but empty array response: stores key without user_id', async () => {
    mockHashApiKey.mockResolvedValue('mocked-hash-value');
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(UUID5);
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(UUID6);

    mockDB.query.mockResolvedValueOnce([[]]);
    mockDB.query.mockResolvedValueOnce(undefined);

    const result = await actions['generate-key']({
      request: createGenerateKeyRequest('empty-key'),
      locals: { userEmail: 'nobody@example.com', authenticated: true },
    } as any);

    expect(mockDB.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('CREATE api_keys'),
      expect.objectContaining({ hash: 'mocked-hash-value', name: 'empty-key' }),
    );
    expect(mockDB.query.mock.calls[1][0]).not.toContain('user_id');

    vi.restoreAllMocks();
  });

  test('without userEmail: stores key without user_id', async () => {
    mockHashApiKey.mockResolvedValue('mocked-hash-value');
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(UUID7);
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(UUID8);

    // Key creation succeeds (no user lookup should happen)
    mockDB.query.mockResolvedValueOnce(undefined);

    const result = await actions['generate-key']({
      request: createGenerateKeyRequest('no-email-key'),
      locals: { authenticated: true }, // no userEmail
    } as any);

    // Should not query for user at all — only CREATE
    expect(mockDB.query).toHaveBeenCalledTimes(1);
    expect(mockDB.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE api_keys'),
      expect.objectContaining({ hash: 'mocked-hash-value', name: 'no-email-key' }),
    );
    expect(mockDB.query.mock.calls[0][0]).not.toContain('user_id');

    vi.restoreAllMocks();
  });

  test('default key name when name not provided', async () => {
    mockHashApiKey.mockResolvedValue('mocked-hash-value');
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(UUID9);
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(UUID10);

    mockDB.query.mockResolvedValueOnce(undefined);

    const result = await actions['generate-key']({
      request: createGenerateKeyRequest(), // no name provided
      locals: { authenticated: true },
    } as any);

    expect(mockDB.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE api_keys'),
      expect.objectContaining({ name: 'default' }),
    );
    expect(result).toMatchObject({ keyName: 'default' });

    vi.restoreAllMocks();
  });

  test('DB error during user lookup: returns fail 400 (caught by try-catch)', async () => {
    mockHashApiKey.mockResolvedValue('mocked-hash-value');
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(UUID11);
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(UUID12);

    // User lookup throws
    mockDB.query.mockRejectedValueOnce(new Error('Query failed'));

    const result = await actions['generate-key']({
      request: createGenerateKeyRequest('broken-key'),
      locals: { userEmail: 'user@example.com', authenticated: true },
    } as any);

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Query failed' });
    expect(result).toEqual({ status: 400, data: { error: 'Query failed' } });

    vi.restoreAllMocks();
  });

  test('DB error during key creation: returns fail 400', async () => {
    mockHashApiKey.mockResolvedValue('mocked-hash-value');
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(UUID13);
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(UUID14);

    // User lookup succeeds
    mockDB.query.mockResolvedValueOnce([[{ id: 'users:xyz' }]]);
    // Key creation fails
    mockDB.query.mockRejectedValueOnce(new Error('Failed to create key'));

    const result = await actions['generate-key']({
      request: createGenerateKeyRequest('failing-key'),
      locals: { userEmail: 'user@example.com', authenticated: true },
    } as any);

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Failed to create key' });
    expect(result).toEqual({ status: 400, data: { error: 'Failed to create key' } });

    vi.restoreAllMocks();
  });

  test('key hash is computed from the generated raw key', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(UUID13);
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(UUID14);

    mockDB.query.mockResolvedValueOnce(undefined);

    await actions['generate-key']({
      request: createGenerateKeyRequest('hash-test'),
      locals: { authenticated: true },
    } as any);

    // Verify hashApiKey was called with rawKey = "UUID1-UUID2" (dashes replaced)
    const rawKeyStart = UUID13.replace(/-/g, '');
    const rawKeyEnd = UUID14.replace(/-/g, '');
    expect(mockHashApiKey).toHaveBeenCalledWith(`${rawKeyStart}-${rawKeyEnd}`);

    vi.restoreAllMocks();
  });
});

describe('settings actions.delete-key', () => {
  test('with valid id: deletes the key and returns success', async () => {
    mockDB.query.mockResolvedValueOnce(undefined);

    const result = await actions['delete-key']({
      request: createDeleteKeyRequest('key:abc123'),
    } as any);

    expect(mockDB.query).toHaveBeenCalledWith('DELETE api_keys WHERE id = $id', {
      id: 'key:abc123',
    });
    expect(result).toEqual({ success: true });
  });

  test('without id: returns fail 400', async () => {
    const result = await actions['delete-key']({
      request: createDeleteKeyRequest(),
    } as any);

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Key ID is required' });
    expect(result).toEqual({ status: 400, data: { error: 'Key ID is required' } });
  });

  test('DB error during delete: returns fail 400', async () => {
    mockDB.query.mockRejectedValueOnce(new Error('Record not found'));

    const result = await actions['delete-key']({
      request: createDeleteKeyRequest('key:missing'),
    } as any);

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Record not found' });
    expect(result).toEqual({ status: 400, data: { error: 'Record not found' } });
  });
});

// =============================================================================
// Helpers — update-profile
// =============================================================================

function createUpdateProfileRequest(name?: string, email?: string): Request {
  const form = new FormData();
  if (name !== undefined) form.set('name', name);
  if (email !== undefined) form.set('email', email);
  return new Request('http://localhost:7777/settings', { method: 'POST', body: form });
}

// =============================================================================
// Tests — settings actions.update-profile
// =============================================================================

describe('settings actions.update-profile', () => {
  const mockProfileCookies = { set: vi.fn() };

  test('unauthenticated: returns fail 401', async () => {
    const result = await actions['update-profile']({
      request: createUpdateProfileRequest('Test', 'test@test.com'),
      locals: { authenticated: false },
      cookies: mockProfileCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(401, { error: 'Not authenticated' });
    expect(result).toEqual({ status: 401, data: { error: 'Not authenticated' } });
  });

  test('missing fields: returns fail 400', async () => {
    const result = await actions['update-profile']({
      request: createUpdateProfileRequest(),
      locals: { userEmail: 'test@test.com', authenticated: true },
      cookies: mockProfileCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Name and email are required' });
    expect(result).toEqual({ status: 400, data: { error: 'Name and email are required' } });
  });

  test('invalid email format: returns fail 400', async () => {
    const result = await actions['update-profile']({
      request: createUpdateProfileRequest('Test', 'notanemail'),
      locals: { userEmail: 'test@test.com', authenticated: true },
      cookies: mockProfileCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Invalid email address' });
    expect(result).toEqual({ status: 400, data: { error: 'Invalid email address' } });
  });

  test('same email, no change: updates name only, no cookie re-sign', async () => {
    const driverQuery = mockDB.getDriver().query;
    driverQuery.mockResolvedValueOnce(undefined);

    const result = await actions['update-profile']({
      request: createUpdateProfileRequest('Test User', 'test@test.com'),
      locals: { userEmail: 'test@test.com', authenticated: true },
      cookies: mockProfileCookies,
    } as any);

    expect(driverQuery).toHaveBeenCalledWith(
      'UPDATE users SET name = $name, email = $email WHERE email = $currentEmail',
      { name: 'Test User', email: 'test@test.com', currentEmail: 'test@test.com' },
    );
    expect(mockProfileCookies.set).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  test('new email taken: returns fail 409', async () => {
    mockDB.query.mockResolvedValueOnce([[{ id: 'users:existing' }]]);

    const result = await actions['update-profile']({
      request: createUpdateProfileRequest('Test', 'taken@test.com'),
      locals: { userEmail: 'old@test.com', authenticated: true },
      cookies: mockProfileCookies,
    } as any);

    expect(mockDB.query).toHaveBeenCalledWith(
      'SELECT id FROM users WHERE email = $email',
      { email: 'taken@test.com' },
    );
    expect(mockFail).toHaveBeenCalledWith(409, { error: 'This email is already in use' });
    expect(result).toEqual({ status: 409, data: { error: 'This email is already in use' } });
  });

  test('new email + DB error: returns fail 500', async () => {
    mockDB.query.mockResolvedValueOnce([[]]);
    const driverQuery = mockDB.getDriver().query;
    driverQuery.mockRejectedValueOnce(new Error('DB connection failed'));

    const result = await actions['update-profile']({
      request: createUpdateProfileRequest('Test', 'new@test.com'),
      locals: { userEmail: 'old@test.com', authenticated: true },
      cookies: mockProfileCookies,
    } as any);

    expect(mockFail).toHaveBeenCalledWith(500, { error: 'DB connection failed' });
    expect(result).toEqual({ status: 500, data: { error: 'DB connection failed' } });
  });

  test('full profile update with email change: updates DB, signs cookie, returns success', async () => {
    mockDB.query.mockResolvedValueOnce([[]]);
    const driverQuery = mockDB.getDriver().query;
    driverQuery.mockResolvedValueOnce(undefined);

    const result = await actions['update-profile']({
      request: createUpdateProfileRequest('New Name', 'new@test.com'),
      locals: { userEmail: 'old@test.com', authenticated: true },
      cookies: mockProfileCookies,
    } as any);

    expect(driverQuery).toHaveBeenCalledWith(
      'UPDATE users SET name = $name, email = $email WHERE email = $currentEmail',
      { name: 'New Name', email: 'new@test.com', currentEmail: 'old@test.com' },
    );
    expect(mockProfileCookies.set).toHaveBeenCalledWith(
      'dali_session',
      expect.stringMatching(/^[0-9a-f]+\.new@test\.com$/),
      expect.objectContaining({
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
      }),
    );
    expect(result).toEqual({ success: true });
  });
});
