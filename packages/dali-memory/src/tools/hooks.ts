import memoryService from '../utils/memory-service.ts';
import { logger } from '../utils/logger.ts';

export function onSessionCompacting(_input: any, output: any): void {
  logger.debug('experimental.session.compacting hook triggered');
  output.context.push(`## Fact Extraction
Review the conversation content being compacted. Identify any knowledge facts (statements about the user, their preferences, project decisions, architecture choices, or other information worth remembering).

For each fact you find, output it in this format:
FACT: <the knowledge statement>

These will be automatically extracted and stored.`);
}

export async function onChatMessage(input: any, output: any): Promise<void> {
  logger.debug('chat.message hook triggered', { input, output });
  const currentSessionId = input.sessionID;
  const userText = input.parts
    ?.filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join(' ')
    .trim();

  const agentText = output.parts
    ?.filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join(' ')
    .trim();

  if (userText) {
    await memoryService.saveMessage(currentSessionId, 'user', userText).catch((err: unknown) => {
      logger.warn('Failed to save user message', { error: String(err) });
    });
  }

  if (agentText) {
    await memoryService.saveMessage(currentSessionId, 'agent', agentText).catch((err: unknown) => {
      logger.warn('Failed to save agent message', { error: String(err) });
    });
  }
}
