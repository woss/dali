import type { ParsedMemoryToolArgs, ToolContext, ToolResult } from './types.ts';
import memoryService from '../utils/memory-service.ts';
import { logger } from '../utils/logger.ts';

export async function executeMemoryTool(
  args: ParsedMemoryToolArgs,
  context: ToolContext & { containerTag: string },
): Promise<ToolResult> {
  switch (args.mode) {
    case 'add': {
      if (!args.content) return { output: 'Content required for add mode' };
      const id = await memoryService.addMemory(
        args.content,
        args.tags || [],
        args.type || 'general',
        context.containerTag,
        context.sessionID,
      );
      if (!id) return { output: 'Failed to add memory' };
      logger.debug('Memory added', {
        id,
        containerTag: context.containerTag,
        sessionId: context.sessionID,
      });
      return { output: `Memory added with ID: ${id}` };
    }

    case 'search': {
      if (!args.query) return { output: 'Query required for search mode' };
      const results = await memoryService.searchMemories(args.query, context.containerTag, {
        tags: args.tags,
        limit: 10,
      });
      if (results.length === 0) return { output: 'No memories found' };
      const formatted = results
        .map((r: any, i: number) => `${i + 1}. [${r.id}] ${r.content?.slice(0, 100)}...`)
        .join('\n');
      return { output: `Found ${results.length} memories:\n${formatted}` };
    }

    case 'list': {
      const memories = await memoryService.listMemories(context.containerTag, 50);
      if (memories.length === 0) return { output: 'No memories found' };
      const listFormatted = memories
        .map((m: any, i: number) => `${i + 1}. [${m.id}] ${m.content?.slice(0, 100)}...`)
        .join('\n');
      return { output: `Memories:\n${listFormatted}` };
    }

    case 'forget': {
      if (!args.id) return { output: 'ID required for forget mode' };
      await memoryService.deleteMemory(args.id);
      return { output: `Memory ${args.id} deleted` };
    }

    case 'help':
      return {
        output: `Memory tool modes: add, search, list, forget, help, profile\nFact tool modes: fact_add <content> [memoryId], fact_list <memoryId>, fact_verify <factId>`,
      };

    case 'profile':
      return { output: 'Profile mode not yet implemented' };

    case 'fact_add': {
      if (!args.content) return { output: 'Content required for fact_add mode' };
      const factId = await memoryService.saveFact(args.content, false);
      if (!factId) return { output: 'Failed to add fact' };
      if (args.memoryId) {
        await memoryService.linkMemoryToFact(args.memoryId, factId);
        return { output: `Fact added with ID: ${factId} and linked to memory ${args.memoryId}` };
      }
      return { output: `Fact added with ID: ${factId}` };
    }

    case 'fact_list': {
      if (!args.memoryId) return { output: 'memoryId required for fact_list mode' };
      const facts = await memoryService.getFactsForMemory(args.memoryId);
      if (facts.length === 0) return { output: 'No facts found for this memory' };
      const formatted = facts
        .map(
          (f: any, i: number) =>
            `${i + 1}. [${f.id}] ${f.content?.slice(0, 200)}${f.verified ? ' ✓' : ' ○'}`,
        )
        .join('\n');
      return { output: `Facts for memory ${args.memoryId}:\n${formatted}` };
    }

    case 'fact_verify': {
      if (!args.factId) return { output: 'factId required for fact_verify mode' };
      await memoryService.verifyFact(args.factId);
      return { output: `Fact ${args.factId} verified` };
    }

    default:
      return { output: 'Invalid mode. Use: add, search, list, forget, help, profile' };
  }
}
