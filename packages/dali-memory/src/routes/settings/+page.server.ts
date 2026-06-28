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
};
