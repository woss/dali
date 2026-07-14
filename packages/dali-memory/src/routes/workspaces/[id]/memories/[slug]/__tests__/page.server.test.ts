// @vitest-environment node
/**
 * Tests for the workspace-scoped memory detail page server load function and actions
 * (+page.server.ts).
 *
 * Load:
 * 1. Verifies workspace exists via db.query (404 if not found)
 * 2. Loads memory by slug via MemoryService.getMemory (404 if not found)
 * 3. Verifies memory.workspace_id matches params.id (404 if mismatch)
 * 4. Loads tags via TagService.getMemoryTags
 * 5. Returns workspace, memory, tags
 *
 * Actions:
 * - edit: workspace membership check, validation, updateMemory
 * - delete: deletes memory, redirects to workspace list
 * - add_tag: workspace membership check, find-or-create tags, relate
 * - remove_tag: workspace membership check, remove relation
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Hoisted mocks — declared before any vi.mock calls
// =============================================================================

const {
  mockConnect,
  mockDbQuery,
  mockInitialize,
  mockGetMemory,
  mockUpdateMemory,
  mockDeleteMemory,
  mockGetMemoryTags,
  mockFindByName,
  mockCreateTag,
  mockAddTagToMemory,
  mockRemoveTagFromMemory,
  mockError,
  mockFail,
  mockRedirect,
} = vi.hoisted(() => ({
  mockConnect: vi.fn().mockResolvedValue({ query: vi.fn() }),
  mockDbQuery: vi.fn(),
  mockInitialize: vi.fn().mockResolvedValue(undefined),
  mockGetMemory: vi.fn(),
  mockUpdateMemory: vi.fn(),
  mockDeleteMemory: vi.fn(),
  mockGetMemoryTags: vi.fn(),
  mockFindByName: vi.fn(),
  mockCreateTag: vi.fn(),
  mockAddTagToMemory: vi.fn(),
  mockRemoveTagFromMemory: vi.fn(),
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
}));

vi.mock('$lib/server/embedder', () => ({
  EmbedderService: vi.fn().mockImplementation(function () {
    return { initialize: mockInitialize };
  }),
}));

vi.mock('$lib/server/services/memory', () => ({
  MemoryService: vi.fn().mockImplementation(function () {
    return {
      getMemory: mockGetMemory,
      updateMemory: mockUpdateMemory,
      deleteMemory: mockDeleteMemory,
    };
  }),
}));

vi.mock('$lib/server/services/tag', () => ({
  TagService: vi.fn().mockImplementation(function () {
    return {
      getMemoryTags: mockGetMemoryTags,
      findByName: mockFindByName,
      createTag: mockCreateTag,
      addTagToMemory: mockAddTagToMemory,
      removeTagFromMemory: mockRemoveTagFromMemory,
    };
  }),
}));

vi.mock('../../../../../../lib/utils/serialization', () => ({
  toPlain: <T>(x: T): T => x,
}));

vi.mock('$lib/server/logger', () => ({
  createLogger: vi.fn(() => ({
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@sveltejs/kit', () => ({
  error: mockError,
  fail: mockFail,
  redirect: mockRedirect,
}));

// Generated SvelteKit types — type-only, stub is sufficient
vi.mock('../$types', () => ({}));

// =============================================================================
// Fixtures
// =============================================================================

const sampleWorkspace = {
  id: 'ws_001',
  name: 'Workspace Alpha',
  description: 'The alpha workspace',
  is_personal: false,
};

const sampleMemory = {
  id: 'mem_abc123',
  slug: 'test-memory',
  name: 'Test Memory',
  content: 'Test content',
  memory_type: 'note',
  workspace_id: 'ws_001',
  created_at: '2026-01-01T00:00:00Z',
};

const sampleTags = [
  { id: 'tag_001', name: 'important' },
  { id: 'tag_002', name: 'reference' },
];

// =============================================================================
// Helpers
// =============================================================================

function createEditRequest(overrides?: { name?: string; content?: string; id?: string }): Request {
  const form = new FormData();
  form.set('name', overrides?.name ?? 'Updated Name');
  form.set('content', overrides?.content ?? 'Updated content');
  return new Request('http://localhost:7777/workspaces/ws_001/memories/test-memory', {
    method: 'POST',
    body: form,
  });
}

function createDeleteRequest(overrides?: { id?: string }): Request {
  const form = new FormData();
  form.set('id', overrides?.id ?? 'mem_abc123');
  return new Request('http://localhost:7777/workspaces/ws_001/memories/test-memory', {
    method: 'POST',
    body: form,
  });
}

function createAddTagRequest(overrides?: { tag_name?: string }): Request {
  const form = new FormData();
  form.set('tag_name', overrides?.tag_name ?? 'important');
  return new Request('http://localhost:7777/workspaces/ws_001/memories/test-memory', {
    method: 'POST',
    body: form,
  });
}

function createRemoveTagRequest(overrides?: { tag_id?: string }): Request {
  const form = new FormData();
  form.set('tag_id', overrides?.tag_id ?? 'tag_001');
  return new Request('http://localhost:7777/workspaces/ws_001/memories/test-memory', {
    method: 'POST',
    body: form,
  });
}

// =============================================================================
// Module under test — imported dynamically so mocks apply first
// =============================================================================

let pageServerModule: any;

beforeEach(async () => {
  vi.clearAllMocks();

  // Default: connect returns a db with query method
  mockConnect.mockResolvedValue({ query: mockDbQuery });
  mockDbQuery.mockResolvedValue([sampleWorkspace]);

  pageServerModule = await import('../+page.server');
});

// =============================================================================
// Load function tests
// =============================================================================

describe('Workspace memory detail page — load', () => {
  test('returns workspace, memory, and tags for valid workspace and slug', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);
    mockGetMemoryTags.mockResolvedValue(sampleTags);

    const result = await pageServerModule.load({
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM workspaces'),
      expect.any(Object),
    );
    expect(mockDbQuery.mock.calls[0][1].id.toString()).toBe('workspaces:ws_001');
    expect(mockGetMemory).toHaveBeenCalledWith('test-memory');
    expect(mockGetMemoryTags).toHaveBeenCalledWith(sampleMemory.id);

    expect(result.workspace).toEqual(sampleWorkspace);
    expect(result.memory).toEqual(sampleMemory);
    expect(result.tags).toEqual(sampleTags);
  });

  test('throws 404 when workspace does not exist', async () => {
    mockDbQuery.mockResolvedValueOnce([]);

    await expect(
      pageServerModule.load({
        params: { id: 'nonexistent', slug: 'test-memory' },
      }),
    ).rejects.toThrow('Workspace not found');

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM workspaces'),
      expect.any(Object),
    );
    expect(mockDbQuery.mock.calls[0][1].id.toString()).toBe('workspaces:nonexistent');
    // Should not proceed to memory lookup
    expect(mockGetMemory).not.toHaveBeenCalled();
  });

  test('throws 404 when memory slug does not exist', async () => {
    mockGetMemory.mockResolvedValue(null);

    await expect(
      pageServerModule.load({
        params: { id: 'ws_001', slug: 'nonexistent-slug' },
      }),
    ).rejects.toThrow('Memory not found');

    expect(mockGetMemory).toHaveBeenCalledWith('nonexistent-slug');
    // Should not proceed to tag lookup
    expect(mockGetMemoryTags).not.toHaveBeenCalled();
  });

  test('throws 404 when memory workspace_id does not match params.id', async () => {
    const otherWorkspaceMemory = { ...sampleMemory, workspace_id: 'ws_002' };
    mockGetMemory.mockResolvedValue(otherWorkspaceMemory);

    await expect(
      pageServerModule.load({
        params: { id: 'ws_001', slug: 'test-memory' },
      }),
    ).rejects.toThrow('Memory not found in this workspace');

    expect(mockGetMemory).toHaveBeenCalledWith('test-memory');
    // Should not proceed to tag lookup
    expect(mockGetMemoryTags).not.toHaveBeenCalled();
  });

  test('passes memory ID as string to TagService', async () => {
    const memoryWithNumberId = { ...sampleMemory, id: 12345 };
    mockGetMemory.mockResolvedValue(memoryWithNumberId);
    mockGetMemoryTags.mockResolvedValue([]);

    await pageServerModule.load({
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockGetMemoryTags).toHaveBeenCalledWith('12345');
  });
});

// =============================================================================
// Actions — edit
// =============================================================================

describe('Workspace memory detail page — edit action', () => {
  test('missing name returns fail 400', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);

    const result = await pageServerModule.actions.edit({
      request: createEditRequest({ name: '' }),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Name and content are required' });
    expect(result).toEqual({
      status: 400,
      data: { error: 'Name and content are required' },
    });
  });

  test('missing content returns fail 400', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);

    const result = await pageServerModule.actions.edit({
      request: createEditRequest({ content: '' }),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Name and content are required' });
  });

  test('memory not found returns fail 404', async () => {
    mockGetMemory.mockResolvedValue(null);

    const result = await pageServerModule.actions.edit({
      request: createEditRequest(),
      params: { id: 'ws_001', slug: 'nonexistent' },
    });

    expect(mockFail).toHaveBeenCalledWith(404, { error: 'Memory not found' });
    expect(result).toEqual({
      status: 404,
      data: { error: 'Memory not found' },
    });
  });

  test('workspace membership mismatch returns fail 404', async () => {
    mockGetMemory.mockResolvedValue({ ...sampleMemory, workspace_id: 'ws_002' });

    const result = await pageServerModule.actions.edit({
      request: createEditRequest(),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(404, { error: 'Memory not found in this workspace' });
    expect(result).toEqual({
      status: 404,
      data: { error: 'Memory not found in this workspace' },
    });
  });

  test('valid edit calls updateMemory and returns success', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);

    const result = await pageServerModule.actions.edit({
      request: createEditRequest({ name: 'Updated Name', content: 'Updated content' }),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockUpdateMemory).toHaveBeenCalledWith('test-memory', {
      name: 'Updated Name',
      content: 'Updated content',
    });
    expect(result).toEqual({ success: true, action: 'edit' });
  });

  test('updateMemory throws returns fail 400', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);
    mockUpdateMemory.mockRejectedValueOnce(new Error('DB error'));

    const result = await pageServerModule.actions.edit({
      request: createEditRequest(),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'DB error' });
    expect(result).toEqual({
      status: 400,
      data: { error: 'DB error' },
    });
  });

  test('updateMemory throws non-Error returns generic error message', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);
    mockUpdateMemory.mockRejectedValueOnce('string error');

    const result = await pageServerModule.actions.edit({
      request: createEditRequest(),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Failed to update memory' });
  });
});

// =============================================================================
// Actions — delete
// =============================================================================

describe('Workspace memory detail page — delete action', () => {
  test('memory not found returns fail 404', async () => {
    mockGetMemory.mockResolvedValueOnce(undefined);

    const result = await pageServerModule.actions.delete({
      request: createDeleteRequest({ id: 'mem_abc123' }),
      params: { id: 'ws_001', slug: 'nonexistent' },
    });

    expect(mockFail).toHaveBeenCalledWith(404, { error: 'Memory not found' });
    expect(result).toEqual({
      status: 404,
      data: { error: 'Memory not found' },
    });
  });

  test('workspace membership mismatch returns fail 404', async () => {
    mockGetMemory.mockResolvedValueOnce({ ...sampleMemory, workspace_id: 'ws_002' });

    const result = await pageServerModule.actions.delete({
      request: createDeleteRequest({ id: 'mem_abc123' }),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(404, {
      error: 'Memory not found in this workspace',
    });
    expect(result).toEqual({
      status: 404,
      data: { error: 'Memory not found in this workspace' },
    });
  });

  test('valid delete calls deleteMemory with slug and redirects', async () => {
    mockGetMemory.mockResolvedValueOnce(sampleMemory);

    await expect(
      pageServerModule.actions.delete({
        request: createDeleteRequest({ id: 'mem_abc123' }),
        params: { id: 'ws_001', slug: 'test-memory' },
      }),
    ).rejects.toThrow('Redirect:/workspaces/ws_001/memories');

    expect(mockDeleteMemory).toHaveBeenCalledWith('test-memory');
    expect(mockRedirect).toHaveBeenCalledWith(303, '/workspaces/ws_001/memories');
  });

  test('deleteMemory throws returns fail 400', async () => {
    mockGetMemory.mockResolvedValueOnce(sampleMemory);
    mockDeleteMemory.mockRejectedValueOnce(new Error('Delete failed'));

    const result = await pageServerModule.actions.delete({
      request: createDeleteRequest({ id: 'mem_abc123' }),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Delete failed' });
    expect(result).toEqual({
      status: 400,
      data: { error: 'Delete failed' },
    });
  });

  test('deleteMemory throws non-Error returns generic error message', async () => {
    mockGetMemory.mockResolvedValueOnce(sampleMemory);
    mockDeleteMemory.mockRejectedValueOnce('string error');

    const result = await pageServerModule.actions.delete({
      request: createDeleteRequest({ id: 'mem_abc123' }),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Failed to delete memory' });
  });
});

// =============================================================================
// Actions — add_tag
// =============================================================================

describe('Workspace memory detail page — add_tag action', () => {
  test('missing tag_name returns fail 400', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);

    const result = await pageServerModule.actions.add_tag({
      request: createAddTagRequest({ tag_name: '' }),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'At least one tag name is required' });
    expect(result).toEqual({
      status: 400,
      data: { error: 'At least one tag name is required' },
    });
  });

  test('whitespace-only tag_name returns fail 400', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);

    const result = await pageServerModule.actions.add_tag({
      request: createAddTagRequest({ tag_name: '   ' }),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'At least one tag name is required' });
  });

  test('memory not found returns fail 404', async () => {
    mockGetMemory.mockResolvedValue(null);

    const result = await pageServerModule.actions.add_tag({
      request: createAddTagRequest(),
      params: { id: 'ws_001', slug: 'nonexistent' },
    });

    expect(mockFail).toHaveBeenCalledWith(404, { error: 'Memory not found' });
    expect(result).toEqual({
      status: 404,
      data: { error: 'Memory not found' },
    });
  });

  test('workspace membership mismatch returns fail 404', async () => {
    mockGetMemory.mockResolvedValue({ ...sampleMemory, workspace_id: 'ws_002' });

    const result = await pageServerModule.actions.add_tag({
      request: createAddTagRequest(),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(404, { error: 'Memory not found in this workspace' });
    expect(result).toEqual({
      status: 404,
      data: { error: 'Memory not found in this workspace' },
    });
  });

  test('existing tag — find-or-creates and relates to memory', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);
    mockFindByName.mockResolvedValue({ id: 'tag_001', name: 'important' });

    const result = await pageServerModule.actions.add_tag({
      request: createAddTagRequest({ tag_name: 'important' }),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFindByName).toHaveBeenCalledWith('important');
    expect(mockCreateTag).not.toHaveBeenCalled();
    expect(mockAddTagToMemory).toHaveBeenCalledWith(sampleMemory.id, 'tag_001');
    expect(result).toEqual({ success: true });
  });

  test('new tag — creates tag and relates to memory', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);
    mockFindByName.mockResolvedValue(null);
    mockCreateTag.mockResolvedValue({ id: 'tag_new', name: 'newtag' });

    const result = await pageServerModule.actions.add_tag({
      request: createAddTagRequest({ tag_name: 'newtag' }),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFindByName).toHaveBeenCalledWith('newtag');
    expect(mockCreateTag).toHaveBeenCalledWith('newtag');
    expect(mockAddTagToMemory).toHaveBeenCalledWith(sampleMemory.id, 'tag_new');
    expect(result).toEqual({ success: true });
  });

  test('TagService throws returns fail 400 with message', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);
    mockAddTagToMemory.mockRejectedValueOnce(new Error('DB timeout'));

    const result = await pageServerModule.actions.add_tag({
      request: createAddTagRequest(),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'DB timeout' });
    expect(result).toEqual({
      status: 400,
      data: { error: 'DB timeout' },
    });
  });

  test('TagService throws non-Error returns generic error message', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);
    mockAddTagToMemory.mockRejectedValueOnce('string error');

    const result = await pageServerModule.actions.add_tag({
      request: createAddTagRequest(),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Failed to add tag' });
  });

  test('comma-separated tags create multiple tags', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);
    mockAddTagToMemory.mockReset();
    mockFindByName.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockCreateTag
      .mockResolvedValueOnce({ id: 'tag_a', name: 'alpha' })
      .mockResolvedValueOnce({ id: 'tag_b', name: 'beta' });

    const result = await pageServerModule.actions.add_tag({
      request: createAddTagRequest({ tag_name: 'alpha,beta' }),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFindByName).toHaveBeenCalledTimes(2);
    expect(mockFindByName).toHaveBeenNthCalledWith(1, 'alpha');
    expect(mockFindByName).toHaveBeenNthCalledWith(2, 'beta');
    expect(mockCreateTag).toHaveBeenCalledTimes(2);
    expect(mockAddTagToMemory).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true });
  });

  test('tags with extra spaces are trimmed correctly', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);
    mockAddTagToMemory.mockReset();
    mockFindByName
      .mockResolvedValueOnce({ id: 'tag_a', name: 'hello' })
      .mockResolvedValueOnce({ id: 'tag_b', name: 'world' });

    const result = await pageServerModule.actions.add_tag({
      request: createAddTagRequest({ tag_name: '  hello , world  ' }),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFindByName).toHaveBeenCalledTimes(2);
    expect(mockFindByName).toHaveBeenNthCalledWith(1, 'hello');
    expect(mockFindByName).toHaveBeenNthCalledWith(2, 'world');
    expect(mockAddTagToMemory).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true });
  });

  test('only commas returns fail 400', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);

    const result = await pageServerModule.actions.add_tag({
      request: createAddTagRequest({ tag_name: ', , ' }),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'At least one tag name is required' });
    expect(result).toEqual({
      status: 400,
      data: { error: 'At least one tag name is required' },
    });
  });
});

// =============================================================================
// Actions — remove_tag
// =============================================================================

describe('Workspace memory detail page — remove_tag action', () => {
  test('missing tag_id returns fail 400', async () => {
    const result = await pageServerModule.actions.remove_tag({
      request: createRemoveTagRequest({ tag_id: '' }),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Tag ID is required' });
    expect(result).toEqual({
      status: 400,
      data: { error: 'Tag ID is required' },
    });
  });

  test('memory not found returns fail 404', async () => {
    mockGetMemory.mockResolvedValue(null);

    const result = await pageServerModule.actions.remove_tag({
      request: createRemoveTagRequest(),
      params: { id: 'ws_001', slug: 'nonexistent' },
    });

    expect(mockFail).toHaveBeenCalledWith(404, { error: 'Memory not found' });
    expect(result).toEqual({
      status: 404,
      data: { error: 'Memory not found' },
    });
  });

  test('workspace membership mismatch returns fail 404', async () => {
    mockGetMemory.mockResolvedValue({ ...sampleMemory, workspace_id: 'ws_002' });

    const result = await pageServerModule.actions.remove_tag({
      request: createRemoveTagRequest(),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(404, { error: 'Memory not found in this workspace' });
    expect(result).toEqual({
      status: 404,
      data: { error: 'Memory not found in this workspace' },
    });
  });

  test('valid request removes tag and returns success', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);

    const result = await pageServerModule.actions.remove_tag({
      request: createRemoveTagRequest({ tag_id: 'tag_001' }),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockRemoveTagFromMemory).toHaveBeenCalledWith(sampleMemory.id, 'tag_001');
    expect(result).toEqual({ success: true });
  });

  test('TagService throws Error returns fail 400 with message', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);
    mockRemoveTagFromMemory.mockRejectedValueOnce(new Error('Relation not found'));

    const result = await pageServerModule.actions.remove_tag({
      request: createRemoveTagRequest(),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Relation not found' });
    expect(result).toEqual({
      status: 400,
      data: { error: 'Relation not found' },
    });
  });

  test('TagService throws non-Error returns generic error message', async () => {
    mockGetMemory.mockResolvedValue(sampleMemory);
    mockRemoveTagFromMemory.mockRejectedValueOnce('string error');

    const result = await pageServerModule.actions.remove_tag({
      request: createRemoveTagRequest(),
      params: { id: 'ws_001', slug: 'test-memory' },
    });

    expect(mockFail).toHaveBeenCalledWith(400, { error: 'Failed to remove tag' });
  });
});
