import {
  configureSync,
  getLogger,
  jsonLinesFormatter,
  type Logger,
  type Sink,
} from '@logtape/logtape';
import { getRotatingFileSink } from '@logtape/file';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pluginName } from '../constants.ts';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerConfig {
  level?: LogLevel;
  enabled?: boolean;
}

let loggerInstance: Logger | null = null;

function getLogDir(): string {
  return join(homedir(), '.config', pluginName, 'logs');
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getFileSink(): Sink {
  const envPath = process.env.DALI_MEMORY_LOGGING_FILE_PATH;
  const resolvedEnvPath = envPath
    ? envPath.replace(/^~/, homedir()).replace('$HOME', homedir())
    : null;
  const filePath = resolvedEnvPath
    ? resolve(resolvedEnvPath)
    : join(getLogDir(), 'dali-memory.log');
  ensureDir(filePath);
  return getRotatingFileSink(filePath, {
    formatter: jsonLinesFormatter,
    maxFiles: 5,
    maxSize: 10 * 1024 * 1024,
  });
}

function getEffectiveConfig(config?: LoggerConfig): { level: string; enabled: boolean } {
  return {
    level: config?.level ?? process.env.DALI_MEMORY_LOGGING_LEVEL ?? 'info',
    enabled: config?.enabled ?? process.env.DALI_MEMORY_LOGGING_ENABLED !== 'false',
  };
}

function initialize(config?: LoggerConfig): void {
  if (loggerInstance) return;

  const { level, enabled } = getEffectiveConfig(config);
  if (!enabled) {
    loggerInstance = getLogger(pluginName);
    return;
  }

  const sinks: Record<string, Sink> = {};
  try {
    sinks.file = getFileSink();
  } catch {
    // File logging is optional
  }

  const lowestLevel =
    level === 'warn'
      ? ('warning' as const)
      : level === 'error'
        ? ('error' as const)
        : level === 'debug'
          ? ('debug' as const)
          : ('info' as const);

  configureSync({
    sinks,
    loggers: [
      {
        category: ['logtape', 'meta'],
        sinks: Object.keys(sinks),
        lowestLevel: 'warning',
      },
      {
        category: pluginName,
        sinks: Object.keys(sinks),
        lowestLevel,
      },
    ],
  });

  loggerInstance = getLogger(pluginName);
}

export function initLogger(config?: LoggerConfig): void {
  initialize(config);
}

const logger = new Proxy<Logger>({} as Logger, {
  get(_target, prop: string | symbol) {
    if (!loggerInstance) {
      initialize();
    }
    const value = Reflect.get(loggerInstance!, prop);
    if (typeof value === 'function') {
      return value.bind(loggerInstance);
    }
    return value;
  },
});

export { logger };
