import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { MemoryService } from './services/memory';
import { TagService } from './services/tag';
import { HybridSearch } from './services/hybrid-search';
import { EmbedderService } from './embedder/index';
import { validateApiKey } from './auth/api-keys';
import { getDB } from './db/connection';
import { getLog } from './logger';
import type { SearchOptions } from './services/types';

// ---------------------------------------------------------------------------
// Tool name constants
// ---------------------------------------------------------------------------
const TOOL_MEMORIES_STORE = 'memories_store';
const TOOL_MEMORIES_SEARCH = 'memories_search';
const TOOL_TAGS_ADD = 'tags_add';
const TOOL_TAGS_REMOVE = 'tags_remove';

// ---------------------------------------------------------------------------
// Zod v4 input schemas
// ---------------------------------------------------------------------------
const MemoriesStoreSchema = z.object({
  name: z.string(),
  content: z.string(),
  memory_type: z.string().optional(),
  workspace_id: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const MemoriesSearchSchema = z.object({
  query: z.string(),
  workspace_id: z.string().optional(),
  limit: z.number().optional(),
  threshold: z.number().optional(),
});

const TagsAddSchema = z.object({
  memory_id: z.string(),
  tag_name: z.string(),
});

const TagsRemoveSchema = z.object({
  memory_id: z.string(),
  tag_name: z.string(),
});

// ---------------------------------------------------------------------------
// Static JSON Schema definitions for ListToolsResult
// ---------------------------------------------------------------------------
const MEMORIES_STORE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' as const },
    content: { type: 'string' as const },
    memory_type: { type: 'string' as const },
    workspace_id: { type: 'string' as const },
    metadata: { type: 'object' as const },
  },
  required: ['name', 'content', 'workspace_id'],
};

const MEMORIES_SEARCH_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    query: { type: 'string' as const },
    workspace_id: { type: 'string' as const },
    limit: { type: 'number' as const },
    threshold: { type: 'number' as const },
  },
  required: ['query'],
};

const TAGS_ADD_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    memory_id: { type: 'string' as const },
    tag_name: { type: 'string' as const },
  },
  required: ['memory_id', 'tag_name'],
};

const TAGS_REMOVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    memory_id: { type: 'string' as const },
    tag_name: { type: 'string' as const },
  },
  required: ['memory_id', 'tag_name'],
};

// ---------------------------------------------------------------------------
// Factory: createMCPServer
// ---------------------------------------------------------------------------

/**
 * Creates a configured `Server` instance with 4 MCP tools:
 *
 * - memories_store   – Create a memory with auto-generated embedding
 * - memories_search  – Hybrid search across memories
 * - tags_add         – Create a tag and attach to a memory
 * - tags_remove      – Detach a tag from a memory
 */
export function createMCPServer(): Server {
  const server = new Server(
    { name: 'dali-memory', version: '0.4.0' },
    { capabilities: { tools: {} } },
  );

  // ---- tools/list ----
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = [
      {
        name: TOOL_MEMORIES_STORE,
        description: 'Create a memory with auto-generated embedding',
        inputSchema: MEMORIES_STORE_INPUT_SCHEMA,
      },
      {
        name: TOOL_MEMORIES_SEARCH,
        description: 'Hybrid search across memories',
        inputSchema: MEMORIES_SEARCH_INPUT_SCHEMA,
      },
      {
        name: TOOL_TAGS_ADD,
        description: 'Create a tag and attach to a memory',
        inputSchema: TAGS_ADD_INPUT_SCHEMA,
      },
      {
        name: TOOL_TAGS_REMOVE,
        description: 'Detach a tag from a memory',
        inputSchema: TAGS_REMOVE_INPUT_SCHEMA,
      },
    ];

    const log = getLog(['dali-memory', 'mcp']);
    log.debug(`ListTools: ${tools.map((t) => t.name).join(', ')}`);
    return { tools };
  });

  // ---- tools/call ----
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const log = getLog(['dali-memory', 'mcp']);
    log.info(`Tool called: ${name}`);

    try {
      switch (name) {
        case TOOL_MEMORIES_STORE:
          return await handleMemoriesStore(args ?? {});

        case TOOL_MEMORIES_SEARCH:
          return await handleMemoriesSearch(args ?? {});

        case TOOL_TAGS_ADD:
          return await handleTagsAdd(args ?? {});

        case TOOL_TAGS_REMOVE:
          return await handleTagsRemove(args ?? {});

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      // Re-throw McpError so the protocol layer handles it properly
      if (error instanceof McpError) {
        log.error(`Tool error: ${name} — ${error.message}`);
        throw error;
      }
      // All other errors → user-facing message with isError
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error(`Tool error: ${name} — ${message}`);
      return {
        content: [{ type: 'text' as const, text: message }],
        isError: true,
      };
    }
  });

  return server;
}

// ---------------------------------------------------------------------------
// runMCPServer – stdio transport
// ---------------------------------------------------------------------------

/**
 * Creates a server, attaches a stdio transport, and starts listening.
 */
export async function runMCPServer(): Promise<void> {
  const server = createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleMemoriesStore(
  rawArgs: Record<string, unknown>,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const args = MemoriesStoreSchema.parse(rawArgs);

  const embedder = new EmbedderService();
  await embedder.initialize();
  const memoryService = new MemoryService(embedder);

  const record = await memoryService.createMemory({
    name: args.name,
    content: args.content,
    memory_type: args.memory_type,
    workspace_id: args.workspace_id,
    metadata: args.metadata,
  });

  return {
    content: [{ type: 'text', text: JSON.stringify({ id: record.id }) }],
  };
}

async function handleMemoriesSearch(
  rawArgs: Record<string, unknown>,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const args = MemoriesSearchSchema.parse(rawArgs);

  const embedder = new EmbedderService();
  await embedder.initialize();
  const hybridSearch = new HybridSearch(embedder);

  const options: SearchOptions = {};
  if (args.workspace_id !== undefined) options.workspaceId = args.workspace_id;
  if (args.limit !== undefined) options.limit = args.limit;
  if (args.threshold !== undefined) options.threshold = args.threshold;

  const results = await hybridSearch.search(args.query, options);

  return {
    content: [{ type: 'text', text: JSON.stringify(results) }],
  };
}

async function handleTagsAdd(
  rawArgs: Record<string, unknown>,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const args = TagsAddSchema.parse(rawArgs);

  const tagService = new TagService();
  const tag = await tagService.createTag(args.tag_name);
  await tagService.addTagToMemory(args.memory_id, tag.id);

  return {
    content: [{ type: 'text', text: JSON.stringify({ tag_id: tag.id }) }],
  };
}

async function handleTagsRemove(
  rawArgs: Record<string, unknown>,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const args = TagsRemoveSchema.parse(rawArgs);

  const tagService = new TagService();
  const tag = await tagService.findByName(args.tag_name);

  if (!tag) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ removed: false, reason: 'Tag not found' }),
        },
      ],
    };
  }

  await tagService.removeTagFromMemory(args.memory_id, tag.id);

  return {
    content: [{ type: 'text', text: JSON.stringify({ removed: true }) }],
  };
}
