import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// Hoisted mocks — referenced inside vi.mock() factories
// =============================================================================

const { mockGetConfig } = vi.hoisted(() => {
  const mockGetConfig = vi.fn(() => ({ DALI_MEMORY_SECRET: 'test-secret' }));
  return { mockGetConfig };
});

// =============================================================================
// Module mocks — hoisted before imports
// =============================================================================

vi.mock('../../config', () => ({
  getConfig: mockGetConfig,
}));

// =============================================================================
// Module under test — imported AFTER mocks
// =============================================================================

import { hashApiKey } from '../api-keys';

// =============================================================================
// Tests
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  // Reset getConfig to return default secret for each test
  mockGetConfig.mockReturnValue({ DALI_MEMORY_SECRET: 'test-secret' });
});

describe('hashApiKey()', () => {
  test('same input + same secret produces the same hash (deterministic)', async () => {
    const hash1 = await hashApiKey('my-api-key');
    const hash2 = await hashApiKey('my-api-key');
    expect(hash1).toBe(hash2);
  });

  test('different inputs with the same secret produce different hashes', async () => {
    const hash1 = await hashApiKey('key-one');
    const hash2 = await hashApiKey('key-two');
    expect(hash1).not.toBe(hash2);
  });

  test('same input with different secrets produces a different hash (pepper works)', async () => {
    const hash1 = await hashApiKey('my-key');
    mockGetConfig.mockReturnValue({ DALI_MEMORY_SECRET: 'different-secret' });
    const hash2 = await hashApiKey('my-key');
    expect(hash1).not.toBe(hash2);
  });

  test('output is 64 hex characters (SHA-256)', async () => {
    const hash = await hashApiKey('any-key');
    expect(hash).toHaveLength(64);
  });

  test('output contains only hexadecimal characters [0-9a-f]', async () => {
    const hash = await hashApiKey('any-key');
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  test('works with empty string input', async () => {
    const hash = await hashApiKey('');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  test('works with special characters in input', async () => {
    const hash = await hashApiKey('!@#$%^&*()_+-=[]{}|;:,.<>?');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });
});
