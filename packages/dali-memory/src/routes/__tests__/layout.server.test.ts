import { describe, test, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Hoisted mocks
// =============================================================================

const { mockConnect, mockGetDriver, mockDriverQuery } = vi.hoisted(() => {
  const driver = { query: vi.fn() };
  return {
    mockConnect: vi.fn(),
    mockGetDriver: vi.fn(() => driver),
    mockDriverQuery: driver.query,
  };
});

// =============================================================================
// Module mocks
// =============================================================================

vi.mock('$lib/server/db/connection', () => ({
  connect: mockConnect,
}));

vi.mock('$lib/utils/serialization', () => ({
  toPlain: <T>(x: T): T => x,
}));

vi.mock('../$types', () => ({}));

// =============================================================================
// Module under test — lazy import in beforeEach
// =============================================================================

let load: any;

beforeEach(async () => {
  vi.clearAllMocks();

  // Default: connect returns DaliORM with getDriver() returning mock driver
  mockConnect.mockResolvedValue({ getDriver: mockGetDriver });

  const mod = await import('../+layout.server');
  load = mod.load;
});

// =============================================================================
// Tests
// =============================================================================

describe('Layout server load', () => {
  // ── Happy path ───────────────────────────────────────────────

  test('returns full shape when authenticated with default workspace', async () => {
    mockDriverQuery
      .mockResolvedValueOnce([{ name: 'Alice', default_workspace_id: 'workspace:ws_abc' }])
      .mockResolvedValueOnce([
        { id: 'workspace:ws_abc', name: 'Personal' },
        { id: 'workspace:ws_xyz', name: 'Team' },
      ]);

    const result = await load({
      locals: { authenticated: true, userEmail: 'alice@test.com' },
    } as any);

    expect(result).toEqual({
      authenticated: true,
      userEmail: 'alice@test.com',
      name: 'Alice',
      defaultWorkspaceId: 'ws_abc',
      workspaces: [
        { name: 'Personal', id: 'ws_abc' },
        { name: 'Team', id: 'ws_xyz' },
      ],
    });
  });

  test('returns name as null when userResult has no name', async () => {
    mockDriverQuery
      .mockResolvedValueOnce([{ default_workspace_id: 'workspace:ws_abc' }])
      .mockResolvedValueOnce([]);

    const result = await load({
      locals: { authenticated: true, userEmail: 'alice@test.com' },
    } as any);

    expect(result.name).toBeNull();
  });

  // ── No default workspace ─────────────────────────────────────

  test('defaultWorkspaceId is null when user has no default_workspace_id', async () => {
    mockDriverQuery
      .mockResolvedValueOnce([{ name: 'Bob', default_workspace_id: null }])
      .mockResolvedValueOnce([{ id: 'workspace:ws_bob', name: 'Bobs Workspace' }]);

    const result = await load({
      locals: { authenticated: true, userEmail: 'bob@test.com' },
    } as any);

    expect(result.defaultWorkspaceId).toBeNull();
    expect(result.name).toBe('Bob');
    expect(result.workspaces).toHaveLength(1);
  });

  // ── Not authenticated ───────────────────────────────────────

  test('returns defaults when not authenticated', async () => {
    const result = await load({
      locals: { authenticated: false },
    } as any);

    expect(result).toEqual({
      authenticated: false,
      userEmail: null,
      name: null,
      defaultWorkspaceId: null,
      workspaces: [],
    });
    expect(mockConnect).not.toHaveBeenCalled();
  });

  test('returns defaults when authenticated flag is absent', async () => {
    const result = await load({
      locals: {},
    } as any);

    expect(result.authenticated).toBe(false);
    expect(result.userEmail).toBeNull();
    expect(result.name).toBeNull();
    expect(result.defaultWorkspaceId).toBeNull();
    expect(result.workspaces).toEqual([]);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  // ── Authenticated but no userEmail ───────────────────────────

  test('skips DB queries when authenticated but no userEmail', async () => {
    const result = await load({
      locals: { authenticated: true },
    } as any);

    expect(result.name).toBeNull();
    expect(result.defaultWorkspaceId).toBeNull();
    expect(result.workspaces).toEqual([]);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  test('skips DB queries when userEmail is empty string', async () => {
    const result = await load({
      locals: { authenticated: true, userEmail: '' },
    } as any);

    expect(result.name).toBeNull();
    expect(mockConnect).not.toHaveBeenCalled();
  });

  // ── DB error handling ────────────────────────────────────────

  test('gracefully handles connect failure', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await load({
      locals: { authenticated: true, userEmail: 'alice@test.com' },
    } as any);

    expect(result.name).toBeNull();
    expect(result.defaultWorkspaceId).toBeNull();
    expect(result.workspaces).toEqual([]);
  });

  test('gracefully handles driver query failure on user query', async () => {
    mockDriverQuery.mockRejectedValueOnce(new Error('Query timeout'));

    const result = await load({
      locals: { authenticated: true, userEmail: 'alice@test.com' },
    } as any);

    expect(result.name).toBeNull();
    expect(result.defaultWorkspaceId).toBeNull();
    expect(result.workspaces).toEqual([]);
  });

  test('gracefully handles driver query failure on workspace list', async () => {
    mockDriverQuery
      .mockResolvedValueOnce([{ name: 'Alice', default_workspace_id: 'workspace:ws_abc' }])
      .mockRejectedValueOnce(new Error('Workspace query failed'));

    const result = await load({
      locals: { authenticated: true, userEmail: 'alice@test.com' },
    } as any);

    // user name was read but workspace list failed
    expect(result.name).toBe('Alice');
    expect(result.defaultWorkspaceId).toBe('ws_abc');
    expect(result.workspaces).toEqual([]);
  });

  // ── SurrealDB record angle bracket parsing ───────────────────

  test('extracts defaultWorkspaceId from record string with angle brackets', async () => {
    mockDriverQuery
      .mockResolvedValueOnce([{ name: 'Charlie', default_workspace_id: '⟨workspace:ch_789⟩' }])
      .mockResolvedValueOnce([]);

    const result = await load({
      locals: { authenticated: true, userEmail: 'charlie@test.com' },
    } as any);

    expect(result.defaultWorkspaceId).toBe('ch_789');
  });

  test('extracts defaultWorkspaceId from record without angle brackets', async () => {
    mockDriverQuery
      .mockResolvedValueOnce([{ name: 'Diana', default_workspace_id: 'workspace:di_999' }])
      .mockResolvedValueOnce([]);

    const result = await load({
      locals: { authenticated: true, userEmail: 'diana@test.com' },
    } as any);

    expect(result.defaultWorkspaceId).toBe('di_999');
  });

  test('extracts workspace slugs from record IDs with angle brackets', async () => {
    mockDriverQuery
      .mockResolvedValueOnce([{ name: 'Eve', default_workspace_id: 'workspace:e_111' }])
      .mockResolvedValueOnce([
        { id: '⟨workspace:e_111⟩', name: 'Eves Space' },
        { id: '⟨workspace:e_222⟩', name: 'Second Space' },
      ]);

    const result = await load({
      locals: { authenticated: true, userEmail: 'eve@test.com' },
    } as any);

    expect(result.workspaces).toEqual([
      { name: 'Eves Space', id: 'e_111' },
      { name: 'Second Space', id: 'e_222' },
    ]);
  });

  test('workspace slug extracted from id without colon falls back to full id', async () => {
    mockDriverQuery
      .mockResolvedValueOnce([{ name: 'Frank', default_workspace_id: 'ws_plain' }])
      .mockResolvedValueOnce([{ id: 'nocolon', name: 'No Colon' }]);

    const result = await load({
      locals: { authenticated: true, userEmail: 'frank@test.com' },
    } as any);

    expect(result.defaultWorkspaceId).toBe('ws_plain');
    expect(result.workspaces).toEqual([{ name: 'No Colon', id: 'nocolon' }]);
  });

  test('workspace slug falls back to empty string when pop returns null/undefined', async () => {
    mockDriverQuery
      .mockResolvedValueOnce([{ name: 'Grace', default_workspace_id: null }])
      .mockResolvedValueOnce([{ id: 'workspace:', name: 'Empty Slug' }]);

    const result = await load({
      locals: { authenticated: true, userEmail: 'grace@test.com' },
    } as any);

    // 'workspace:'.split(':').pop() === ''
    expect(result.workspaces).toEqual([]); // '' is falsy, so filtered by the `if (slug)` check
  });

  // ── Deduplication ─────────────────────────────────────────────

  test('deduplicates workspaces with same slug', async () => {
    mockDriverQuery
      .mockResolvedValueOnce([{ name: 'Hank', default_workspace_id: 'workspace:h_333' }])
      .mockResolvedValueOnce([
        { id: 'workspace:h_333', name: 'Personal' },
        { id: 'workspace:h_333', name: 'Personal Duplicate' },
      ]);

    const result = await load({
      locals: { authenticated: true, userEmail: 'hank@test.com' },
    } as any);

    // Only the first occurrence is kept
    expect(result.workspaces).toHaveLength(1);
    expect(result.workspaces[0]).toEqual({ name: 'Personal', id: 'h_333' });
  });

  // ── Empty / null results ─────────────────────────────────────

  test('handles null userResult gracefully', async () => {
    mockDriverQuery.mockResolvedValueOnce([null]);

    const result = await load({
      locals: { authenticated: true, userEmail: 'ivan@test.com' },
    } as any);

    expect(result.name).toBeNull();
    expect(result.defaultWorkspaceId).toBeNull();
  });

  test('handles undefined workspace result gracefully', async () => {
    mockDriverQuery
      .mockResolvedValueOnce([{ name: 'Ivan', default_workspace_id: 'workspace:i_444' }])
      .mockResolvedValueOnce(undefined);

    const result = await load({
      locals: { authenticated: true, userEmail: 'ivan@test.com' },
    } as any);

    expect(result.name).toBe('Ivan');
    expect(result.workspaces).toEqual([]);
  });

  test('handles null workspace result gracefully', async () => {
    mockDriverQuery
      .mockResolvedValueOnce([{ name: 'Judy', default_workspace_id: 'workspace:j_555' }])
      .mockResolvedValueOnce(null);

    const result = await load({
      locals: { authenticated: true, userEmail: 'judy@test.com' },
    } as any);

    expect(result.workspaces).toEqual([]);
  });

  test('returns empty workspaces list when no workspaces exist', async () => {
    mockDriverQuery
      .mockResolvedValueOnce([{ name: 'Karl', default_workspace_id: 'workspace:k_666' }])
      .mockResolvedValueOnce([]);

    const result = await load({
      locals: { authenticated: true, userEmail: 'karl@test.com' },
    } as any);

    expect(result.workspaces).toEqual([]);
  });

  // ── Query parameter verification ─────────────────────────────

  test('queries user by email', async () => {
    mockDriverQuery
      .mockResolvedValueOnce([{ name: 'Laura', default_workspace_id: 'workspace:l_777' }])
      .mockResolvedValueOnce([]);

    await load({
      locals: { authenticated: true, userEmail: 'laura@test.com' },
    } as any);

    expect(mockDriverQuery).toHaveBeenNthCalledWith(
      1,
      'SELECT name, default_workspace_id FROM users WHERE email = $email',
      { email: 'laura@test.com' },
    );
  });

  test('queries workspaces ordered by name', async () => {
    mockDriverQuery
      .mockResolvedValueOnce([{ name: 'Mike', default_workspace_id: 'workspace:m_888' }])
      .mockResolvedValueOnce([]);

    await load({
      locals: { authenticated: true, userEmail: 'mike@test.com' },
    } as any);

    expect(mockDriverQuery).toHaveBeenNthCalledWith(
      2,
      'SELECT id, name FROM workspaces WHERE deleted_at = none ORDER BY name ASC',
    );
  });
});
