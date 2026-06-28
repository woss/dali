import { connect, getDB } from '$lib/server/db/connection';
import { toPlain } from '../../lib/utils/serialization';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  await connect();
  const db = getDB();
  const workspaces = await db.query<{
    id: string;
    name: string;
    description: string | null;
    is_personal: boolean;
    created_at: string;
  }>('SELECT id, name, description, is_personal, created_at FROM workspaces ORDER BY name ASC');
  return { workspaces: toPlain(workspaces) };
};

export const actions: Actions = {
  create: async ({ request }) => {
    await connect();
    const db = getDB();
    const data = await request.formData();
    const name = data.get('name')?.toString();
    const description = data.get('description')?.toString() || '';

    if (!name) {
      return fail(400, { error: 'Workspace name is required' });
    }

    try {
      await db.query<unknown>(
        'CREATE workspaces CONTENT { name: $name, description: $description }',
        { name, description },
      );
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create workspace';
      return fail(400, { error: msg });
    }
  },

  delete: async ({ request }) => {
    await connect();
    const db = getDB();
    const data = await request.formData();
    const id = data.get('id')?.toString();

    if (!id) {
      return fail(400, { error: 'Workspace ID is required' });
    }

    try {
      await db.query<unknown>('DELETE workspaces WHERE id = $id', { id });
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete workspace';
      return fail(400, { error: msg });
    }
  },
};
