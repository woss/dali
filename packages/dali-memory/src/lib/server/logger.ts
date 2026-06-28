import {
  configureSync,
  getConsoleSink,
  getTextFormatter,
  getAnsiColorFormatter,
  getLogger,
  type Logger,
  type LogLevel,
} from '@logtape/logtape';
import { getFileSink } from '@logtape/file';
import { getConfig } from './config';

// Map our config log levels to LogTape log levels
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  debug: 'debug',
  info: 'info',
  warn: 'warning',
  error: 'error',
};

// ---------------------------------------------------------------------------
// Logger module — LogTape with console + rotating file sinks
// ---------------------------------------------------------------------------

let configured = false;

export type LogCategory =
  | ['dali-memory']
  | ['dali-memory', 'mcp']
  | ['dali-memory', 'auth']
  | ['dali-memory', 'db']
  | ['dali-memory', 'embedder']
  | ['dali-memory', 'http'];

/**
 * Initialize LogTape once at app start. Safe to call multiple times.
 */
export function initLogger(): void {
  if (configured) return;

  const level = (LOG_LEVEL_MAP[getConfig().DALI_MEMORY_LOG_LEVEL] ?? 'info') as LogLevel;
  const logsDir = process.env.DALI_MEMORY_LOG_DIR || 'logs';

  try {
    configureSync({
      sinks: {
        console: getConsoleSink({ formatter: getAnsiColorFormatter() }),
        file: getFileSink(`${logsDir}/dali-memory.log`, {
          formatter: getTextFormatter(),
        }),
      },
      loggers: [
        { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: [] },
        { category: ['dali-memory'], lowestLevel: level, sinks: ['console', 'file'] },
        { category: ['dali-memory', 'mcp'], lowestLevel: level, sinks: ['console', 'file'] },
        { category: ['dali-memory', 'auth'], lowestLevel: level, sinks: ['console', 'file'] },
        { category: ['dali-memory', 'db'], lowestLevel: level, sinks: ['console', 'file'] },
        { category: ['dali-memory', 'embedder'], lowestLevel: level, sinks: ['console', 'file'] },
        { category: ['dali-memory', 'http'], lowestLevel: level, sinks: ['console', 'file'] },
      ],
    });

    configured = true;
  } catch {
    // Already configured — happens in dev/HMR when this module is hot-reloaded
    // but LogTape's internal state survives. Safe to ignore.
  }
}

/**
 * Get a scoped logger by category.
 * Call initLogger() once before using this in production.
 */
export function getLog(category: LogCategory): Logger {
  if (!configured) {
    initLogger();
  }
  return getLogger(category);
}
