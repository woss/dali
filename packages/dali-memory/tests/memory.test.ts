/**
 * Tests for withQueryError wrapping in memory.ts (Task 2.2)
 *
 * The withQueryError helper wraps ORM calls: generic Error → QueryError with
 * operation context. QueryError re-thrown as-is. Domain errors remain plain Error.
 *
 * Tested through MemoryService methods since withQueryError is module-private.
 *
 * Coverage:
 * 1. Generic Error from ORM → QueryError with operation context
 * 2. QueryError from ORM → re-thrown as-is (no double-wrap)
 * 3. Domain errors remain plain Error (NOT QueryError)
 * 4. Cause chain preserved in QueryError.context.cause
 * 5. Non-Error values wrapped in QueryError
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryError } from '@woss/dali-orm/core/errors';
import { RecordId } from 'surrealdb';

// ─── Mock modules (hoisted by vi.mock) ──────────────────────────────────────

vi.mock('../src/lib/server/db/connection', () => ({
  getDB: vi.fn(),
}));

vi.mock('../src/lib/server/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));

vi.mock('../src/lib/server/config', () => ({
  getConfig: vi.fn(() => ({
    DALI_MEMORY_EMBEDDING_PROVIDER: 'test-provider',
  })),
}));

vi.mock('../src/lib/server/chunking', () => ({
  chunkContent: vi.fn((content: string) => [{ text: content, chunkIndex: 0, section: '' }]),
}));

// ─── Import mocked modules ───────────────────────────────────────────────────

import { getDB } from '../src/lib/server/db/connection';

// ─── Mock builder helpers ────────────────────────────────────────────────────

/** Create a full query builder chain mock with every method needed by memory.ts */
function createQueryBuilder(overrides: Partial<{ execute: any }> = {}) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.start = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.execute = overrides.execute ?? vi.fn().mockResolvedValue([]);
  chain.id = vi.fn().mockReturnValue(chain);
  chain.data = vi.fn().mockReturnValue(chain);
  chain.create = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.relate = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.to = vi.fn().mockReturnValue(chain);
  return chain;
}

function createMockDB(overrides: { driver?: any } = {}) {
  const mockDriver = {
    select: vi.fn().mockResolvedValue([]),
    ...(overrides.driver ?? {}),
  };

  return {
    query: vi.fn().mockResolvedValue([]),
    model: vi.fn().mockReturnValue(createQueryBuilder()),
    getDriver: vi.fn().mockReturnValue(mockDriver),
  };
}

function createMockEmbedder() {
  return {
    embed: vi.fn().mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
      model: 'test-model',
      dimensions: 3,
    }),
  };
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('withQueryError wrapping via MemoryService', () => {
  let embedder: ReturnType<typeof createMockEmbedder>;
  let db: ReturnType<typeof createMockDB>;

  beforeEach(() => {
    vi.clearAllMocks();
    embedder = createMockEmbedder();
    db = createMockDB();
    vi.mocked(getDB).mockReturnValue(db as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1: Generic Error from ORM → QueryError with operation context ─────

  test('wraps generic Error from driver.select in QueryError with operation name', async () => {
    db.getDriver().select.mockRejectedValueOnce(new Error('connection timeout'));

    const { MemoryService } = await import('../src/lib/server/services/memory');
    const service = new MemoryService(embedder as any);

    try {
      await service.getMemory('memories:test');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.message).toBe('get memory failed');
      expect(err.context.operation).toBe('get memory');
    }
  });

  test('wraps generic Error from db.model chain in QueryError', async () => {
    db.model.mockReturnValue(
      createQueryBuilder({ execute: vi.fn().mockRejectedValue(new Error('query syntax error')) }),
    );

    const { MemoryService } = await import('../src/lib/server/services/memory');
    const service = new MemoryService(embedder as any);

    try {
      await service.listMemories('ws-1');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.message).toBe('list memories failed');
      expect(err.context.operation).toBe('list memories');
    }
  });

  test('wraps generic Error from db.query in QueryError', async () => {
    // getMemory uses driver.select, but createMemory uses db.query for workspace validation
    db.query.mockRejectedValueOnce(new Error('SQL parse error'));

    const { MemoryService } = await import('../src/lib/server/services/memory');
    const service = new MemoryService(embedder as any);

    try {
      await service.createMemory({
        name: 'test',
        content: 'test content',
        workspace_id: 'ws-1',
      });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.message).toBe('workspace validation failed');
      expect(err.context.operation).toBe('workspace validation');
    }
  });

  // ── 2: QueryError from ORM → re-thrown as-is (no double-wrap) ─────────

  test('re-throws QueryError as-is without double-wrapping', async () => {
    const originalQueryError = new QueryError('surreal syntax error', {
      operation: 'raw query',
    });
    db.getDriver().select.mockRejectedValueOnce(originalQueryError);

    const { MemoryService } = await import('../src/lib/server/services/memory');
    const service = new MemoryService(embedder as any);

    try {
      await service.getMemory('memories:test');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      // Same reference — no double wrapping
      expect(err).toBe(originalQueryError);
      expect(err.message).toBe('surreal syntax error');
      expect(err.context.operation).toBe('raw query');
    }
  });

  // ── 3: Domain errors remain plain Error ──────────────────────────────

  test('domain error "Workspace not found" is plain Error, NOT QueryError', async () => {
    // Workspace validation query returns empty result
    db.query.mockResolvedValueOnce([]);

    const { MemoryService } = await import('../src/lib/server/services/memory');
    const service = new MemoryService(embedder as any);

    try {
      await service.createMemory({
        name: 'test',
        content: 'test content',
        workspace_id: 'ws-1',
      });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(QueryError);
      expect(err.message).toBe('Workspace not found');
    }
  });

  test('domain error "Memory with this content already exists" is plain Error', async () => {
    // Workspace validation returns existing workspace
    db.query.mockResolvedValueOnce([{ id: 'workspaces:ws-1' }]);
    // Content dedup: model().select().where().limit(1).execute() returns existing
    db.model.mockReturnValue(
      createQueryBuilder({
        execute: vi.fn().mockResolvedValue([{ content: 'test content', workspace_id: 'workspaces:ws-1' }]),
      }),
    );

    const { MemoryService } = await import('../src/lib/server/services/memory');
    const service = new MemoryService(embedder as any);

    try {
      await service.createMemory({
        name: 'test',
        content: 'test content',
        workspace_id: 'ws-1',
      });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(QueryError);
      expect(err.message).toMatch(/Memory with this content already exists/);
    }
  });

  test('domain error "Memory not found" is plain Error, NOT QueryError', async () => {
    // driver.select returns empty — memory not found
    db.getDriver().select.mockResolvedValue([]);

    const { MemoryService } = await import('../src/lib/server/services/memory');
    const service = new MemoryService(embedder as any);

    // getMemory returns null, but updateMemory calls getMemory then throws
    try {
      await service.updateMemory('memories:nonexistent', { name: 'new' }, 'ws-1');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(QueryError);
      expect(err.message).toMatch(/Memory not found/);
    }
  });

  // ── 4: Cause chain preserved ─────────────────────────────────────────

  test('QueryError.context.cause preserves original error reference', async () => {
    const originalError = new Error('disk full');
    db.getDriver().select.mockRejectedValueOnce(originalError);

    const { MemoryService } = await import('../src/lib/server/services/memory');
    const service = new MemoryService(embedder as any);

    try {
      await service.getMemory('memories:test');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      // Same reference — cause preserves the original error object
      expect(err.context.cause).toBe(originalError);
      expect(err.context.cause.message).toBe('disk full');
      expect(err.context.operation).toBe('get memory');
    }
  });

  // ── 5: Non-Error values wrapped in QueryError ────────────────────────

  test('wraps non-Error value (string) from ORM in QueryError', async () => {
    db.getDriver().select.mockRejectedValueOnce('string failure');

    const { MemoryService } = await import('../src/lib/server/services/memory');
    const service = new MemoryService(embedder as any);

    try {
      await service.getMemory('memories:test');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.message).toBe('get memory failed');
      // Non-Error wrapped in new Error(String(value))
      expect(err.context.cause).toBeInstanceOf(Error);
      expect(err.context.cause.message).toBe('string failure');
    }
  });

  test('wraps null value from ORM in QueryError', async () => {
    db.getDriver().select.mockRejectedValueOnce(null);

    const { MemoryService } = await import('../src/lib/server/services/memory');
    const service = new MemoryService(embedder as any);

    try {
      await service.getMemory('memories:test');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.context.cause).toBeInstanceOf(Error);
      expect(err.context.cause.message).toBe('null');
    }
  });

  test('wraps undefined value from ORM in QueryError', async () => {
    db.getDriver().select.mockRejectedValueOnce(undefined);

    const { MemoryService } = await import('../src/lib/server/services/memory');
    const service = new MemoryService(embedder as any);

    try {
      await service.getMemory('memories:test');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.context.cause).toBeInstanceOf(Error);
      expect(err.context.cause.message).toBe('undefined');
    }
  });

  // ── 6: Operation names match the withQueryError string arg ────────────

  test('operation name matches the withQueryError call-site string', async () => {
    const originalError = new Error('boom');
    db.getDriver().select.mockRejectedValueOnce(originalError);

    const { MemoryService } = await import('../src/lib/server/services/memory');
    const service = new MemoryService(embedder as any);

    try {
      await service.getMemory('memories:test');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      // Matches the 'get memory' arg in withQueryError('get memory', ...)
      expect(err.context.operation).toBe('get memory');
      expect(err.message).toBe('get memory failed');
    }
  });

  test('listAllMemories wraps errors with correct operation name', async () => {
    db.model.mockReturnValue(
      createQueryBuilder({ execute: vi.fn().mockRejectedValue(new Error('table missing')) }),
    );

    const { MemoryService } = await import('../src/lib/server/services/memory');
    const service = new MemoryService(embedder as any);

    try {
      await service.listAllMemories();
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.context.operation).toBe('list all memories');
      expect(err.message).toBe('list all memories failed');
    }
  });

  // ── 7: Successful path — no QueryError ───────────────────────────────

  test('successful getMemory returns result without throwing', async () => {
    const rid = new RecordId('memories', 'test-slug');
    db.getDriver().select.mockResolvedValueOnce([
      { id: rid, name: 'test', content: 'content', slug: 'test-slug' },
    ]);

    const { MemoryService } = await import('../src/lib/server/services/memory');
    const service = new MemoryService(embedder as any);

    const result = await service.getMemory('memories:test-slug');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('test');
  });

  test('successful listMemories returns results without throwing', async () => {
    const rid = new RecordId('memories', 'mem1');
    db.model.mockReturnValue(
      createQueryBuilder({
        execute: vi.fn().mockResolvedValue([
          { id: rid, name: 'mem1', content: 'c1' },
        ]),
      }),
    );

    const { MemoryService } = await import('../src/lib/server/services/memory');
    const service = new MemoryService(embedder as any);

    const results = await service.listMemories('ws-1');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('mem1');
  });
});
