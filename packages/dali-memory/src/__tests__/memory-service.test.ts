import { vi, beforeEach, describe, expect, it } from 'vite-plus/test';
import type { EventSessionCreated, EventSessionUpdated } from '@opencode-ai/sdk/v2';

// ==================== HOISTED MOCK OBJECTS ====================
// vi.hoisted ensures factories resolve before vi.mock factories run
// Float32-safe values: 0.125 = 2^-3, 0.375 = 3/8, 0.625 = 5/8 (exact in float32)

const { VECTOR_F32, VECTOR_NUMBERS } = vi.hoisted(() => {
  const f32 = new Float32Array([0.125, 0.375, 0.625]);
  return {
    VECTOR_F32: f32,
    VECTOR_NUMBERS: Array.from(f32), // [0.125, 0.375, 0.625] — exact
  };
});

const mockSurrealClient = vi.hoisted(() => ({
  connect: vi.fn().mockResolvedValue(undefined),
  saveMemory: vi.fn().mockResolvedValue('mem-id'),
  searchMemories: vi.fn().mockResolvedValue([]),
  getMemoryById: vi.fn().mockResolvedValue(null),
  deleteMemory: vi.fn().mockResolvedValue(undefined),
  listMemories: vi.fn().mockResolvedValue([]),
  getOrCreateProject: vi.fn().mockResolvedValue('proj-id'),
  upsertSession: vi.fn().mockResolvedValue('sess-rec-id'),
  saveMessage: vi.fn().mockResolvedValue('msg-id'),
  saveFact: vi.fn().mockResolvedValue('fact-id'),
  verifyFact: vi.fn().mockResolvedValue(undefined),
  getFactsForMemory: vi.fn().mockResolvedValue([]),
  getOrCreateEmbedding: vi.fn().mockResolvedValue('emb-id'),
  linkMemoryToProject: vi.fn().mockResolvedValue(undefined),
  linkMemoryToSession: vi.fn().mockResolvedValue(undefined),
  linkMemoryToEmbedding: vi.fn().mockResolvedValue(undefined),
  linkMemoryToFact: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  applyPendingMigrations: vi.fn().mockResolvedValue({ applied: [] }),
  upsertModel: vi.fn().mockResolvedValue('model-id'),
  linkModelToSession: vi.fn().mockResolvedValue(undefined),
}));

const mockConfigModule = vi.hoisted(() => ({
  initConfig: vi.fn().mockReturnValue({
    storage: { mode: 'embed', embed: { dataPath: '/tmp/test/' } },
    embedding: { endpoint: 'http://test:1234/v1', model: 'test-model' },
  }),
  getTags: vi.fn().mockReturnValue({ userTag: 'test-user', projectTag: 'test-project' }),
}));

const mockEmbedderModule = vi.hoisted(() => ({
  embeddingService: {
    configure: vi.fn(),
    embed: vi.fn().mockResolvedValue({
      vector: VECTOR_F32,
      dimensions: 3,
    }),
    clearCache: vi.fn(),
  },
}));

// ==================== MOCKS ====================

vi.mock('../utils/surreal-client.ts', () => ({
  default: mockSurrealClient,
}));

vi.mock('../config.ts', () => mockConfigModule);

vi.mock('../embedder/embedder.ts', () => mockEmbedderModule);

// ==================== IMPORTS ====================

import { MemoryService } from '../utils/memory-service.ts';

// ==================== TESTS ====================

beforeEach(() => {
  vi.clearAllMocks();
});

// ----------------------------------------------------------------
// Construction and State
// ----------------------------------------------------------------
describe('construction and state', () => {
  it('can be instantiated', () => {
    const svc = new MemoryService();
    expect(svc).toBeInstanceOf(MemoryService);
  });

  it('projectId getter throws when not set', () => {
    const svc = new MemoryService();
    expect(() => svc.projectId).toThrow('Project ID is not set');
  });

  it('projectId setter stores the value', () => {
    const svc = new MemoryService();
    svc.projectId = 'my-project';
    expect(svc.projectId).toBe('my-project');
  });

  it('projectId getter returns the set value', () => {
    const svc = new MemoryService();
    svc.projectId = 'another-project';
    expect(svc.projectId).toBe('another-project');
  });
});

// ----------------------------------------------------------------
// initialize
// ----------------------------------------------------------------
describe('initialize', () => {
  it('calls config loading, embeddingService.configure, and surrealClient.connect', async () => {
    const svc = new MemoryService();
    await svc.initialize('/some/dir');

    expect(mockConfigModule.initConfig).toHaveBeenCalledWith('/some/dir');
    expect(mockEmbedderModule.embeddingService.configure).toHaveBeenCalledWith({
      endpoint: 'http://test:1234/v1',
      model: 'test-model',
      provider: 'remote',
    });
    expect(mockSurrealClient.connect).toHaveBeenCalledTimes(1);
  });

  it('does nothing when already initialized', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    await svc.initialize('/other-dir');

    // connect should only be called once
    expect(mockSurrealClient.connect).toHaveBeenCalledTimes(1);
  });

  it('handles initialization error gracefully (config error)', async () => {
    mockConfigModule.initConfig.mockImplementationOnce(() => {
      throw new Error('config parse error');
    });

    const svc = new MemoryService();
    // Should not throw
    await expect(svc.initialize('/bad/dir')).resolves.toBeUndefined();

    // After error, isInitialized should still be false, so subsequent methods return defaults
    const result = await svc.addMemory('test', [], 'doc', 'ctag', 'sess1');
    expect(result).toBe('');
  });

  it('allows retry after initialization failure', async () => {
    // First call fails
    mockSurrealClient.connect.mockRejectedValueOnce(new Error('first fail'));
    const svc = new MemoryService();
    await svc.initialize('/dir');

    // After first failure, _config is null, isInitialized returns false
    // Second call should retry because first errored
    await svc.initialize('/dir');

    // connect should have been called twice (first failed, second retried)
    expect(mockSurrealClient.connect).toHaveBeenCalledTimes(2);
  });
});

// ----------------------------------------------------------------
// addMemory
// ----------------------------------------------------------------
describe('addMemory', () => {
  it("returns '' when not initialized", async () => {
    const svc = new MemoryService();
    const result = await svc.addMemory('content', [], 'doc', 'ctag', 'sess1');
    expect(result).toBe('');
    expect(mockSurrealClient.saveMemory).not.toHaveBeenCalled();
  });

  it("returns '' when embedding fails", async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockEmbedderModule.embeddingService.embed.mockResolvedValueOnce(null);

    const result = await svc.addMemory('content', [], 'doc', 'ctag', 'sess1');
    expect(result).toBe('');
    expect(mockSurrealClient.saveMemory).not.toHaveBeenCalled();
  });

  it("returns '' when surrealClient.saveMemory returns falsy", async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.saveMemory.mockResolvedValueOnce('');

    svc.projectId = 'proj-1';
    const result = await svc.addMemory('content', ['tag1'], 'doc', 'ctag', 'sess1');
    expect(result).toBe('');
    expect(mockSurrealClient.saveMemory).toHaveBeenCalledTimes(1);
  });

  it('passes empty embedId when getOrCreateEmbedding returns empty, saveMemory still called', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.getOrCreateEmbedding.mockResolvedValueOnce('');

    svc.projectId = 'proj-1';
    const result = await svc.addMemory('content', ['tag1'], 'doc', 'ctag', 'sess1');
    // saveMemory is called regardless of embedId emptiness
    expect(mockSurrealClient.saveMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        embedId: '',
      }),
    );
    // saveMemory mock returns 'mem-id', so result is 'mem-id'
    expect(result).toBe('mem-id');
  });

  it('returns the memory ID on success', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T10:30:00Z'));
    const nowMs = Date.now(); // 1768473000000

    const svc = new MemoryService();
    await svc.initialize('/dir');
    svc.projectId = 'proj-1';

    const result = await svc.addMemory('content', ['tag1'], 'doc', 'ctag', 'sess1');
    expect(result).toBe('mem-id');

    expect(mockSurrealClient.getOrCreateEmbedding).toHaveBeenCalledWith('test-model', 3);
    expect(mockSurrealClient.saveMemory).toHaveBeenCalledWith({
      memory: {
        content: 'content',
        vector: VECTOR_NUMBERS,
        tags: ['tag1'],
        type: 'doc',
        container_tag: 'ctag',
        metadata: { timestamp: nowMs, source: 'dali-memory' },
        is_pinned: false,
        created_at: '2026-01-15T10:30:00.000Z',
        updated_at: '2026-01-15T10:30:00.000Z',
      },
      projectId: 'proj-1',
      sessionId: 'sess1',
      embedId: 'emb-id',
    });

    vi.useRealTimers();
  });

  it('rethrows exception', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    svc.projectId = 'proj-1';
    mockSurrealClient.saveMemory.mockRejectedValueOnce(new Error('db error'));

    await expect(svc.addMemory('content', [], 'doc', 'ctag', 'sess1')).rejects.toThrow('db error');
  });
});

// ----------------------------------------------------------------
// searchMemories
// ----------------------------------------------------------------
describe('searchMemories', () => {
  it('returns [] when not initialized', async () => {
    const svc = new MemoryService();
    const result = await svc.searchMemories('query', 'ctag');
    expect(result).toEqual([]);
    expect(mockSurrealClient.searchMemories).not.toHaveBeenCalled();
  });

  it('returns [] when embedding fails', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockEmbedderModule.embeddingService.embed.mockResolvedValueOnce(null);

    const result = await svc.searchMemories('query', 'ctag');
    expect(result).toEqual([]);
    expect(mockSurrealClient.searchMemories).not.toHaveBeenCalled();
  });

  it('returns results from surrealClient.searchMemories on success', async () => {
    const fakeRecords = [{ id: 'mem1', content: 'test', type: 'doc' }];
    mockSurrealClient.searchMemories.mockResolvedValueOnce(fakeRecords);

    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.searchMemories('my query', 'ctag', {
      tags: ['tag1'],
      limit: 5,
    });
    expect(result).toEqual(fakeRecords);
    expect(mockSurrealClient.searchMemories).toHaveBeenCalledWith(
      'my query',
      VECTOR_NUMBERS,
      ['tag1'],
      'ctag',
      5,
    );
  });

  it('uses default options when none provided', async () => {
    mockSurrealClient.searchMemories.mockResolvedValueOnce([]);

    const svc = new MemoryService();
    await svc.initialize('/dir');

    await svc.searchMemories('query', 'ctag');
    expect(mockSurrealClient.searchMemories).toHaveBeenCalledWith(
      'query',
      VECTOR_NUMBERS,
      [],
      'ctag',
      10,
    );
  });

  it('catches exception and returns []', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.searchMemories.mockRejectedValueOnce(new Error('search fail'));

    const result = await svc.searchMemories('query', 'ctag');
    expect(result).toEqual([]);
  });
});

// ----------------------------------------------------------------
// getMemory
// ----------------------------------------------------------------
describe('getMemory', () => {
  it('returns null when not initialized', async () => {
    const svc = new MemoryService();
    const result = await svc.getMemory('some-id');
    expect(result).toBeNull();
    expect(mockSurrealClient.getMemoryById).not.toHaveBeenCalled();
  });

  it('returns memory record from surrealClient.getMemoryById on success', async () => {
    const fakeRecord = { id: 'mem:1', content: 'memory', type: 'doc' };
    mockSurrealClient.getMemoryById.mockResolvedValueOnce(fakeRecord);

    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.getMemory('mem:1');
    expect(result).toEqual(fakeRecord);
    expect(mockSurrealClient.getMemoryById).toHaveBeenCalledWith('mem:1');
  });

  it('returns null when getMemoryById returns null', async () => {
    mockSurrealClient.getMemoryById.mockResolvedValueOnce(null);

    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.getMemory('nonexistent');
    expect(result).toBeNull();
  });

  it('catches exception and returns null', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.getMemoryById.mockRejectedValueOnce(new Error('get fail'));

    const result = await svc.getMemory('some-id');
    expect(result).toBeNull();
  });
});

// ----------------------------------------------------------------
// deleteMemory
// ----------------------------------------------------------------
describe('deleteMemory', () => {
  it('does nothing when not initialized', async () => {
    const svc = new MemoryService();
    await svc.deleteMemory('mem:1');
    expect(mockSurrealClient.deleteMemory).not.toHaveBeenCalled();
  });

  it('calls surrealClient.deleteMemory on success', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');

    await svc.deleteMemory('mem:1');
    expect(mockSurrealClient.deleteMemory).toHaveBeenCalledWith('mem:1');
  });

  it('rethrows exception', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.deleteMemory.mockRejectedValueOnce(new Error('delete fail'));

    await expect(svc.deleteMemory('mem:1')).rejects.toThrow('delete fail');
  });
});

// ----------------------------------------------------------------
// listMemories
// ----------------------------------------------------------------
describe('listMemories', () => {
  it('returns [] when not initialized', async () => {
    const svc = new MemoryService();
    const result = await svc.listMemories('ctag');
    expect(result).toEqual([]);
    expect(mockSurrealClient.listMemories).not.toHaveBeenCalled();
  });

  it('returns results from surrealClient.listMemories on success', async () => {
    const fakeList = [
      { id: 'mem:1', content: 'a' },
      { id: 'mem:2', content: 'b' },
    ];
    mockSurrealClient.listMemories.mockResolvedValueOnce(fakeList);

    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.listMemories('ctag', 10);
    expect(result).toEqual(fakeList);
    expect(mockSurrealClient.listMemories).toHaveBeenCalledWith('ctag', 10);
  });

  it('uses default limit of 50 when not provided', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');

    await svc.listMemories('ctag');
    expect(mockSurrealClient.listMemories).toHaveBeenCalledWith('ctag', 50);
  });

  it('catches exception and returns []', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.listMemories.mockRejectedValueOnce(new Error('list fail'));

    const result = await svc.listMemories('ctag');
    expect(result).toEqual([]);
  });
});

// ----------------------------------------------------------------
// getTags
// ----------------------------------------------------------------
describe('getTags', () => {
  it('returns tags from config.getTags on success', async () => {
    const svc = new MemoryService();
    const result = await svc.getTags('/some/dir');
    expect(result).toEqual({ userTag: 'test-user', projectTag: 'test-project' });
  });

  it('catches exception and returns empty tags fallback', async () => {
    mockConfigModule.getTags.mockImplementationOnce(() => {
      throw new Error('tag error');
    });

    const svc = new MemoryService();
    const result = await svc.getTags('/some/dir');
    expect(result).toEqual({ userTag: '', projectTag: '' });
  });
});

// ----------------------------------------------------------------
// getOrCreateProject
// ----------------------------------------------------------------
describe('getOrCreateProject', () => {
  it("returns '' when not initialized", async () => {
    const svc = new MemoryService();
    const result = await svc.getOrCreateProject('my-proj', '/path');
    expect(result).toBe('');
    expect(mockSurrealClient.getOrCreateProject).not.toHaveBeenCalled();
  });

  it('returns project ID on success', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.getOrCreateProject('my-proj', '/path');
    expect(result).toBe('proj-id');
    expect(mockSurrealClient.getOrCreateProject).toHaveBeenCalledWith('my-proj', '/path');
  });

  it("returns '' when getOrCreateProject returns falsy", async () => {
    mockSurrealClient.getOrCreateProject.mockResolvedValueOnce('');

    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.getOrCreateProject('proj', '/path');
    expect(result).toBe('');
  });

  it('rethrows exception', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.getOrCreateProject.mockRejectedValueOnce(new Error('project error'));

    await expect(svc.getOrCreateProject('proj', '/path')).rejects.toThrow('project error');
  });
});

// ----------------------------------------------------------------
// upsertSession
// ----------------------------------------------------------------
const sessionCreatedData: EventSessionCreated = {
  properties: {
    info: {
      id: 'session-abc',
      title: 'Test Session',
      slug: 'test-session',
      time: { created: '2026-01-15T10:00:00Z' },
      model: { providerID: 'openai', id: 'gpt-4' },
    },
  },
} as unknown as EventSessionCreated;

const sessionCreatedNoModel: EventSessionCreated = {
  properties: {
    info: {
      id: 'session-def',
      title: 'No Model',
      slug: 'no-model',
      time: { created: '2026-01-15T11:00:00Z' },
    },
  },
} as unknown as EventSessionCreated;

describe('upsertSession', () => {
  it("returns '' when not initialized", async () => {
    const svc = new MemoryService();
    const result = await svc.upsertSession('proj-1', sessionCreatedData);
    expect(result).toBe('');
    expect(mockSurrealClient.upsertModel).not.toHaveBeenCalled();
  });

  it('returns session record ID on success', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.upsertSession('proj-1', sessionCreatedData);
    expect(result).toBe('sess-rec-id');
    expect(mockSurrealClient.upsertModel).toHaveBeenCalledWith('openai', 'gpt-4');
    expect(mockSurrealClient.upsertSession).toHaveBeenCalledWith('proj-1', {
      id: 'session-abc',
      title: 'Test Session',
      slug: 'test-session',
      created_at: '2026-01-15T10:00:00.000Z',
      updated_at: '2026-01-15T10:00:00.000Z',
    });
    expect(mockSurrealClient.linkModelToSession).toHaveBeenCalledWith('model-id', 'session-abc');
  });

  it("uses 'unknown' when model info is missing", async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');

    await svc.upsertSession('proj-1', sessionCreatedNoModel);
    expect(mockSurrealClient.upsertModel).toHaveBeenCalledWith('unknown', 'unknown');
  });

  it("returns '' when upsertSession returns falsy", async () => {
    mockSurrealClient.upsertSession.mockResolvedValueOnce('');

    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.upsertSession('proj-1', sessionCreatedData);
    expect(result).toBe('');
    // linkModelToSession should NOT be called when upsertSession returns falsy
    expect(mockSurrealClient.linkModelToSession).not.toHaveBeenCalled();
  });

  it('rethrows exception', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.upsertModel.mockRejectedValueOnce(new Error('model error'));

    await expect(svc.upsertSession('proj-1', sessionCreatedData)).rejects.toThrow('model error');
  });
});

// ----------------------------------------------------------------
// updateSession
// ----------------------------------------------------------------
const sessionUpdatedData: EventSessionUpdated = {
  properties: {
    info: {
      id: 'session-abc',
      title: 'Updated Session',
      slug: 'updated-session',
      time: { created: '2026-01-15T12:00:00Z' },
      model: { providerID: 'anthropic', id: 'claude-3' },
    },
  },
} as unknown as EventSessionUpdated;

const sessionUpdatedStringModel: EventSessionUpdated = {
  properties: {
    info: {
      id: 'session-xyz',
      title: 'String Model',
      slug: 'string-model',
      time: { created: '2026-01-15T13:00:00Z' },
      model: 'gpt-3.5-turbo' as unknown as undefined,
    },
  },
} as unknown as EventSessionUpdated;

const sessionUpdatedNullModel: EventSessionUpdated = {
  properties: {
    info: {
      id: 'session-null',
      title: 'Null Model',
      slug: 'null-model',
      time: { created: '2026-01-15T14:00:00Z' },
      model: null as unknown as undefined,
    },
  },
} as unknown as EventSessionUpdated;

describe('updateSession', () => {
  it('does nothing when not initialized', async () => {
    const svc = new MemoryService();
    await svc.updateSession(sessionUpdatedData);
    expect(mockSurrealClient.upsertSession).not.toHaveBeenCalled();
  });

  it('calls surrealClient.upsertSession and upsertModel + linkModelToSession on success', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    svc.projectId = 'proj-1';

    await svc.updateSession(sessionUpdatedData);
    expect(mockSurrealClient.upsertSession).toHaveBeenCalledWith('proj-1', {
      id: 'session-abc',
      title: 'Updated Session',
      slug: 'updated-session',
      created_at: '2026-01-15T12:00:00.000Z',
    });
    expect(mockSurrealClient.upsertModel).toHaveBeenCalledWith('anthropic', 'claude-3');
    expect(mockSurrealClient.linkModelToSession).toHaveBeenCalledWith('model-id', 'session-abc');
  });

  it('normalizes string model to providerID unknown', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    svc.projectId = 'proj-1';

    await svc.updateSession(sessionUpdatedStringModel);
    expect(mockSurrealClient.upsertModel).toHaveBeenCalledWith('unknown', 'gpt-3.5-turbo');
  });

  it('normalizes null model to both unknown', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    svc.projectId = 'proj-1';

    await svc.updateSession(sessionUpdatedNullModel);
    expect(mockSurrealClient.upsertModel).toHaveBeenCalledWith('unknown', 'unknown');
  });

  it('rethrows exception', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    svc.projectId = 'proj-1';
    mockSurrealClient.upsertSession.mockRejectedValueOnce(new Error('upsert fail'));

    await expect(svc.updateSession(sessionUpdatedData)).rejects.toThrow('upsert fail');
  });
});

// ----------------------------------------------------------------
// saveMessage
// ----------------------------------------------------------------
describe('saveMessage', () => {
  it("returns '' when not initialized", async () => {
    const svc = new MemoryService();
    const result = await svc.saveMessage('sess-1', 'user', 'hello');
    expect(result).toBe('');
    expect(mockSurrealClient.saveMessage).not.toHaveBeenCalled();
  });

  it('returns message ID on success', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.saveMessage('sess-1', 'user', 'hello');
    expect(result).toBe('msg-id');
    expect(mockSurrealClient.saveMessage).toHaveBeenCalledWith('sess-1', 'user', 'hello');
  });

  it("returns '' when saveMessage returns falsy", async () => {
    mockSurrealClient.saveMessage.mockResolvedValueOnce('');

    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.saveMessage('sess-1', 'agent', 'response');
    expect(result).toBe('');
  });

  it('rethrows exception', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.saveMessage.mockRejectedValueOnce(new Error('msg error'));

    await expect(svc.saveMessage('sess-1', 'system', 'info')).rejects.toThrow('msg error');
  });
});

// ----------------------------------------------------------------
// saveFact
// ----------------------------------------------------------------
describe('saveFact', () => {
  it("returns '' when not initialized", async () => {
    const svc = new MemoryService();
    const result = await svc.saveFact('fact content');
    expect(result).toBe('');
    expect(mockSurrealClient.saveFact).not.toHaveBeenCalled();
  });

  it('returns fact ID on success with default verified=false', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.saveFact('fact content');
    expect(result).toBe('fact-id');
    expect(mockSurrealClient.saveFact).toHaveBeenCalledWith('fact content', false);
  });

  it('returns fact ID on success with verified=true', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.saveFact('verified fact', true);
    expect(result).toBe('fact-id');
    expect(mockSurrealClient.saveFact).toHaveBeenCalledWith('verified fact', true);
  });

  it("returns '' when saveFact returns falsy", async () => {
    mockSurrealClient.saveFact.mockResolvedValueOnce('');

    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.saveFact('fact');
    expect(result).toBe('');
  });

  it('rethrows exception', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.saveFact.mockRejectedValueOnce(new Error('fact error'));

    await expect(svc.saveFact('fact')).rejects.toThrow('fact error');
  });
});

// ----------------------------------------------------------------
// verifyFact
// ----------------------------------------------------------------
describe('verifyFact', () => {
  it('does nothing when not initialized', async () => {
    const svc = new MemoryService();
    await svc.verifyFact('fact-1');
    expect(mockSurrealClient.verifyFact).not.toHaveBeenCalled();
  });

  it('calls surrealClient.verifyFact on success', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');

    await svc.verifyFact('fact-1');
    expect(mockSurrealClient.verifyFact).toHaveBeenCalledWith('fact-1');
  });

  it('rethrows exception', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.verifyFact.mockRejectedValueOnce(new Error('verify fail'));

    await expect(svc.verifyFact('fact-1')).rejects.toThrow('verify fail');
  });
});

// ----------------------------------------------------------------
// getFactsForMemory
// ----------------------------------------------------------------
describe('getFactsForMemory', () => {
  it('returns [] when not initialized', async () => {
    const svc = new MemoryService();
    const result = await svc.getFactsForMemory('mem-1');
    expect(result).toEqual([]);
    expect(mockSurrealClient.getFactsForMemory).not.toHaveBeenCalled();
  });

  it('returns facts from surrealClient.getFactsForMemory on success', async () => {
    const fakeFacts = [{ id: 'fact:1', content: 'fact-1', verified: false }];
    mockSurrealClient.getFactsForMemory.mockResolvedValueOnce(fakeFacts);

    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.getFactsForMemory('mem-1');
    expect(result).toEqual(fakeFacts);
    expect(mockSurrealClient.getFactsForMemory).toHaveBeenCalledWith('mem-1');
  });

  it('catches exception and returns []', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.getFactsForMemory.mockRejectedValueOnce(new Error('facts error'));

    const result = await svc.getFactsForMemory('mem-1');
    expect(result).toEqual([]);
  });
});

// ----------------------------------------------------------------
// getOrCreateEmbedding
// ----------------------------------------------------------------
describe('getOrCreateEmbedding', () => {
  it("returns '' when not initialized", async () => {
    const svc = new MemoryService();
    const result = await svc.getOrCreateEmbedding('test-model', 3);
    expect(result).toBe('');
    expect(mockSurrealClient.getOrCreateEmbedding).not.toHaveBeenCalled();
  });

  it('returns embedding ID on success', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.getOrCreateEmbedding('test-model', 3);
    expect(result).toBe('emb-id');
    expect(mockSurrealClient.getOrCreateEmbedding).toHaveBeenCalledWith('test-model', 3);
  });

  it("returns '' when getOrCreateEmbedding returns falsy", async () => {
    mockSurrealClient.getOrCreateEmbedding.mockResolvedValueOnce('');

    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.getOrCreateEmbedding('test-model', 3);
    expect(result).toBe('');
  });

  it('rethrows exception', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.getOrCreateEmbedding.mockRejectedValueOnce(new Error('embedding error'));

    await expect(svc.getOrCreateEmbedding('test-model', 3)).rejects.toThrow('embedding error');
  });
});

// ----------------------------------------------------------------
// linkMemoryTo*
// ----------------------------------------------------------------
describe('linkMemoryToProject', () => {
  it('does nothing when not initialized', async () => {
    const svc = new MemoryService();
    await svc.linkMemoryToProject('mem:1', 'proj:1');
    expect(mockSurrealClient.linkMemoryToProject).not.toHaveBeenCalled();
  });

  it('calls surrealClient.linkMemoryToProject on success', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');

    await svc.linkMemoryToProject('mem:1', 'proj:1');
    expect(mockSurrealClient.linkMemoryToProject).toHaveBeenCalledWith('mem:1', 'proj:1');
  });

  it('rethrows exception', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.linkMemoryToProject.mockRejectedValueOnce(new Error('link error'));

    await expect(svc.linkMemoryToProject('mem:1', 'proj:1')).rejects.toThrow('link error');
  });
});

describe('linkMemoryToSession', () => {
  it('does nothing when not initialized', async () => {
    const svc = new MemoryService();
    await svc.linkMemoryToSession('mem:1', 'sess:1');
    expect(mockSurrealClient.linkMemoryToSession).not.toHaveBeenCalled();
  });

  it('calls surrealClient.linkMemoryToSession on success', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');

    await svc.linkMemoryToSession('mem:1', 'sess:1');
    expect(mockSurrealClient.linkMemoryToSession).toHaveBeenCalledWith('mem:1', 'sess:1');
  });

  it('rethrows exception', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.linkMemoryToSession.mockRejectedValueOnce(new Error('link error'));

    await expect(svc.linkMemoryToSession('mem:1', 'sess:1')).rejects.toThrow('link error');
  });
});

describe('linkMemoryToEmbedding', () => {
  it('does nothing when not initialized', async () => {
    const svc = new MemoryService();
    await svc.linkMemoryToEmbedding('mem:1', 'emb:1');
    expect(mockSurrealClient.linkMemoryToEmbedding).not.toHaveBeenCalled();
  });

  it('calls surrealClient.linkMemoryToEmbedding on success', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');

    await svc.linkMemoryToEmbedding('mem:1', 'emb:1');
    expect(mockSurrealClient.linkMemoryToEmbedding).toHaveBeenCalledWith('mem:1', 'emb:1');
  });

  it('rethrows exception', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.linkMemoryToEmbedding.mockRejectedValueOnce(new Error('link error'));

    await expect(svc.linkMemoryToEmbedding('mem:1', 'emb:1')).rejects.toThrow('link error');
  });
});

describe('linkMemoryToFact', () => {
  it('does nothing when not initialized', async () => {
    const svc = new MemoryService();
    await svc.linkMemoryToFact('mem:1', 'fact:1');
    expect(mockSurrealClient.linkMemoryToFact).not.toHaveBeenCalled();
  });

  it('calls surrealClient.linkMemoryToFact on success', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');

    await svc.linkMemoryToFact('mem:1', 'fact:1');
    expect(mockSurrealClient.linkMemoryToFact).toHaveBeenCalledWith('mem:1', 'fact:1');
  });

  it('rethrows exception', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.linkMemoryToFact.mockRejectedValueOnce(new Error('link error'));

    await expect(svc.linkMemoryToFact('mem:1', 'fact:1')).rejects.toThrow('link error');
  });
});

// ----------------------------------------------------------------
// applyPendingMigrations
// ----------------------------------------------------------------
describe('applyPendingMigrations', () => {
  it('returns { applied: [] } when not initialized', async () => {
    const svc = new MemoryService();
    const result = await svc.applyPendingMigrations();
    expect(result).toEqual({ applied: [] });
    expect(mockSurrealClient.applyPendingMigrations).not.toHaveBeenCalled();
  });

  it('returns result from surrealClient.applyPendingMigrations on success', async () => {
    mockSurrealClient.applyPendingMigrations.mockResolvedValueOnce({ applied: ['001_init'] });

    const svc = new MemoryService();
    await svc.initialize('/dir');

    const result = await svc.applyPendingMigrations();
    expect(result).toEqual({ applied: ['001_init'] });
    expect(mockSurrealClient.applyPendingMigrations).toHaveBeenCalled();
  });

  it('rethrows exception', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.applyPendingMigrations.mockRejectedValueOnce(new Error('migration error'));

    await expect(svc.applyPendingMigrations()).rejects.toThrow('migration error');
  });
});

// ----------------------------------------------------------------
// shutdown
// ----------------------------------------------------------------
describe('shutdown', () => {
  it('does nothing when not initialized (config is null)', async () => {
    const svc = new MemoryService();
    await svc.shutdown();
    expect(mockSurrealClient.disconnect).not.toHaveBeenCalled();
  });

  it('calls surrealClient.disconnect and resets config on success', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    expect(mockSurrealClient.connect).toHaveBeenCalled();

    await svc.shutdown();
    expect(mockSurrealClient.disconnect).toHaveBeenCalled();

    // After shutdown, isInitialized should return false (config reset to null)
    const result = await svc.addMemory('content', [], 'doc', 'ctag', 'sess1');
    expect(result).toBe('');
  });

  it('catches exception during disconnect and does not throw', async () => {
    const svc = new MemoryService();
    await svc.initialize('/dir');
    mockSurrealClient.disconnect.mockRejectedValueOnce(new Error('disconnect error'));

    await expect(svc.shutdown()).resolves.toBeUndefined();
  });
});
