// @vitest-environment node
/**
 * Tests for the workspace-scoped memories page server load function and actions
 * (+page.server.ts).
 *
 * The load function:
 * 1. Takes params.id as workspace ID
 * 2. Verifies workspace exists (404 if not found) via db.query
 * 3. Supports ?q (searchQuery), ?tag, ?offset URL params
 * 4. When activeTag set: uses TagService.unionTags filtered by workspace_id
 * 5. When searchQuery set: uses HybridSearch with workspaceId scope
 * 6. Otherwise: MemoryService.listMemories(workspaceId, { limit, offset })
 * 7. Returns: workspace, memories, allTags, activeTag, hasMore, offset, limit, searchQuery
 *
 * Actions:
 * - create: uses params.id as workspace_id
 * - delete: redirects to /workspaces/[id]/memories
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Hoisted mocks — declared before any vi.mock calls
// =============================================================================

const {
  mockConnect,
  mockDbQuery,
  mockInitialize,
  mockListMemories,
  mockSearch,
  mockListTags,
  mockUnionTags,
  mockGetMemoryTags,
  mockCreateMemory,
  mockDeleteMemory,
  mockError,
  mockFail,
  mockRedirect,
} = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockDbQuery: vi.fn(),
  mockInitialize: vi.fn().mockResolvedValue(undefined),
  mockListMemories: vi.fn(),
  mockSearch: vi.fn(),
  mockListTags: vi.fn(),
  mockUnionTags: vi.fn(),
  mockGetMemoryTags: vi.fn(),
  mockCreateMemory: vi.fn(),
  mockDeleteMemory: vi.fn(),
  mockError: vi.fn((_status: number, message: string) => {
    throw new Error(message);
  }),
  mockFail: vi.fn((status: number, data: unknown) => ({ status, data })),
  mockRedirect: vi.fn((_status: number, _location: string) => {
    throw new Error(`Redirect:${_location}`);
  }),
}));

// =============================================================================
// Module mocks — must match import paths in +page.server.ts
// =============================================================================

vi.mock('$lib/server/db/connection', () => ({
  connect: mockConnect,
  getDB: vi.fn(() => ({ query: mockDbQuery })),
}));

vi.mock('$lib/server/embedder', () => ({
  EmbedderService: vi.fn().mockImplementation(function () {
    return { initialize: mockInitialize };
  }),
}));

vi.mock('$lib/server/services/memory', () => ({
  MemoryService: vi.fn().mockImplementation(function () {
    return {
      listMemories: mockListMemories,
      createMemory: mockCreateMemory,
      deleteMemory: mockDeleteMemory,
    };
  }),
}));

vi.mock('$lib/server/services/tag', () => ({
  TagService: vi.fn().mockImplementation(function () {
    return {
      listTags: mockListTags,
      unionTags: mockUnionTags,
      getMemoryTags: mockGetMemoryTags,
    };
  }),
}));

vi.mock('$lib/server/services/hybrid-search', () => ({
  HybridSearch: vi.fn().mockImplementation(function () {
    return { search: mockSearch };
  }),
}));

vi.mock('../../../../lib/utils/serialization', () => ({
  toPlain: <T>(x: T): T => x,
}));

vi.mock('@sveltejs/kit', () => ({
  error: mockError,
  fail: mockFail,
  redirect: mockRedirect,
}));

// =============================================================================
// Fixtures
// =============================================================================

const sampleWorkspace = {
  id: 'ws_001',
  name: 'Workspace Alpha',
  description: 'The alpha workspace',
  is_personal: false,
};

const sampleMemories = [
  {
    id: 'mem_001',
    slug: 'first',
    name: 'First',
    content: 'Content A',
    memory_type: 'fact',
    workspace_id: 'ws_001',
    created_at: '2026-06-01T00:00:00Z',
  },
  {
    id: 'mem_002',
    slug: 'second',
    name: 'Second',
    content: 'Content B',
    memory_type: 'note',
    workspace_id: 'ws_001',
    created_at: '2026-06-15T00:00:00Z',
  },
];

const sampleTags = [
  { id: 'tag_001', name: 'important' },
  { id: 'tag_002', name: 'reference' },
];

const perMemoryTags: Record<string, Array<{ id: string; name: string }>> = {
  mem_001: [sampleTags[0]],
  mem_002: [sampleTags[1]],
};

// =============================================================================
// Helpers
// =============================================================================

function makeUrl(workspaceId: string, params?: Record<string, string>): URL {
  const qs = params ? new URLSearchParams(params).toString() : '';
  return new URL(`http://localhost:7777/workspaces/${workspaceId}/memories${qs ? '?' + qs : ''}`);
}

// =============================================================================
// Module under test
// =============================================================================

let pageServerModule: any;

beforeEach(async () => {
  vi.clearAllMocks();

  // Default: connect returns a db with query method that returns sample workspace
  mockConnect.mockResolvedValue({ query: mockDbQuery });
  mockDbQuery.mockResolvedValue([sampleWorkspace]);

  pageServerModule = await import('../+page.server');
});

// =============================================================================
// Load function tests
// =============================================================================

describe('Workspace memories page server — load', () => {
  // ── Workspace existence check ────────────────────────────────

  test('load throws 404 when workspace does not exist', async () => {
    mockDbQuery.mockResolvedValueOnce([]);

    await expect(
      pageServerModule.load({
        params: { id: 'nonexistent' },
        url: makeUrl('nonexistent'),
      }),
    ).rejects.toThrow('Workspace not found');

    expect(mockDbQuery).toHaveBeenCalledWith(
      'SELECT id, name, description, is_personal FROM workspaces WHERE id = $id AND deleted_at = none',
      expect.any(Object),
    );
    // RecordId is serialized by SurrealDB client — verify content directly
    expect(mockDbQuery.mock.calls[0][1].id.toString()).toBe('workspaces:nonexistent');
  });

  test('load returns workspace data for existing workspace', async () => {
    mockListTags.mockResolvedValue(sampleTags);
    mockListMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockResolvedValue([]);

    const result = await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001'),
    });

    expect(result.workspace).toEqual(sampleWorkspace);
    expect(mockDbQuery).toHaveBeenCalledWith(
      'SELECT id, name, description, is_personal FROM workspaces WHERE id = $id AND deleted_at = none',
      expect.any(Object),
    );
    expect(mockDbQuery.mock.calls[0][1].id.toString()).toBe('workspaces:ws_001');
  });

  // ── Browse mode (no search, no tag) ─────────────────────────

  test('load returns memories filtered by workspace_id from params', async () => {
    mockListTags.mockResolvedValue(sampleTags);
    mockListMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockResolvedValue([]);

    const result = await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001'),
    });

    expect(mockListMemories).toHaveBeenCalledWith('ws_001', { limit: 20, offset: 0 });
    expect(result.memories).toEqual(sampleMemories.map((m) => ({ ...m, tags: [] })));
  });

  test('load returns default values when no URL params', async () => {
    mockListTags.mockResolvedValue(sampleTags);
    mockListMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockResolvedValue([]);

    const result = await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001'),
    });

    expect(result.workspace).toEqual(sampleWorkspace);
    expect(result.memories).toEqual(sampleMemories.map((m) => ({ ...m, tags: [] })));
    expect(result.allTags).toEqual(sampleTags);
    expect(result.searchQuery).toBeNull();
    expect(result.activeTag).toBeNull();
    expect(result.offset).toBe(0);
    expect(result.limit).toBe(20);
  });

  // ── Search mode ─────────────────────────────────────────────

  test('load returns search results with matched_on when q param is present', async () => {
    const searchResults = [
      { memory: sampleMemories[0], score: 0.95, matched_on: 'vector' as const },
      { memory: sampleMemories[1], score: 0.72, matched_on: 'fulltext' as const },
    ];
    mockListTags.mockResolvedValue(sampleTags);
    mockSearch.mockResolvedValue(searchResults);

    const result = await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001', { q: 'needle' }),
    });

    expect(result.searchQuery).toBe('needle');
    expect(result.memories).toHaveLength(2);
    expect(result.memories[0]).toEqual({ ...sampleMemories[0], matched_on: 'vector', tags: [] });
    expect(result.memories[1]).toEqual({ ...sampleMemories[1], matched_on: 'fulltext', tags: [] });
  });

  test('load passes workspaceId to HybridSearch', async () => {
    mockListTags.mockResolvedValue(sampleTags);
    mockSearch.mockResolvedValue([
      { memory: sampleMemories[0], score: 0.9, matched_on: 'both' as const },
    ]);

    await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001', { q: 'test query' }),
    });

    // HybridSearch should be constructed with the embedder
    const { HybridSearch } = await import('$lib/server/services/hybrid-search');
    expect(HybridSearch).toHaveBeenCalledTimes(1);

    // search() should receive workspaceId and limit
    expect(mockSearch).toHaveBeenCalledWith('test query', {
      workspaceId: 'ws_001',
      limit: 20,
    });
  });

  // ── Tag filter mode ─────────────────────────────────────────

  test('load filters memories by tag with workspace scope', async () => {
    mockListTags.mockResolvedValue(sampleTags);
    mockUnionTags.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockImplementation((id: string) => Promise.resolve(perMemoryTags[id] || []));

    const result = await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001', { tag: 'important' }),
    });

    expect(mockUnionTags).toHaveBeenCalledWith(['important']);
    expect(result.activeTag).toBe('important');
    expect(result.memories).toHaveLength(2);
    // Tag results filtered by workspace_id — our mock returns all as ws_001 so they all pass
  });

  test('load filters tag results to only matching workspace_id', async () => {
    const crossWsMemories = [
      { ...sampleMemories[0], workspace_id: 'ws_001' },
      { ...sampleMemories[1], workspace_id: 'ws_002' },
    ];
    mockListTags.mockResolvedValue(sampleTags);
    mockUnionTags.mockResolvedValue(crossWsMemories);
    mockGetMemoryTags.mockResolvedValue([]);

    const result = await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001', { tag: 'important' }),
    });

    // Only ws_001 memory should survive the filter
    expect(result.memories).toHaveLength(1);
    expect(result.memories[0].id).toBe('mem_001');
  });

  // ── Pagination ──────────────────────────────────────────────

  test('load passes offset param to MemoryService.listMemories', async () => {
    mockListTags.mockResolvedValue(sampleTags);
    mockListMemories.mockResolvedValue(sampleMemories);

    await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001', { offset: '40' }),
    });

    expect(mockListMemories).toHaveBeenCalledWith('ws_001', { limit: 20, offset: 40 });
  });

  test('load returns offset value from URL param', async () => {
    mockListTags.mockResolvedValue(sampleTags);
    mockListMemories.mockResolvedValue(sampleMemories);

    const result = await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001', { offset: '60' }),
    });

    expect(result.offset).toBe(60);
  });

  // ── hasMore behavior ────────────────────────────────────────

  test('hasMore is true when browse mode returns full page of memories', async () => {
    const fullPage = Array.from({ length: 20 }, (_, i) => ({
      ...sampleMemories[0],
      id: `mem_${String(i).padStart(3, '0')}`,
      slug: `mem-${i}`,
      name: `Memory ${i}`,
    }));
    mockListTags.mockResolvedValue(sampleTags);
    mockListMemories.mockResolvedValue(fullPage);

    const result = await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001'),
    });

    expect(result.hasMore).toBe(true);
    expect(result.memories).toHaveLength(20);
  });

  test('hasMore is false when browse mode returns fewer than limit items', async () => {
    mockListTags.mockResolvedValue(sampleTags);
    mockListMemories.mockResolvedValue(sampleMemories);

    const result = await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001'),
    });

    expect(result.hasMore).toBe(false);
    expect(result.memories).toHaveLength(2);
  });

  test('hasMore is false when searchQuery is present', async () => {
    mockListTags.mockResolvedValue(sampleTags);
    mockSearch.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        memory: { ...sampleMemories[0], id: `mem_${i}`, slug: `m${i}`, name: `M${i}` },
        score: 0.5 + i * 0.02,
        matched_on: 'vector' as const,
      })),
    );

    const result = await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001', { q: 'search' }),
    });

    expect(result.hasMore).toBe(false);
    expect(result.memories).toHaveLength(20);
  });

  test('hasMore is false when activeTag is set', async () => {
    mockListTags.mockResolvedValue(sampleTags);
    mockUnionTags.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockResolvedValue([]);

    const result = await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001', { tag: 'important' }),
    });

    expect(result.hasMore).toBe(false);
  });

  // ── Tags attached to memories ───────────────────────────────

  test('load attaches tags to each memory object', async () => {
    mockListTags.mockResolvedValue(sampleTags);
    mockListMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockImplementation((id: string) => Promise.resolve(perMemoryTags[id] || []));

    const result = await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001'),
    });

    expect(result.memories[0].tags).toEqual([sampleTags[0]]);
    expect(result.memories[1].tags).toEqual([sampleTags[1]]);
  });

  test('load attaches empty tags array when getMemoryTags returns nothing', async () => {
    mockListTags.mockResolvedValue(sampleTags);
    mockListMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockResolvedValue([]);

    const result = await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001'),
    });

    expect(result.memories[0].tags).toEqual([]);
    expect(result.memories[1].tags).toEqual([]);
  });

  // ── Search query edge cases ─────────────────────────────────

  test('searchQuery is null when q param is absent', async () => {
    mockListTags.mockResolvedValue(sampleTags);
    mockListMemories.mockResolvedValue(sampleMemories);

    const result = await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001'),
    });

    expect(result.searchQuery).toBeNull();
  });

  test('searchQuery is null when q param is empty string', async () => {
    mockListTags.mockResolvedValue(sampleTags);
    mockListMemories.mockResolvedValue(sampleMemories);

    const result = await pageServerModule.load({
      params: { id: 'ws_001' },
      url: makeUrl('ws_001', { q: '' }),
    });

    expect(result.searchQuery).toBeNull();
  });
});

// =============================================================================
// Actions tests
// =============================================================================

describe('Workspace memories page server — create action', () => {
  test('create action uses workspace_id from params.id', async () => {
    mockCreateMemory.mockResolvedValue(sampleMemories[0]);

    const form = new FormData();
    form.set('name', 'New Memory');
    form.set('content', 'New content');
    form.set('memory_type', 'note');

    const request = new Request('http://localhost:7777/workspaces/ws_001/memories', {
      method: 'POST',
      body: form,
    });

    const result = await pageServerModule.actions.create({
      request,
      params: { id: 'ws_001' },
    });

    expect(mockCreateMemory).toHaveBeenCalledWith({
      name: 'New Memory',
      content: 'New content',
      memory_type: 'note',
      workspace_id: 'ws_001',
    });
    expect(result).toEqual({ success: true, memory: sampleMemories[0] });
  });

  test('create action returns 400 when name is missing', async () => {
    const form = new FormData();
    form.set('name', '');
    form.set('content', 'Content');

    const request = new Request('http://localhost:7777/workspaces/ws_001/memories', {
      method: 'POST',
      body: form,
    });

    const result = await pageServerModule.actions.create({
      request,
      params: { id: 'ws_001' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Name and content are required' });
    expect(result).toEqual({ status: 400, data: { error: 'Name and content are required' } });
  });

  test('create action returns 400 when content is missing', async () => {
    const form = new FormData();
    form.set('name', 'Test');
    form.set('content', '');

    const request = new Request('http://localhost:7777/workspaces/ws_001/memories', {
      method: 'POST',
      body: form,
    });

    const result = await pageServerModule.actions.create({
      request,
      params: { id: 'ws_001' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Name and content are required' });
  });

  test('create action returns 400 when service throws', async () => {
    mockCreateMemory.mockRejectedValue(new Error('Service error'));

    const form = new FormData();
    form.set('name', 'Test');
    form.set('content', 'Content');

    const request = new Request('http://localhost:7777/workspaces/ws_001/memories', {
      method: 'POST',
      body: form,
    });

    const result = await pageServerModule.actions.create({
      request,
      params: { id: 'ws_001' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Service error' });
  });

  test('create action returns generic error when non-Error is thrown', async () => {
    mockCreateMemory.mockRejectedValue('string error');

    const form = new FormData();
    form.set('name', 'Test');
    form.set('content', 'Content');

    const request = new Request('http://localhost:7777/workspaces/ws_001/memories', {
      method: 'POST',
      body: form,
    });

    const result = await pageServerModule.actions.create({
      request,
      params: { id: 'ws_001' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Failed to create memory' });
  });

  // ── has_memory RELATE graph edge (auth path) ─────────────────

  test('create action RELATE query is called when auth active and memory is created', async () => {
    mockDbQuery
      .mockReset()
      .mockResolvedValueOnce([{ id: 'user:abc123' }]) // user lookup
      .mockResolvedValueOnce([{ id: 'workspace:ws_001' }]); // workspace ownership
    mockCreateMemory.mockResolvedValue(sampleMemories[0]);

    const form = new FormData();
    form.set('name', 'Test');
    form.set('content', 'Content');

    const request = new Request('http://localhost:7777/workspaces/ws_001/memories', {
      method: 'POST',
      body: form,
    });

    const result = await pageServerModule.actions.create({
      request,
      params: { id: 'ws_001' },
      locals: { userEmail: 'user@test.com' },
    });

    // Hoisted userRow gets the user lookup id — RELATE uses it
    expect(mockDbQuery).toHaveBeenCalledTimes(3);
    expect(mockDbQuery).toHaveBeenNthCalledWith(3, 'RELATE $userId -> has_memory -> $memoryId', {
      userId: 'user:abc123',
      memoryId: 'mem_001',
    });
    expect(result).toEqual({ success: true, memory: sampleMemories[0] });
  });

  test('create action RELATE query is NOT called when auth is disabled', async () => {
    mockCreateMemory.mockResolvedValue(sampleMemories[0]);

    const form = new FormData();
    form.set('name', 'Test');
    form.set('content', 'Content');

    const request = new Request('http://localhost:7777/workspaces/ws_001/memories', {
      method: 'POST',
      body: form,
    });

    const result = await pageServerModule.actions.create({
      request,
      params: { id: 'ws_001' },
      // No locals — auth disabled, userRow stays undefined
    });

    expect(mockDbQuery).not.toHaveBeenCalledWith(
      'RELATE $userId -> has_memory -> $memoryId',
      expect.anything(),
    );
    expect(result).toEqual({ success: true, memory: sampleMemories[0] });
  });

  test('create action RELATE query is NOT called when memory creation fails (caught by try/catch)', async () => {
    mockDbQuery
      .mockReset()
      .mockResolvedValueOnce([{ id: 'user:abc123' }]) // user lookup
      .mockResolvedValueOnce([{ id: 'workspace:ws_001' }]); // workspace ownership
    mockCreateMemory.mockRejectedValue(new Error('Service error'));

    const form = new FormData();
    form.set('name', 'Test');
    form.set('content', 'Content');

    const request = new Request('http://localhost:7777/workspaces/ws_001/memories', {
      method: 'POST',
      body: form,
    });

    const result = await pageServerModule.actions.create({
      request,
      params: { id: 'ws_001' },
      locals: { userEmail: 'user@test.com' },
    });

    // 2 calls: user lookup + workspace check. No RELATE because createMemory failed.
    expect(mockDbQuery).toHaveBeenCalledTimes(2);
    expect(mockDbQuery).not.toHaveBeenCalledWith(
      'RELATE $userId -> has_memory -> $memoryId',
      expect.anything(),
    );
    expect(result).toEqual({ status: 400, data: { error: 'Service error' } });
  });
});

describe('Workspace memories page server — delete action', () => {
  test('delete action calls deleteMemory and redirects to workspace memories', async () => {
    mockDeleteMemory.mockResolvedValue(undefined);
    mockRedirect.mockImplementation((_status: number, _location: string) => {
      throw new Error(`Redirect:${_location}`);
    });

    const form = new FormData();
    form.set('id', 'mem_001');
    const request = new Request('http://localhost:7777/workspaces/ws_001/memories', {
      method: 'POST',
      body: form,
    });

    await expect(
      pageServerModule.actions.delete({
        request,
        params: { id: 'ws_001' },
      }),
    ).rejects.toThrow('Redirect:/workspaces/ws_001/memories');

    expect(mockDeleteMemory).toHaveBeenCalledWith('mem_001', 'ws_001');
    expect(mockRedirect).toHaveBeenCalledWith(303, '/workspaces/ws_001/memories');
  });

  test('delete action returns 400 when id is missing', async () => {
    const form = new FormData();
    form.set('id', '');
    const request = new Request('http://localhost:7777/workspaces/ws_001/memories', {
      method: 'POST',
      body: form,
    });

    const result = await pageServerModule.actions.delete({
      request,
      params: { id: 'ws_001' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Memory ID is required' });
  });

  test('delete action returns 400 when service throws', async () => {
    mockDeleteMemory.mockRejectedValue(new Error('Delete failed'));

    const form = new FormData();
    form.set('id', 'mem_001');
    const request = new Request('http://localhost:7777/workspaces/ws_001/memories', {
      method: 'POST',
      body: form,
    });

    const result = await pageServerModule.actions.delete({
      request,
      params: { id: 'ws_001' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Delete failed' });
  });
});
