import { initLogger, createLogger } from '$lib/server/logger';
import { getConfig } from '$lib/server/config';
import { initEmbedder } from '$lib/server/embedder/index';
import { verifyCookie } from '$lib/server/auth/session';
import { requestStorage } from '$lib/server/trace-context';
import type { Handle } from '@sveltejs/kit';

// Init logger first, then preload embedder — runs once at module load
initLogger().catch((err) => {
  console.error('Failed to init logger:', err instanceof Error ? err.message : String(err));
});
initEmbedder().catch((err) => {
  console.error('Failed to preload embedder:', err instanceof Error ? err.message : String(err));
});

const PROTECTED_PREFIXES = ['/memories', '/workspaces', '/settings', '/api'];
const PUBLIC_PATHS = ['/login', '/register', '/logout', '/api/mcp'];

function isProtected(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return false;
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

export const handle: Handle = async ({ event, resolve }) => {
  const config = getConfig();

  // Wrap each request in a trace context for log correlation
  return requestStorage.run({ traceId: crypto.randomUUID() }, async () => {
    if (!config.DALI_MEMORY_AUTH_ENABLED) {
      return resolve(event);
    }

    if (isProtected(event.url.pathname)) {
      const email = await verifyCookie(event.cookies.get('dali_session'), config.DALI_MEMORY_SECRET);
      if (!email) return Response.redirect(new URL('/login', event.url), 303);
      event.locals.authenticated = true;
      event.locals.userEmail = email;
    }

    createLogger(['dali-memory', 'http']).debug(`${event.request.method} ${event.url.pathname}`);
    return resolve(event);
  });
};
