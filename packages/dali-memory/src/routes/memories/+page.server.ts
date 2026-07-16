import { connect } from '$lib/server/db/connection';
import { EmbedderService } from '$lib/server/embedder';
import { MemoryService } from '$lib/server/services/memory';
import { HybridSearch } from '$lib/server/services/hybrid-search';
import { TagService } from '$lib/server/services/tag';
import type { MemoryRecord, TagRecord } from '$lib/server/services/types';
import { toPlain } from '../../lib/utils/serialization';
import { fail } from '@sveltejs/kit';
import { RecordId } from 'surrealdb';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const { url, locals } = event;
  const db = await connect();
  const embedder = new EmbedderService();
  await embedder.initialize();
  const memoryService = new MemoryService(embedder);
  const tagService = new TagService();

  const userEmail = locals?.userEmail;

  // Resolve user ID when auth enabled
  let userId: unknown = null;
  if (userEmail) {
    const [userRow] = await db.query<{ id: unknown }>(
      'SELECT id FROM users WHERE email = $email LIMIT 1',
      { email: userEmail },
    );
    if (userRow?.id) {
      userId = userRow.id;
    }
  }

  const searchQuery = url.searchParams.get('q') || null;
  const activeTag = url.searchParams.get('tag') || null;

  // Fetch user's memories via the has_memory graph relation
  let allMemories: (MemoryRecord & { matched_on?: 'vector' | 'fulltext' | 'both' })[];

  if (userId) {
    // Traverse the graph: user -> has_memory -> memory
    const [userData] = await db.query<Record<string, unknown>>(
      'SELECT ->has_memory->memories.* AS memory FROM $userId',
      { userId },
    );
    const userMemories = (userData != null ? (userData as any)['memory'] : []) ?? [];
    allMemories = Array.isArray(userMemories) ? userMemories : [];
  } else {
    allMemories = await memoryService.listAllMemories();
  }

  let memories = allMemories;

  if (activeTag) {
    const tagged = await tagService.unionTags([activeTag]);
    const taggedIds = new Set(tagged.map((m) => m.id.toString()));
    memories = allMemories.filter((m) => taggedIds.has(m.id.toString()));
  } else if (searchQuery && allMemories.length > 0) {
    // Search all memories, then intersect with user's memories
    const hybridSearch = new HybridSearch(embedder);
    const results = await hybridSearch.search(searchQuery, { limit: 50 });
    const userMemIds = new Set(allMemories.map((m) => m.id.toString()));
    memories = results
      .map((r) => ({ ...r.memory, matched_on: r.matched_on }))
      .filter((m) => userMemIds.has(m.id.toString()));
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

  // Fetch workspace names (all, for badges)
  const allTags = await tagService.listTags();
  const workspaceNames: Record<string, string> = {};
  const allWorkspaces = await db.query<{ id: unknown; name: string }>(
    'SELECT id, name FROM workspaces WHERE deleted_at = none',
  );
  for (const ws of allWorkspaces) {
    workspaceNames[String((ws.id as unknown as RecordId).id)] = ws.name;
  }

  // Workspace selector: scoped to user's workspaces when auth enabled
  let workspaces = allWorkspaces.map((ws: any) => ({
    id: String((ws.id as unknown as RecordId).id),
    name: ws.name,
  }));
  if (userId) {
    const userWsIds = await db.query<{ id: unknown }>(
      'SELECT id FROM workspaces WHERE user_id = $userId AND deleted_at = none',
      { userId },
    );
    const userWsSet = new Set(
      (userWsIds ?? []).map((w: any) => String((w.id as unknown as RecordId).id)),
    );
    workspaces = workspaces.filter((ws) => userWsSet.has(ws.id));
  }

  return {
    memories: toPlain(
      memories.map((mem) => ({
        ...mem,
        workspace_id: String((mem.workspace_id as unknown as RecordId).id),
        tags: memoryTagsMap[mem.id] || [],
      })),
    ),
    allTags: toPlain(allTags),
    workspaceNames: toPlain(workspaceNames),
    activeTag,
    searchQuery,
    workspaces: toPlain(workspaces),
  };
};

export const actions: Actions = {
  create: async (event) => {
    const { request, locals } = event;
    const db = await connect();

    const embedder = new EmbedderService();
    await embedder.initialize();
    const memoryService = new MemoryService(embedder);

    const fd = await request.formData();
    const name = fd.get('name')?.toString();
    const content = fd.get('content')?.toString();
    const memory_type = fd.get('memory_type')?.toString() || 'fact';
    const workspace_id = fd.get('workspace_id')?.toString();

    if (!name || !content || !workspace_id) {
      return fail(400, { error: 'Name, content, and workspace are required' });
    }

    // When auth enabled, validate user owns the workspace
    let currentUserId: unknown = null;
    if (locals?.userEmail && workspace_id) {
      const [userRow] = await db.query<{ id: unknown }>(
        'SELECT id FROM users WHERE email = $email LIMIT 1',
        { email: locals.userEmail },
      );
      if (userRow?.id) {
        currentUserId = userRow.id;
        const wsCheck = await db.query<{ id: unknown }>(
          'SELECT id FROM workspaces WHERE id = $wsId AND user_id = $userId AND deleted_at = none',
          { wsId: new RecordId('workspaces', workspace_id.split(':').pop()!), userId: userRow.id },
        );
        if (!wsCheck || wsCheck.length === 0) {
          return fail(400, { error: 'Workspace not found or access denied' });
        }
      }
    }
    console.log('Creating memory with:', {
      name,
      content,
      memory_type,
      workspace_id,
      currentUserId,
    });
    try {
      const memory = await memoryService.createMemory({
        name,
        content,
        memory_type,
        workspace_id,
      });
      console.log('Memory created:', memory);
      // Create the has_memory graph edge when auth is active
      if (currentUserId && memory?.id) {
        await db.query('RELATE $userId -> has_memory -> $memoryId', {
          userId: currentUserId,
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
    const { request, locals } = event;
    const db = await connect();

    const embedder = new EmbedderService();
    await embedder.initialize();
    const memoryService = new MemoryService(embedder);

    const fd = await request.formData();
    const id = fd.get('id')?.toString();

    if (!id) {
      return fail(400, { error: 'Memory ID is required' });
    }

    // Validate ownership via has_memory graph relation
    if (locals?.userEmail && id) {
      const [userRow] = await db.query<{ id: unknown }>(
        'SELECT id FROM users WHERE email = $email LIMIT 1',
        { email: locals.userEmail },
      );
      if (userRow?.id) {
        const owned = await db.query<{ id: unknown }>(
          'SELECT id FROM has_memory WHERE in = $userId AND out = $memoryId',
          {
            userId: userRow.id,
            memoryId: new RecordId('memories', id.split(':').pop()!),
          },
        );
        if (!owned || owned.length === 0) {
          return fail(400, { error: 'Memory not found or access denied' });
        }
      }
    }

    try {
      await memoryService.deleteMemory(id);
      // Clean up the has_memory edge
      await db.query('DELETE has_memory WHERE out = $memoryId', {
        memoryId: new RecordId('memories', id.split(':').pop()!),
      });
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete memory';
      return fail(400, { error: msg });
    }
  },
};
