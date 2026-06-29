import { connect, getDB } from '$lib/server/db/connection';
import { getConfig } from '$lib/server/config';
import { hashApiKey } from '$lib/server/auth/api-keys';
import { toPlain } from '../../lib/utils/serialization';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  await connect();
  const db = getDB();
  const config = getConfig();

  const safeConfig = {
    embeddingProvider: config.DALI_MEMORY_EMBEDDING_PROVIDER,
    embeddingModel: config.DALI_MEMORY_EMBEDDING_MODEL,
    embeddingEndpoint: config.DALI_MEMORY_EMBEDDING_ENDPOINT,
    authEnabled: config.DALI_MEMORY_AUTH_ENABLED,
    surrealUrl: config.DALI_MEMORY_SURREAL_URL,
    surrealNs: config.DALI_MEMORY_SURREAL_NS,
    surrealDb: config.DALI_MEMORY_SURREAL_DB,
    logLevel: config.DALI_MEMORY_LOG_LEVEL,
  };

  const apiKeys = await db.query<any>(
    'SELECT id, name, created_at, last_used_at FROM api_keys ORDER BY created_at DESC',
  );

  return { config: safeConfig, apiKeys: toPlain(apiKeys) };
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
  'generate-key': async ({ request, locals }) => {
    await connect();
    const db = getDB();
    const data = await request.formData();
    const name = data.get('name')?.toString() || 'default';

    try {
      const rawKey =
        crypto.randomUUID().replace(/-/g, '') + '-' + crypto.randomUUID().replace(/-/g, '');
      const hash = await hashApiKey(rawKey);

      // Look up user by email to get user_id
      let userId: string | null = null;
      if (locals.userEmail) {
        const users = await db.query<{ id: string }[]>(
          'SELECT id FROM users WHERE email = $email',
          { email: locals.userEmail },
        );
        userId = users?.[0]?.[0]?.id ?? null;
      }

      if (userId) {
        await db.query(
          'CREATE api_keys CONTENT { key_hash: $hash, name: $name, user_id: $user_id }',
          { hash, name, user_id: userId },
        );
      } else {
        await db.query('CREATE api_keys CONTENT { key_hash: $hash, name: $name }', { hash, name });
      }
      return { success: true, newKey: rawKey, keyName: name };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate API key';
      return fail(400, { error: msg });
    }
  },

  'delete-key': async ({ request }) => {
    await connect();
    const db = getDB();
    const data = await request.formData();
    const id = data.get('id')?.toString();

    if (!id) {
      return fail(400, { error: 'Key ID is required' });
    }

    try {
      await db.query('DELETE api_keys WHERE id = $id', { id });
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete API key';
      return fail(400, { error: msg });
    }
  },

  'update-profile': async ({ request, locals, cookies }) => {
    if (!locals.authenticated || !locals.userEmail) {
      return fail(401, { error: 'Not authenticated' });
    }

    const data = await request.formData();
    const name = data.get('name')?.toString();
    const email = data.get('email')?.toString();

    if (!name || !email) {
      return fail(400, { error: 'Name and email are required' });
    }

    if (!email.includes('@')) {
      return fail(400, { error: 'Invalid email address' });
    }

    await connect();

    if (email !== locals.userEmail) {
      const existing = await getDB().query<{ id: string }[]>(
        'SELECT id FROM users WHERE email = $email',
        { email },
      );
      if (existing?.[0]?.length > 0) {
        return fail(409, { error: 'This email is already in use' });
      }
    }

    try {
      const driver = getDB().getDriver();
      await driver.query(
        'UPDATE users SET name = $name, email = $email WHERE email = $currentEmail',
        { name, email, currentEmail: locals.userEmail },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update profile';
      return fail(500, { error: msg });
    }

    if (email !== locals.userEmail) {
      const signed = await signSession(email, getConfig().DALI_MEMORY_SECRET);
      cookies.set('dali_session', signed, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return { success: true };
  },
};
