import { createLogger } from '../logger';
import { getConfig } from '../config';
import { getDB } from '../db/connection';
import { select, update } from '@woss/dali-orm/query';
import { apiKeysTable } from '../db/schema';

export async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key + getConfig().DALI_MEMORY_SECRET);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hash;
}

export async function validateApiKey(key: string | null | undefined): Promise<boolean> {
  if (!key) {
    return false;
  }
  if (!getConfig().DALI_MEMORY_AUTH_ENABLED) {
    return true;
  }
  const db = getDB();
  const hash = await hashApiKey(key);

  const results = await select(db, apiKeysTable)
    .where((w) => w.eq('key_hash', hash))
    .execute();

  if (results.length === 0) {
    createLogger(['dali-memory', 'auth']).warn('Invalid API key attempt');
    return false;
  }

  createLogger(['dali-memory', 'auth']).debug('API key validated successfully');

  const record = results[0];
  const rawId = record.id;
  const shortId =
    typeof rawId === 'string'
      ? rawId.includes(':')
        ? rawId.split(':').pop()
        : rawId
      : rawId && typeof rawId === 'object'
        ? (rawId as { id?: string }).id
        : undefined;

  if (shortId) {
    update(db, apiKeysTable)
      .id(shortId)
      .set('last_used_at', new Date().toISOString())
      .execute()
      .catch((e) => {
        console.error('Failed to update last_used_at for API key:', e);
        // Best-effort — failure to touch last_used_at is non-critical
      });
  }

  return true;
}
