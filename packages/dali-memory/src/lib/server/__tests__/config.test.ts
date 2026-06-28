import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// Mutable env ref — assigned before each import so the mock factory returns it
// =============================================================================

let mockEnv: Record<string, string> = {};

vi.mock('$env/dynamic/private', () => ({
  get env() {
    return mockEnv;
  },
}));

// =============================================================================
// Helpers
// =============================================================================

/**
 * Returns a minimal valid env object with optional overrides.
 * Optional fields are OMITTED by default so defaults can be verified.
 */
function validEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    DALI_MEMORY_SURREAL_URL: 'ws://localhost:10101',
    DALI_MEMORY_SURREAL_NS: 'memory',
    DALI_MEMORY_SURREAL_DB: 'memory',
    DALI_MEMORY_SURREAL_USER: 'root',
    DALI_MEMORY_SURREAL_PASS: 'root',
    DALI_MEMORY_SECRET: 'test-secret',
    ...overrides,
  };
}

// =============================================================================
// Tests — uses a mutable module-level ref so each test sets mockEnv before
// resetting modules and re-importing.  Avoids nested vi.doMock conflicts.
// =============================================================================

describe('getConfig()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Valid env — defaults applied
  // ---------------------------------------------------------------------------

  describe('with valid env (defaults only)', () => {
    beforeEach(() => {
      mockEnv = validEnv();
      vi.resetModules();
    });

    test('returns parsed config object when env vars are valid', async () => {
      const { getConfig } = await import('../config');
      const config = getConfig();

      expect(config).toBeDefined();
      expect(config.DALI_MEMORY_SECRET).toBe('test-secret');
      expect(config.DALI_MEMORY_SURREAL_URL).toBe('ws://localhost:10101');
    });

    test('applies defaults for optional env vars', async () => {
      const { getConfig } = await import('../config');
      const cfg = getConfig();

      // Embedding defaults
      expect(cfg.DALI_MEMORY_EMBEDDING_PROVIDER).toBe('remote');
      expect(cfg.DALI_MEMORY_EMBEDDING_MODEL).toBe('all-MiniLM-L6-v2');
      expect(cfg.DALI_MEMORY_EMBEDDING_DIMENSION).toBe(384);
      expect(cfg.DALI_MEMORY_EMBEDDING_ENDPOINT).toBe('http://localhost:1234/v1');
      expect(cfg.DALI_MEMORY_EMBEDDING_CACHE_DIR).toBe('./models');

      // MCP defaults
      expect(cfg.DALI_MEMORY_MCP_SSE_PATH).toBe('/mcp');

      // Server defaults
      expect(cfg.DALI_MEMORY_PORT).toBe(5173);
      expect(cfg.DALI_MEMORY_HOST).toBe('0.0.0.0');

      // Auth default
      expect(cfg.DALI_MEMORY_AUTH_ENABLED).toBe(true);

      // SurrealDB defaults
      expect(cfg.DALI_MEMORY_SURREAL_NS).toBe('memory');
      expect(cfg.DALI_MEMORY_SURREAL_DB).toBe('memory');
      expect(cfg.DALI_MEMORY_SURREAL_USER).toBe('root');
      expect(cfg.DALI_MEMORY_SURREAL_PASS).toBe('root');

      // Logging default
      expect(cfg.DALI_MEMORY_LOG_LEVEL).toBe('info');
    });

    test('caches: second call returns same object (singleton)', async () => {
      const { getConfig } = await import('../config');
      const a = getConfig();
      const b = getConfig();

      expect(a).toBe(b);
    });
  });

  // ---------------------------------------------------------------------------
  // Custom values — coercion
  // ---------------------------------------------------------------------------

  describe('with custom values', () => {
    beforeEach(() => {
      mockEnv = validEnv({
        DALI_MEMORY_PORT: '8080',
        DALI_MEMORY_EMBEDDING_PROVIDER: 'local',
        DALI_MEMORY_AUTH_ENABLED: 'false',
        DALI_MEMORY_EMBEDDING_DIMENSION: '768',
        DALI_MEMORY_EMBEDDING_MODEL: 'intfloat/e5-small-v2',
        DALI_MEMORY_HOST: '127.0.0.1',
        DALI_MEMORY_LOG_LEVEL: 'debug',
      });
      vi.resetModules();
    });

    test('coerces string-port to number', async () => {
      const { getConfig } = await import('../config');
      expect(getConfig().DALI_MEMORY_PORT).toBe(8080);
    });

    test('coerces string-dimension to positive integer', async () => {
      const { getConfig } = await import('../config');
      expect(getConfig().DALI_MEMORY_EMBEDDING_DIMENSION).toBe(768);
    });

    test('coerces string-boolean "false" to boolean true (non-empty string)', async () => {
      const { getConfig } = await import('../config');
      // z.coerce.boolean() uses Boolean() — any non-empty string is truthy
      expect(getConfig().DALI_MEMORY_AUTH_ENABLED).toBe(true);
    });

    test('empty string-boolean coerces to false (falsy string)', async () => {
      mockEnv = validEnv({ DALI_MEMORY_AUTH_ENABLED: '' });
      vi.resetModules();
      const { getConfig } = await import('../config');
      expect(getConfig().DALI_MEMORY_AUTH_ENABLED).toBe(false);
    });

    test('accepts custom string enum values', async () => {
      const { getConfig } = await import('../config');
      expect(getConfig().DALI_MEMORY_EMBEDDING_PROVIDER).toBe('local');
      expect(getConfig().DALI_MEMORY_LOG_LEVEL).toBe('debug');
    });

    test('accepts custom host and model strings', async () => {
      const { getConfig } = await import('../config');
      expect(getConfig().DALI_MEMORY_HOST).toBe('127.0.0.1');
      expect(getConfig().DALI_MEMORY_EMBEDDING_MODEL).toBe('intfloat/e5-small-v2');
    });
  });

  // ---------------------------------------------------------------------------
  // Validation errors
  // ---------------------------------------------------------------------------

  describe('on invalid env', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('missing DALI_MEMORY_SECRET causes process.exit(1)', async () => {
      mockEnv = validEnv({ DALI_MEMORY_SECRET: '' });
      vi.resetModules();

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit(1)');
      });

      const { getConfig } = await import('../config');
      expect(() => getConfig()).toThrow('process.exit(1)');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('invalid DALI_MEMORY_SURREAL_URL causes process.exit(1)', async () => {
      mockEnv = validEnv({ DALI_MEMORY_SURREAL_URL: 'not-a-valid-url' });
      vi.resetModules();

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit(1)');
      });

      const { getConfig } = await import('../config');
      expect(() => getConfig()).toThrow('process.exit(1)');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('invalid DALI_MEMORY_EMBEDDING_ENDPOINT causes process.exit(1)', async () => {
      mockEnv = validEnv({ DALI_MEMORY_EMBEDDING_ENDPOINT: 'bad-endpoint' });
      vi.resetModules();

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit(1)');
      });

      const { getConfig } = await import('../config');
      expect(() => getConfig()).toThrow('process.exit(1)');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('invalid DALI_MEMORY_LOG_LEVEL enum causes process.exit(1)', async () => {
      mockEnv = validEnv({ DALI_MEMORY_LOG_LEVEL: 'verbose' });
      vi.resetModules();

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit(1)');
      });

      const { getConfig } = await import('../config');
      expect(() => getConfig()).toThrow('process.exit(1)');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
