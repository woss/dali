import memoryService from '../utils/memory-service.ts';
import { logger } from '../utils/logger.ts';

export async function executeMigrateTool(): Promise<string> {
  const result = await memoryService.applyPendingMigrations();
  const msg =
    result.applied.length > 0
      ? `Applied ${result.applied.length} migration(s): ${result.applied.join(', ')}`
      : 'No pending migrations to apply';
  logger.info(msg, { applied: result.applied });
  return msg;
}
