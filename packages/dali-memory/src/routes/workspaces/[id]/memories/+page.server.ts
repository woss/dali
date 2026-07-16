import { connect, getDB } from '$lib/server/db/connection';
import { EmbedderService } from '$lib/server/embedder';
import { MemoryService } from '$lib/server/services/memory';
import { HybridSearch } from '$lib/server/services/hybrid-search';
import { TagService } from '$lib/server/services/tag';
import type { MemoryRecord, TagRecord } from '$lib/server/services/types';
import { toPlain } from '../../../../lib/utils/serialization';
import { error, fail, redirect } from '@sveltejs/kit';
import { RecordId } from 'surrealdb';
import type { Actions, PageServerLoad } from './$types';

const DEFAULT_LIMIT = 20;

export const load: PageServerLoad = async (event) => {
  const { params, url, locals } = event;
  const db = await connect();
  const embedder = new EmbedderService();
  await embedder.initialize();
  const memoryService = new MemoryService(embedder);
  const userEmail = locals?.userEmail;

  const workspaceId = params.id;
  const wsRecordId = new RecordId('workspaces', workspaceId);

  // Verify workspace exists (and ownership when auth is enabled)
  let wsBindings: { id: RecordId; userId?: unknown } = { id: wsRecordId };
  let wsQuery =
    'SELECT id, name, description, is_personal FROM workspaces WHERE id = $id AND deleted_at = none';
  if (userEmail) {
    const [userRow] = await db.query<{ id: unknown }>(
      'SELECT id FROM users WHERE email = $email LIMIT 1',
      { email: userEmail },
    );
    if (userRow?.id) {
      wsQuery += ' AND user_id = $userId';
      wsBindings.userId = userRow.id;
    }
  }
  const workspaceRows = await db.query<{
    id: string;
    name: string;
    description: string | null;
    is_personal: boolean;
  }>(wsQuery, wsBindings);
  const workspace = workspaceRows?.[0] ?? null;

  if (!workspace) {
    error(404, 'Workspace not found');
  }

  const searchQuery = url.searchParams.get('q') || null;
  const activeTag = url.searchParams.get('tag') || null;
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const limit = DEFAULT_LIMIT;

  const tagService = new TagService();
  const allTags = await tagService.listTags();

  let memories: (MemoryRecord & { matched_on?: 'vector' | 'fulltext' | 'both' })[];
  if (activeTag) {
    const tagged = await tagService.unionTags([activeTag]);
    memories = tagged.filter((m) => {
      const wid = m.workspace_id;
      const widStr = typeof wid === 'string' ? wid : String((wid as unknown as RecordId).id);
      return widStr === workspaceId;
    });
  } else if (searchQuery) {
    const hybridSearch = new HybridSearch(embedder);
    const results = await hybridSearch.search(searchQuery, {
      workspaceId,
      limit,
    });
    memories = results.map((r) => ({
      ...r.memory,
      matched_on: r.matched_on,
    }));
  } else {
    memories = await memoryService.listMemories(workspaceId, { limit, offset });
  }

  // Fetch tags for each memory
  const memoryTagsMap: Record<string, TagRecord[]> = {};
  if (memories.length > 0) {
    const tagsResults = await Promise.all(
      memories.map((m) => tagService.getMemoryTags(m.id.toString())),
    );
    memories.forEach((mem, i) => {
      memoryTagsMap[mem.id] = tagsResults[i];
    });
  }

  // Attach tags to memories
  const memoriesWithTags = memories.map((mem) => ({
    ...mem,
    tags: memoryTagsMap[mem.id] || [],
  }));

  return {
    workspace: toPlain(workspace),
    memories: toPlain(memoriesWithTags),
    allTags: toPlain(allTags),
    activeTag,
    hasMore: !searchQuery && !activeTag && memories.length === limit,
    offset: toPlain(offset),
    limit: toPlain(limit),
    searchQuery,
  };
};

export const actions: Actions = {
  create: async (event) => {
    const { request, params, locals } = event;
    await connect();
    const db = getDB();

    // Conditional ownership check — skip when auth is disabled
    let userRow: { id: unknown } | undefined;
    if (locals?.userEmail) {
      [userRow] = await db.query<{ id: unknown }>(
        'SELECT id FROM users WHERE email = $email LIMIT 1',
        { email: locals.userEmail },
      );
      if (userRow?.id) {
        const ws = await db.query<{ id: string }>(
          'SELECT id FROM workspaces WHERE id = $id AND user_id = $userId AND deleted_at = none',
          { id: new RecordId('workspaces', params.id), userId: userRow.id },
        );
        if (!ws?.[0]) {
          error(404, 'Workspace not found');
        }
      }
    }

    const embedder = new EmbedderService();
    await embedder.initialize();
    const memoryService = new MemoryService(embedder);

    const data = await request.formData();
    const name = data.get('name')?.toString();
    const content = data.get('content')?.toString();
    const memory_type = data.get('memory_type')?.toString() || 'fact';
    const workspace_id = params.id;

    if (!name || !content) {
      return fail(400, { error: 'Name and content are required' });
    }

    try {
      const memory = await memoryService.createMemory({
        name,
        content,
        memory_type,
        workspace_id,
      });

      // Create the has_memory graph edge when auth is active
      if (userRow?.id && memory?.id) {
        await db.query('RELATE $userId -> has_memory -> $memoryId', {
          userId: userRow.id,
          memoryId: memory.id,
        });
      }

      return { success: true, memory: toPlain(memory) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create memory';
      return fail(400, { error: msg });
    }
  },

  delete: async (event) => {
    const { request, params, locals } = event;
    await connect();
    const db = getDB();

    // Conditional ownership check — skip when auth is disabled
    if (locals?.userEmail) {
      const [userRow] = await db.query<{ id: unknown }>(
        'SELECT id FROM users WHERE email = $email LIMIT 1',
        { email: locals.userEmail },
      );
      if (userRow?.id) {
        const ws = await db.query<{ id: string }>(
          'SELECT id FROM workspaces WHERE id = $id AND user_id = $userId AND deleted_at = none',
          { id: new RecordId('workspaces', params.id), userId: userRow.id },
        );
        if (!ws?.[0]) {
          error(404, 'Workspace not found');
        }
      }
    }

    const embedder = new EmbedderService();
    await embedder.initialize();
    const memoryService = new MemoryService(embedder);

    const data = await request.formData();
    const id = data.get('id')?.toString();

    if (!id) {
      return fail(400, { error: 'Memory ID is required' });
    }

    try {
      await memoryService.deleteMemory(id, params.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete memory';
      return fail(400, { error: msg });
    }

    redirect(303, `/workspaces/${params.id}/memories`);
  },
};
