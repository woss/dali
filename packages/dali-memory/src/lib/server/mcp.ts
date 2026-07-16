import { performance } from 'node:perf_hooks';
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
import { EmbedderService, getEmbedder } from './embedder/index';
import { validateApiKey } from './auth/api-keys';
import { connect, getDB } from './db/connection';
import { createLogger } from './logger';
import type { SearchOptions } from './services/types';
import type { Logger } from '@logtape/logtape';

// ---------------------------------------------------------------------------
// Tool name constants
// ---------------------------------------------------------------------------
const TOOL_MEMORIES_STORE = 'memories_store';
const TOOL_MEMORIES_SEARCH = 'memories_search';
const TOOL_TAGS_ADD = 'tags_add';
const TOOL_TAGS_REMOVE = 'tags_remove';
const TOOL_WORKSPACES_LIST = 'workspaces_list';
const TOOL_MEMORIES_DELETE = 'memories_delete';

// ---------------------------------------------------------------------------
// Zod v4 input schemas
// ---------------------------------------------------------------------------
const MemoriesStoreSchema = z
  .object({
    name: z.string().optional(),
    content: z.string(),
    memory_type: z.string().optional(),
    workspace_id: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    slug: z.string().optional(),
  })
  .refine((data) => data.slug !== undefined || data.name !== undefined, {
    message: 'Either slug or name must be provided',
  });

const MemoriesSearchSchema = z.object({
  query: z.string(),
  workspace_id: z.string().optional(),
  limit: z.number().optional(),
  threshold: z.number().optional(),
});

const TagsAddSchema = z.object({
  memory_slug: z.string(),
  tag_name: z.string(),
});

const TagsRemoveSchema = z.object({
  memory_slug: z.string(),
  tag_name: z.string(),
});

const WorkspacesListSchema = z.object({
  limit: z.number().optional(),
});

const MemoriesDeleteSchema = z.object({
  memory_id: z.string(),
  workspace_id: z.string(),
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
    slug: { type: 'string' as const },
  },
  required: ['content', 'workspace_id'],
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
    memory_slug: { type: 'string' as const },
    tag_name: { type: 'string' as const },
  },
  required: ['memory_slug', 'tag_name'],
};

const TAGS_REMOVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    memory_slug: { type: 'string' as const },
    tag_name: { type: 'string' as const },
  },
  required: ['memory_slug', 'tag_name'],
};

const WORKSPACES_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: { type: 'number' as const },
  },
};

const MEMORIES_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    memory_id: { type: 'string' as const, description: 'The memory slug or ID to delete' },
    workspace_id: { type: 'string' as const, description: 'The workspace the memory belongs to' },
  },
  required: ['memory_id', 'workspace_id'],
};

// ---------------------------------------------------------------------------
// Factory: createMCPServer
// ---------------------------------------------------------------------------

/**
 * Creates a configured `Server` instance with 6 MCP tools:
 *
 * - memories_store    – Create a memory with auto-generated embedding
 * - memories_search   – Hybrid search across memories
 * - memories_delete   – Delete a memory by slug or ID
 * - tags_add          – Create a tag and attach to a memory
 * - tags_remove       – Detach a tag from a memory
 * - workspaces_list   – List all workspaces
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
      {
        name: TOOL_WORKSPACES_LIST,
        description: 'List all workspaces',
        inputSchema: WORKSPACES_LIST_INPUT_SCHEMA,
      },
      {
        name: TOOL_MEMORIES_DELETE,
        description: 'Delete a memory by slug or ID',
        inputSchema: MEMORIES_DELETE_INPUT_SCHEMA,
      },
    ];

    const log = createLogger(['dali-memory', 'mcp']);
    log.debug(`ListTools: ${tools.map((t) => t.name).join(', ')}`);
    return { tools };
  });

  // ---- tools/call ----
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const log = createLogger(['dali-memory', 'mcp']);

    try {
      switch (name) {
        case TOOL_MEMORIES_STORE:
          return await timedTool(
            log,
            TOOL_MEMORIES_STORE,
            () => handleMemoriesStore(args ?? {}),
            args,
          );

        case TOOL_MEMORIES_SEARCH:
          return await timedTool(
            log,
            TOOL_MEMORIES_SEARCH,
            () => handleMemoriesSearch(args ?? {}),
            args,
          );

        case TOOL_TAGS_ADD:
          return await timedTool(log, TOOL_TAGS_ADD, () => handleTagsAdd(args ?? {}), args);

        case TOOL_TAGS_REMOVE:
          return await timedTool(log, TOOL_TAGS_REMOVE, () => handleTagsRemove(args ?? {}), args);

        case TOOL_WORKSPACES_LIST:
          return await timedTool(log, TOOL_WORKSPACES_LIST, () => handleWorkspacesList(), args);

        case TOOL_MEMORIES_DELETE:
          return await timedTool(
            log,
            TOOL_MEMORIES_DELETE,
            () => handleMemoriesDelete(args ?? {}),
            args,
          );

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

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

async function timedTool(
  log: Logger,
  name: string,
  fn: () => Promise<ToolResult>,
  args?: Record<string, unknown>,
): Promise<ToolResult> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration_ms = +(performance.now() - start).toFixed(2);
    log.info('Tool {name} completed', { tool: name, duration_ms, status: 'ok' });
    return result;
  } catch (error) {
    const duration_ms = +(performance.now() - start).toFixed(2);
    const msg = error instanceof Error ? error.message : String(error);
    log.error('Tool {name} failed', { tool: name, duration_ms, status: 'error', error: msg });
    throw error;
  }
}

async function handleMemoriesStore(
  rawArgs: Record<string, unknown>,
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  const args = MemoriesStoreSchema.parse(rawArgs);

  // Generate slug from name if not provided
  const slug =
    args.slug ??
    (args.name
      ? args.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      : undefined);

  // Use name falling back to slug if needed
  const name = args.name ?? slug;

  if (!name || !slug) {
    return {
      content: [{ type: 'text', text: 'Either slug or name must be provided' }],
      isError: true,
    };
  }

  let embedder: EmbedderService;
  try {
    embedder = getEmbedder();
  } catch {
    return {
      content: [
        { type: 'text', text: 'Embedding service unavailable. Service may still be starting up.' },
      ],
      isError: true,
    };
  }
  const memoryService = new MemoryService(embedder);

  const record = await memoryService.createMemory({
    name,
    content: args.content,
    memory_type: args.memory_type,
    workspace_id: args.workspace_id,
    metadata: args.metadata,
    slug,
  });

  return {
    content: [{ type: 'text', text: JSON.stringify({ id: String(record.id) }) }],
  };
}

async function handleMemoriesSearch(
  rawArgs: Record<string, unknown>,
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  const args = MemoriesSearchSchema.parse(rawArgs);

  let embedder: EmbedderService;
  try {
    embedder = getEmbedder();
  } catch {
    return {
      content: [
        { type: 'text', text: 'Embedding service unavailable. Service may still be starting up.' },
      ],
      isError: true,
    };
  }

  const hybridSearch = new HybridSearch(embedder);

  const options: SearchOptions = {};
  if (args.workspace_id !== undefined) options.workspaceId = args.workspace_id;
  if (args.limit !== undefined) options.limit = args.limit;
  if (args.threshold !== undefined) options.threshold = args.threshold;

  try {
    const results = await hybridSearch.search(args.query, options);
    return {
      content: [{ type: 'text', text: JSON.stringify(results) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Search failed: ${message}` }],
      isError: true,
    };
  }
}

async function handleTagsAdd(
  rawArgs: Record<string, unknown>,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const args = TagsAddSchema.parse(rawArgs);

  const tagService = new TagService();
  const tag = await tagService.createTag(args.tag_name);
  const tagId = String(tag.id); // SurrealDB returns RecordId; convert to string

  // Construct full memory ID from slug
  const memoryId = `memories:${args.memory_slug}`;
  await tagService.addTagToMemory(memoryId, tagId);

  return {
    content: [{ type: 'text', text: JSON.stringify({ tag_id: tagId }) }],
  };
}

async function handleWorkspacesList(): Promise<{
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}> {
  await connect();
  const db = getDB();

  try {
    const result = await db.query<{
      id: string;
      name: string;
      description: string | null;
      is_personal: boolean;
      created_at: string;
    }>(
      'SELECT id, name, description, is_personal, created_at FROM workspaces WHERE deleted_at = none ORDER BY name ASC',
    );

    const workspaces = (result ?? []).map((ws) => {
      const rawCreated = ws.created_at;
      const created_at =
        rawCreated && typeof rawCreated === 'object'
          ? ((rawCreated as Date).toISOString?.() ?? String(rawCreated))
          : String(rawCreated);

      return {
        id: String(ws.id),
        name: ws.name,
        description: ws.description,
        is_personal: ws.is_personal,
        created_at,
      };
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(workspaces) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Failed to list workspaces: ${message}` }],
      isError: true,
    };
  }
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

  const tagId = String(tag.id); // SurrealDB returns RecordId; convert to string

  // Construct full memory ID from slug
  const memoryId = `memories:${args.memory_slug}`;
  await tagService.removeTagFromMemory(memoryId, tagId);

  return {
    content: [{ type: 'text', text: JSON.stringify({ removed: true }) }],
  };
}

async function handleMemoriesDelete(
  rawArgs: Record<string, unknown>,
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  const args = MemoriesDeleteSchema.parse(rawArgs);

  let embedder: EmbedderService;
  try {
    embedder = getEmbedder();
  } catch {
    return {
      content: [
        { type: 'text', text: 'Embedding service unavailable. Service may still be starting up.' },
      ],
      isError: true,
    };
  }
  const memoryService = new MemoryService(embedder);

  try {
    await memoryService.deleteMemory(args.memory_id, args.workspace_id);
    return {
      content: [{ type: 'text', text: JSON.stringify({ deleted: true, id: args.memory_id }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: message }],
      isError: true,
    };
  }
}
