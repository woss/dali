import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// =============================================================================
// Hoisted helpers — referenced inside vi.mock() factories
// =============================================================================

const { mockGetLog } = vi.hoisted(() => {
  const mockGetLog = vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }));
  return { mockGetLog };
});

// =============================================================================
// Module mocks — hoisted before all imports
// These mock LOW-LEVEL dependencies: SvelteKit env, logger, local/remote impls
// =============================================================================

vi.mock('$env/dynamic/private', () => ({
  env: {
    DALI_MEMORY_SURREAL_URL: 'ws://localhost:10101',
    DALI_MEMORY_SURREAL_NS: 'memory',
    DALI_MEMORY_SURREAL_DB: 'memory',
    DALI_MEMORY_SURREAL_USER: 'root',
    DALI_MEMORY_SURREAL_PASS: 'root',
    DALI_MEMORY_SECRET: 'test-secret',
    DALI_MEMORY_LOG_LEVEL: 'info',
    DALI_MEMORY_EMBEDDING_PROVIDER: 'remote',
  },
}));

// ../../logger resolves to src/lib/server/logger.ts — the same module that
// embedder/index.ts imports as '../logger'
vi.mock('../../logger', () => ({
  createLogger: mockGetLog,
}));

// Prevent LocalEmbedder from downloading ONNX weights via
// @huggingface/transformers pipeline()
vi.mock('./local', () => ({
  LocalEmbedder: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    embed: vi.fn(),
    embedBatch: vi.fn(),
  })),
}));

// Prevent RemoteEmbedder from making HTTP requests
vi.mock('./remote', () => ({
  RemoteEmbedder: vi.fn().mockImplementation(() => ({
    embed: vi.fn(),
    embedBatch: vi.fn(),
  })),
}));

// =============================================================================
// Tests — initEmbedder()
// =============================================================================

describe('initEmbedder()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test('resolves without error on first call', async () => {
    const { initEmbedder, getEmbedder } = await import('../index');
    await expect(initEmbedder()).resolves.toBeUndefined();
    expect(getEmbedder()).toBeDefined();
  });

  test('idempotency: calling twice does not re-initialize (init called once)', async () => {
    const { initEmbedder, getEmbedder, EmbedderService } = await import('../index');

    const initSpy = vi.spyOn(EmbedderService.prototype, 'initialize');

    await initEmbedder();
    expect(initSpy).toHaveBeenCalledTimes(1);

    const first = getEmbedder();
    await initEmbedder();
    const second = getEmbedder();

    // Still exactly one call — second initEmbedder is a no-op
    expect(initSpy).toHaveBeenCalledTimes(1);
    // Same object identity (singleton)
    expect(first).toBe(second);
  });
});

// =============================================================================
// Tests — getEmbedder()
// =============================================================================

describe('getEmbedder()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test('returns initialized EmbedderService instance after initEmbedder()', async () => {
    const { initEmbedder, getEmbedder } = await import('../index');
    await initEmbedder();
    const instance = getEmbedder();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(Object);
    expect(instance).toHaveProperty('embed');
    expect(instance).toHaveProperty('embedBatch');
  });

  test('throws expected error when called before initEmbedder()', async () => {
    const { getEmbedder } = await import('../index');
    expect(() => getEmbedder()).toThrow('Embedder not initialized. Call initEmbedder() first.');
  });
});

// =============================================================================
// Tests — EmbedderService methods throw when not initialized
// =============================================================================

describe('EmbedderService methods (uninitialized provider)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test('embed() throws "Embedder not initialized" when provider is null', async () => {
    const { EmbedderService } = await import('../index');
    const svc = new EmbedderService();
    // initialize() was never called → provider is null
    await expect(svc.embed('test')).rejects.toThrow('Embedder not initialized');
  });

  test('embedBatch() throws "Embedder not initialized" when provider is null', async () => {
    const { EmbedderService } = await import('../index');
    const svc = new EmbedderService();
    await expect(svc.embedBatch(['test'])).rejects.toThrow('Embedder not initialized');
  });
});

// =============================================================================
// Tests — MCP handlers gracefully handle getEmbedder() throwing
//
// ⚠️  This describe block MUST be last in the file.  It uses vi.doMock() to
// mock the embedder module at runtime, which would break the earlier tests if
// it ran before them.  No vi.unmock() is called because these tests execute
// last and the mock registry is discarded at session end.
// =============================================================================

describe('MCP handler error handling (uninitialized embedder)', () => {
  let setHandlerSpy: any;

  afterEach(() => {
    setHandlerSpy?.mockRestore();
    vi.clearAllMocks();
  });

  test('memories_store returns embedder-unavailable error when getEmbedder throws', async () => {
    // Runtime-mock the embedder module so getEmbedder() throws
    vi.doMock('../index', () => ({
      EmbedderService: class {},
      getEmbedder: vi.fn(() => {
        throw new Error('Embedder not initialized. Call initEmbedder() first.');
      }),
    }));
    vi.resetModules();

    // Spy to capture the CallTool request handler
    setHandlerSpy = vi.spyOn(Server.prototype, 'setRequestHandler');

    const { createMCPServer } = await import('../../mcp');
    createMCPServer();

    // Find the CallTool handler from the spy calls
    let callToolHandler: ((request: any) => Promise<any>) | null = null;
    for (const [schema, handler] of setHandlerSpy.mock.calls) {
      if (schema === CallToolRequestSchema) {
        callToolHandler = handler;
        break;
      }
    }
    expect(callToolHandler).not.toBeNull();

    const result = await callToolHandler!({
      params: {
        name: 'memories_store',
        arguments: { name: 'test-memory', content: 'test', workspace_id: 'ws-1' },
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe(
      'Embedding service unavailable. Service may still be starting up.',
    );
  });

  test('memories_search returns embedder-unavailable error when getEmbedder throws', async () => {
    vi.doMock('../index', () => ({
      EmbedderService: class {},
      getEmbedder: vi.fn(() => {
        throw new Error('Embedder not initialized. Call initEmbedder() first.');
      }),
    }));
    vi.resetModules();

    setHandlerSpy = vi.spyOn(Server.prototype, 'setRequestHandler');

    const { createMCPServer } = await import('../../mcp');
    createMCPServer();

    let callToolHandler: ((request: any) => Promise<any>) | null = null;
    for (const [schema, handler] of setHandlerSpy.mock.calls) {
      if (schema === CallToolRequestSchema) {
        callToolHandler = handler;
        break;
      }
    }
    expect(callToolHandler).not.toBeNull();

    const result = await callToolHandler!({
      params: { name: 'memories_search', arguments: { query: 'hello' } },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe(
      'Embedding service unavailable. Service may still be starting up.',
    );
  });
});
