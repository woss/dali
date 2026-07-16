/**
 * Tests for withQueryError wrapping in tag.ts (Task 2.3)
 *
 * The withQueryError helper wraps ORM calls: generic Error → QueryError with
 * operation context. QueryError re-thrown as-is. Domain errors remain plain Error.
 *
 * Tested through TagService methods since withQueryError is module-private.
 *
 * Coverage:
 * 1. Generic Error from ORM → QueryError with operation context
 * 2. QueryError from ORM → re-thrown as-is (no double-wrap)
 * 3. Cause chain preserved in QueryError.context.cause
 * 4. Non-Error values wrapped in QueryError
 * 5. All 8 public methods succeed on happy path
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryError } from '@woss/dali-orm/core/errors';

// ─── Mock modules (hoisted by vi.mock) ──────────────────────────────────────

vi.mock('../src/lib/server/db/connection', () => ({
  getDB: vi.fn(),
}));

vi.mock('../src/lib/server/db/schema', () => ({
  tagsTable: { name: 'tags' },
  memoryTagsTable: { name: 'memory_tags' },
}));

// ─── Import mocked modules ───────────────────────────────────────────────────

import { getDB } from '../src/lib/server/db/connection';

// ─── Mock builder helpers ────────────────────────────────────────────────────

/** Create a full query builder chain mock with every method needed by tag.ts */
function createQueryBuilder(overrides: Partial<{ execute: any }> = {}) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.execute = overrides.execute ?? vi.fn().mockResolvedValue([]);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.one = vi.fn().mockReturnValue(chain);
  chain.relate = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.to = vi.fn().mockReturnValue(chain);
  return chain;
}

function createMockDB(overrides: { model?: any; query?: any } = {}) {
  return {
    model: overrides.model ?? vi.fn().mockReturnValue(createQueryBuilder()),
    query: overrides.query ?? vi.fn().mockResolvedValue([]),
  };
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('withQueryError wrapping via TagService', () => {
  let db: ReturnType<typeof createMockDB>;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDB();
    vi.mocked(getDB).mockReturnValue(db as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1: Generic Error from ORM → QueryError with operation context ─────

  test('wraps generic Error from db.model chain in QueryError with operation name', async () => {
    db.model.mockReturnValue(
      createQueryBuilder({ execute: vi.fn().mockRejectedValue(new Error('query syntax error')) }),
    );

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    try {
      await service.getTag('tags:test');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.message).toBe('getTag failed');
      expect(err.context.operation).toBe('getTag');
    }
  });

  test('wraps generic Error from db.query in QueryError', async () => {
    db.query = vi.fn().mockRejectedValue(new Error('SQL parse error'));

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    try {
      await service.removeTagFromMemory('memories:mem1', 'tags:tag1');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.message).toBe('removeTagFromMemory failed');
      expect(err.context.operation).toBe('removeTagFromMemory');
    }
  });

  test('wraps generic Error from createTag:select in QueryError', async () => {
    db.model.mockReturnValue(
      createQueryBuilder({ execute: vi.fn().mockRejectedValue(new Error('connection lost')) }),
    );

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    try {
      await service.createTag('test-tag');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.message).toBe('createTag:select failed');
      expect(err.context.operation).toBe('createTag:select');
    }
  });

  test('wraps generic Error from createTag:insert in QueryError', async () => {
    // First call (select) succeeds with empty result
    const selectBuilder = createQueryBuilder({
      execute: vi.fn().mockResolvedValue([]),
    });
    // Second call (insert) fails
    const insertBuilder = createQueryBuilder({
      execute: vi.fn().mockRejectedValue(new Error('constraint violation')),
    });

    let callCount = 0;
    db.model.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? selectBuilder : insertBuilder;
    });

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    try {
      await service.createTag('new-tag');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.message).toBe('createTag:insert failed');
      expect(err.context.operation).toBe('createTag:insert');
    }
  });

  // ── 2: QueryError from ORM → re-thrown as-is (no double-wrap) ─────────

  test('re-throws QueryError as-is without double-wrapping', async () => {
    const originalQueryError = new QueryError('surreal syntax error', {
      operation: 'raw query',
    });
    db.model.mockReturnValue(
      createQueryBuilder({ execute: vi.fn().mockRejectedValue(originalQueryError) }),
    );

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    try {
      await service.getTag('tags:test');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      // Same reference — no double wrapping
      expect(err).toBe(originalQueryError);
      expect(err.message).toBe('surreal syntax error');
      expect(err.context.operation).toBe('raw query');
    }
  });

  test('re-throws QueryError from db.query as-is', async () => {
    const originalQueryError = new QueryError('runtime query failure', {
      operation: 'surreal runtime',
    });
    db.query = vi.fn().mockRejectedValue(originalQueryError);

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    try {
      await service.unionTags(['tag1', 'tag2']);
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err).toBe(originalQueryError);
      expect(err.message).toBe('runtime query failure');
    }
  });

  // ── 3: Cause chain preserved ─────────────────────────────────────────

  test('QueryError.context.cause preserves original error reference', async () => {
    const originalError = new Error('disk full');
    db.model.mockReturnValue(
      createQueryBuilder({ execute: vi.fn().mockRejectedValue(originalError) }),
    );

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    try {
      await service.findByName('test');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.context.cause).toBe(originalError);
      expect(err.context.cause.message).toBe('disk full');
      expect(err.context.operation).toBe('findByName');
    }
  });

  // ── 4: Non-Error values wrapped in QueryError ────────────────────────

  test('wraps non-Error value (string) from ORM in QueryError', async () => {
    db.model.mockReturnValue(
      createQueryBuilder({ execute: vi.fn().mockRejectedValue('string failure') }),
    );

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    try {
      await service.listTags();
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.message).toBe('listTags failed');
      expect(err.context.cause).toBeInstanceOf(Error);
      expect(err.context.cause.message).toBe('string failure');
    }
  });

  test('wraps null value from ORM in QueryError', async () => {
    db.model.mockReturnValue(
      createQueryBuilder({ execute: vi.fn().mockRejectedValue(null) }),
    );

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    try {
      await service.getTag('tags:test');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.context.cause).toBeInstanceOf(Error);
      expect(err.context.cause.message).toBe('null');
    }
  });

  test('wraps undefined value from ORM in QueryError', async () => {
    db.model.mockReturnValue(
      createQueryBuilder({ execute: vi.fn().mockRejectedValue(undefined) }),
    );

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    try {
      await service.findByName('test');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.context.cause).toBeInstanceOf(Error);
      expect(err.context.cause.message).toBe('undefined');
    }
  });

  // ── 5: Operation names match the withQueryError string arg ────────────

  test('operation name matches the withQueryError call-site string for listTags', async () => {
    const originalError = new Error('boom');
    db.model.mockReturnValue(
      createQueryBuilder({ execute: vi.fn().mockRejectedValue(originalError) }),
    );

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    try {
      await service.listTags();
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.context.operation).toBe('listTags');
      expect(err.message).toBe('listTags failed');
    }
  });

  test('operation name matches for addTagToMemory', async () => {
    const builder = createQueryBuilder({
      execute: vi.fn().mockRejectedValue(new Error('relate failed')),
    });
    db.model.mockReturnValue(builder);

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    try {
      await service.addTagToMemory('memories:mem1', 'tags:tag1');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.context.operation).toBe('addTagToMemory');
      expect(err.message).toBe('addTagToMemory failed');
    }
  });

  test('operation name matches for getMemoryTags', async () => {
    db.query = vi.fn().mockRejectedValue(new Error('graph traversal failed'));

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    try {
      await service.getMemoryTags('memories:mem1');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.context.operation).toBe('getMemoryTags');
      expect(err.message).toBe('getMemoryTags failed');
    }
  });

  test('operation name matches for intersectTags', async () => {
    db.query = vi.fn().mockRejectedValue(new Error('intersect failed'));

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    try {
      await service.intersectTags(['tag1', 'tag2']);
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QueryError);
      expect(err.context.operation).toBe('intersectTags');
      expect(err.message).toBe('intersectTags failed');
    }
  });

  // ── 6: Successful path — all 8 methods ───────────────────────────────

  test('createTag returns new tag when no existing tag with same name', async () => {
    const selectBuilder = createQueryBuilder({
      execute: vi.fn().mockResolvedValue([]),
    });
    const insertBuilder = createQueryBuilder({
      execute: vi.fn().mockResolvedValue([{ id: 'tags:new-tag', name: 'new-tag' }]),
    });
    // insert().one() returns the builder itself
    insertBuilder.one = vi.fn().mockReturnValue(insertBuilder);

    let callCount = 0;
    db.model.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? selectBuilder : insertBuilder;
    });

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    const result = await service.createTag('new-tag');
    expect(result).toEqual({ id: 'tags:new-tag', name: 'new-tag' });
    expect(selectBuilder.where).toHaveBeenCalled();
    expect(insertBuilder.one).toHaveBeenCalledWith({ name: 'new-tag' });
  });

  test('createTag returns existing tag if name already exists', async () => {
    const existingTag = { id: 'tags:existing', name: 'existing' };
    const selectBuilder = createQueryBuilder({
      execute: vi.fn().mockResolvedValue([existingTag]),
    });
    const insertBuilder = createQueryBuilder({
      execute: vi.fn().mockResolvedValue([]),
    });

    let callCount = 0;
    db.model.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? selectBuilder : insertBuilder;
    });

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    const result = await service.createTag('existing');
    expect(result).toEqual(existingTag);
    // Insert should NOT be called
    expect(insertBuilder.one).not.toHaveBeenCalled();
  });

  test('getTag returns tag by id', async () => {
    const tag = { id: 'tags:tag1', name: 'important' };
    db.model.mockReturnValue(
      createQueryBuilder({ execute: vi.fn().mockResolvedValue([tag]) }),
    );

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    const result = await service.getTag('tags:tag1');
    expect(result).toEqual(tag);
  });

  test('getTag returns null when not found', async () => {
    db.model.mockReturnValue(
      createQueryBuilder({ execute: vi.fn().mockResolvedValue([]) }),
    );

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    const result = await service.getTag('tags:nonexistent');
    expect(result).toBeNull();
  });

  test('findByName returns tag by name', async () => {
    const tag = { id: 'tags:tag1', name: 'research' };
    db.model.mockReturnValue(
      createQueryBuilder({ execute: vi.fn().mockResolvedValue([tag]) }),
    );

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    const result = await service.findByName('research');
    expect(result).toEqual(tag);
  });

  test('findByName returns null when not found', async () => {
    db.model.mockReturnValue(
      createQueryBuilder({ execute: vi.fn().mockResolvedValue([]) }),
    );

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    const result = await service.findByName('nonexistent');
    expect(result).toBeNull();
  });

  test('listTags returns all tags sorted by name', async () => {
    const tags = [
      { id: 'tags:a', name: 'alpha' },
      { id: 'tags:b', name: 'beta' },
    ];
    const builder = createQueryBuilder({
      execute: vi.fn().mockResolvedValue(tags),
    });
    db.model.mockReturnValue(builder);

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    const result = await service.listTags();
    expect(result).toEqual(tags);
    expect(builder.orderBy).toHaveBeenCalledWith('name', 'ASC');
  });

  test('addTagToMemory calls relate with correct args', async () => {
    const builder = createQueryBuilder({
      execute: vi.fn().mockResolvedValue([]),
    });
    db.model.mockReturnValue(builder);

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    await service.addTagToMemory('memories:mem1', 'tags:tag1');
    expect(builder.relate).toHaveBeenCalled();
    expect(builder.from).toHaveBeenCalledWith('memories:mem1');
    expect(builder.to).toHaveBeenCalledWith('tags:tag1');
    expect(builder.execute).toHaveBeenCalled();
  });

  test('removeTagFromMemory calls db.query with DELETE', async () => {
    db.query = vi.fn().mockResolvedValue([]);

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    await service.removeTagFromMemory('memories:mem1', 'tags:tag1');
    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('DELETE FROM memory_tags');
    expect(sql).toContain('$memId');
    expect(sql).toContain('$tagId');
    expect(params.memId).toBeDefined();
    expect(params.tagId).toBeDefined();
  });

  test('getMemoryTags returns tags from graph traversal', async () => {
    const tags = [{ id: 'tags:tag1', name: 'important' }];
    db.query = vi.fn().mockResolvedValue([{ tags }]);

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    const result = await service.getMemoryTags('memories:mem1');
    expect(result).toEqual(tags);
    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql] = db.query.mock.calls[0];
    expect(sql).toContain('->memory_tags->tags');
  });

  test('getMemoryTags returns empty array when no tags', async () => {
    db.query = vi.fn().mockResolvedValue([]);

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    const result = await service.getMemoryTags('memories:mem1');
    expect(result).toEqual([]);
  });

  test('getMemoryTags returns single tag object wrapped in array', async () => {
    const tag = { id: 'tags:tag1', name: 'solo' };
    db.query = vi.fn().mockResolvedValue([{ tags: tag }]);

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    const result = await service.getMemoryTags('memories:mem1');
    expect(result).toEqual([tag]);
  });

  test('getMemoryTags returns empty array when tags field is null', async () => {
    db.query = vi.fn().mockResolvedValue([{ tags: null }]);

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    const result = await service.getMemoryTags('memories:mem1');
    expect(result).toEqual([]);
  });

  test('unionTags returns memories matching any tag', async () => {
    const memories = [
      { id: 'memories:m1', name: 'mem1' },
      { id: 'memories:m2', name: 'mem2' },
    ];
    db.query = vi.fn().mockResolvedValue(memories);

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    const result = await service.unionTags(['tag1', 'tag2']);
    expect(result).toEqual(memories);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('CONTAINSANY');
    expect(params.tagNames).toEqual(['tag1', 'tag2']);
  });

  test('unionTags returns empty array for empty input', async () => {
    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    const result = await service.unionTags([]);
    expect(result).toEqual([]);
    // db.query should NOT be called
    expect(db.query).not.toHaveBeenCalled();
  });

  test('intersectTags returns memories matching all tags', async () => {
    const memories = [{ id: 'memories:m1', name: 'mem1' }];
    db.query = vi.fn().mockResolvedValue(memories);

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    const result = await service.intersectTags(['tag1', 'tag2']);
    expect(result).toEqual(memories);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('CONTAINS $tagName0');
    expect(sql).toContain('CONTAINS $tagName1');
    expect(params.tagName0).toBe('tag1');
    expect(params.tagName1).toBe('tag2');
  });

  test('intersectTags returns empty array for empty input', async () => {
    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    const result = await service.intersectTags([]);
    expect(result).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('intersectTags handles single tag', async () => {
    db.query = vi.fn().mockResolvedValue([{ id: 'memories:m1', name: 'mem1' }]);

    const { TagService } = await import('../src/lib/server/services/tag');
    const service = new TagService();

    const result = await service.intersectTags(['only-tag']);
    expect(result).toHaveLength(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('CONTAINS $tagName0');
    expect(sql).not.toContain('tagName1');
    expect(params.tagName0).toBe('only-tag');
  });
});
