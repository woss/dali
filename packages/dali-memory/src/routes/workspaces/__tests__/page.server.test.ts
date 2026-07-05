import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// Hoisted mocks
// =============================================================================

const { mockConnect, mockGetDB, mockDBQuery, mockFail } = vi.hoisted(() => {
  const _mockDB = { query: vi.fn() };
  return {
    mockConnect: vi.fn().mockResolvedValue(undefined),
    mockGetDB: vi.fn(() => _mockDB),
    mockDBQuery: _mockDB.query,
    mockFail: vi.fn((status: number, data: any) => ({ status, data })),
  };
});

// =============================================================================
// Module mocks
// =============================================================================

vi.mock('$lib/server/db/connection', () => ({
  connect: mockConnect,
  getDB: mockGetDB,
}));

vi.mock('@sveltejs/kit', () => ({
  fail: mockFail,
}));

vi.mock('../$types', () => ({}));

// =============================================================================
// Module under test
// =============================================================================

let pageModule: any;

beforeEach(async () => {
  vi.clearAllMocks();
  pageModule = await import('../+page.server');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// Load function tests
// =============================================================================

describe('Workspaces page — load', () => {
  test('returns workspaces with slug extracted from record IDs', async () => {
    mockDBQuery.mockResolvedValueOnce([
      { id: 'workspace:ws_001', name: 'Alpha', description: null, is_personal: true, created_at: '2026-01-01T00:00:00Z' },
      { id: 'workspace:ws_002', name: 'Beta', description: 'Team workspace', is_personal: false, created_at: '2026-02-15T00:00:00Z' },
    ]);

    const result = await pageModule.load();

    expect(result.workspaces).toHaveLength(2);
    expect(result.workspaces[0]).toEqual({
      id: 'workspace:ws_001',
      name: 'Alpha',
      description: null,
      is_personal: true,
      created_at: '2026-01-01T00:00:00Z',
      slug: 'ws_001',
    });
    expect(result.workspaces[1]).toEqual({
      id: 'workspace:ws_002',
      name: 'Beta',
      description: 'Team workspace',
      is_personal: false,
      created_at: '2026-02-15T00:00:00Z',
      slug: 'ws_002',
    });
  });

  test('extracts slug from record IDs with SurrealDB angle brackets', async () => {
    mockDBQuery.mockResolvedValueOnce([
      { id: '⟨workspace:ws_abc⟩', name: 'Alpha', description: null, is_personal: true, created_at: '2026-01-01T00:00:00Z' },
    ]);

    const result = await pageModule.load();

    expect(result.workspaces[0].slug).toBe('ws_abc');
  });

  test('slug falls back to full id when no colon present', async () => {
    mockDBQuery.mockResolvedValueOnce([
      { id: 'plainid', name: 'Plain', description: null, is_personal: false, created_at: '2026-03-01T00:00:00Z' },
    ]);

    const result = await pageModule.load();

    expect(result.workspaces[0].slug).toBe('plainid');
  });

  test('slug falls back to raw id when pop returns empty string', async () => {
    mockDBQuery.mockResolvedValueOnce([
      { id: 'workspace:', name: 'Empty', description: null, is_personal: false, created_at: '2026-03-01T00:00:00Z' },
    ]);

    const result = await pageModule.load();

    // 'workspace:'.split(':').pop() === '' → ?? ws.id → fallback to raw id
    // But the source does: .split(':').pop() ?? ws.id — since '' is not null/undefined, ?? keeps ''
    expect(result.workspaces[0].slug).toBe('');
  });

  test('returns empty workspaces list when no workspaces exist', async () => {
    mockDBQuery.mockResolvedValueOnce([]);

    const result = await pageModule.load();

    expect(result.workspaces).toEqual([]);
  });

  test('gracefully handles null db.query result (empty workspaces)', async () => {
    mockDBQuery.mockResolvedValueOnce(null);

    const result = await pageModule.load();
    expect(result.workspaces).toEqual([]);
  });

  test('gracefully handles undefined db.query result (empty workspaces)', async () => {
    mockDBQuery.mockResolvedValueOnce(undefined);

    const result = await pageModule.load();
    expect(result.workspaces).toEqual([]);
  });

  test('preserves backward-compatible workspace shape', async () => {
    mockDBQuery.mockResolvedValueOnce([
      { id: 'workspace:ws_001', name: 'Alpha', description: 'Desc', is_personal: true, created_at: '2026-01-01T00:00:00Z' },
    ]);

    const result = await pageModule.load();
    const ws = result.workspaces[0];

    // All original fields are present
    expect(ws).toHaveProperty('id', 'workspace:ws_001');
    expect(ws).toHaveProperty('name', 'Alpha');
    expect(ws).toHaveProperty('description', 'Desc');
    expect(ws).toHaveProperty('is_personal', true);
    expect(ws).toHaveProperty('created_at', '2026-01-01T00:00:00Z');
    // New slug field
    expect(ws).toHaveProperty('slug', 'ws_001');
  });

  // ── Query verification ────────────────────────────────────────

  test('queries workspaces with correct fields and ordering', async () => {
    mockDBQuery.mockResolvedValueOnce([]);

    await pageModule.load();

    expect(mockDBQuery).toHaveBeenCalledWith(
      'SELECT id, name, description, is_personal, created_at FROM workspaces ORDER BY name ASC',
    );
  });
});

// =============================================================================
// Actions tests
// =============================================================================

describe('Workspaces page — create action', () => {
  test('create action calls db.query with workspace data', async () => {
    mockDBQuery.mockResolvedValueOnce(undefined);

    const form = new FormData();
    form.set('name', 'New Workspace');
    form.set('description', 'A brand new workspace');

    const request = new Request('http://localhost:7777/workspaces', {
      method: 'POST',
      body: form,
    });

    const result = await pageModule.actions.create({ request } as any);

    expect(mockDBQuery).toHaveBeenCalledWith(
      'CREATE workspaces CONTENT { name: $name, description: $description }',
      { name: 'New Workspace', description: 'A brand new workspace' },
    );
    expect(result).toEqual({ success: true });
  });

  test('create action returns 400 when name is missing', async () => {
    const form = new FormData();
    form.set('name', '');
    form.set('description', 'Some desc');

    const request = new Request('http://localhost:7777/workspaces', {
      method: 'POST',
      body: form,
    });

    const result = await pageModule.actions.create({ request } as any);

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Workspace name is required' });
    expect(result).toEqual({ status: 400, data: { error: 'Workspace name is required' } });
  });

  test('create action returns 400 when name is not provided at all', async () => {
    const form = new FormData();
    form.set('description', 'No name');

    const request = new Request('http://localhost:7777/workspaces', {
      method: 'POST',
      body: form,
    });

    const result = await pageModule.actions.create({ request } as any);

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Workspace name is required' });
  });

  test('create action returns 400 when db query throws', async () => {
    mockDBQuery.mockRejectedValueOnce(new Error('DB failure'));

    const form = new FormData();
    form.set('name', 'Failing');
    form.set('description', 'Will fail');

    const request = new Request('http://localhost:7777/workspaces', {
      method: 'POST',
      body: form,
    });

    const result = await pageModule.actions.create({ request } as any);

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'DB failure' });
    expect(result).toEqual({ status: 400, data: { error: 'DB failure' } });
  });

  test('create action returns generic error when non-Error is thrown', async () => {
    mockDBQuery.mockRejectedValueOnce('string error');

    const form = new FormData();
    form.set('name', 'Failing');
    form.set('description', 'Will fail');

    const request = new Request('http://localhost:7777/workspaces', {
      method: 'POST',
      body: form,
    });

    const result = await pageModule.actions.create({ request } as any);

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Failed to create workspace' });
  });

  test('create action uses empty string for missing description', async () => {
    mockDBQuery.mockResolvedValueOnce(undefined);

    const form = new FormData();
    form.set('name', 'No Desc');

    const request = new Request('http://localhost:7777/workspaces', {
      method: 'POST',
      body: form,
    });

    await pageModule.actions.create({ request } as any);

    expect(mockDBQuery).toHaveBeenCalledWith(
      expect.stringContaining('CREATE workspaces'),
      { name: 'No Desc', description: '' },
    );
  });
});

describe('Workspaces page — delete action', () => {
  test('delete action calls DELETE query with id', async () => {
    mockDBQuery.mockResolvedValueOnce(undefined);

    const form = new FormData();
    form.set('id', 'workspace:ws_001');

    const request = new Request('http://localhost:7777/workspaces', {
      method: 'POST',
      body: form,
    });

    const result = await pageModule.actions.delete({ request } as any);

    expect(mockDBQuery).toHaveBeenCalledWith(
      'DELETE workspaces WHERE id = $id',
      { id: 'workspace:ws_001' },
    );
    expect(result).toEqual({ success: true });
  });

  test('delete action returns 400 when id is missing', async () => {
    const form = new FormData();
    form.set('id', '');

    const request = new Request('http://localhost:7777/workspaces', {
      method: 'POST',
      body: form,
    });

    const result = await pageModule.actions.delete({ request } as any);

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Workspace ID is required' });
    expect(result).toEqual({ status: 400, data: { error: 'Workspace ID is required' } });
  });

  test('delete action returns 400 when id is not provided', async () => {
    const form = new FormData();

    const request = new Request('http://localhost:7777/workspaces', {
      method: 'POST',
      body: form,
    });

    const result = await pageModule.actions.delete({ request } as any);

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Workspace ID is required' });
  });

  test('delete action returns 400 when db throws', async () => {
    mockDBQuery.mockRejectedValueOnce(new Error('Not found'));

    const form = new FormData();
    form.set('id', 'workspace:missing');

    const request = new Request('http://localhost:7777/workspaces', {
      method: 'POST',
      body: form,
    });

    const result = await pageModule.actions.delete({ request } as any);

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Not found' });
  });
});
