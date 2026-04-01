import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { getTags, resolveSecretValue } from '../config.ts';

describe('resolveSecretValue', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns undefined when value is undefined', () => {
    expect(resolveSecretValue(undefined)).toBeUndefined();
  });

  it('returns plain string values unchanged', () => {
    expect(resolveSecretValue('my-api-key')).toBe('my-api-key');
  });

  it('resolves env:// prefix from process.env', () => {
    process.env.MY_SECRET = 'super-secret-value';
    expect(resolveSecretValue('env://MY_SECRET')).toBe('super-secret-value');
  });

  it('returns undefined when env variable does not exist', () => {
    expect(resolveSecretValue('env://NONEXISTENT_VAR')).toBeUndefined();
  });

  it('resolves file:// prefix by reading file content', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const tmpFile = path.join('/tmp', `test-secret-${Date.now()}.txt`);
    try {
      fs.writeFileSync(tmpFile, 'file-secret-value', 'utf-8');
      const result = resolveSecretValue(`file://${tmpFile}`);
      expect(result).toBe('file-secret-value');
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    }
  });

  it('returns string as-is when it does not start with a prefix', () => {
    expect(resolveSecretValue('sk-12345')).toBe('sk-12345');
  });

  it('handles empty string as undefined', () => {
    expect(resolveSecretValue('')).toBeUndefined();
  });
});

describe('getTags', () => {
  it('returns consistent tags for same directory', () => {
    const tags1 = getTags('/tmp/test-project');
    const tags2 = getTags('/tmp/test-project');
    expect(tags1.userTag).toBe(tags2.userTag);
    expect(tags1.projectTag).toBe(tags2.projectTag);
  });

  it('returns different project tags for different directories', () => {
    const tags1 = getTags('/tmp/project-a');
    const tags2 = getTags('/tmp/project-b');
    expect(tags1.projectTag).not.toBe(tags2.projectTag);
  });

  it('returns tags with opencode_user_ prefix for userTag', () => {
    const tags = getTags('/tmp/test-project');
    expect(tags.userTag).toMatch(/^opencode_user_/);
  });

  it('returns tags with opencode_project_ prefix for projectTag', () => {
    const tags = getTags('/tmp/test-project');
    expect(tags.projectTag).toMatch(/^opencode_project_/);
  });

  it('returns hex hash of correct length after prefix', () => {
    const tags = getTags('/tmp/test-project');
    // Prefix + 16 hex chars
    expect(tags.projectTag).toMatch(/^opencode_project_[0-9a-f]{16}$/);
    expect(tags.userTag).toMatch(/^opencode_user_[0-9a-f]{16}$/);
  });

  it('handles directory with special characters', () => {
    const tags = getTags('/tmp/my project (special!)');
    expect(tags.projectTag).toMatch(/^opencode_project_[0-9a-f]{16}$/);
    expect(tags.userTag).toMatch(/^opencode_user_[0-9a-f]{16}$/);
  });
});
