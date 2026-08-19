import { Server } from '@modelcontextprotocol/sdk/server/index.js';
/**
 * Creates a configured `Server` instance with 4 MCP tools:
 *
 * - memories_store   – Create a memory with auto-generated embedding
 * - memories_search  – Hybrid search across memories
 * - tags_add         – Create a tag and attach to a memory
 * - tags_remove      – Detach a tag from a memory
 */
export declare function createMCPServer(): Server;
/**
 * Creates a server, attaches a stdio transport, and starts listening.
 */
export declare function runMCPServer(): Promise<void>;
//# sourceMappingURL=mcp.d.ts.map