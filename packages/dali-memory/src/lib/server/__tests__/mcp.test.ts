import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// Hoisted state — shared between vi.mock() factories and test code
// =============================================================================
const { mockLog, handlerRef, mockCreateMemory } = vi.hoisted(() => {
  const mockLog = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  };

  const handlerRef: { current: ((req: any) => Promise<any>) | null } = { current: null };
  const mockCreateMemory = vi.fn();

  return { mockLog, handlerRef, mockCreateMemory };
});

// =============================================================================
// Module-level mocks (hoisted before all imports)
// =============================================================================

// SvelteKit virtual module — required by getConfig() transitively
vi.mock('$env/dynamic/private', () => ({
  env: {
    DALI_MEMORY_SURREAL_URL: 'ws://localhost:10101',
    DALI_MEMORY_SURREAL_NS: 'memory',
    DALI_MEMORY_SURREAL_DB: 'memory',
    DALI_MEMORY_SURREAL_USER: 'root',
    DALI_MEMORY_SURREAL_PASS: 'root',
    DALI_MEMORY_SECRET: 'test-secret',
  },
}));

// Logger — return the shared mock so tests can assert on calls
vi.mock('../logger', () => ({
  createLogger: vi.fn(() => mockLog),
}));

// MCP SDK types — light mock, the Server mock never inspects schema objects
vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: {},
  ListToolsRequestSchema: {},
  ErrorCode: { MethodNotFound: 'MethodNotFound' },
  McpError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'McpError';
    }
  },
}));

// MCP SDK Server — capture the CallTool handler for direct invocation in tests
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: class {
    setRequestHandler = vi.fn((_schema: any, handler: any) => {
      handlerRef.current = handler;
    });
    connect = vi.fn();
  },
}));

// Service mocks — prevent real DB / embedder / network calls
vi.mock('../services/memory', () => ({
  MemoryService: vi.fn(function () {
    return { createMemory: mockCreateMemory };
  }),
}));

vi.mock('../services/tag', () => ({
  TagService: vi.fn(function () {
    return {
      createTag: vi.fn(),
      findByName: vi.fn(),
      addTagToMemory: vi.fn(),
      removeTagFromMemory: vi.fn(),
    };
  }),
}));

vi.mock('../services/hybrid-search', () => ({
  HybridSearch: vi.fn(function () {
    return { search: vi.fn() };
  }),
}));

vi.mock('../embedder/index', () => ({
  EmbedderService: class {},
  getEmbedder: () => ({ embed: async () => '', embedBatch: async () => [''] }),
}));

vi.mock('../db/connection', () => ({
  connect: vi.fn(),
  getDB: vi.fn(() => ({ query: vi.fn() })),
}));

vi.mock('../auth/api-keys', () => ({
  validateApiKey: vi.fn(),
}));

// =============================================================================
// Imports — all vi.mock() calls are hoisted above this
// =============================================================================

import { createMCPServer } from '../mcp';

// =============================================================================
// Tests — timedTool wrapper (exercised via createMCPServer tool handlers)
// =============================================================================

describe('timedTool', () => {
  const TOOL_STORE = 'memories_store';
  const VALID_ARGS = {
    content: 'test content',
    workspace_id: 'ws1',
    name: 'test-memory',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    handlerRef.current = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Create the MCP server (populates handlerRef.current with the
   * CallTool handler) and return that handler for direct invocation.
   */
  function getHandler(): (req: any) => Promise<any> {
    createMCPServer();
    const h = handlerRef.current;
    if (!h) throw new Error('CallTool handler was not captured — check MCP Server mock');
    return h;
  }

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  describe('on success', () => {
    test('returns the result from the wrapped handler', async () => {
      mockCreateMemory.mockResolvedValue({ id: 'memories:abc123' });
      const handler = getHandler();

      const result = await handler({
        params: { name: TOOL_STORE, arguments: VALID_ARGS },
      });

      expect(result).toEqual({
        content: [{ type: 'text', text: '{"id":"memories:abc123"}' }],
      });
    });

    test('logs info with status "ok" and structured properties', async () => {
      mockCreateMemory.mockResolvedValue({ id: 'memories:x' });
      const handler = getHandler();

      await handler({ params: { name: TOOL_STORE, arguments: VALID_ARGS } });

      expect(mockLog.info).toHaveBeenCalledTimes(1);
      expect(mockLog.info).toHaveBeenCalledWith(
        'Tool {name} completed',
        expect.objectContaining({
          tool: TOOL_STORE,
          duration_ms: expect.any(Number),
          status: 'ok',
        }),
      );
    });

    test('duration_ms is a non-negative finite number on success', async () => {
      mockCreateMemory.mockResolvedValue({ id: 'memories:x' });
      const handler = getHandler();

      await handler({ params: { name: TOOL_STORE, arguments: VALID_ARGS } });

      const arg = vi.mocked(mockLog.info).mock.calls[0][1] as Record<string, unknown>;
      expect(arg.duration_ms).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(arg.duration_ms)).toBe(true);
    });

    test('does not call log.error on success', async () => {
      mockCreateMemory.mockResolvedValue({ id: 'memories:x' });
      const handler = getHandler();

      await handler({ params: { name: TOOL_STORE, arguments: VALID_ARGS } });

      expect(mockLog.error).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Error path
  // -------------------------------------------------------------------------

  describe('on error', () => {
    test('logs error with status "error" and the error message', async () => {
      mockCreateMemory.mockRejectedValue(new Error('DB connection lost'));
      const handler = getHandler();

      await handler({ params: { name: TOOL_STORE, arguments: VALID_ARGS } });

      // timedTool logs the structured error entry
      expect(mockLog.error).toHaveBeenCalledWith(
        'Tool {name} failed',
        expect.objectContaining({
          tool: TOOL_STORE,
          duration_ms: expect.any(Number),
          status: 'error',
          error: 'DB connection lost',
        }),
      );
    });

    test('outer handler catches re-throw and returns isError response', async () => {
      mockCreateMemory.mockRejectedValue(new Error('fail'));
      const handler = getHandler();

      const result = await handler({
        params: { name: TOOL_STORE, arguments: VALID_ARGS },
      });

      // The outer catch in CallToolRequestSchema handler converts to isError
      expect(result).toMatchObject({
        content: [{ type: 'text', text: 'fail' }],
        isError: true,
      });
    });

    test('handles non-Error rejection (string)', async () => {
      mockCreateMemory.mockRejectedValue('string error');
      const handler = getHandler();

      await handler({ params: { name: TOOL_STORE, arguments: VALID_ARGS } });

      expect(mockLog.error).toHaveBeenCalledWith(
        'Tool {name} failed',
        expect.objectContaining({ error: 'string error' }),
      );
    });

    test('handles non-Error rejection (object)', async () => {
      mockCreateMemory.mockRejectedValue({ code: 500 });
      const handler = getHandler();

      await handler({ params: { name: TOOL_STORE, arguments: VALID_ARGS } });

      // String({ code: 500 }) → '[object Object]'
      expect(mockLog.error).toHaveBeenCalledWith(
        'Tool {name} failed',
        expect.objectContaining({ error: '[object Object]' }),
      );
    });

    test('duration_ms is non-negative finite number on error', async () => {
      mockCreateMemory.mockRejectedValue(new Error('fail'));
      const handler = getHandler();

      await handler({ params: { name: TOOL_STORE, arguments: VALID_ARGS } });

      // Find the timedTool error log call (not the outer handler's Tool error log)
      const timedToolCall = vi
        .mocked(mockLog.error)
        .mock.calls.find((c) => c[0] === 'Tool {name} failed');
      expect(timedToolCall).toBeDefined();
      const arg = timedToolCall![1] as Record<string, unknown>;
      expect(arg.duration_ms).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(arg.duration_ms)).toBe(true);
    });

    test('does not call log.info on error', async () => {
      mockCreateMemory.mockRejectedValue(new Error('fail'));
      const handler = getHandler();

      await handler({ params: { name: TOOL_STORE, arguments: VALID_ARGS } });

      expect(mockLog.info).not.toHaveBeenCalled();
    });
  });
});
