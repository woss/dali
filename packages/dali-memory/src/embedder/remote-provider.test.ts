import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { RemoteEmbedProvider } from './remote-provider.ts';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('RemoteEmbedProvider', () => {
  let provider: RemoteEmbedProvider;

  beforeEach(() => {
    provider = new RemoteEmbedProvider();
    mockFetch.mockReset();
  });

  describe('configure', () => {
    it('sets the config and logs it', () => {
      const config = {
        provider: 'remote',
        endpoint: 'http://test:1234/v1',
        model: 'test-model',
        apiKey: 'test-key',
      } as const;
      provider.configure(config);
      expect(provider.config).toEqual(config);
    });

    it('sets config without apiKey', () => {
      const config = {
        provider: 'remote',
        endpoint: 'http://test:1234/v1',
        model: 'test-model',
      } as const;
      provider.configure(config);
      expect(provider.config).toEqual(config);
    });
  });

  describe('embed', () => {
    const testConfig = {
      provider: 'remote',
      endpoint: 'http://test:1234/v1',
      model: 'test-model',
      apiKey: 'test-key',
    } as const;

    beforeEach(() => {
      provider.configure(testConfig);
    });

    it('returns null when not configured', async () => {
      const unconfigured = new RemoteEmbedProvider();
      const result = await unconfigured.embed('test text');
      expect(result).toBeNull();
    });

    it('returns cached embedding on repeat call', async () => {
      const embedding = [0.1, 0.2, 0.3];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding }] }),
      });

      const firstResult = await provider.embed('test text');
      expect(firstResult).not.toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call with same text should use cache
      const secondResult = await provider.embed('test text');
      expect(secondResult).not.toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional fetch
      expect(secondResult?.dimensions).toBe(3);
    });

    it('makes fetch request to correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }),
      });

      await provider.embed('hello world');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toBe('http://test:1234/v1/embeddings');

      const callOptions = mockFetch.mock.calls[0][1];
      expect(callOptions.method).toBe('POST');
      expect(callOptions.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-key',
      });
      expect(JSON.parse(callOptions.body)).toMatchObject({
        input: 'hello world',
        model: 'test-model',
      });
    });

    it('includes Authorization header only when apiKey provided', async () => {
      const noKeyProvider = new RemoteEmbedProvider();
      noKeyProvider.configure({
        provider: 'remote',
        endpoint: 'http://test:1234/v1',
        model: 'test-model',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: [0.5] }] }),
      });

      await noKeyProvider.embed('test');

      const callOptions = mockFetch.mock.calls[0][1];
      expect(callOptions.headers).not.toHaveProperty('Authorization');
    });

    it('returns vector and dimensions from API response', async () => {
      const embedding = [0.5, 0.25, 0.125, 0.0625];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding }] }),
      });

      const result = await provider.embed('test text');
      expect(result).not.toBeNull();
      expect(result?.dimensions).toBe(4);
      expect(result?.vector).toBeInstanceOf(Float32Array);
      // Float32 can exactly represent powers of 2
      expect(Array.from(result!.vector)).toEqual(embedding);
    });

    it('returns null on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await provider.embed('test');
      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await provider.embed('test');
      expect(result).toBeNull();
    });

    it('returns null on invalid response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await provider.embed('test');
      expect(result).toBeNull();
    });

    it('returns null when embedding field is not an array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: 'not-an-array' }] }),
      });

      const result = await provider.embed('test');
      expect(result).toBeNull();
    });

    it('evicts oldest entry when cache reaches max size', async () => {
      const embedding = [0.5];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ embedding }] }),
      });

      // Fill cache with CACHE_SIZE (100) entries
      for (let i = 0; i < 101; i++) {
        await provider.embed(`text-${i}`);
      }

      // First text should have been evicted
      // This call should trigger a new fetch
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: [0.9] }] }),
      });
      await provider.embed('text-0');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearCache', () => {
    it('clears the in-memory cache', async () => {
      const config = {
        provider: 'remote',
        endpoint: 'http://test:1234/v1',
        model: 'test-model',
      } as const;
      provider.configure(config);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ embedding: [0.1] }] }),
      });

      await provider.embed('test');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      provider.clearCache();

      // Should fetch again since cache cleared
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: [0.2] }] }),
      });

      await provider.embed('test');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
