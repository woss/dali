/**
 * Comprehensive test suite for Config File Loader
 *
 * Tests every exported function in loader.ts with mocked filesystem.
 * Covers: loadConfig, loadConfigSync, clearConfigCache, getCachedConfig,
 * configFileExists, loadConfigOptions, loadConfigOptionsSync.
 *
 * Internal functions (stripJsonComments, parseJsonContent, detectFormat,
 * findConfigFile, searchConfigFile, loadFileContent, loadTypeScriptConfig)
 * are tested indirectly through the public API.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Module-level mocks (hoisted to top by vitest)
// ============================================================================

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../schema.js', () => ({
  validateConfig: vi.fn(),
  parseConfig: vi.fn(),
}));

// ============================================================================
// Imports (after mocks due to hoisting)
// ============================================================================

import {
  clearConfigCache,
  configFileExists,
  getCachedConfig,
  loadConfig,
  loadConfigOptions,
  loadConfigOptionsSync,
  loadConfigSync,
} from '../loader.js';

import { parseConfig, validateConfig } from '../schema.js';

// ============================================================================
// Helpers
// ============================================================================

/** Valid minimal config JSON string */
const VALID_JSON = JSON.stringify({
  url: 'ws://localhost:8000',
  namespace: 'test_ns',
  database: 'test_db',
});

/** Resolved path for fixture test TypeScript config files */
const FIXTURES_DIR = new URL('./fixtures/', import.meta.url).pathname;

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  vi.restoreAllMocks();
  clearConfigCache();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(process, 'cwd').mockReturnValue('/test/workspace');

  // Default mock implementations
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readFileSync).mockReturnValue(VALID_JSON);
  vi.mocked(validateConfig).mockReturnValue({
    valid: true,
    errors: [],
    typed: true,
  });
  vi.mocked(parseConfig).mockImplementation(
    (cfg: Record<string, unknown>) => ({ ...cfg, validated: true }) as never,
  );
});

// ============================================================================
// loadConfig (async)
// ============================================================================

describe('loadConfig', () => {
  it('loads config from explicit .json path', async () => {
    const result = await loadConfig({ path: '/app/.dali-orm.json' });

    expect(result.config).toBeDefined();
    expect(result.cached).toBe(false);
    expect(result.path).toContain('.dali-orm.json');
    expect(result.config.namespace).toBe('test_ns');
    expect(result.config.database).toBe('test_db');
    expect(
      (result.config as unknown as Record<string, unknown>).validated,
    ).toBe(true);
    expect(vi.mocked(validateConfig)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(parseConfig)).toHaveBeenCalledTimes(1);
  });

  it('loads config from explicit .jsonc path', async () => {
    const result = await loadConfig({ path: '/app/.dali-orm.jsonc' });

    expect(result.config).toBeDefined();
    expect(result.cached).toBe(false);
    expect(result.path).toContain('.dali-orm.jsonc');
  });

  it('throws when no config file found in any search location', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await expect(loadConfig()).rejects.toThrow('Config file not found');
  });

  it('throws when file does not exist (format.exists false)', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await expect(loadConfig({ path: '/app/missing.json' })).rejects.toThrow(
      'does not exist',
    );
  });

  it('throws on validation error', async () => {
    vi.mocked(validateConfig).mockReturnValueOnce({
      valid: false,
      typed: false,
      errors: [{ path: '/url', message: 'Invalid protocol' }],
    });

    await expect(loadConfig({ path: '/app/.dali-orm.json' })).rejects.toThrow(
      'Config validation failed',
    );
  });

  it('returns cached result on second call with same path', async () => {
    const first = await loadConfig({ path: '/app/.dali-orm.json' });
    expect(first.cached).toBe(false);

    const second = await loadConfig({ path: '/app/.dali-orm.json' });
    expect(second.cached).toBe(true);
    expect(second.config).toEqual(first.config);
  });

  it('loads fresh config when path changes (cache miss)', async () => {
    await loadConfig({ path: '/app/first.json' });

    const result = await loadConfig({ path: '/app/second.json' });
    expect(result.cached).toBe(false);
  });

  it('loads TypeScript config with default export', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const tsPath = join(FIXTURES_DIR, 'test-config.ts');

    const result = await loadConfig({ path: tsPath });

    expect(result.config).toBeDefined();
    expect(result.config.url).toBe('ws://localhost:8000');
  });

  it('loads TypeScript config with named config export', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const tsPath = join(FIXTURES_DIR, 'test-config-named.ts');

    const result = await loadConfig({ path: tsPath });

    expect(result.config).toBeDefined();
    expect(result.config.url).toBe('ws://localhost:8000');
  });

  it('throws when TypeScript config exports non-object', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const tsPath = join(FIXTURES_DIR, 'test-config-invalid.ts');

    await expect(loadConfig({ path: tsPath })).rejects.toThrow(
      'must export a default config object',
    );
  });

  it('throws when TypeScript file import fails', async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    await expect(
      loadConfig({ path: '/nonexistent/config.ts' }),
    ).rejects.toThrow('Failed to load TypeScript config');
  });
});

// ============================================================================
// loadConfigSync
// ============================================================================

describe('loadConfigSync', () => {
  it('loads config from explicit .json path', () => {
    const result = loadConfigSync({ path: '/app/.dali-orm.json' });

    expect(result.config).toBeDefined();
    expect(result.cached).toBe(false);
    expect(result.config.namespace).toBe('test_ns');
    expect(
      (result.config as unknown as Record<string, unknown>).validated,
    ).toBe(true);
  });

  it('throws when no config file found in any search location', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    expect(() => loadConfigSync()).toThrow('Config file not found');
  });

  it('throws when file does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    expect(() => loadConfigSync({ path: '/app/missing.json' })).toThrow(
      'does not exist',
    );
  });

  it('throws on validation error', () => {
    vi.mocked(validateConfig).mockReturnValueOnce({
      valid: false,
      typed: false,
      errors: [{ path: '/url', message: 'Invalid protocol' }],
    });

    expect(() => loadConfigSync({ path: '/app/.dali-orm.json' })).toThrow(
      'Config validation failed',
    );
  });

  it('throws when loading TypeScript config synchronously', () => {
    expect(() => loadConfigSync({ path: '/app/config.ts' })).toThrow(
      'cannot be loaded synchronously',
    );
  });

  it('returns cached result on second call with same path', () => {
    const first = loadConfigSync({ path: '/app/.dali-orm.json' });
    expect(first.cached).toBe(false);

    const second = loadConfigSync({ path: '/app/.dali-orm.json' });
    expect(second.cached).toBe(true);
    expect(second.config).toEqual(first.config);
  });
});

// ============================================================================
// Cache Management
// ============================================================================

describe('configCache', () => {
  it('clearConfigCache clears the cache', async () => {
    await loadConfig({ path: '/app/.dali-orm.json' });
    expect(getCachedConfig()).not.toBeNull();

    clearConfigCache();

    expect(getCachedConfig()).toBeNull();
  });

  it('getCachedConfig returns null when cache is empty', () => {
    clearConfigCache();

    expect(getCachedConfig()).toBeNull();
  });

  it('getCachedConfig returns config when cache is populated', async () => {
    await loadConfig({ path: '/app/.dali-orm.json' });

    const cached = getCachedConfig();

    expect(cached).not.toBeNull();
    expect(cached!.cached).toBe(true);
    expect(cached!.config.namespace).toBe('test_ns');
  });
});

// ============================================================================
// configFileExists
// ============================================================================

describe('configFileExists', () => {
  it('returns true when file exists', () => {
    const result = configFileExists({ path: '/app/.dali-orm.json' });

    expect(result).toBe(true);
  });

  it('returns false when file does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = configFileExists({ path: '/app/.dali-orm.json' });

    expect(result).toBe(false);
  });
});

// ============================================================================
// Convenience Wrappers
// ============================================================================

describe('loadConfigOptions (convenience async)', () => {
  it('returns validated config object directly', async () => {
    const config = await loadConfigOptions({ path: '/app/.dali-orm.json' });

    expect(config.namespace).toBe('test_ns');
    expect((config as unknown as Record<string, unknown>).validated).toBe(true);
  });

  it('propagates errors from loadConfig', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await expect(loadConfigOptions()).rejects.toThrow('Config file not found');
  });
});

describe('loadConfigOptionsSync (convenience sync)', () => {
  it('returns validated config object directly', () => {
    const config = loadConfigOptionsSync({ path: '/app/.dali-orm.json' });

    expect(config.namespace).toBe('test_ns');
    expect((config as unknown as Record<string, unknown>).validated).toBe(true);
  });

  it('propagates errors from loadConfigSync', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    expect(() => loadConfigOptionsSync()).toThrow('Config file not found');
  });
});

// ============================================================================
// stripJsonComments (via loadConfigSync with JSONC content)
// ============================================================================

describe('stripJsonComments (indirect via JSONC loading)', () => {
  it('removes single-line // comments', () => {
    vi.mocked(readFileSync).mockReturnValueOnce(`{
      "url": "ws://localhost:8000",
      // this is a comment
      "namespace": "test_ns",
      "database": "test_db"
    }`);

    const result = loadConfigSync({ path: '/app/.dali-orm.jsonc' });

    expect(result.config.namespace).toBe('test_ns');
  });

  it('removes multi-line /* */ comments', () => {
    vi.mocked(readFileSync).mockReturnValueOnce(`{
      "url": "ws://localhost:8000",
      /* multi-line
         comment here */
      "namespace": "test_ns",
      "database": "test_db"
    }`);

    const result = loadConfigSync({ path: '/app/.dali-orm.jsonc' });

    expect(result.config.namespace).toBe('test_ns');
  });

  it('preserves strings containing comment-like characters', () => {
    vi.mocked(readFileSync).mockReturnValueOnce(`{
      "url": "ws://localhost:8000",
      "pattern": "http://example.com/api/*",
      "namespace": "test_ns",
      "database": "test_db"
    }`);

    const result = loadConfigSync({ path: '/app/.dali-orm.jsonc' });

    expect(result.config.url).toBe('ws://localhost:8000');
  });

  it('handles escape sequences in strings', () => {
    vi.mocked(readFileSync).mockReturnValueOnce(`{
      "url": "ws://localhost:8000",
      "path": "C:\\\\\\\\development\\\\config",
      "namespace": "test_ns",
      "database": "test_db"
    }`);

    const result = loadConfigSync({ path: '/app/.dali-orm.jsonc' });

    expect(result.config.namespace).toBe('test_ns');
  });

  it('removes trailing commas', () => {
    vi.mocked(readFileSync).mockReturnValueOnce(`{
      "url": "ws://localhost:8000",
      "namespace": "test_ns",
      "database": "test_db",
    }`);

    const result = loadConfigSync({ path: '/app/.dali-orm.jsonc' });

    expect(result.config.namespace).toBe('test_ns');
  });
});

// ============================================================================
// loadFileContent / parseJsonContent errors (indirect via loadConfigSync)
// ============================================================================

describe('file content errors', () => {
  it('throws when file content cannot be loaded (file missing)', () => {
    vi.mocked(existsSync)
      .mockReturnValueOnce(true) // detectFormat
      .mockReturnValue(false); // loadFileContent

    expect(() => loadConfigSync({ path: '/app/.dali-orm.json' })).toThrow(
      'Config file not found',
    );
  });

  it('throws descriptive error for invalid JSON content', () => {
    vi.mocked(readFileSync).mockReturnValueOnce('{ not-valid-json }');

    expect(() => loadConfigSync({ path: '/app/.dali-orm.json' })).toThrow(
      'Failed to parse JSON config',
    );
  });
});

// ============================================================================
// findConfigFile search behavior (indirect via loadConfigSync)
// ============================================================================

describe('config file search paths', () => {
  it('finds config via explicit path (bypasses search)', () => {
    const result = loadConfigSync({ path: '/custom/path/.dali-orm.json' });

    expect(result.path).toContain('/custom/path/.dali-orm.json');
  });

  it('finds config in .config subdirectory', () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      const s = String(p);
      return s.includes('/.config/.dali-orm.json');
    });

    const result = loadConfigSync();

    expect(result.path).toContain('/.config/.dali-orm.json');
  });

  it('finds config in home directory after CWD search fails', () => {
    const home = homedir();
    vi.mocked(existsSync).mockImplementation((p) => {
      const s = String(p);
      return s.includes(home);
    });

    const result = loadConfigSync();

    expect(result.path).toContain(home);
  });

  it('returns null when config not found in CWD, .config, config, or home', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    expect(() => loadConfigSync()).toThrow('Config file not found');
  });
});

// ============================================================================
// detectFormat variants (indirect via loadConfig/loadConfigSync)
// ============================================================================

describe('detectFormat (indirect)', () => {
  it('handles .json extension (json type)', () => {
    const result = loadConfigSync({ path: '/app/.dali-orm.json' });

    expect(result.path).toContain('.json');
  });

  it('handles .jsonc extension (jsonc type, json loading path)', () => {
    const result = loadConfigSync({ path: '/app/.dali-orm.jsonc' });

    expect(result.path).toContain('.jsonc');
    expect(result.config.namespace).toBe('test_ns');
  });

  it('handles .ts extension (typescript type)', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const tsPath = join(FIXTURES_DIR, 'test-config.ts');

    const result = await loadConfig({ path: tsPath });

    expect(result.path).toContain('test-config.ts');
    expect(result.config.url).toBe('ws://localhost:8000');
  });
});
