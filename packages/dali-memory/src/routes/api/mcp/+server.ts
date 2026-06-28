import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMCPServer } from '$lib/server/mcp';
import { validateApiKey } from '$lib/server/auth/api-keys';
import { connect } from '$lib/server/db/connection';

// ---------------------------------------------------------------------------
// Singleton MCP server + transport — initialised lazily, connected once
// ---------------------------------------------------------------------------

let mcpServer: ReturnType<typeof createMCPServer>;
let transport: WebStandardStreamableHTTPServerTransport;
let connected = false;

async function ensureInitialized() {
  if (!mcpServer) {
    mcpServer = createMCPServer();
  }
  if (!transport) {
    transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });
  }
  if (!connected) {
    await mcpServer.connect(transport);
    connected = true;
  }
}

// ---------------------------------------------------------------------------
// Auth helper — extracts Bearer token and validates it
// ---------------------------------------------------------------------------

async function authenticate(request: Request): Promise<Response | null> {
  await connect();
  const authHeader = request.headers.get('authorization') ?? '';
  const apiKey = authHeader.replace(/^Bearer\s+/i, '').trim();
  const valid = await validateApiKey(apiKey);
  if (!valid) {
    return new Response('Unauthorized', { status: 401 });
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET  → establish SSE stream
// POST → send JSON-RPC message
// ---------------------------------------------------------------------------

export const GET = async ({ request }: { request: Request }): Promise<Response> => {
  const authError = await authenticate(request);
  if (authError) return authError;

  await ensureInitialized();

  // WebStandardStreamableHTTPServerTransport handles SSE stream setup:
  //  - Returns a Response with Content-Type: text/event-stream
  //  - Sends priming events (including the endpoint event)
  //  - Keeps the connection alive for server-to-client messages
  return transport.handleRequest(request);
};

export const POST = async ({ request }: { request: Request }): Promise<Response> => {
  const authError = await authenticate(request);
  if (authError) return authError;

  await ensureInitialized();

  // Transport dispatches JSON-RPC to the connected MCP server
  // and returns a Response (may be SSE, JSON, or 202 Accepted)
  return transport.handleRequest(request);
};
