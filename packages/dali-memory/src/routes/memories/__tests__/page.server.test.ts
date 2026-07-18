// @vitest-environment node
/**
 * Tests for the global memories page server load function (+page.server.ts).
 *
 * The load function:
 * 1. Calls MemoryService.listAllMemories() (no workspace filter)
 * 2. Supports ?tag URL param for filtering by tag
 * 3. Fetches tags for each memory via TagService.getMemoryTags
 * 4. Batch-fetches workspace names for distinct workspace_ids via db.query
 * 5. Normalizes workspace_id to bare string for URL-safe serialization
 * 6. Returns: memories, allTags, workspaceNames, activeTag
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Hoisted mocks
// =============================================================================

const {
  mockConnect,
  mockDbQuery,
  mockInitialize,
  mockListAllMemories,
  mockListTags,
  mockUnionTags,
  mockGetMemoryTags,
} = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockDbQuery: vi.fn(),
  mockInitialize: vi.fn().mockResolvedValue(undefined),
  mockListAllMemories: vi.fn(),
  mockListTags: vi.fn(),
  mockUnionTags: vi.fn(),
  mockGetMemoryTags: vi.fn(),
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
      listAllMemories: mockListAllMemories,
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

vi.mock('../../../lib/utils/serialization', () => ({
  toPlain: <T>(x: T): T => x,
}));

// =============================================================================
// Fixtures
// =============================================================================

/** workspace_id as RecordId-like object with .id property */
const wsAlphaId = { id: 'ws_001' };
const wsBetaId = { id: 'ws_002' };

/** RecordId-like: toString() returns qualified string as surrealdb RecordId does */
function makeWsId(bareId: string) {
  return { id: bareId, toString: () => `workspaces:${bareId}` };
}

const sampleWorkspaceRows = [
  { id: makeWsId('ws_001'), name: 'Workspace Alpha' },
  { id: makeWsId('ws_002'), name: 'Workspace Beta' },
];

/** SurrealDB query returns Result[] — { result: [...] } wrapper */
const _wsQueryResult = (rows: typeof sampleWorkspaceRows) => [{ result: rows }];

const sampleMemories = [
  {
    id: 'mem_001',
    slug: 'first',
    name: 'First',
    content: 'Content A',
    memory_type: 'fact',
    workspace_id: wsAlphaId,
    created_at: '2026-06-01T00:00:00Z',
  },
  {
    id: 'mem_002',
    slug: 'second',
    name: 'Second',
    content: 'Content B',
    memory_type: 'note',
    workspace_id: wsAlphaId,
    created_at: '2026-06-15T00:00:00Z',
  },
  {
    id: 'mem_003',
    slug: 'third',
    name: 'Third',
    content: 'Content C',
    memory_type: 'fact',
    workspace_id: wsBetaId,
    created_at: '2026-06-20T00:00:00Z',
  },
];

const sampleTags = [
  { id: 'tag_001', name: 'important' },
  { id: 'tag_002', name: 'reference' },
  { id: 'tag_003', name: 'archived' },
];

const perMemoryTags: Record<string, Array<{ id: string; name: string }>> = {
  mem_001: [sampleTags[0]],
  mem_002: [sampleTags[1]],
  mem_003: [sampleTags[2]],
};

// =============================================================================
// Helpers
// =============================================================================

function makeUrl(params?: Record<string, string>): URL {
  const qs = params ? new URLSearchParams(params).toString() : '';
  return new URL(`http://localhost:7777/memories${qs ? '?' + qs : ''}`);
}

// =============================================================================
// Module under test
// =============================================================================

let pageServerModule: any;

beforeEach(async () => {
  vi.clearAllMocks();

  // Default: connect returns a db with query method
  mockConnect.mockResolvedValue({ query: mockDbQuery });
  // Default: db.query returns workspace rows (SurrealDB Result[] format)
  mockDbQuery.mockResolvedValue(sampleWorkspaceRows);

  pageServerModule = await import('../+page.server');
});

// =============================================================================
// Load function tests
// =============================================================================

describe('Global memories page server — load', () => {
  // ── Basic load ───────────────────────────────────────────────

  test('load returns all memories via listAllMemories', async () => {
    mockListAllMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockResolvedValue([]);
    mockListTags.mockResolvedValue(sampleTags);

    const result = await pageServerModule.load({ url: makeUrl() });

    expect(mockListAllMemories).toHaveBeenCalledOnce();
    expect(result.memories).toHaveLength(3);
    expect(result.memories[0].id).toBe('mem_001');
    expect(result.memories[1].id).toBe('mem_002');
    expect(result.memories[2].id).toBe('mem_003');
  });

  test('load returns default values when no URL params', async () => {
    mockListAllMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockResolvedValue([]);
    mockListTags.mockResolvedValue(sampleTags);

    const result = await pageServerModule.load({ url: makeUrl() });

    expect(result.memories).toHaveLength(3);
    expect(result.allTags).toEqual(sampleTags);
    expect(result.activeTag).toBeNull();
    expect(result.workspaceNames).toBeDefined();
  });

  // ── workspace_id normalization ───────────────────────────────

  test('load normalizes workspace_id to bare string for URLs', async () => {
    mockListAllMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockResolvedValue([]);
    mockListTags.mockResolvedValue(sampleTags);

    const result = await pageServerModule.load({ url: makeUrl() });

    // workspace_id should be bare string (e.g. "ws_001"), not RecordId
    expect(typeof result.memories[0].workspace_id).toBe('string');
    expect(result.memories[0].workspace_id).toBe('ws_001');
    expect(result.memories[1].workspace_id).toBe('ws_001');
    expect(result.memories[2].workspace_id).toBe('ws_002');
  });

  // ── Empty state ──────────────────────────────────────────────

  test('load handles empty memories gracefully', async () => {
    mockListAllMemories.mockResolvedValue([]);
    mockListTags.mockResolvedValue([]);
    mockDbQuery.mockResolvedValueOnce([]); // global workspace query returns empty

    const result = await pageServerModule.load({ url: makeUrl() });

    expect(result.memories).toEqual([]);
    expect(result.allTags).toEqual([]);
    expect(result.activeTag).toBeNull();
    expect(result.workspaceNames).toEqual({});
  });

  test('load returns empty tags array for each memory', async () => {
    mockListAllMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockResolvedValue([]);
    mockListTags.mockResolvedValue(sampleTags);

    const result = await pageServerModule.load({ url: makeUrl() });

    expect(result.memories[0].tags).toEqual([]);
    expect(result.memories[1].tags).toEqual([]);
    expect(result.memories[2].tags).toEqual([]);
  });

  // ── Tag filter mode ──────────────────────────────────────────

  test('load filters memories by activeTag using unionTags', async () => {
    mockListAllMemories.mockResolvedValue(sampleMemories);
    // unionTags returns only memories tagged "important" — mem_001
    mockUnionTags.mockResolvedValue([sampleMemories[0]]);
    mockGetMemoryTags.mockResolvedValue([]);
    mockListTags.mockResolvedValue(sampleTags);

    const result = await pageServerModule.load({
      url: makeUrl({ tag: 'important' }),
    });

    expect(mockUnionTags).toHaveBeenCalledWith(['important']);
    expect(result.activeTag).toBe('important');
    expect(result.memories).toHaveLength(1);
    expect(result.memories[0].id).toBe('mem_001');
  });

  test('load filters memories to intersection of all and tagged', async () => {
    // listAllMemories returns 3, unionTags returns 2 (one not in all)
    mockListAllMemories.mockResolvedValue([sampleMemories[0], sampleMemories[1]]);
    mockUnionTags.mockResolvedValue([sampleMemories[1], sampleMemories[2]]);
    mockGetMemoryTags.mockResolvedValue([]);
    mockListTags.mockResolvedValue(sampleTags);

    const result = await pageServerModule.load({
      url: makeUrl({ tag: 'reference' }),
    });

    // Only mem_002 is in both sets
    expect(result.memories).toHaveLength(1);
    expect(result.memories[0].id).toBe('mem_002');
  });

  test('load returns empty memories when tag filter matches nothing', async () => {
    mockListAllMemories.mockResolvedValue(sampleMemories);
    mockUnionTags.mockResolvedValue([]);
    mockGetMemoryTags.mockResolvedValue([]);
    mockListTags.mockResolvedValue(sampleTags);

    const result = await pageServerModule.load({
      url: makeUrl({ tag: 'nonexistent' }),
    });

    expect(result.memories).toEqual([]);
    expect(result.activeTag).toBe('nonexistent');
  });

  // ── Tags attached to memories ────────────────────────────────

  test('load attaches tags to each memory object', async () => {
    mockListAllMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockImplementation((id: string) => Promise.resolve(perMemoryTags[id] || []));
    mockListTags.mockResolvedValue(sampleTags);

    const result = await pageServerModule.load({ url: makeUrl() });

    expect(result.memories[0].tags).toEqual([sampleTags[0]]);
    expect(result.memories[1].tags).toEqual([sampleTags[1]]);
    expect(result.memories[2].tags).toEqual([sampleTags[2]]);
  });

  test('load attaches empty tags array when getMemoryTags returns nothing', async () => {
    mockListAllMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockResolvedValue([]);
    mockListTags.mockResolvedValue(sampleTags);

    const result = await pageServerModule.load({ url: makeUrl() });

    expect(result.memories[0].tags).toEqual([]);
    expect(result.memories[1].tags).toEqual([]);
    expect(result.memories[2].tags).toEqual([]);
  });

  // ── Workspace names ──────────────────────────────────────────

  test('load batch-fetches workspace names with global query', async () => {
    mockListAllMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockResolvedValue([]);
    mockListTags.mockResolvedValue(sampleTags);

    await pageServerModule.load({ url: makeUrl() });

    // Code now queries all workspaces globally instead of batch by IDs
    expect(mockDbQuery).toHaveBeenCalledWith(
      'SELECT id, name FROM workspaces WHERE deleted_at = none',
    );
  });

  test('load queries all workspaces globally', async () => {
    // Two memories in same workspace — code still queries all workspaces globally
    const mems = [sampleMemories[0], sampleMemories[1]]; // both ws_001
    mockListAllMemories.mockResolvedValue(mems);
    mockGetMemoryTags.mockResolvedValue([]);
    mockListTags.mockResolvedValue(sampleTags);

    await pageServerModule.load({ url: makeUrl() });

    // Code queries all workspaces, not batch by IDs
    expect(mockDbQuery).toHaveBeenCalledWith(
      'SELECT id, name FROM workspaces WHERE deleted_at = none',
    );
  });

  test('load populates workspaceNames map correctly', async () => {
    mockListAllMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockResolvedValue([]);
    mockListTags.mockResolvedValue(sampleTags);

    const result = await pageServerModule.load({ url: makeUrl() });

    expect(result.workspaceNames).toEqual({
      ws_001: 'Workspace Alpha',
      ws_002: 'Workspace Beta',
    });
  });

  test('load returns empty workspaceNames when no workspaces exist', async () => {
    mockListAllMemories.mockResolvedValue([]);
    mockListTags.mockResolvedValue([]);
    mockDbQuery.mockResolvedValueOnce([]); // global workspace query returns empty

    const result = await pageServerModule.load({ url: makeUrl() });

    expect(result.workspaceNames).toEqual({});
  });

  // ── activeTag ────────────────────────────────────────────────

  test('activeTag is null when tag param is absent', async () => {
    mockListAllMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockResolvedValue([]);
    mockListTags.mockResolvedValue(sampleTags);

    const result = await pageServerModule.load({ url: makeUrl() });

    expect(result.activeTag).toBeNull();
  });

  test('activeTag is returned from URL param', async () => {
    mockListAllMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockResolvedValue([]);
    mockListTags.mockResolvedValue(sampleTags);

    const result = await pageServerModule.load({
      url: makeUrl({ tag: 'archived' }),
    });

    expect(result.activeTag).toBe('archived');
  });

  test('activeTag is null when tag param is empty', async () => {
    mockListAllMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockResolvedValue([]);
    mockListTags.mockResolvedValue(sampleTags);

    const result = await pageServerModule.load({
      url: makeUrl({ tag: '' }),
    });

    expect(result.activeTag).toBeNull();
  });

  // ── Return shape ─────────────────────────────────────────────

  test('load returns expected shape', async () => {
    mockListAllMemories.mockResolvedValue(sampleMemories);
    mockGetMemoryTags.mockResolvedValue([]);
    mockListTags.mockResolvedValue(sampleTags);

    const result = await pageServerModule.load({ url: makeUrl() });

    expect(result).toHaveProperty('memories');
    expect(result).toHaveProperty('allTags');
    expect(result).toHaveProperty('workspaceNames');
    expect(result).toHaveProperty('activeTag');
    expect(Array.isArray(result.memories)).toBe(true);
    expect(Array.isArray(result.allTags)).toBe(true);
    expect(typeof result.workspaceNames).toBe('object');
    expect(result.activeTag === null || typeof result.activeTag === 'string').toBe(true);
  });
});
