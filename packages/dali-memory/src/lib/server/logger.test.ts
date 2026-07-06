import { describe, test, expect, vi, beforeEach } from 'vitest';

const {
  mockConfigure,
  mockGetConsoleSink,
  mockGetJsonLinesFormatter,
  mockGetLogger,
  mockGetRotatingFileSink,
  mockGetPrettyFormatter,
  mockContextLocalStorage,
  mockConfig,
} = vi.hoisted(() => {
  const mockGetLogger = vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }));
  return {
    mockConfigure: vi.fn<(...args: any[]) => Promise<void>>(),
    mockGetConsoleSink: vi.fn(() => vi.fn()),
    mockGetJsonLinesFormatter: vi.fn(() => ({})),
    mockGetLogger,
    mockGetRotatingFileSink: vi.fn(() => vi.fn()),
    mockGetPrettyFormatter: vi.fn(() => ({})),
    mockContextLocalStorage: {} as Record<string, unknown>,
    mockConfig: {
      DALI_MEMORY_LOG_LEVEL: 'info',
      DALI_MEMORY_LOG_DIR: 'logs',
    },
  };
});

vi.mock('@logtape/logtape', () => ({
  configure: mockConfigure,
  getConsoleSink: mockGetConsoleSink,
  getJsonLinesFormatter: mockGetJsonLinesFormatter,
  getLogger: mockGetLogger,
}));
vi.mock('@logtape/file', () => ({ getRotatingFileSink: mockGetRotatingFileSink }));
vi.mock('@logtape/pretty', () => ({ getPrettyFormatter: mockGetPrettyFormatter }));
vi.mock('./config', () => ({ getConfig: () => mockConfig }));
vi.mock('./trace-context', () => ({ contextLocalStorage: mockContextLocalStorage }));

function resetMockConfig() {
  mockConfig.DALI_MEMORY_LOG_LEVEL = 'info';
  mockConfig.DALI_MEMORY_LOG_DIR = 'logs';
}

describe('CAT', () => {
  test('defines known categories', async () => {
    const { CAT } = await import('./logger');
    expect(CAT.app).toEqual(['dali-memory', 'app']);
    expect(CAT.db).toEqual(['dali-memory', 'db']);
    expect(CAT.api).toEqual(['dali-memory', 'api']);
    expect(CAT.llm).toEqual(['dali-memory', 'llm']);
    expect(CAT.mcp).toEqual(['dali-memory', 'mcp']);
    expect(CAT.auth).toEqual(['dali-memory', 'auth']);
    expect(CAT.embedder).toEqual(['dali-memory', 'embedder']);
    expect(CAT.http).toEqual(['dali-memory', 'http']);
    expect(CAT.search).toEqual(['dali-memory', 'search']);
    expect(CAT.hooks).toEqual(['dali-memory', 'hooks']);
  });
});

describe('initLogger()', () => {
  beforeEach(() => {
    vi.resetModules();
    [
      mockConfigure,
      mockGetConsoleSink,
      mockGetJsonLinesFormatter,
      mockGetLogger,
      mockGetRotatingFileSink,
      mockGetPrettyFormatter,
    ].forEach((m) => m.mockClear());
    resetMockConfig();
  });

  test('configures console with pretty formatter', async () => {
    const { initLogger } = await import('./logger');
    await initLogger();
    expect(mockConfigure).toHaveBeenCalledTimes(1);
    expect(mockGetPrettyFormatter).toHaveBeenCalledWith({
      timestamp: 'time',
      inspectOptions: { colors: true },
      wordWrap: 400,
    });
  });

  test('configures file with rotating JSON lines', async () => {
    const { initLogger } = await import('./logger');
    await initLogger();
    expect(mockGetRotatingFileSink).toHaveBeenCalledWith(
      'logs/dali-memory.log',
      expect.objectContaining({ maxSize: 10 * 1024 * 1024, maxFiles: 70 }),
    );
    expect(mockGetJsonLinesFormatter).toHaveBeenCalledWith({ properties: 'flatten' });
  });

  test('uses single parent category', async () => {
    const { initLogger } = await import('./logger');
    await initLogger();
    const loggers = mockConfigure.mock.calls[0][0].loggers;
    expect(loggers).toHaveLength(2);
    const d = loggers.filter((l: any) => l.category[0] === 'dali-memory');
    expect(d).toHaveLength(1);
    expect(d[0].category).toEqual(['dali-memory']);
  });

  test('sets lowestLevel from config', async () => {
    mockConfig.DALI_MEMORY_LOG_LEVEL = 'warn';
    const { initLogger } = await import('./logger');
    await initLogger();
    const daliLogger = mockConfigure.mock.calls[0][0].loggers.find(
      (l: any) => l.category[0] === 'dali-memory',
    );
    expect(daliLogger.lowestLevel).toBe('warning');
  });

  test('defaults to info for unknown level', async () => {
    mockConfig.DALI_MEMORY_LOG_LEVEL = 'verbose';
    const { initLogger } = await import('./logger');
    await initLogger();
    const daliLogger = mockConfigure.mock.calls[0][0].loggers.find(
      (l: any) => l.category[0] === 'dali-memory',
    );
    expect(daliLogger.lowestLevel).toBe('info');
  });

  test('uses default dir when LOG_DIR empty', async () => {
    mockConfig.DALI_MEMORY_LOG_DIR = '';
    const { initLogger } = await import('./logger');
    await initLogger();
    expect(mockGetRotatingFileSink).toHaveBeenCalledWith(
      'logs/dali-memory.log',
      expect.any(Object),
    );
  });

  test('is idempotent', async () => {
    const { initLogger } = await import('./logger');
    await initLogger();
    await initLogger();
    await initLogger();
    expect(mockConfigure).toHaveBeenCalledTimes(1);
  });

  test('passes contextLocalStorage', async () => {
    const { initLogger } = await import('./logger');
    await initLogger();
    expect(mockConfigure.mock.calls[0][0].contextLocalStorage).toBe(mockContextLocalStorage);
  });
});

describe('createLogger()', () => {
  beforeEach(() => {
    vi.resetModules();
    mockConfigure.mockClear();
    mockGetLogger.mockClear();
    resetMockConfig();
  });

  test('returns Logger', async () => {
    const { createLogger } = await import('./logger');
    const log = createLogger(['dali-memory', 'app']);
    expect(log).toBeDefined();
    expect(mockGetLogger).toHaveBeenCalledWith(['dali-memory', 'app']);
  });

  test('does not trigger init after already configured', async () => {
    const { initLogger, createLogger } = await import('./logger');
    await initLogger();
    mockConfigure.mockClear();
    createLogger(['dali-memory', 'db']);
    expect(mockConfigure).not.toHaveBeenCalled();
  });
});
