import { connect } from '$lib/server/db/connection';
import { EmbedderService } from '$lib/server/embedder';
import { MemoryService } from '$lib/server/services/memory';
import { TagService } from '$lib/server/services/tag';
import type { TagRecord } from '$lib/server/services/types';
import { toPlain } from '../../lib/utils/serialization';
import { RecordId } from 'surrealdb';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const db = await connect();
  const embedder = new EmbedderService();
  await embedder.initialize();
  const memoryService = new MemoryService(embedder);
  const tagService = new TagService();

  const activeTag = url.searchParams.get('tag') || null;

  // Filter by tag if active
  let memories = await memoryService.listAllMemories();
  if (activeTag) {
    const tagged = await tagService.unionTags([activeTag]);
    const taggedIds = new Set(tagged.map(m => m.id.toString()));
    memories = memories.filter(m => taggedIds.has(m.id.toString()));
  }

  // Fetch tags for each memory
  const memoryTagsMap: Record<string, TagRecord[]> = {};
  if (memories.length > 0) {
    const tagsResults = await Promise.all(
      memories.map(m => tagService.getMemoryTags(m.id.toString())),
    );
    memories.forEach((mem, i) => {
      memoryTagsMap[mem.id] = tagsResults[i];
    });
  }

  // Batch-fetch workspace names
  const allTags = await tagService.listTags();
  const workspaceNames: Record<string, string> = {};
  const distinctWorkspaceIds = [...new Set(memories.map(m => String((m.workspace_id as unknown as RecordId).id)))];

  if (distinctWorkspaceIds.length > 0) {
    const workspaceRows = await db.query(
      'SELECT id, name FROM workspaces WHERE id IN $ids',
      { ids: distinctWorkspaceIds.map(id => new RecordId('workspaces', id)) },
    );
    const rows = (workspaceRows?.[0] as any)?.result ?? [];
    for (const ws of rows) {
      workspaceNames[String((ws.id as unknown as RecordId).id)] = ws.name;
    }
  }

  return {
    memories: toPlain(memories.map(mem => ({
      ...mem,
      workspace_id: String((mem.workspace_id as unknown as RecordId).id),  // normalize to bare id for URLs
      tags: memoryTagsMap[mem.id] || [],
    }))),
    allTags: toPlain(allTags),
    workspaceNames: toPlain(workspaceNames),
    activeTag,
  };
};
