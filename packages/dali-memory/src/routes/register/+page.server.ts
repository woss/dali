import { connect, getDB } from '$lib/server/db/connection';
import { getConfig } from '$lib/server/config';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.authenticated) {
    redirect(303, '/memories');
  }
};

async function signSession(sessionId: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(sessionId));
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex}.${sessionId}`;
}

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

    if (password.length < 8) {
      return fail(400, { error: 'Password must be at least 8 characters', weak: true });
    }

    if (password !== confirmPassword) {
      return fail(400, { error: 'Passwords do not match', mismatch: true });
    }

    await connect();
    try {
      const driver = getDB().getDriver();
      await driver.query(
        'CREATE users SET name = $name, email = $email, pass = crypto::argon2::generate($pass)',
        { name, email, pass: password },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('UNIQUE') ||
        msg.includes('idx_users_email') ||
        msg.includes('already exists')
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

    redirect(303, '/memories');
  },
};
