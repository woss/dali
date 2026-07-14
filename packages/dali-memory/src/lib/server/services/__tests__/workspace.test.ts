import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — referenced inside vi.mock() factories
// ---------------------------------------------------------------------------
const { mockState } = vi.hoisted(() => ({
  mockState: {
    orm: null as any,
    embed: vi.fn(),
    embedBatch: vi.fn(),
  },
}));

vi.mock('../../db/connection', () => ({
  getDB: () => {
    if (!mockState.orm) throw new Error('ORM not initialized');
    return mockState.orm;
  },
}));

vi.mock('../../embedder/index', () => ({
  EmbedderService: vi.fn().mockImplementation(function () {
    return {
      initialize: vi.fn().mockResolvedValue(undefined),
      embed: mockState.embed,
      embedBatch: mockState.embedBatch,
    };
  }),
}));

vi.mock('$env/dynamic/private', () => ({
  env: {
    DALI_MEMORY_SECRET: 'test-secret-value',
    DALI_MEMORY_EMBEDDING_MODEL: 'Xenova/all-MiniLM-L6-v2',
    DALI_MEMORY_SURREAL_URL: 'ws://localhost:10101',
    DALI_MEMORY_SURREAL_NS: 'memory',
    DALI_MEMORY_SURREAL_DB: 'memory',
    DALI_MEMORY_SURREAL_USER: 'root',
    DALI_MEMORY_SURREAL_PASS: 'root',
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { DaliORM } from '@woss/dali-orm';
import { pushSchemaFromTableDefs } from '@woss/dali-orm/migration/api';
import { schema } from '../../db/schema';
import { MemoryService } from '../memory';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const EMBEDDING_384 = Array.from({ length: 384 }, (_, i) => (i % 10) / 10);

function rid(id: any): string {
  return typeof id === 'string' ? id : id.toString();
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
let orm: DaliORM;
let wsA: string; // workspace A — always exists
const NONEXISTENT_WS = 'workspaces:nonexistent';

beforeAll(async () => {
  orm = await DaliORM.connect({
    embeddedDriver: { driver: 'embedded', mode: 'memory' },
  });

  await orm.query('DEFINE ANALYZER fts_ascii TOKENIZERS class FILTERS ascii, lowercase');
  await pushSchemaFromTableDefs(orm.getDriver(), schema.getTables());
  await orm.query('DEFINE FIELD metadata.source ON memories TYPE option<string>');

  // Create workspace A — use record-id syntax so wsId is predictable
  await orm.query('CREATE workspaces:ws_a SET name = "workspace A", is_personal = true');
  wsA = 'workspaces:ws_a';

  // Verify workspace EXISTS — query directly by record ID (avoids parameterized WHERE)
  const wsRows = await orm.query('SELECT * FROM workspaces');
  const found = wsRows.find((r: any) => String(r.id) === wsA);
  if (!found) {
    throw new Error(`Test setup: workspace ${wsA} not found among ${wsRows.length} workspaces`);
  }

  mockState.orm = orm;
  mockState.embed.mockResolvedValue({
    embedding: EMBEDDING_384,
    model: 'test-model',
    dimensions: 384,
  });
});

afterAll(async () => {
  if (orm) await orm.disconnect();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('MemoryService workspace validation', () => {
  let service: MemoryService;

  beforeAll(async () => {
    service = new MemoryService(
      new (await vi.importMock('../../embedder/index').then((m: any) => m.EmbedderService))(),
    );
  });

  beforeEach(() => {
    mockState.embed.mockClear();
  });

  // ===========================================================================
  // createMemory — workspace existence check (FR-009)
  // ===========================================================================
  describe('createMemory', () => {
    test('creates memory when workspace exists', async () => {
      const mem: any = await service.createMemory({
        name: 'ws-valid-test',
        content: `create-workspace-exists-${Date.now()}`,
        workspace_id: wsA,
        metadata: { source: 'workspace-test' },
      });
      expect(mem).toBeDefined();
      expect(mem.content).toContain('create-workspace-exists');
      // workspace_id is stored as RecordId; verify via toString
      expect(String(mem.workspace_id)).toBe(wsA);
    });

    test('throws when workspace does not exist', async () => {
      const content = `create-no-ws-${Date.now()}`;
      // The workspace check at line 68-70 fires BEFORE content dedup or embedding
      await expect(
        service.createMemory({
          name: 'no-ws-test',
          content,
          workspace_id: NONEXISTENT_WS,
          metadata: { source: 'workspace-test' },
        }),
      ).rejects.toThrow('Workspace not found');
    });

    test('workspace check fires before content dedup and embedding', async () => {
      // embed should NOT be called
      const content = `create-before-dedup-${Date.now()}`;
      await expect(
        service.createMemory({
          name: 'order-test',
          content,
          workspace_id: NONEXISTENT_WS,
        }),
      ).rejects.toThrow('Workspace not found');
      expect(mockState.embed).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // getMemory — workspace validation (FR-010)
  // ===========================================================================
  describe('getMemory', () => {
    let memId: string;

    beforeAll(async () => {
      const mem: any = await service.createMemory({
        name: 'get-ws-test',
        content: `get-memory-ws-${Date.now()}`,
        workspace_id: wsA,
        slug: 'get-ws-test',
      });
      memId = rid(mem.id);
    });

    test('returns memory when workspace matches', async () => {
      // getMemory with matching workspaceId should succeed (no throw) and return the memory
      const result = await service.getMemory(memId, wsA);
      expect(result).not.toBeNull();
      expect(result!.content).toContain('get-memory-ws-');
    });

    test('returns memory without workspaceId (backward compatible)', async () => {
      const result = await service.getMemory(memId);
      expect(result).not.toBeNull();
      expect(result!.content).toContain('get-memory-ws-');
    });

    test('throws when workspace does not match', async () => {
      await expect(service.getMemory(memId, 'workspaces:other')).rejects.toThrow(
        'Memory not found in workspace',
      );
    });

    test('returns null for missing id with workspaceId', async () => {
      const result = await service.getMemory('memories:nonexistent', wsA);
      expect(result).toBeNull();
    });

    test('returns null for missing id without workspaceId', async () => {
      const result = await service.getMemory('memories:nonexistent');
      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // updateMemory — workspace validation via getMemory delegation (FR-010)
  // ===========================================================================
  describe('updateMemory', () => {
    let memId: string;

    beforeAll(async () => {
      const mem: any = await service.createMemory({
        name: 'update-ws-test',
        content: `update-memory-ws-${Date.now()}`,
        workspace_id: wsA,
        slug: 'update-ws-test',
      });
      memId = rid(mem.id);
    });

    test('updates memory with matching workspaceId', async () => {
      const updated: any = await service.updateMemory(memId, { name: 'updated-name-ws' }, wsA);
      expect(updated.name).toBe('updated-name-ws');
    });

    test('updates memory without workspaceId (backward compatible)', async () => {
      const updated: any = await service.updateMemory(memId, {
        name: 'updated-name-no-ws',
      });
      expect(updated.name).toBe('updated-name-no-ws');
    });

    test('throws when workspace does not match', async () => {
      // getMemory with wrong workspaceId throws, which propagates through updateMemory
      await expect(
        service.updateMemory(memId, { name: 'should-fail' }, 'workspaces:other'),
      ).rejects.toThrow('Memory not found in workspace');
    });

    test('throws when memory not found with workspaceId', async () => {
      await expect(
        service.updateMemory('memories:nonexistent', { name: 'nope' }, wsA),
      ).rejects.toThrow('Memory not found');
    });
  });

  // ===========================================================================
  // deleteMemory — workspace validation (FR-013)
  // ===========================================================================
  describe('deleteMemory', () => {
    test('deletes memory with matching workspaceId', async () => {
      // Create a dedicated memory for delete test
      const mem: any = await service.createMemory({
        name: 'delete-ws-match',
        content: `delete-memory-match-${Date.now()}`,
        workspace_id: wsA,
        slug: 'delete-ws-match',
      });
      const memId = rid(mem.id);

      // Should not throw
      await expect(service.deleteMemory(memId, wsA)).resolves.toBeUndefined();

      // Verify deleted
      const gone = await service.getMemory(memId);
      expect(gone).toBeNull();
    });

    test('deletes memory without workspaceId (backward compatible)', async () => {
      const mem: any = await service.createMemory({
        name: 'delete-no-ws',
        content: `delete-no-ws-${Date.now()}`,
        workspace_id: wsA,
        slug: 'delete-no-ws',
      });
      const memId = rid(mem.id);

      await expect(service.deleteMemory(memId)).resolves.toBeUndefined();
      const gone = await service.getMemory(memId);
      expect(gone).toBeNull();
    });

    test('throws when workspace does not match', async () => {
      const mem: any = await service.createMemory({
        name: 'delete-ws-mismatch',
        content: `delete-mismatch-${Date.now()}`,
        workspace_id: wsA,
        slug: 'delete-ws-mismatch',
      });
      const memId = rid(mem.id);

      // Deleting with wrong workspace should throw
      await expect(service.deleteMemory(memId, 'workspaces:other')).rejects.toThrow(
        'Memory not found in workspace',
      );

      // Memory should still exist
      const stillThere = await service.getMemory(memId);
      expect(stillThere).not.toBeNull();
    });
  });
});
