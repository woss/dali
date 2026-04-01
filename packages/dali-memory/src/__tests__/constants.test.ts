import { describe, expect, it } from 'vite-plus/test';
import { pluginName } from '../constants.ts';

describe('constants', () => {
  it('pluginName is dali-memory', () => {
    expect(pluginName).toBe('dali-memory');
  });
});
