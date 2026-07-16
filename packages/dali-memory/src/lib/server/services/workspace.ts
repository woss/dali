import { RecordId } from 'surrealdb';
import { QueryError } from '@woss/dali-orm/core/errors';
import { createLogger, CAT } from '../logger';
import { getDB } from '../db/connection';
import { workspacesTable } from '../db/schema';

const log = createLogger(CAT.db);

/** Strip SurrealQL angle-bracket escaping from RecordId.toString() */
function stripBrackets(s: string): string {
  return s.replace(/[⟨⟩]/g, '');
}

/** Strip SurrealDB table prefix from record ID (table:abc → abc) */
function rawId(id: string): string {
  const clean = stripBrackets(id);
  const idx = clean.indexOf(':');
  return idx >= 0 ? clean.slice(idx + 1) : clean;
}

/** Wrap an ORM call with structured QueryError context on failure. */
async function withQueryError<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof QueryError) throw error;
    log.error(`${operation} failed`, {
      error: error instanceof Error ? error.message : String(error),
      className: error?.constructor?.name ?? 'Unknown',
    });
    throw new QueryError(`${operation} failed`, {
      operation,
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

/** Workspace record shape returned by list queries. */
interface WorkspaceRecord {
  id: string;
  name: string;
  description: string | null;
  is_personal: boolean;
  created_at: string;
  memory_count: number;
}

/**
 * Service layer for workspace operations.
 * Uses dali-orm query builders for CRUD; raw queries only for
 * graph-traversal aggregations the ORM cannot express.
 */
export class WorkspaceService {
  /**
   * List all non-deleted workspaces, optionally filtered by user.
   * Includes memory count via incoming graph edge traversal.
   *
   * @param userId - If provided, only return workspaces owned by this user.
   */
  async listWorkspaces(userId?: string): Promise<WorkspaceRecord[]> {
    const db = getDB();

    // Graph traversal count (count(<-workspace_id)) cannot be expressed
    // through the ORM select builder, so we use a parameterized raw query.
    if (userId) {
      const wsUserId = new RecordId('users', rawId(userId));
      const result = await withQueryError('listWorkspaces', () =>
        db.query<WorkspaceRecord>(
          `SELECT id, name, description, is_personal, created_at,
                  count(<-workspace_id) AS memory_count
           FROM workspaces
           WHERE user_id = $userId AND deleted_at = none
           ORDER BY name ASC`,
          { userId: wsUserId },
        ),
      );
      return result ?? [];
    }

    const result = await withQueryError('listWorkspaces:all', () =>
      db.query<WorkspaceRecord>(
        `SELECT id, name, description, is_personal, created_at,
                count(<-workspace_id) AS memory_count
         FROM workspaces
         WHERE deleted_at = none
         ORDER BY name ASC`,
        {},
      ),
    );
    return result ?? [];
  }

  /**
   * Create a new workspace.
   *
   * @param data.name - Workspace name (required).
   * @param data.description - Optional description.
   * @param data.userId - Optional owner user ID.
   */
  async createWorkspace(data: {
    name: string;
    description?: string;
    userId?: string;
  }): Promise<void> {
    const db = getDB();

    const insertData: Record<string, unknown> = {
      name: data.name,
      description: data.description ?? '',
    };

    if (data.userId) {
      insertData.user_id = new RecordId('users', rawId(data.userId));
    }

    await withQueryError('createWorkspace', () =>
      db.model(workspacesTable).insert().one(insertData).execute(),
    );
  }

  /**
   * Soft-delete a workspace by setting deleted_at.
   * Verifies user ownership before deletion.
   * Uses ORM update by record ID to avoid the string-vs-RecordId comparison bug.
   *
   * @param id - Workspace record ID (string form, e.g. "workspaces:abc").
   * @param userId - ID of the user requesting deletion.
   * @throws Error if workspace not found or user lacks ownership.
   */
  async deleteWorkspace(id: string, userId: string): Promise<void> {
    const db = getDB();
    const recordKey = rawId(id);
    const wsUserId = new RecordId('users', rawId(userId));

    // Verify ownership via ORM select
    const existing = await withQueryError('deleteWorkspace:verify', () =>
      db
        .model(workspacesTable)
        .select()
        .where((w) => w.eq('id', new RecordId('workspaces', recordKey)).eq('user_id', wsUserId))
        .limit(1)
        .execute(),
    );

    if (!existing || existing.length === 0) {
      throw new Error('Workspace not found or access denied');
    }

    // Soft delete: update by record ID (fixes string-vs-RecordId bug)
    await withQueryError('deleteWorkspace:update', () =>
      db
        .model(workspacesTable)
        .update()
        .id(recordKey)
        .data({ deleted_at: new Date().toISOString() })
        .execute(),
    );
  }

  /**
   * Check whether a workspace is the user's default workspace.
   *
   * @param userId - User ID to check.
   * @param workspaceId - Workspace ID to compare against default.
   */
  async isDefaultWorkspace(userId: string, workspaceId: string): Promise<boolean> {
    const db = getDB();
    const wsUserId = new RecordId('users', rawId(userId));

    const result = await withQueryError('isDefaultWorkspace', () =>
      db.query<{ default_workspace_id: RecordId | string | null }>(
        'SELECT default_workspace_id FROM users WHERE id = $userId LIMIT 1',
        { userId: wsUserId },
      ),
    );

    if (!result || result.length === 0) return false;
    const defaultId = result[0]?.default_workspace_id;
    if (!defaultId) return false;

    // Normalize both IDs to raw form for reliable comparison
    const defaultRaw =
      defaultId instanceof RecordId ? String(defaultId.id) : rawId(String(defaultId));
    const targetRaw = rawId(workspaceId);
    return defaultRaw === targetRaw;
  }
}

/** Singleton workspace service instance. */
export const workspaceService = new WorkspaceService();
