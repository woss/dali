import { initLogger, getLog } from '$lib/server/logger';
import { getConfig } from '$lib/server/config';
import { initEmbedder } from '$lib/server/embedder/index';
import type { Handle } from '@sveltejs/kit';

// Preload embedder model on server start — runs once at module load
initEmbedder().catch((err) => {
  console.error('Failed to preload embedder:', err instanceof Error ? err.message : String(err));
});

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

async function verifyCookie(cookie: string | undefined, secret: string): Promise<string | null> {
  if (!cookie || !cookie.includes('.')) return null;
  const [hexSig, ...rest] = cookie.split('.');
  const sessionId = rest.join('.');
  const expectedSig = await signSession(sessionId, secret);
  const expectedHex = expectedSig.split('.')[0];

  if (hexSig.length !== expectedHex.length) return null;
  let mismatch = 0;
  for (let i = 0; i < hexSig.length; i++)
    mismatch |= hexSig.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  if (mismatch !== 0) return null;
  return sessionId; // now returns the email address
}

const PROTECTED_PREFIXES = ['/memories', '/workspaces', '/settings', '/api'];
const PUBLIC_PATHS = ['/login', '/register', '/logout', '/api/mcp'];

function isProtected(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return false;
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

export const handle: Handle = async ({ event, resolve }) => {
  initLogger();
  const config = getConfig();

  if (!config.DALI_MEMORY_AUTH_ENABLED) {
    return resolve(event);
  }

  if (isProtected(event.url.pathname)) {
    const email = await verifyCookie(event.cookies.get('dali_session'), config.DALI_MEMORY_SECRET);
    if (!email) return Response.redirect(new URL('/login', event.url), 303);
    event.locals.authenticated = true;
    event.locals.userEmail = email;
  }

  getLog(['dali-memory', 'http']).debug(`${event.request.method} ${event.url.pathname}`);
  return resolve(event);
};
