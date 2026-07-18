import { signSession } from '$lib/server/auth/session';
import { connect, getDB } from '$lib/server/db/connection';
import { getConfig } from '$lib/server/config';
import { json } from '@sveltejs/kit';

// ---------------------------------------------------------------------------
// POST /register — JSON-body registration for MCP client registrations
//
// OpenCode sends POST with Content-Type: application/json to register a user.
// The existing +page.server.ts form action only handles form-encoded data.
// This handler accepts JSON and creates user + personal workspace.
// ---------------------------------------------------------------------------

export const POST = async ({
  request,
  cookies,
}: {
  request: Request;
  cookies: any;
}): Promise<Response> => {
  let body: { name?: string; email?: string; password?: string; confirm_password?: string };

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, email, password, confirm_password: confirmPassword } = body;

  if (!name || !email || !password || !confirmPassword) {
    return json({ error: 'All fields are required' }, { status: 400 });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password)) {
    return json(
      {
        error:
          'Password must be at least 8 characters with at least 1 uppercase, 1 lowercase, and 1 digit',
      },
      { status: 400 },
    );
  }

  if (password !== confirmPassword) {
    return json({ error: 'Passwords do not match' }, { status: 400 });
  }

  await connect();
  try {
    const driver = getDB().getDriver();
    await driver.transaction(async (tx) => {
      const userResult = await tx.query<{ id: any; name: string; email: string }>(
        'CREATE users SET name = $name, email = $email, pass = crypto::argon2::generate($pass)',
        { name, email, pass: password },
      );
      const user = userResult[0];
      if (!user) throw new Error('Failed to create user record');

      const workspaceResult = await tx.query<{ id: any }>(
        'CREATE workspaces SET is_personal = true, user_id = $userId, name = $name, description = $description',
        { userId: user.id, name, description: email },
      );
      const workspace = workspaceResult[0];
      if (!workspace) throw new Error('Failed to create workspace');

      await tx.query('UPDATE $userId SET default_workspace_id = $workspaceId', {
        userId: user.id,
        workspaceId: workspace.id,
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('idx_users_email')) {
      return json({ error: 'An account with this email already exists' }, { status: 409 });
    }
    if (msg.includes('idx_workspaces_name')) {
      return json(
        { error: 'A workspace with this name already exists. Please choose a different name.' },
        { status: 409 },
      );
    }
    if (
      msg.includes('UNIQUE') ||
      msg.includes('already exists') ||
      msg.includes('already contains')
    ) {
      return json({ error: 'An account with this email already exists' }, { status: 409 });
    }
    return json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }

  // Auto sign in — set session cookie
  const signed = await signSession(email!, getConfig().DALI_MEMORY_SECRET);
  cookies.set('dali_session', signed, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30,
  });

  return json({ success: true, email, redirect: '/workspaces' }, { status: 201 });
};
