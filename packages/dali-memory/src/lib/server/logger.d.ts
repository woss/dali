import { type Logger } from '@logtape/logtape';
export type LogCategory = ['dali-memory'] | ['dali-memory', 'mcp'] | ['dali-memory', 'auth'] | ['dali-memory', 'db'] | ['dali-memory', 'embedder'] | ['dali-memory', 'http'];
/**
 * Initialize LogTape once at app start. Safe to call multiple times.
 */
export declare function initLogger(): void;
/**
 * Get a scoped logger by category.
 * Call initLogger() once before using this in production.
 */
export declare function getLog(category: LogCategory): Logger;
//# sourceMappingURL=logger.d.ts.map