import { connect, getDB } from '$lib/server/db/connection';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const authenticated = locals.authenticated ?? false;
  const userEmail = locals.userEmail ?? null;
  let name: string | null = null;

  if (authenticated && userEmail) {
    try {
      await connect();
      const db = getDB().getDriver();
      const [result] = await db.query<{ name: string }>(
        'SELECT name FROM users WHERE email = $email',
        { email: userEmail },
      );
      name = result?.name ?? null;
    } catch {
      // name stays null — auth still works if DB is down
    }
  }

  return {
    authenticated,
    userEmail,
    name,
  };
};
