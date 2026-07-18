/**
 * Session signing and verification utilities.
 *
 * Uses HMAC-SHA256 to sign session payloads (email addresses) with a server secret.
 * The signed value is formatted as `${hex_signature}.${sessionId}` for cookie storage.
 */

export async function signSession(sessionId: string, secret: string): Promise<string> {
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

/**
 * Verify a signed session cookie and return the session payload (email).
 * Uses constant-time comparison to prevent timing attacks.
 */
export async function verifyCookie(
  cookie: string | undefined,
  secret: string,
): Promise<string | null> {
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
  return sessionId;
}
