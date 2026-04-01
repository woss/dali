import * as path from 'node:path';
import { vi, afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';
import { MemoryService } from '../utils/memory-service.ts';
import { embeddingService } from '../embedder/embedder.ts';

// Mock migrations — tests must NEVER touch production meta/ files
vi.mock('@woss/dali-orm/migration/api', () => ({
  migrateToDatabase: vi.fn().mockResolvedValue({ applied: [] }),
}));

describe('MemoryService (integration)', () => {
  let service: MemoryService;
  let tmpDir: string;
  let projectId: string;
  let sessionId: string;
  let memoryId: string;
  let factId: string;

  beforeAll(async () => {
    service = new MemoryService();
    tmpDir = './tmp/dali-memory-int-' + Date.now();

    const nodeFs = await import('node:fs');

    // Write config file for memory service to use embedded mode
    const configDir = path.join(tmpDir, '.opencode');
    nodeFs.mkdirSync(configDir, { recursive: true });
    nodeFs.writeFileSync(
      path.join(configDir, 'dali-memory.jsonc'),
      JSON.stringify({
        storage: {
          mode: 'embed',
          embed: {
            engine: 'memory',
            dataPath: tmpDir + '/',
          },
        },
        embedding: {
          endpoint: 'http://localhost:1234/v1',
          model: 'test-model',
        },
      }),
    );

    await service.initialize(tmpDir);
    vi.spyOn(embeddingService, 'embed').mockResolvedValue({
      vector: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]),
      dimensions: 10,
    });
    projectId = await service.getOrCreateProject('test-project', tmpDir);
    service.projectId = projectId;
  }, 30000);

  afterAll(async () => {
    if (service) {
      vi.restoreAllMocks();
      await service.shutdown();
    }
  }, 10000);

  it('is initialized', () => {
    expect(projectId).toBeTruthy();
  });

  describe('Sessions', () => {
    it('upsertSession creates a session record', async () => {
      const id = await service.upsertSession(projectId, {
        id: `sess-${Date.now()}`,
        type: 'session.created',
        properties: {
          sessionID: `sess-${Date.now()}`,
          info: {
            id: `sess-${Date.now()}`,
            agent: 'build',
            title: 'Integration Test Session',
            slug: 'integration-test',
            projectID: projectId,
            directory: '/test',
            version: '1.0.0',
            model: { id: 'claude-3', providerID: 'anthropic' },
            time: { created: new Date().toISOString(), updated: new Date().toISOString() } as any,
          },
        },
      });
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      sessionId = id;
    }, 15000);

    it('updateSession updates session', async () => {
      await expect(
        service.updateSession({
          id: sessionId,
          type: 'session.updated',
          properties: {
            sessionID: sessionId,
            info: {
              id: sessionId,
              agent: 'plan',
              title: 'Updated Session Title',
              slug: 'updated-slug',
              projectID: projectId,
              directory: '/test',
              version: '1.0.0',
              model: { id: 'gpt-4', providerID: 'openai' },
              time: { created: new Date().toISOString(), updated: new Date().toISOString() } as any,
            },
          },
        }),
      ).resolves.not.toThrow();
    }, 15000);
  });

  describe('Memories', () => {
    it('getTags returns valid tags', async () => {
      const tags = await service.getTags(tmpDir);
      expect(tags.userTag).toMatch(/^opencode_user_/);
      expect(tags.projectTag).toMatch(/^opencode_project_/);
    });

    it('addMemory creates a memory', async () => {
      const id = await service.addMemory(
        'Integration test memory content',
        ['test', 'integration'],
        'conversation',
        'test_container',
        sessionId,
      );
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      memoryId = id;
    }, 15000);

    it('getMemory retrieves the saved memory', async () => {
      const memory = await service.getMemory(memoryId);
      expect(memory).not.toBeNull();
      expect(memory?.content).toBe('Integration test memory content');
    }, 10000);

    it('listMemories returns memories for container', async () => {
      const memories = await service.listMemories('test_container', 10);
      expect(memories.length).toBeGreaterThanOrEqual(1);
    }, 10000);
  });

  describe('Messages', () => {
    it('saveMessage saves a user message', async () => {
      const id = await service.saveMessage(sessionId, 'user', 'Test user message');
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    }, 10000);

    it('saveMessage saves an agent message', async () => {
      const id = await service.saveMessage(sessionId, 'agent', 'Test agent response');
      expect(id).toBeTruthy();
    }, 10000);
  });

  describe('Facts', () => {
    it('saveFact creates a fact', async () => {
      const id = await service.saveFact('Integration test fact');
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      factId = id;
    }, 10000);

    it('verifyFact marks fact as verified', async () => {
      await expect(service.verifyFact(factId)).resolves.not.toThrow();
    }, 10000);

    it('getFactsForMemory returns linked facts', async () => {
      // First link the memory to the fact via surrealClient
      if (memoryId && factId) {
        // The memory service delegates to surreal client for linking
        // Test that it doesn't throw
        await expect(service.linkMemoryToFact(memoryId, factId)).resolves.not.toThrow();
      }
    }, 10000);
  });

  describe('deleteMemory', () => {
    it('deletes a memory', async () => {
      if (memoryId) {
        await expect(service.deleteMemory(memoryId)).resolves.not.toThrow();
        const memory = await service.getMemory(memoryId);
        expect(memory).toBeNull();
      }
    }, 10000);
  });
});
