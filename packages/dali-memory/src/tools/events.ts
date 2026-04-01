import type { EventSessionCreated, EventSessionUpdated } from '@opencode-ai/sdk/v2';
import memoryService from '../utils/memory-service.ts';
import { logger } from '../utils/logger.ts';

export interface ExtraEventDeps {
  projectDbId: string;
  injectFactExtraction?: (sessionID: string) => Promise<void>;
}

export async function onSessionEvent(input: { event: any }, deps: ExtraEventDeps): Promise<void> {
  const { event } = input;
  switch (event.type) {
    case 'session.created': {
      const sessionEvent = event as EventSessionCreated;
      await memoryService.upsertSession(deps.projectDbId, sessionEvent);
      break;
    }
    case 'session.updated': {
      const sessionEvent = event as EventSessionUpdated;
      await memoryService.updateSession(sessionEvent);
      break;
    }
    case 'session.compacted': {
      const sessionID = event.properties?.sessionID;
      if (sessionID && deps.injectFactExtraction) {
        try {
          await deps.injectFactExtraction(sessionID);
        } catch (e) {
          logger.warn('Failed to inject fact extraction prompt', { error: String(e) });
        }
      }
      break;
    }
    default:
      break;
  }
}
