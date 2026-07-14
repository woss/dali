import { connect, getDB } from '$lib/server/db/connection';
import { toPlain } from '$lib/utils/serialization';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const authenticated = locals.authenticated ?? false;
  const userEmail = locals.userEmail ?? null;
  let name: string | null = null;
  let defaultWorkspaceId: string | null = null;
  let workspaces: Array<{ name: string; id: string }> = [];

  if (authenticated && userEmail) {
    try {
      const db = await connect();
      const driver = db.getDriver();

      // Get user name and default workspace
      const [userResult] = await driver.query<{ name: string; default_workspace_id: unknown }>(
        'SELECT name, default_workspace_id FROM users WHERE email = $email',
        { email: userEmail },
      );
      name = userResult?.name ?? null;

      // Extract default workspace ID from record string
      if (userResult?.default_workspace_id) {
        const wsId = String(userResult.default_workspace_id);
        defaultWorkspaceId =
          wsId
            .replace(/[⟨⟩]/g, '')
            .split(':')
            .pop() ?? null;
      }

      // Load workspaces list for nav
      const wsResult = await driver.query<{ id: unknown; name: string }>(
        'SELECT id, name FROM workspaces ORDER BY name ASC',
      );
      const seen = new Set<string>();
      for (const ws of wsResult ?? []) {
        const slug =
          String(ws.id)
            .replace(/[⟨⟩]/g, '')
            .split(':')
            .pop() ?? '';
        if (slug && !seen.has(slug)) {
          seen.add(slug);
          workspaces.push({ name: ws.name, id: slug });
        }
      }
    } catch {
      // name/defaultWorkspaceId/workspaces stay null/[] — auth works even if DB is down
    }
  }

  return {
    authenticated,
    userEmail,
    name,
    defaultWorkspaceId,
    workspaces: toPlain(workspaces),
  };
};
