import {
  configure,
  getConsoleSink,
  getLogger,
  getJsonLinesFormatter,
  type Logger,
  type LogLevel,
} from '@logtape/logtape';
import { getRotatingFileSink } from '@logtape/file';
import { getPrettyFormatter } from '@logtape/pretty';
import { getConfig } from './config';
import { contextLocalStorage } from './trace-context';

const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  debug: 'debug',
  info: 'info',
  warn: 'warning',
  error: 'error',
};

let configured = false;
export type Category = [string, string];

export const CAT = {
  app: ['dali-memory', 'app'] as Category,
  db: ['dali-memory', 'db'] as Category,
  api: ['dali-memory', 'api'] as Category,
  llm: ['dali-memory', 'llm'] as Category,
  mcp: ['dali-memory', 'mcp'] as Category,
  auth: ['dali-memory', 'auth'] as Category,
  embedder: ['dali-memory', 'embedder'] as Category,
  http: ['dali-memory', 'http'] as Category,
  search: ['dali-memory', 'search'] as Category,
  hooks: ['dali-memory', 'hooks'] as Category,
};

export async function initLogger(): Promise<void> {
  console.log('configuring logger...', configured);
  if (configured) {
    return;
  }

  const level = (LOG_LEVEL_MAP[getConfig().DALI_MEMORY_LOG_LEVEL] ?? 'info') as LogLevel;
  const logsDir = getConfig().DALI_MEMORY_LOG_DIR || 'logs';

  try {
    await configure({
      contextLocalStorage,
      reset: true,
      sinks: {
        console: getConsoleSink({
          formatter: getPrettyFormatter({
            timestamp: 'time',
            inspectOptions: { colors: true },
            wordWrap: 400,
          }),
        }),
        file: getRotatingFileSink(`${logsDir}/dali-memory.log`, {
          maxSize: 10 * 1024 * 1024,
          maxFiles: 70,
          formatter: getJsonLinesFormatter({ properties: 'flatten' }),
        }),
      },
      loggers: [
        { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: [] },
        { category: ['dali-memory'], lowestLevel: level, sinks: ['console', 'file'] },
      ],
    });
    configured = true;
  } catch (error) {
    console.error('Failed to configure logger:', error);
  }
}

/**
 * Create a category-scoped logger.
 *
 * Usage:
 *   const log = logger(CAT.db);
 *   log.debug`Query took ${duration}ms`;
 */
export function createLogger(category: Category): Logger {
  return getLogger(category);
}
