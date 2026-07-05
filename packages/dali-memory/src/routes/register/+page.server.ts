import { signSession } from '$lib/server/auth/session';
import { connect, getDB } from '$lib/server/db/connection';
import { getConfig } from '$lib/server/config';
import { fail, redirect } from '@sveltejs/kit';
import { RecordId } from 'surrealdb';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.authenticated) {
    redirect(303, '/workspaces');
  }
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const name = data.get('name')?.toString();
    const email = data.get('email')?.toString();
    const password = data.get('password')?.toString();
    const confirmPassword = data.get('confirm_password')?.toString();

    if (!name || !email || !password || !confirmPassword) {
      return fail(400, { error: 'All fields are required', missing: true });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return fail(400, {
        error: 'Password must be at least 8 characters with at least 1 uppercase, 1 lowercase, and 1 digit',
        weak: true,
      });
    }

    if (password !== confirmPassword) {
      return fail(400, { error: 'Passwords do not match', mismatch: true });
    }

    await connect();
    try {
      const driver = getDB().getDriver();
      await driver.transaction(async (tx) => {
        // Step 1: Create the user
        const userResult = await tx.query<{ id: RecordId; name: string; email: string }>(
          'CREATE users SET name = $name, email = $email, pass = crypto::argon2::generate($pass)',
          { name, email, pass: password },
        );
        const user = userResult[0];
        if (!user) throw new Error('Failed to create user record');

        // Step 2: Create a personal workspace for the user
        const workspaceResult = await tx.query<{ id: RecordId }>(
          'CREATE workspaces SET is_personal = true, user_id = $userId, name = $name, description = $description',
          { userId: user.id, name, description: email },
        );
        const workspace = workspaceResult[0];
        if (!workspace) throw new Error('Failed to create workspace');

        // Step 3: Set the workspace as the user's default
        await tx.query(
          'UPDATE $userId SET default_workspace_id = $workspaceId',
          { userId: user.id, workspaceId: workspace.id },
        );
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Check email uniqueness first — the 'already contains' pattern also matches workspace name collisions
      if (
        msg.includes('idx_users_email')
      ) {
        return fail(409, { error: 'An account with this email already exists', duplicate: true });
      }
      if (
        msg.includes('idx_workspaces_name')
      ) {
        return fail(409, { error: 'A workspace with this name already exists. Please choose a different name.', workspaceNameTaken: true });
      }
      if (
        msg.includes('UNIQUE') ||
        msg.includes('already exists') ||
        msg.includes('already contains')
      ) {
        return fail(409, { error: 'An account with this email already exists', duplicate: true });
      }
      return fail(500, { error: 'Registration failed. Please try again.', serverError: true });
    }

    // Auto sign in after registration
    const sessionId = email!; // use email as the session payload
    const signed = await signSession(sessionId, getConfig().DALI_MEMORY_SECRET);

    cookies.set('dali_session', signed, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    redirect(303, '/workspaces');
  },
};
