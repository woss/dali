import { signSession } from '$lib/server/auth/session';
import { connect, getDB } from '$lib/server/db/connection';
import { getConfig } from '$lib/server/config';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url: _url }) => {
  if (locals.authenticated) {
    redirect(303, '/workspaces');
  }

  if (!getConfig().DALI_MEMORY_AUTH_ENABLED) {
    redirect(303, '/');
  }
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get('email')?.toString();
    const password = data.get('password')?.toString();

    if (!email || !password) {
      return fail(400, { error: 'Email and password are required', missing: true });
    }

    // Validate credentials against users table
    await connect();
    try {
      const driver = getDB().getDriver();
      const users = await driver.query<{ id: string }[]>(
        'SELECT * FROM users WHERE email = $email AND crypto::argon2::compare(pass, $pass)',
        { email, pass: password },
      );
      if (!users || users.length === 0) {
        return fail(401, { error: 'Invalid email or password', invalid: true });
      }
    } catch {
      return fail(401, { error: 'Invalid email or password', invalid: true });
    }

    // Create signed session cookie with user's email
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
