import { describe, expect, it } from 'vite-plus/test';

describe('dali-memory package entry point', () => {
  it('exports empty object from index.ts', async () => {
    const mod = await import('../index.ts');
    // index.ts only has `export {};`
    expect(Object.keys(mod)).toHaveLength(0);
  });
});
