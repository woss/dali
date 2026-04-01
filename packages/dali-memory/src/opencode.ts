import { type Plugin, type PluginInput, tool } from '@opencode-ai/plugin';
import z from 'zod';
import { parseTheArgs } from './utils/argsParsing.ts';
import { initLogger, logger } from './utils/logger.ts';
import memoryService from './utils/memory-service.ts';
import {
  daliMigrateOpenCodeDb,
  daliRemember,
  daliExtractFacts,
  noop,
} from './commands/commands.ts';
import { executeMigrateTool } from './tools/migrate-tool.ts';
import { executeMemoryTool } from './tools/memory-tool.ts';
import { onSessionCompacting, onChatMessage } from './tools/hooks.ts';
import { onSessionEvent } from './tools/events.ts';

const MemoryToolArgsSchema = z.object({
  mode: z
    .enum([
      'add',
      'search',
      'list',
      'forget',
      'help',
      'profile',
      'fact_add',
      'fact_list',
      'fact_verify',
    ])
    .describe('Mode of operation'),
  content: z.string().optional().describe('Memory content (for add mode)'),
  query: z.string().optional().describe('Search query (for search mode)'),
  tags: z.array(z.string()).optional().describe('Tags for categorization'),
  type: z.string().optional().describe('Memory type/category'),
  id: z.string().optional().describe('Memory ID (for forget mode)'),
  scope: z.enum(['project', 'all-projects']).optional().describe('Scope of the memory'),
  memoryId: z.string().optional().describe('Memory ID (for fact_add/list linking)'),
  factId: z.string().optional().describe('Fact ID (for fact_verify)'),
});

initLogger();

export const DaliMemoryPlugin: Plugin = async ({ client, directory }: PluginInput) => {
  await memoryService.initialize(directory);
  logger.debug('DaliMemory plugin initialized', { directory });
  const projectName = directory.split('/').slice(-1)[0];
  const projectDbId = await memoryService.getOrCreateProject(projectName, directory);
  if (!projectDbId) {
    logger.warn('Failed to get or create project — continuing without project');
    void client.tui.showToast({
      body: {
        message:
          'DaliMemory: Failed to initialize project context. Memory operations may not work correctly.',
        variant: 'warning',
      },
    });
    throw new Error('Failed to initialize project context');
  }
  memoryService.projectId = projectDbId;

  const getContainerTag = async (scope: string | undefined) => {
    const tags = await memoryService.getTags(directory);
    return scope === 'all-projects' ? tags.userTag : tags.projectTag;
  };

  return {
    async config(openCodeConfig) {
      openCodeConfig.command ??= {};
      openCodeConfig.command.dali_migrate_oc_db ??= daliMigrateOpenCodeDb;
      openCodeConfig.command.dali_remember ??= daliRemember;
      openCodeConfig.command.dali_extract_facts ??= daliExtractFacts;
      openCodeConfig.command.noop ??= noop;
    },
    tool: {
      dali_migrate_oc_db: tool({
        description: 'Apply pending migration files from the migrations directory.',
        args: {},
        async execute() {
          const msg = await executeMigrateTool();
          void client.app.log({
            body: { message: msg, level: 'info', service: 'DaliMemory' },
          });
          return msg;
        },
      }),
      dali_memory: tool({
        description: 'Manage persistent memories with SurrealDB backend',
        args: MemoryToolArgsSchema.shape as any,
        async execute(args: any, ctx: any) {
          const parsed = parseTheArgs('dali_memory', MemoryToolArgsSchema.shape, args);
          const containerTag = await getContainerTag(parsed.scope);
          return executeMemoryTool(parsed, {
            sessionID: ctx.sessionID,
            containerTag,
          });
        },
      }),
    },
    'experimental.session.compacting': async (_input, output) => {
      onSessionCompacting(_input, output);
    },
    'chat.message': async (input, output) => {
      await onChatMessage(input, output);
    },
    event: async (input) => {
      await onSessionEvent(input, {
        projectDbId,
        injectFactExtraction: async (sessionID) => {
          await client.session.prompt({
            body: {
              parts: [
                {
                  type: 'text',
                  text: 'Extract all knowledge facts from the compaction summary above. For each FACT: entry, call dali_memory with mode=fact_add content="<fact>". Do not skip any.',
                },
              ],
            },
            path: { id: sessionID },
          });
        },
      });
    },
  };
};

export default DaliMemoryPlugin;
