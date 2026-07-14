import { connect, getDB } from '$lib/server/db/connection';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/** Look up user RecordId from email. Returns null if no user exists. */
async function getUserIdByEmail(db: ReturnType<typeof getDB>, email: string): Promise<unknown> {
  const [userRow] = await db.query<{ id: unknown }>(
    'SELECT id FROM users WHERE email = $email LIMIT 1',
    { email },
  );
  return userRow?.id ?? null;
}

export const load: PageServerLoad = async (event) => {
  await connect();
  const db = getDB();
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
      const userId = await getUserIdByEmail(db, userEmail);
      if (userId) {
        const result = await db.query<{
          id: string;
          name: string;
          description: string | null;
          is_personal: boolean;
          created_at: string;
          memory_count: number;
        }>(
          'SELECT id, name, description, is_personal, created_at, count(<-workspace_id) AS memory_count FROM workspaces WHERE user_id = $userId ORDER BY name ASC',
          { userId },
        );
        workspaces = result ?? [];
      }
    } else {
      const result = await db.query<{
        id: string;
        name: string;
        description: string | null;
        is_personal: boolean;
        created_at: string;
        memory_count: number;
      }>(
        'SELECT id, name, description, is_personal, created_at, count(<-workspace_id) AS memory_count FROM workspaces ORDER BY name ASC',
        {},
      );
      workspaces = result ?? [];
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
    const db = getDB();
    if (!request) return fail(400, { error: 'No request' });
    const data = await request.formData();
    const name = data.get('name')?.toString();
    const description = data.get('description')?.toString() || '';

    if (!name) {
      return fail(400, { error: 'Workspace name is required' });
    }

    try {
      let query = 'CREATE workspaces CONTENT { name: $name, description: $description';
      const bindings: Record<string, unknown> = { name, description };
      if (userEmail) {
        const userId = await getUserIdByEmail(db, userEmail);
        if (userId) {
          query += ', user_id: $userId';
          bindings.userId = userId;
        }
      }
      query += ' }';
      await db.query<unknown>(query, bindings);
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
    const db = getDB();
    if (!request) return fail(400, { error: 'No request' });
    const data = await request.formData();
    const id = data.get('id')?.toString();

    if (!id) {
      return fail(400, { error: 'Workspace ID is required' });
    }

    try {
      if (userEmail) {
        const userId = await getUserIdByEmail(db, userEmail);
        await db.query<unknown>(
          userId
            ? 'DELETE workspaces WHERE id = $id AND user_id = $userId'
            : 'DELETE workspaces WHERE id = $id',
          userId ? { id, userId } : { id },
        );
      } else {
        await db.query<unknown>('DELETE workspaces WHERE id = $id', { id });
      }
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete workspace';
      return fail(400, { error: msg });
    }
  },
};
