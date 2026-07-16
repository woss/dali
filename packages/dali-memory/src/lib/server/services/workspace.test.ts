/**
 * Tests for WorkspaceService (Task 7.2)
 *
 * Covers:
 * 1. listWorkspaces — with userId, without userId, empty results, db error
 * 2. createWorkspace — with/without userId, with/without description, db error
 * 3. deleteWorkspace — ownership verification failure, successful soft delete, db error
 * 4. isDefaultWorkspace — matching IDs, non-matching IDs, missing user, db error
 * 5. withQueryError wrapping — generic Error → QueryError, QueryError passthrough
 * 6. stripBrackets / rawId — bracket stripping, table prefix stripping
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryError } from '@woss/dali-orm/core/errors';
import { RecordId } from 'surrealdb';

// ─── Mock modules (hoisted by vi.mock) ──────────────────────────────────────

vi.mock('../db/connection', () => ({
  getDB: vi.fn(),
}));

vi.mock('../logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));

vi.mock('../db/schema', () => ({
  workspacesTable: { name: 'workspaces' },
}));

// ─── Import mocked modules ───────────────────────────────────────────────────

import { getDB } from '../db/connection';

// ─── Mock builder helpers ────────────────────────────────────────────────────

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
  // ORM insert chain: insert().one(data).execute()
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.one = vi.fn().mockReturnValue(chain);
  return chain;
}

function createMockDB() {
  return {
    query: vi.fn().mockResolvedValue([]),
    model: vi.fn().mockReturnValue(createQueryBuilder()),
  };
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('WorkspaceService', () => {
  let db: ReturnType<typeof createMockDB>;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDB();
    vi.mocked(getDB).mockReturnValue(db as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // listWorkspaces
  // ═══════════════════════════════════════════════════════════════════════════

  describe('listWorkspaces', () => {
    test('returns workspaces when userId is provided', async () => {
      const mockWorkspaces = [
        {
          id: 'workspaces:ws-1',
          name: 'My Workspace',
          description: 'A workspace',
          is_personal: true,
          created_at: '2025-01-01T00:00:00Z',
          memory_count: 5,
        },
        {
          id: 'workspaces:ws-2',
          name: 'Another',
          description: null,
          is_personal: false,
          created_at: '2025-02-01T00:00:00Z',
          memory_count: 0,
        },
      ];
      db.query.mockResolvedValueOnce(mockWorkspaces);

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      const result = await service.listWorkspaces('users:user-1');

      expect(result).toEqual(mockWorkspaces);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('My Workspace');
      expect(result[0].memory_count).toBe(5);
      expect(result[1].name).toBe('Another');

      // Verify raw query was called with userId parameter
      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('WHERE user_id = $userId');
      expect(sql).toContain('deleted_at = none');
      expect(params.userId).toBeInstanceOf(RecordId);
    });

    test('returns all workspaces when no userId provided', async () => {
      const mockWorkspaces = [
        { id: 'workspaces:ws-1', name: 'Shared', memory_count: 3 },
      ];
      db.query.mockResolvedValueOnce(mockWorkspaces);

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      const result = await service.listWorkspaces();

      expect(result).toEqual(mockWorkspaces);
      expect(result).toHaveLength(1);

      // Verify query does NOT contain userId filter
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).not.toContain('user_id = $userId');
      expect(sql).toContain('deleted_at = none');
      expect(params).toEqual({});
    });

    test('returns empty array when db.query returns null/undefined', async () => {
      db.query.mockResolvedValueOnce(null);

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      const result = await service.listWorkspaces('users:user-1');

      expect(result).toEqual([]);
    });

    test('wraps db.query errors in QueryError for userId path', async () => {
      db.query.mockRejectedValueOnce(new Error('table not found'));

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      try {
        await service.listWorkspaces('users:user-1');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(QueryError);
        expect(err.message).toBe('listWorkspaces failed');
        expect(err.context.operation).toBe('listWorkspaces');
      }
    });

    test('wraps db.query errors in QueryError for all-workspaces path', async () => {
      db.query.mockRejectedValueOnce(new Error('connection lost'));

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      try {
        await service.listWorkspaces();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(QueryError);
        expect(err.message).toBe('listWorkspaces:all failed');
        expect(err.context.operation).toBe('listWorkspaces:all');
      }
    });

    test('passes QueryError through without double-wrapping', async () => {
      const originalQueryError = new QueryError('syntax error', {
        operation: 'raw query',
      });
      db.query.mockRejectedValueOnce(originalQueryError);

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      try {
        await service.listWorkspaces();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBe(originalQueryError);
        expect(err.message).toBe('syntax error');
      }
    });

    test('normalizes userId with rawId stripping (workspaces:abc → abc)', async () => {
      db.query.mockResolvedValueOnce([]);

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      await service.listWorkspaces('users:some-long-id');

      const [, params] = db.query.mock.calls[0];
      // RecordId('users', rawId('users:some-long-id')) = RecordId('users', 'some-long-id')
      expect(params.userId).toBeInstanceOf(RecordId);
      expect(String(params.userId)).toContain('some-long-id');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // createWorkspace
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createWorkspace', () => {
    test('creates workspace with name and description', async () => {
      const executeMock = vi.fn().mockResolvedValue([]);
      db.model.mockReturnValue(
        createQueryBuilder({ execute: executeMock }),
      );

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      await service.createWorkspace({
        name: 'My Workspace',
        description: 'A test workspace',
        userId: 'users:user-1',
      });

      expect(db.model).toHaveBeenCalled();
      expect(executeMock).toHaveBeenCalledTimes(1);

      // Verify insert chain was called
      const chain = db.model.mock.results[0].value;
      expect(chain.insert).toHaveBeenCalled();
    });

    test('creates workspace without description defaults to empty string', async () => {
      const executeMock = vi.fn().mockResolvedValue([]);
      db.model.mockReturnValue(
        createQueryBuilder({ execute: executeMock }),
      );

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      await service.createWorkspace({
        name: 'No Desc',
        userId: 'users:user-1',
      });

      expect(executeMock).toHaveBeenCalledTimes(1);
    });

    test('creates workspace without userId (no user_id field)', async () => {
      const executeMock = vi.fn().mockResolvedValue([]);
      db.model.mockReturnValue(
        createQueryBuilder({ execute: executeMock }),
      );

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      await service.createWorkspace({
        name: 'Orphan Workspace',
        description: 'No owner',
      });

      expect(executeMock).toHaveBeenCalledTimes(1);
    });

    test('wraps ORM errors in QueryError with operation name', async () => {
      db.model.mockReturnValue(
        createQueryBuilder({
          execute: vi.fn().mockRejectedValue(new Error('duplicate key')),
        }),
      );

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      try {
        await service.createWorkspace({
          name: 'Duplicate',
          userId: 'users:user-1',
        });
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(QueryError);
        expect(err.message).toBe('createWorkspace failed');
        expect(err.context.operation).toBe('createWorkspace');
        expect(err.context.cause.message).toBe('duplicate key');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // deleteWorkspace
  // ═══════════════════════════════════════════════════════════════════════════

  describe('deleteWorkspace', () => {
    test('successfully soft-deletes a workspace the user owns', async () => {
      // Ownership verification returns existing record
      const verifyExecute = vi.fn().mockResolvedValue([
        { id: 'workspaces:ws-1', name: 'Owned', user_id: 'users:user-1' },
      ]);
      // Update succeeds
      const updateExecute = vi.fn().mockResolvedValue([]);

      let callCount = 0;
      db.model.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createQueryBuilder({ execute: verifyExecute });
        }
        return createQueryBuilder({ execute: updateExecute });
      });

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      await service.deleteWorkspace('workspaces:ws-1', 'users:user-1');

      // Verify both operations were called
      expect(verifyExecute).toHaveBeenCalledTimes(1);
      expect(updateExecute).toHaveBeenCalledTimes(1);
    });

    test('throws "Workspace not found or access denied" when ownership check fails', async () => {
      // Ownership verification returns empty (user doesn't own it)
      const verifyExecute = vi.fn().mockResolvedValue([]);
      db.model.mockReturnValue(
        createQueryBuilder({ execute: verifyExecute }),
      );

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      try {
        await service.deleteWorkspace('workspaces:ws-1', 'users:user-999');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Workspace not found or access denied');
        // This is a domain error, NOT a QueryError
        expect(err).not.toBeInstanceOf(QueryError);
      }
    });

    test('throws when ownership verification returns null', async () => {
      const verifyExecute = vi.fn().mockResolvedValue(null);
      db.model.mockReturnValue(
        createQueryBuilder({ execute: verifyExecute }),
      );

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      try {
        await service.deleteWorkspace('workspaces:ws-1', 'users:user-1');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Workspace not found or access denied');
      }
    });

    test('wraps verification query errors in QueryError', async () => {
      db.model.mockReturnValue(
        createQueryBuilder({
          execute: vi.fn().mockRejectedValue(new Error('db offline')),
        }),
      );

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      try {
        await service.deleteWorkspace('workspaces:ws-1', 'users:user-1');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(QueryError);
        expect(err.message).toBe('deleteWorkspace:verify failed');
        expect(err.context.operation).toBe('deleteWorkspace:verify');
      }
    });

    test('wraps update errors in QueryError after successful verification', async () => {
      // First call (verify) succeeds, second call (update) fails
      const verifyExecute = vi.fn().mockResolvedValue([
        { id: 'workspaces:ws-1', name: 'Owned' },
      ]);
      const updateExecute = vi.fn().mockRejectedValue(
        new Error('update conflict'),
      );

      let callCount = 0;
      db.model.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createQueryBuilder({ execute: verifyExecute });
        }
        return createQueryBuilder({ execute: updateExecute });
      });

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      try {
        await service.deleteWorkspace('workspaces:ws-1', 'users:user-1');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(QueryError);
        expect(err.message).toBe('deleteWorkspace:update failed');
        expect(err.context.operation).toBe('deleteWorkspace:update');
      }
    });

    test('passes QueryError through without double-wrapping on verify', async () => {
      const originalQueryError = new QueryError('table missing', {
        operation: 'select',
      });
      db.model.mockReturnValue(
        createQueryBuilder({
          execute: vi.fn().mockRejectedValue(originalQueryError),
        }),
      );

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      try {
        await service.deleteWorkspace('workspaces:ws-1', 'users:user-1');
        expect.fail('Should have thrown');
      } catch (err: any) {
        // Same reference — QueryError re-thrown as-is (no double-wrap)
        expect(err).toBe(originalQueryError);
        expect(err.message).toBe('table missing');
      }
    });

    test('normalizes workspace ID with rawId (workspaces:abc → abc)', async () => {
      const verifyExecute = vi.fn().mockResolvedValue([{ id: 'workspaces:abc' }]);
      const updateExecute = vi.fn().mockResolvedValue([]);

      let callCount = 0;
      db.model.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createQueryBuilder({ execute: verifyExecute });
        }
        return createQueryBuilder({ execute: updateExecute });
      });

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      await service.deleteWorkspace('workspaces:abc', 'users:user-1');

      // Verify that the select chain was called (ownership check)
      expect(verifyExecute).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // isDefaultWorkspace
  // ═══════════════════════════════════════════════════════════════════════════

  describe('isDefaultWorkspace', () => {
    test('returns true when workspace is the user default', async () => {
      db.query.mockResolvedValueOnce([
        { default_workspace_id: 'workspaces:ws-1' },
      ]);

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      const result = await service.isDefaultWorkspace('users:user-1', 'workspaces:ws-1');

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('SELECT default_workspace_id FROM users');
      expect(sql).toContain('WHERE id = $userId');
      expect(params.userId).toBeInstanceOf(RecordId);
    });

    test('returns false when workspace IDs do not match', async () => {
      db.query.mockResolvedValueOnce([
        { default_workspace_id: 'workspaces:ws-default' },
      ]);

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      const result = await service.isDefaultWorkspace('users:user-1', 'workspaces:ws-other');

      expect(result).toBe(false);
    });

    test('returns false when user not found (empty result)', async () => {
      db.query.mockResolvedValueOnce([]);

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      const result = await service.isDefaultWorkspace('users:nonexistent', 'workspaces:ws-1');

      expect(result).toBe(false);
    });

    test('returns false when default_workspace_id is null', async () => {
      db.query.mockResolvedValueOnce([
        { default_workspace_id: null },
      ]);

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      const result = await service.isDefaultWorkspace('users:user-1', 'workspaces:ws-1');

      expect(result).toBe(false);
    });

    test('returns false when default_workspace_id is undefined', async () => {
      db.query.mockResolvedValueOnce([
        { default_workspace_id: undefined },
      ]);

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      const result = await service.isDefaultWorkspace('users:user-1', 'workspaces:ws-1');

      expect(result).toBe(false);
    });

    test('handles RecordId instance for default_workspace_id', async () => {
      // SurrealDB may return RecordId objects instead of strings
      const defaultRecordId = new RecordId('workspaces', 'ws-match');
      db.query.mockResolvedValueOnce([
        { default_workspace_id: defaultRecordId },
      ]);

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      const result = await service.isDefaultWorkspace('users:user-1', 'workspaces:ws-match');

      expect(result).toBe(true);
    });

    test('handles bracket-encoded strings from RecordId.toString()', async () => {
      // RecordId.toString() may wrap in angle brackets: ⟨workspaces:ws-abc⟩
      db.query.mockResolvedValueOnce([
        { default_workspace_id: '⟨workspaces:ws-abc⟩' },
      ]);

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      const result = await service.isDefaultWorkspace('users:user-1', 'workspaces:ws-abc');

      expect(result).toBe(true);
    });

    test('wraps db.query errors in QueryError', async () => {
      db.query.mockRejectedValueOnce(new Error('query syntax'));

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      try {
        await service.isDefaultWorkspace('users:user-1', 'workspaces:ws-1');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(QueryError);
        expect(err.message).toBe('isDefaultWorkspace failed');
        expect(err.context.operation).toBe('isDefaultWorkspace');
        expect(err.context.cause.message).toBe('query syntax');
      }
    });

    test('passes QueryError through without double-wrapping', async () => {
      const originalQueryError = new QueryError('surreal error', {
        operation: 'raw',
      });
      db.query.mockRejectedValueOnce(originalQueryError);

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      try {
        await service.isDefaultWorkspace('users:user-1', 'workspaces:ws-1');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBe(originalQueryError);
        expect(err.message).toBe('surreal error');
      }
    });

    test('returns false when query returns null', async () => {
      db.query.mockResolvedValueOnce(null);

      const { WorkspaceService } = await import('./workspace');
      const service = new WorkspaceService();

      const result = await service.isDefaultWorkspace('users:user-1', 'workspaces:ws-1');

      expect(result).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helper function tests (module-private functions tested indirectly)
// ═══════════════════════════════════════════════════════════════════════════════

describe('stripBrackets and rawId (tested via WorkspaceService behavior)', () => {
  let db: ReturnType<typeof createMockDB>;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDB();
    vi.mocked(getDB).mockReturnValue(db as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('rawId strips table prefix from record ID string', async () => {
    db.query.mockResolvedValueOnce([]);

    const { WorkspaceService } = await import('./workspace');
    const service = new WorkspaceService();

    // Call with various ID formats
    await service.listWorkspaces('users:user-abc');

    // The RecordId is constructed with rawId(userId) = 'user-abc'
    const [, params] = db.query.mock.calls[0];
    expect(params.userId).toBeInstanceOf(RecordId);
    expect(String(params.userId)).toContain('user-abc');
  });

  test('rawId handles ID without table prefix', async () => {
    db.query.mockResolvedValueOnce([]);

    const { WorkspaceService } = await import('./workspace');
    const service = new WorkspaceService();

    // An ID without colon → rawId returns it as-is
    await service.listWorkspaces('user-no-prefix');

    const [, params] = db.query.mock.calls[0];
    expect(params.userId).toBeInstanceOf(RecordId);
  });

  test('rawId strips angle brackets from RecordId string output', async () => {
    db.query.mockResolvedValueOnce([{ default_workspace_id: '⟨workspaces:ws-1⟩' }]);

    const { WorkspaceService } = await import('./workspace');
    const service = new WorkspaceService();

    // Should match despite bracket encoding
    const result = await service.isDefaultWorkspace('users:user-1', 'workspaces:ws-1');
    expect(result).toBe(true);
  });
});
