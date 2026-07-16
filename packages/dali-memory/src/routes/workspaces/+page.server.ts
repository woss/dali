import { connect, getDB } from '$lib/server/db/connection';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { workspaceService } from '$lib/server/services/workspace';

/**
 * Look up user RecordId from email. Returns the raw ID string (e.g. "abc123")
 * or null if no user exists.
 */
async function getUserIdByEmail(db: ReturnType<typeof getDB>, email: string): Promise<string | null> {
  const [userRow] = await db.query<{ id: unknown }>(
    'SELECT id FROM users WHERE email = $email LIMIT 1',
    { email },
  );
  if (!userRow?.id) return null;
  // Extract raw ID from RecordId, stripping table prefix and angle brackets
  const raw = String(userRow.id).replace(/[⟨⟩]/g, '');
  const idx = raw.indexOf(':');
  return idx >= 0 ? raw.slice(idx + 1) : raw;
}

export const load: PageServerLoad = async (event) => {
  await connect();
  const userEmail = event?.locals?.userEmail;

  let workspaces: Array<{
    id: string;
    name: string;
    description: string | null;
    is_personal: boolean;
    created_at: string;
    memory_count: number;
  }> = [];
  try {
    if (userEmail) {
      const db = getDB();
      const userId = await getUserIdByEmail(db, userEmail);
      if (userId) {
        workspaces = await workspaceService.listWorkspaces(userId);
      }
    } else {
      workspaces = await workspaceService.listWorkspaces();
    }
  } catch {
    // workspaces stays [] — graceful degradation
  }

  const workspacesWithSlug = workspaces.map((ws) => ({
    id: String(ws.id),
    name: ws.name,
    description: ws.description,
    is_personal: ws.is_personal,
    memory_count: ws.memory_count != null ? Number(ws.memory_count) : undefined,
    created_at:
      typeof ws.created_at === 'object' && ws.created_at !== null
        ? ((ws.created_at as Date).toISOString?.() ?? String(ws.created_at))
        : String(ws.created_at),
    slug:
      String(ws.id)
        .replace(/[⟨⟩]/g, '')
        .split(':')
        .pop() ?? String(ws.id),
  }));

  return { workspaces: workspacesWithSlug };
};

export const actions: Actions = {
  create: async (event) => {
    const request = event?.request;
    const userEmail = event?.locals?.userEmail;
    await connect();
    if (!request) return fail(400, { error: 'No request' });
    const data = await request.formData();
    const name = data.get('name')?.toString();
    const description = data.get('description')?.toString() || '';

    if (!name) {
      return fail(400, { error: 'Workspace name is required' });
    }

    try {
      let userId: string | undefined;
      if (userEmail) {
        const db = getDB();
        const resolvedId = await getUserIdByEmail(db, userEmail);
        if (resolvedId) userId = resolvedId;
      }

      await workspaceService.createWorkspace({ name, description, userId });
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create workspace';
      return fail(400, { error: msg });
    }
  },

  delete: async (event) => {
    const request = event?.request;
    const userEmail = event?.locals?.userEmail;
    await connect();
    if (!request) return fail(400, { error: 'No request' });
    const data = await request.formData();
    const id = data.get('id')?.toString();

    if (!id) {
      return fail(400, { error: 'Workspace ID is required' });
    }

    try {
      if (!userEmail) {
        return fail(400, { error: 'Authentication required' });
      }

      const db = getDB();
      const userId = await getUserIdByEmail(db, userEmail);
      if (!userId) {
        return fail(400, { error: 'User not found' });
      }

      // Check if workspace is the user's default workspace
      const isDefault = await workspaceService.isDefaultWorkspace(userId, id);
      if (isDefault) {
        return fail(400, { error: 'Cannot delete default workspace' });
      }

      // Soft delete via service (uses ORM update by record ID)
      await workspaceService.deleteWorkspace(id, userId);
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete workspace';
      return fail(400, { error: msg });
    }
  },
};
