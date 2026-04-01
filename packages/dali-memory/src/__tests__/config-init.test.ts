import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

// ==================== HOISTED MOCK FUNCTIONS ====================
// vi.hoisted ensures these resolve before vi.mock factories run
const { mockExistsSync, mockReadFileSync, mockHomedir, mockJoin, mockParse } = vi.hoisted(() => ({
  mockExistsSync: vi.fn().mockReturnValue(false),
  mockReadFileSync: vi.fn(),
  mockHomedir: vi.fn().mockReturnValue('/home/test-user'),
  mockJoin: vi.fn((...args: string[]) => args.join('/')),
  mockParse: vi.fn(),
}));

// ==================== MODULE MOCKS ====================

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

vi.mock('node:os', () => ({
  homedir: mockHomedir,
}));

vi.mock('node:path', () => ({
  join: mockJoin,
}));

vi.mock('jsonc-parser', () => ({
  parse: mockParse,
}));

// ==================== IMPORTS ====================

import { initConfig } from '../config.ts';

describe('initConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default behaviors (clearAllMocks clears mockReturnValue)
    mockExistsSync.mockReturnValue(false);
    mockHomedir.mockReturnValue('/home/test-user');
    mockJoin.mockImplementation((...args: string[]) => args.join('/'));
  });

  it('returns default config when no files exist', () => {
    const config = initConfig('/tmp/test-project');

    expect(config.storage.mode).toBe('embed');
    expect(config.embedding.model).toBe('text-embedding-qwen3-embedding-4b');
    expect(config.embedding.endpoint).toBe('http://localhost:1234/v1');
    expect(config.storage.embed?.dataPath).toBe('/home/test-user/.config/dali-memory/data/');
    expect(config.plugin).toEqual({});
  });

  it('default dataPath uses homedir', () => {
    const config = initConfig('/tmp/test-project');

    expect(config.storage.embed?.dataPath).toBe('/home/test-user/.config/dali-memory/data/');
    expect(mockHomedir).toHaveBeenCalled();
  });

  it('merges user config on top of defaults', () => {
    mockExistsSync.mockReturnValueOnce(true); // user jsonc
    mockReadFileSync.mockReturnValue('{"embedding": {"model": "custom-model"}}');
    mockParse.mockReturnValue({ embedding: { model: 'custom-model' } });

    const config = initConfig('/tmp/test-project');

    // User override applied
    expect(config.embedding.model).toBe('custom-model');
    // Default preserved for fields not overridden
    expect(config.embedding.endpoint).toBe('http://localhost:1234/v1');
    expect(config.storage.mode).toBe('embed');
  });

  it('project config overrides user config', () => {
    mockExistsSync
      .mockReturnValueOnce(true) // user jsonc
      .mockReturnValueOnce(true); // project jsonc
    mockReadFileSync.mockReturnValue('{}');
    mockParse
      .mockReturnValueOnce({ embedding: { model: 'user-model' } })
      .mockReturnValueOnce({ embedding: { model: 'project-model' } });

    const config = initConfig('/tmp/test-project');

    expect(config.embedding.model).toBe('project-model');
  });

  it('project plugin merges with user plugin config', () => {
    mockExistsSync
      .mockReturnValueOnce(true) // user jsonc
      .mockReturnValueOnce(true); // project jsonc
    mockReadFileSync.mockReturnValue('{}');
    mockParse
      .mockReturnValueOnce({
        plugin: { chatMessage: { enabled: true } },
      })
      .mockReturnValueOnce({
        plugin: { autoCapture: { enabled: true } },
      });

    const config = initConfig('/tmp/test-project');

    expect(config.plugin?.chatMessage?.enabled).toBe(true);
    expect(config.plugin?.autoCapture?.enabled).toBe(true);
  });

  it('falls back to .json when .jsonc not found', () => {
    mockExistsSync
      .mockReturnValueOnce(false) // user jsonc
      .mockReturnValueOnce(true) // user json
      .mockReturnValueOnce(false) // project jsonc
      .mockReturnValueOnce(false); // project json
    mockReadFileSync.mockReturnValue('{"embedding": {"model": "json-model"}}');
    mockParse.mockReturnValue({ embedding: { model: 'json-model' } });

    const config = initConfig('/tmp/test-project');

    expect(config.embedding.model).toBe('json-model');
  });

  it('handles readFileSync error gracefully — returns defaults', () => {
    mockExistsSync.mockReturnValue(true); // file "exists"
    mockReadFileSync.mockImplementation(() => {
      throw new Error('permission denied');
    });

    const config = initConfig('/tmp/test-project');

    // Falls all the way back to defaults
    expect(config.embedding.model).toBe('text-embedding-qwen3-embedding-4b');
    expect(config.storage.mode).toBe('embed');
  });

  it('reads correct user config paths', () => {
    mockExistsSync.mockReturnValueOnce(false); // user jsonc
    mockExistsSync.mockReturnValueOnce(true); // user json

    initConfig('/tmp/test-project');

    const home = '/home/test-user';
    expect(mockJoin).toHaveBeenCalledWith(home, '.config/dali-memory/dali-memory.jsonc');
    expect(mockJoin).toHaveBeenCalledWith(home, '.config/dali-memory/dali-memory.json');
  });

  it('reads correct project config paths', () => {
    initConfig('/tmp/my-project');

    expect(mockJoin).toHaveBeenCalledWith('/tmp/my-project', '.opencode/dali-memory.jsonc');
    expect(mockJoin).toHaveBeenCalledWith('/tmp/my-project', '.opencode/dali-memory.json');
  });

  it('resolves $HOME in dataPath when present', () => {
    mockExistsSync.mockReturnValueOnce(true); // user jsonc
    mockReadFileSync.mockReturnValue('{"storage": {"embed": {"dataPath": "$HOME/custom-data/"}}}');
    mockParse.mockReturnValue({
      storage: { embed: { dataPath: '$HOME/custom-data/' } },
    });

    const config = initConfig('/tmp/p');

    expect(config.storage.embed?.dataPath).toBe('/home/test-user/custom-data/');
  });

  it('resolves tilde in dataPath when present', () => {
    mockExistsSync.mockReturnValueOnce(true); // user jsonc
    mockReadFileSync.mockReturnValue('{"storage": {"embed": {"dataPath": "~/custom-data/"}}}');
    mockParse.mockReturnValue({
      storage: { embed: { dataPath: '~/custom-data/' } },
    });

    const config = initConfig('/tmp/p');

    expect(config.storage.embed?.dataPath).toBe('/home/test-user/custom-data/');
  });

  it('preserves storage defaults when user config only sets embedding', () => {
    mockExistsSync.mockReturnValueOnce(true); // user jsonc
    mockReadFileSync.mockReturnValue('{"embedding": {"model": "custom"}}');
    mockParse.mockReturnValue({ embedding: { model: 'custom' } });

    const config = initConfig('/tmp/p');

    expect(config.storage.mode).toBe('embed');
    expect(config.storage.embed?.dataPath).toBeTruthy();
    expect(config.embedding.model).toBe('custom');
  });

  it('handles empty user config object', () => {
    mockExistsSync.mockReturnValueOnce(true); // user jsonc
    mockReadFileSync.mockReturnValue('{}');
    mockParse.mockReturnValue({});

    const config = initConfig('/tmp/p');

    // All defaults preserved
    expect(config.storage.mode).toBe('embed');
    expect(config.embedding.model).toBe('text-embedding-qwen3-embedding-4b');
  });
});
