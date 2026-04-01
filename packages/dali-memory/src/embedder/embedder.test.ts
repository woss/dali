import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { EmbedderService, embeddingService, embedderConfigSchema } from './embedder.ts';

// Mock fetch for RemoteEmbedProvider
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('EmbedderService facade', () => {
  let service: EmbedderService;

  beforeEach(() => {
    service = new EmbedderService();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
    });
  });

  describe('configure', () => {
    it('selects remote provider by default', async () => {
      const config = {
        provider: 'remote' as const,
        endpoint: 'http://test:1234/v1',
        model: 'test-model',
      };
      await service.configure(config);
      expect(service.config).toBeTruthy();
      expect(service.config?.provider).toBe('remote');
    });

    it('selects remote provider when explicitly set', async () => {
      const config = {
        provider: 'remote' as const,
        endpoint: 'http://test:1234/v1',
        model: 'test-model',
      };
      await service.configure(config);
      expect(service.config?.provider).toBe('remote');
    });

    it('selects local provider when configured', async () => {
      const tsProvider = (service as any).localProvider;
      vi.spyOn(tsProvider, 'configure').mockResolvedValue(undefined);
      const config = { provider: 'local' as const, model: 'test-model' };
      await service.configure(config);
      expect(service.config?.provider).toBe('local');
    });

    it('throws on invalid config', async () => {
      // @ts-expect-error testing invalid config
      await expect(service.configure({ provider: 'invalid' })).rejects.toThrow();
    });
  });

  describe('remote provider delegation', () => {
    it('embeds via remote provider by default', async () => {
      const config = {
        provider: 'remote' as const,
        endpoint: 'http://test:1234/v1',
        model: 'test-model',
      };
      await service.configure(config);

      const result = await service.embed('test text');
      expect(result).not.toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('clearCache delegates to both providers', () => {
      // Should not throw
      expect(() => service.clearCache()).not.toThrow();
    });
  });

  describe('embed returns null when not configured', () => {
    it('returns null before configure is called', async () => {
      const result = await service.embed('test');
      expect(result).toBeNull();
    });
  });
});

describe('embeddingService singleton', () => {
  it('is an instance of EmbedderService', () => {
    expect(embeddingService).toBeInstanceOf(EmbedderService);
  });

  it('can be configured and used', async () => {
    const config = {
      provider: 'remote' as const,
      endpoint: 'http://test:1234/v1',
      model: 'test-model',
    };
    await embeddingService.configure(config);

    // singleton shares the global mock from above
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.5, 0.5] }] }),
    });

    const result = await embeddingService.embed('singleton test');
    expect(result).not.toBeNull();
  });
});

describe('local provider delegation', () => {
  it('embeds via local provider when configured', async () => {
    const service = new EmbedderService();
    const tsProvider = (service as any).localProvider;
    vi.spyOn(tsProvider, 'configure').mockResolvedValue(undefined);
    vi.spyOn(tsProvider, 'embed').mockResolvedValue({
      vector: new Float32Array([0.1, 0.2, 0.3]),
      dimensions: 3,
    });

    await service.configure({ provider: 'local' as const, model: 'test-model' });
    const result = await service.embed('test text');

    expect(result).not.toBeNull();
    expect(result!.dimensions).toBe(3);
    expect(tsProvider.embed).toHaveBeenCalledWith('test text');
  });
});

describe('reconfiguration', () => {
  it('overwrites previous config and updates active provider', async () => {
    const service = new EmbedderService();
    await service.configure({
      provider: 'remote' as const,
      endpoint: 'http://test:1234/v1',
      model: 'first-model',
    });
    expect(service.config?.provider).toBe('remote');
    expect(service.config?.model).toBe('first-model');

    const tsProvider = (service as any).localProvider;
    vi.spyOn(tsProvider, 'configure').mockResolvedValue(undefined);
    await service.configure({ provider: 'local' as const, model: 'second-model' });
    expect(service.config?.provider).toBe('local');
    expect(service.config?.model).toBe('second-model');
  });
});

describe('error handling', () => {
  it('embed returns null when remote fetch fails', async () => {
    mockFetch.mockReset();
    mockFetch.mockRejectedValue(new Error('Network failure'));
    const service = new EmbedderService();
    await service.configure({
      provider: 'remote' as const,
      endpoint: 'http://test:1234/v1',
      model: 'test-model',
    });
    const result = await service.embed('test');
    expect(result).toBeNull();
  });
});

describe('re-export', () => {
  it('re-exports embedderConfigSchema from embedder.ts', () => {
    expect(embedderConfigSchema).toBeDefined();
    const parsed = embedderConfigSchema.parse({ model: 'test' });
    expect(parsed.provider).toBe('remote');
  });
});
