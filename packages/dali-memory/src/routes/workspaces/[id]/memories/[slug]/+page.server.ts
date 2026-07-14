import { error, redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { connect } from '$lib/server/db/connection';
import { RecordId } from 'surrealdb';
import { EmbedderService } from '$lib/server/embedder';
import { MemoryService } from '$lib/server/services/memory';
import { TagService } from '$lib/server/services/tag';
import { toPlain } from '../../../../../lib/utils/serialization';
import { createLogger } from '$lib/server/logger';

/**
 * Extract clean workspace ID string from a RecordId or qualified string.
 * memory.workspace_id is a RecordId('workspaces', '...') from the DB,
 * but params.id is a bare slug like "rqhh4az3tj18qndosaw3".
 */
function wsId(ws: unknown): string {
  if (ws instanceof RecordId) return String(ws.id);
  const s = String(ws);
  return s.includes(':') ? s.split(':').pop()! : s;
}

export const load: PageServerLoad = async ({ params }) => {
  const workspaceId = params.id;
  const { slug } = params;

  const db = await connect();
  const embedder = new EmbedderService();
  await embedder.initialize();
  const memoryService = new MemoryService(embedder);

  // Verify workspace exists
  const wsRecordId = new RecordId('workspaces', workspaceId);
  const workspaceRows = await db.query<{
    id: string;
    name: string;
  }>('SELECT id, name FROM workspaces WHERE id = $id', {
    id: wsRecordId,
  });
  const workspace = workspaceRows?.[0] ?? null;
  if (!workspace) {
    error(404, 'Workspace not found');
  }

  const memory = await memoryService.getMemory(slug);
  if (!memory) {
    error(404, 'Memory not found');
  }

  if (wsId(memory.workspace_id) !== workspaceId) {
    error(404, 'Memory not found in this workspace');
  }

  const tagService = new TagService();
  const memId = memory.id.toString();
  const tags = await tagService.getMemoryTags(memId);

  return { workspace: toPlain(workspace), memory: toPlain(memory), tags: toPlain(tags) };
};

export const actions: Actions = {
  edit: async ({ request, params }) => {
    await connect();
    const embedder = new EmbedderService();
    await embedder.initialize();
    const memoryService = new MemoryService(embedder);

    // Verify workspace membership
    const memory = await memoryService.getMemory(params.slug);
    if (!memory) {
      return fail(404, { error: 'Memory not found' });
    }
    if (wsId(memory.workspace_id) !== params.id) {
      return fail(404, { error: 'Memory not found in this workspace' });
    }

    const data = await request.formData();
    const name = data.get('name')?.toString();
    const content = data.get('content')?.toString();

    if (!name || !content) {
      createLogger(['dali-memory', 'http']).warn('edit action validation failed: missing fields', {
        name: !!name,
        content: !!content,
      });
      return fail(400, { error: 'Name and content are required' });
    }

    try {
      await memoryService.updateMemory(params.slug, { name, content });
      return { success: true, action: 'edit' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update memory';
      createLogger(['dali-memory', 'http']).error('edit action failed', {
        error: msg,
        slug: params.slug,
      });
      return fail(400, { error: msg });
    }
  },

  delete: async ({ request, params }) => {
    await connect();
    const embedder = new EmbedderService();
    await embedder.initialize();
    const memoryService = new MemoryService(embedder);

    // Verify workspace membership
    const memory = await memoryService.getMemory(params.slug);
    if (!memory) {
      return fail(404, { error: 'Memory not found' });
    }
    if (wsId(memory.workspace_id) !== params.id) {
      return fail(404, { error: 'Memory not found in this workspace' });
    }

    try {
      await memoryService.deleteMemory(params.slug);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete memory';
      createLogger(['dali-memory', 'http']).error('delete action failed', {
        error: msg,
        slug: params.slug,
      });
      return fail(400, { error: msg });
    }

    redirect(303, `/workspaces/${params.id}/memories`);
  },

  add_tag: async ({ request, params }) => {
    await connect();
    const embedder = new EmbedderService();
    await embedder.initialize();
    const memoryService = new MemoryService(embedder);

    const memory = await memoryService.getMemory(params.slug);
    if (!memory) {
      return fail(404, { error: 'Memory not found' });
    }
    if (wsId(memory.workspace_id) !== params.id) {
      return fail(404, { error: 'Memory not found in this workspace' });
    }

    const data = await request.formData();
    const raw = data.get('tag_name')?.toString()?.trim();

    if (!raw) {
      return fail(400, { error: 'At least one tag name is required' });
    }

    const tagNames = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (tagNames.length === 0) {
      return fail(400, { error: 'At least one tag name is required' });
    }

    try {
      const tagService = new TagService();
      for (const name of tagNames) {
        let tag = await tagService.findByName(name);
        if (!tag) {
          tag = await tagService.createTag(name);
        }
        await tagService.addTagToMemory(memory.id.toString(), tag.id.toString());
      }
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add tag';
      createLogger(['dali-memory', 'http']).error('add_tag action failed', { error: msg });
      return fail(400, { error: msg });
    }
  },

  remove_tag: async ({ request, params }) => {
    await connect();
    const embedder = new EmbedderService();
    await embedder.initialize();
    const memoryService = new MemoryService(embedder);

    const memory = await memoryService.getMemory(params.slug);
    if (!memory) {
      return fail(404, { error: 'Memory not found' });
    }
    if (wsId(memory.workspace_id) !== params.id) {
      return fail(404, { error: 'Memory not found in this workspace' });
    }

    const data = await request.formData();
    const tagId = data.get('tag_id')?.toString();

    if (!tagId) {
      return fail(400, { error: 'Tag ID is required' });
    }

    try {
      const tagService = new TagService();
      await tagService.removeTagFromMemory(memory.id.toString(), tagId);
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to remove tag';
      createLogger(['dali-memory', 'http']).error('remove_tag action failed', { error: msg });
      return fail(400, { error: msg });
    }
  },
};
