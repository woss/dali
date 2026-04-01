import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

// Mock logtape before importing the module under test
vi.mock('@logtape/logtape', () => ({
  configureSync: vi.fn(),
  getConsoleSink: vi.fn().mockReturnValue('console-sink'),
  getLogger: vi.fn().mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    log: vi.fn(),
    with: vi.fn(),
    withGroup: vi.fn(),
  }),
  jsonLinesFormatter: { format: vi.fn() },
}));

vi.mock('@logtape/file', () => ({
  getRotatingFileSink: vi.fn().mockReturnValue('file-sink'),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn().mockReturnValue('/home/test-user'),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
  dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/') || '.'),
}));

describe('logger module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env vars before each test
    delete process.env.DALI_MEMORY_LOGGING_LEVEL;
    delete process.env.DALI_MEMORY_LOGGING_ENABLED;
    delete process.env.DALI_MEMORY_LOGGING_FILE_PATH;
  });

  describe('module-level initialization (23-73)', () => {
    it('imports successfully and exports a logger', async () => {
      // Dynamic import forces module evaluation
      const mod = await import('../utils/logger.ts');
      expect(mod.logger).toBeDefined();
      expect(mod.initLogger).toBeDefined();
    });
  });

  describe('initLogger', () => {
    it('exists and is a function', async () => {
      const mod = await import('../utils/logger.ts');
      expect(typeof mod.initLogger).toBe('function');
    });

    it('can be called with custom config', async () => {
      const mod = await import('../utils/logger.ts');
      expect(() => mod.initLogger({ level: 'debug', enabled: true })).not.toThrow();
    });

    it('can be called with partial config', async () => {
      const mod = await import('../utils/logger.ts');
      expect(() => mod.initLogger({ level: 'debug' })).not.toThrow();
      expect(() => mod.initLogger({ enabled: false })).not.toThrow();
    });

    it('accepts all valid log levels', async () => {
      const mod = await import('../utils/logger.ts');
      for (const level of ['debug', 'info', 'warn', 'error'] as const) {
        expect(() => mod.initLogger({ level })).not.toThrow();
      }
    });
  });

  describe('LogLevel type', () => {
    it('logger has standard log methods', async () => {
      const mod = await import('../utils/logger.ts');
      expect(typeof mod.logger.debug).toBe('function');
      expect(typeof mod.logger.info).toBe('function');
      expect(typeof mod.logger.warn).toBe('function');
      expect(typeof mod.logger.error).toBe('function');
    });
  });
});
