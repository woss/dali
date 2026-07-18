import { connect, getDB } from '$lib/server/db/connection';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  try {
    await connect();
    const db = getDB().getDriver();
    const [memories] = await db.query<{ count: number }>('SELECT count() AS count FROM memories');
    const [workspaces] = await db.query<{ count: number }>(
      'SELECT count() AS count FROM workspaces WHERE deleted_at = none',
    );
    const [tags] = await db.query<{ count: number }>('SELECT count() AS count FROM tags');
    return {
      stats: {
        memories: memories?.count ?? 0,
        workspaces: workspaces?.count ?? 0,
        tags: tags?.count ?? 0,
      },
    };
  } catch {
    return {
      stats: { memories: 0, workspaces: 0, tags: 0 },
    };
  }
};
