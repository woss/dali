import { connect } from '$lib/server/db/connection';
import { EmbedderService } from '$lib/server/embedder';
import { MemoryService } from '$lib/server/services/memory';
import { toPlain } from '../../lib/utils/serialization';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const db = await connect();
  const embedder = new EmbedderService();
  await embedder.initialize();
  const memoryService = new MemoryService(embedder);
  const workspaces = await db.query<{
    id: string;
    name: string;
    description: string | null;
    is_personal: boolean;
    created_at: string;
  }>('SELECT id, name, description, is_personal, created_at FROM workspaces ORDER BY name ASC');

  const selectedWs = url.searchParams.get('workspace');
  const activeWorkspaceId = selectedWs || (workspaces.length > 0 ? workspaces[0].id : null);

  const memories = activeWorkspaceId
    ? await memoryService.listMemories(activeWorkspaceId, { limit: 100 })
    : [];

  return {
    workspaces: toPlain(workspaces),
    memories: toPlain(memories),
    activeWorkspaceId: toPlain(activeWorkspaceId),
  };
};

export const actions: Actions = {
  create: async ({ request }) => {
    await connect();
    const embedder = new EmbedderService();
    await embedder.initialize();
    const memoryService = new MemoryService(embedder);

    const data = await request.formData();
    const name = data.get('name')?.toString();
    const content = data.get('content')?.toString();
    const memory_type = data.get('memory_type')?.toString() || 'fact';
    const workspace_id = data.get('workspace_id')?.toString();

    if (!name || !content || !workspace_id) {
      return fail(400, { error: 'Name, content, and workspace are required' });
    }

    try {
      const memory = await memoryService.createMemory({
        name,
        content,
        memory_type,
        workspace_id,
      });
      return { success: true, memory: toPlain(memory) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create memory';
      return fail(400, { error: msg });
    }
  },

  delete: async ({ request }) => {
    await connect();
    const embedder = new EmbedderService();
    await embedder.initialize();
    const memoryService = new MemoryService(embedder);

    const data = await request.formData();
    const id = data.get('id')?.toString();

    if (!id) {
      return fail(400, { error: 'Memory ID is required' });
    }

    try {
      await memoryService.deleteMemory(id);
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete memory';
      return fail(400, { error: msg });
    }
  },
};
