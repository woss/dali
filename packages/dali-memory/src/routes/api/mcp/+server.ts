import { JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js';
import { createMCPServer } from '$lib/server/mcp';
import { validateApiKey } from '$lib/server/auth/api-keys';
import { connect } from '$lib/server/db/connection';

interface Session {
  dispatch: (msg: unknown) => Promise<void>;
  close: () => Promise<void>;
}

const sessions = new Map<string, Session>();

async function authenticate(request: Request): Promise<Response | null> {
  await connect();
  const authHeader = request.headers.get('authorization') ?? '';
  const apiKey = authHeader.replace(/^Bearer\s+/i, '').trim();
  return (await validateApiKey(apiKey)) ? null : new Response('Unauthorized', { status: 401 });
}

// ---------------------------------------------------------------------------
// GET  → establish SSE stream
// ---------------------------------------------------------------------------

export const GET = async ({ request }: { request: Request }): Promise<Response> => {
  const authError = await authenticate(request);
  if (authError) return authError;

  const sessionId = crypto.randomUUID();
  const encoder = new TextEncoder();
  const server = createMCPServer();

  // Bun's TransformStream stalls writer.write() until the readable side is
  // consumed.  Use explicit highWaterMark so the initial writes resolve.
  const ts = new TransformStream<Uint8Array, Uint8Array>(
    { transform: (chunk, ctrl) => ctrl.enqueue(chunk) },
    { highWaterMark: 100 },
    { highWaterMark: 100 },
  );

  const writer = ts.writable.getWriter();

  const transport = {
    onmessage: undefined as ((msg: unknown, extra?: unknown) => void) | undefined,
    onclose: undefined as (() => void) | undefined,
    onerror: undefined as ((err: Error) => void) | undefined,
    start: async () => {
      await writer.write(
        encoder.encode(`event: endpoint\ndata: /api/mcp?sessionId=${sessionId}\n\n`),
      );
    },
    send: async (message: unknown) => {
      await writer.write(encoder.encode(`event: message\ndata: ${JSON.stringify(message)}\n\n`));
    },
    close: async () => {
      await writer.close().catch(() => {});
      sessions.delete(sessionId);
    },
  };

  await server.connect(transport as any);

  sessions.set(sessionId, {
    dispatch: async (msg: unknown) => {
      try {
        const parsed = JSONRPCMessageSchema.parse(msg);
        transport.onmessage?.(parsed);
      } catch (err) {
        console.error('[mcp] invalid JSON-RPC:', err);
      }
    },
    close: async () => {
      await server.close();
      sessions.delete(sessionId);
    },
  });

  request.signal.addEventListener('abort', () => {
    sessions.delete(sessionId);
    writer.close().catch(() => {});
  });

  return new Response(ts.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

// ---------------------------------------------------------------------------
// POST → send JSON-RPC message to existing session
// ---------------------------------------------------------------------------

export const POST = async ({ request }: { request: Request }): Promise<Response> => {
  const authError = await authenticate(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const sessionId =
    url.searchParams.get('sessionId') ?? request.headers.get('Mcp-Session-Id') ?? '';

  if (!sessionId) {
    return new Response('Missing session ID — open a GET SSE stream first', { status: 400 });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return new Response('Session not found — SSE stream may have disconnected', { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  try {
    await session.dispatch(body);
  } catch {
    return new Response('Failed to process message', { status: 500 });
  }

  return new Response('Accepted', { status: 202 });
};
