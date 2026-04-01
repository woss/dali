import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { LocalEmbedProvider } from './local-provider.ts';
import { fixtureResult10, fixtureResult3 } from './__fixtures__/embeddings.ts';

// Mock the pipeline function from @huggingface/transformers
const mockPipeline = vi.hoisted(() => vi.fn());
vi.mock('@huggingface/transformers', () => ({
  pipeline: mockPipeline,
}));

describe('LocalEmbedProvider', () => {
  let provider: LocalEmbedProvider;

  beforeEach(() => {
    provider = new LocalEmbedProvider();
  });

  it('can be instantiated', () => {
    expect(provider).toBeInstanceOf(LocalEmbedProvider);
  });

  it('returns null when embed called before configure', async () => {
    const result = await provider.embed('test text');
    expect(result).toBeNull();
  });

  it('has null config before configure', () => {
    expect(provider.config).toBeNull();
  });

  it('clearCache does not throw when not configured', () => {
    expect(() => provider.clearCache()).not.toThrow();
  });

  it('clearCache does not throw when configured (no-op)', () => {
    expect(typeof provider.clearCache).toBe('function');
  });

  it('fixture vectors match expected dimensions', () => {
    expect(fixtureResult10.dimensions).toBe(10);
    expect(fixtureResult10.vector.length).toBe(10);

    expect(fixtureResult3.dimensions).toBe(3);
    expect(fixtureResult3.vector.length).toBe(3);
  });
});

describe('configure', () => {
  let provider: LocalEmbedProvider;

  beforeEach(() => {
    provider = new LocalEmbedProvider();
  });

  it('loads pipeline with DEFAULT_MODEL and provided cache dir', async () => {
    const mockPipe = vi.fn();
    mockPipeline.mockResolvedValue(mockPipe);

    const config = {
      provider: 'local' as const,
      model: 'test-model',
      modelCacheDir: '/tmp/cache',
    };
    await provider.configure(config);

    expect(mockPipeline).toHaveBeenCalledWith('feature-extraction', 'Xenova/bge-large-en-v1.5', {
      cache_dir: '/tmp/cache',
      dtype: 'fp32',
    });
    expect(provider.config).toEqual(config);
  });

  it('uses default cache dir when not provided', async () => {
    const mockPipe = vi.fn();
    mockPipeline.mockResolvedValue(mockPipe);

    await provider.configure({ provider: 'local' as const, model: 'default-model' });

    expect(mockPipeline).toHaveBeenCalled();
    expect(provider.config).toBeTruthy();
  });
});

describe('embed', () => {
  let provider: LocalEmbedProvider;

  beforeEach(() => {
    provider = new LocalEmbedProvider();
  });

  it('returns vector from pipeline output', async () => {
    const mockPipe = vi.fn().mockResolvedValue({
      data: new Float32Array([0.1, 0.2, 0.3, 0.4]),
      dims: [1, 4],
    });
    mockPipeline.mockResolvedValue(mockPipe);

    await provider.configure({ provider: 'local' as const, model: 'test-model' });
    const result = await provider.embed('test text');

    expect(result).not.toBeNull();
    expect(result?.dimensions).toBe(4);
    expect(result?.vector).toBeInstanceOf(Float32Array);
    expect(Array.from(result!.vector).map((v) => Math.round(v * 10) / 10)).toEqual([
      0.1, 0.2, 0.3, 0.4,
    ]);
    expect(mockPipe).toHaveBeenCalledWith('test text', { pooling: 'mean', normalize: true });
  });

  it('returns null when pipeline throws', async () => {
    const mockPipe = vi.fn().mockRejectedValue(new Error('Pipeline error'));
    mockPipeline.mockResolvedValue(mockPipe);

    await provider.configure({ provider: 'local' as const, model: 'test-model' });
    const result = await provider.embed('test text');

    expect(result).toBeNull();
  });
});
