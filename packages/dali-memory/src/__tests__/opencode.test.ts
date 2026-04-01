/** biome-ignore-all lint/style/noNonNullAssertion: test assertions rely on non-null */
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

// Mock dependencies with simple function stubs
vi.mock('../utils/memory-service.ts', () => ({
  default: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getOrCreateProject: vi.fn().mockResolvedValue('project-123'),
    addMemory: vi.fn().mockResolvedValue('memory-123'),
    searchMemories: vi.fn().mockResolvedValue([]),
    listMemories: vi.fn().mockResolvedValue([]),
    deleteMemory: vi.fn().mockResolvedValue(undefined),
    getTags: vi.fn().mockResolvedValue({ userTag: 'user-tag', projectTag: 'project-tag' }),
    upsertSession: vi.fn().mockResolvedValue('session-record-1'),
    updateSession: vi.fn().mockResolvedValue(undefined),
    saveMessage: vi.fn().mockResolvedValue('message-1'),
    saveFact: vi.fn().mockResolvedValue('fact-1'),
    verifyFact: vi.fn().mockResolvedValue(undefined),
    getFactsForMemory: vi.fn().mockResolvedValue([]),
    applyPendingMigrations: vi.fn().mockResolvedValue({ applied: [] }),
    linkMemoryToFact: vi.fn().mockResolvedValue(undefined),
    projectId: 'project-123',
  },
}));

vi.mock('../utils/logger.ts', () => ({
  initLogger: vi.fn(),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

vi.mock('../utils/argsParsing.ts', () => ({
  parseTheArgs: vi.fn((_toolId: string, _args: any, data: any) => data),
}));

describe('DaliMemoryPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports DaliMemoryPlugin and default export', async () => {
    const mod = await import('../opencode.ts');
    expect(mod.DaliMemoryPlugin).toBeDefined();
    expect(mod.default).toBeDefined();
    expect(mod.DaliMemoryPlugin).toBe(mod.default);
  });

  it('DaliMemoryPlugin is a function', async () => {
    const mod = await import('../opencode.ts');
    expect(typeof mod.DaliMemoryPlugin).toBe('function');
  });

  it('plugin function returns expected hooks', async () => {
    const mod = await import('../opencode.ts');
    const mockCtx = {
      client: {
        tui: { showToast: vi.fn() },
        app: { log: vi.fn() },
        session: { prompt: vi.fn() },
      },
      directory: '/test/project',
      worktree: '/test',
      project: { name: 'test' },
      $: vi.fn(),
      serverUrl: new URL('http://localhost:4096'),
    };

    const hooks = await mod.DaliMemoryPlugin(mockCtx as any);
    expect(hooks.tool).toBeDefined();
    expect(hooks.event).toBeDefined();
    expect(hooks.config).toBeDefined();
    expect(hooks['chat.message']).toBeDefined();
    expect(hooks['experimental.session.compacting']).toBeDefined();
  });

  it('config hook registers dali-memory commands', async () => {
    const mod = await import('../opencode.ts');
    const mockCtx = {
      client: {
        tui: { showToast: vi.fn() },
        app: { log: vi.fn() },
        session: { prompt: vi.fn() },
      },
      directory: '/test/project',
      worktree: '/test',
      project: { name: 'test' },
      $: vi.fn(),
      serverUrl: new URL('http://localhost:4096'),
    };

    const hooks = await mod.DaliMemoryPlugin(mockCtx as any);
    const config: Record<string, any> = {};
    await hooks.config!(config);

    expect(config.command).toBeDefined();
    expect(config.command.dali_migrate_oc_db).toBeDefined();
    expect(config.command.dali_migrate_oc_db.description).toContain('Migrate');
    expect(config.command.dali_remember).toBeDefined();
    expect(config.command.dali_remember.description).toContain('persistent memories');
    expect(config.command.dali_extract_facts).toBeDefined();
    expect(config.command.dali_extract_facts.description).toContain('Extract');
    expect(config.command.noop).toBeDefined();
  });

  it('config hook preserves existing commands', async () => {
    const mod = await import('../opencode.ts');
    const mockCtx = {
      client: {
        tui: { showToast: vi.fn() },
        app: { log: vi.fn() },
        session: { prompt: vi.fn() },
      },
      directory: '/test/project',
      worktree: '/test',
      project: { name: 'test' },
      $: vi.fn(),
      serverUrl: new URL('http://localhost:4096'),
    };

    const hooks = await mod.DaliMemoryPlugin(mockCtx as any);
    const config: Record<string, any> = {
      command: { existing_cmd: { template: 'foo', description: 'bar', subtask: false } },
    };
    await hooks.config!(config);
    expect(config.command.existing_cmd).toBeDefined();
    expect(config.command.dali_remember).toBeDefined();
  });

  it('tokenizeMetadataMemoryPlugin hook appends fact extraction instructions', async () => {
    const mod = await import('../opencode.ts');
    const mockCtx = {
      client: {
        tui: { showToast: vi.fn() },
        app: { log: vi.fn() },
        session: { prompt: vi.fn() },
      },
      directory: '/test/project',
      worktree: '/test',
      project: { name: 'test' },
      $: vi.fn(),
      serverUrl: new URL('http://localhost:4096'),
    };

    const hooks = await mod.DaliMemoryPlugin(mockCtx as any);
    const output = { context: ['original'] };
    await hooks['experimental.session.compacting']!({ sessionID: 'ses_1' }, output);

    expect(output.context).toHaveLength(2);
    expect(output.context[1]).toContain('Fact Extraction');
    expect(output.context[1]).toContain('FACT:');
  });

  it('chat.message hook handles empty parts gracefully', async () => {
    const mod = await import('../opencode.ts');
    const mockCtx = {
      client: {
        tui: { showToast: vi.fn() },
        app: { log: vi.fn() },
        session: { prompt: vi.fn() },
      },
      directory: '/test/project',
      worktree: '/test',
      project: { name: 'test' },
      $: vi.fn(),
      serverUrl: new URL('http://localhost:4096'),
    };

    const hooks = await mod.DaliMemoryPlugin(mockCtx as any);
    await expect(
      hooks['chat.message']!(
        { sessionID: 'ses_1' },
        {
          parts: [] as any[],
          message: {
            id: '',
            sessionID: '',
            role: 'user',
            time: {
              created: 0,
            },
            summary: undefined,
            agent: '',
            model: {
              providerID: '',
              modelID: '',
            },
            system: undefined,
            tools: undefined,
          },
        },
      ),
    ).resolves.not.toThrow();
  });

  it('event hook handles session.created', async () => {
    const mod = await import('../opencode.ts');
    const mockCtx = {
      client: {
        tui: { showToast: vi.fn() },
        app: { log: vi.fn() },
        session: { prompt: vi.fn() },
      },
      directory: '/test/project',
      worktree: '/test',
      project: { name: 'test' },
      $: vi.fn(),
      serverUrl: new URL('http://localhost:4096'),
    };

    const hooks = await mod.DaliMemoryPlugin(mockCtx as any);
    await expect(
      hooks.event!({
        event: {
          type: 'session.created',
          properties: {
            info: {
              id: 'session-1',
              agent: 'build',
              title: 'Test',
              slug: 'test',
              model: { id: 'claude', providerID: 'anthropic' },
              time: { created: new Date().toISOString() },
            },
          },
        } as any,
      }),
    ).resolves.not.toThrow();
  });

  it('event hook handles session.updated', async () => {
    const mod = await import('../opencode.ts');
    const mockCtx = {
      client: {
        tui: { showToast: vi.fn() },
        app: { log: vi.fn() },
        session: { prompt: vi.fn() },
      },
      directory: '/test/project',
      worktree: '/test',
      project: { name: 'test' },
      $: vi.fn(),
      serverUrl: new URL('http://localhost:4096'),
    };

    const hooks = await mod.DaliMemoryPlugin(mockCtx as any);
    await expect(
      hooks.event!({
        event: {
          type: 'session.updated',
          properties: {
            info: {
              id: 'session-1',
              agent: 'plan',
              title: 'Updated',
              slug: 'updated',
              model: { id: 'gpt4', providerID: 'openai' },
              time: { created: new Date().toISOString() },
            },
          },
        } as any,
      }),
    ).resolves.not.toThrow();
  });

  it('event hook handles unknown event types', async () => {
    const mod = await import('../opencode.ts');
    const mockCtx = {
      client: {
        tui: { showToast: vi.fn() },
        app: { log: vi.fn() },
        session: { prompt: vi.fn() },
      },
      directory: '/test/project',
      worktree: '/test',
      project: { name: 'test' },
      $: vi.fn(),
      serverUrl: new URL('http://localhost:4096'),
    };

    const hooks = await mod.DaliMemoryPlugin(mockCtx as any);
    await expect(
      hooks.event!({ event: { type: 'something.else' as any, properties: {} } }),
    ).resolves.not.toThrow();
  });

  it('dali_migrate_oc_db tool executes without error', async () => {
    const mod = await import('../opencode.ts');
    const mockCtx = {
      client: {
        tui: { showToast: vi.fn() },
        app: { log: vi.fn() },
        session: { prompt: vi.fn() },
      },
      directory: '/test/project',
      worktree: '/test',
      project: { name: 'test' },
      $: vi.fn(),
      serverUrl: new URL('http://localhost:4096'),
    };

    const hooks = await mod.DaliMemoryPlugin(mockCtx as any);
    const result = await (hooks.tool as any).dali_migrate_oc_db.execute(
      {},
      { sessionID: 'sess-1' },
    );
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
