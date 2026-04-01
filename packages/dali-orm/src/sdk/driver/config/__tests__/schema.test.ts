/**
 * Comprehensive test suite for Config Schema Validation
 *
 * Tests every exported function in schema.ts:
 * - validateConfig: schema validation with guard clauses
 * - parseConfig: validated config parsing
 * - parseUrl: URL protocol validation
 * - parseAuth: auth config parsing
 * - parseDriverOptions: driver options parsing
 * - toAuthConfig: auth config serialization for SurrealDB SDK
 */

import { describe, expect, it } from 'vite-plus/test';
import {
  parseAuth,
  parseConfig,
  parseDriverOptions,
  parseUrl,
  toAuthConfig,
  validateConfig,
} from '../schema.js';

// ============================================================================
// Mock data
// ============================================================================

const MINIMAL_VALID_CONFIG = {
  url: 'ws://localhost:8000',
  namespace: 'test_ns',
  database: 'test_db',
};

const FULL_VALID_CONFIG = {
  url: 'wss://localhost:8000',
  namespace: 'prod_ns',
  database: 'prod_db',
  auth: {
    type: 'root' as const,
    username: 'root',
    password: 'root',
  },
  driver: {
    ws: { pingInterval: 5000, pingTimeout: 10000 },
    http: { strict: true, timeout: 30000 },
  },
};

// ============================================================================
// Tests: validateConfig
// ============================================================================

describe('validateConfig', () => {
  it('returns invalid for null input', () => {
    const result = validateConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Configuration is required');
  });

  it('returns invalid for undefined input', () => {
    const result = validateConfig(undefined);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Configuration is required');
  });

  it('returns invalid for non-object input', () => {
    const result = validateConfig('not-an-object');
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Configuration must be an object');
  });

  it('returns valid for minimal config', () => {
    const result = validateConfig(MINIMAL_VALID_CONFIG);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid with root auth', () => {
    const result = validateConfig(FULL_VALID_CONFIG);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid with record auth', () => {
    const result = validateConfig({
      ...MINIMAL_VALID_CONFIG,
      auth: {
        type: 'record' as const,
        namespace: 'ns',
        database: 'db',
        access: 'my_access',
      },
    });
    expect(result.valid).toBe(true);
  });

  it('returns invalid when url is missing', () => {
    const { url: _, ...noUrl } = MINIMAL_VALID_CONFIG;
    const result = validateConfig(noUrl);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('url'))).toBe(true);
  });

  it('returns invalid when namespace is missing', () => {
    const { namespace: _, ...noNs } = MINIMAL_VALID_CONFIG;
    const result = validateConfig(noNs);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('namespace'))).toBe(true);
  });
});

// ============================================================================
// Tests: parseConfig
// ============================================================================

describe('parseConfig', () => {
  it('parses a valid config into ValidatedOrmConfig', () => {
    const result = parseConfig(MINIMAL_VALID_CONFIG);
    expect(result.url).toBe('ws://localhost:8000');
    expect(result.namespace).toBe('test_ns');
    expect(result.database).toBe('test_db');
  });

  it('throws Error when config validation fails', () => {
    expect(() => parseConfig({} as Parameters<typeof parseConfig>[0])).toThrow(
      'Config validation failed',
    );
  });

  it('parses url, auth, and driver options', () => {
    const result = parseConfig(FULL_VALID_CONFIG);
    expect(result.url).toBe('wss://localhost:8000');
    expect(result.auth).toBeDefined();
    expect(result.auth?.type).toBe('root');
    expect(result.driver).toBeDefined();
    expect(result.driver?.ws?.pingInterval).toBe(5000);
  });

  it('parses config with record auth', () => {
    const result = parseConfig({
      ...MINIMAL_VALID_CONFIG,
      auth: {
        type: 'record' as const,
        namespace: 'ns',
        database: 'db',
        access: 'github_oauth',
        variables: { token: 'abc' },
      },
    });
    expect(result.auth?.type).toBe('record');
    expect(result.auth?.access).toBe('github_oauth');
    expect(result.auth?.variables).toEqual({ token: 'abc' });
  });
});

// ============================================================================
// Tests: parseUrl
// ============================================================================

describe('parseUrl', () => {
  it('accepts ws:// protocol', () => {
    expect(parseUrl('ws://localhost:8000')).toBe('ws://localhost:8000');
  });

  it('accepts wss:// protocol', () => {
    expect(parseUrl('wss://secure.example.com:8000')).toBe('wss://secure.example.com:8000');
  });

  it('accepts http:// protocol', () => {
    expect(parseUrl('http://localhost:8000')).toBe('http://localhost:8000');
  });

  it('accepts https:// protocol', () => {
    expect(parseUrl('https://example.com:8000')).toBe('https://example.com:8000');
  });

  it('rejects ftp:// protocol', () => {
    expect(() => parseUrl('ftp://localhost:8000')).toThrow('Invalid protocol');
  });

  it('rejects invalid URL strings', () => {
    expect(() => parseUrl('not-a-url')).toThrow('Invalid URL');
  });
});

// ============================================================================
// Tests: parseAuth
// ============================================================================

describe('parseAuth', () => {
  it('returns undefined for nullish input', () => {
    expect(parseAuth(null as unknown as Parameters<typeof parseAuth>[0])).toBeUndefined();
  });

  it('parses root auth with username and password', () => {
    const result = parseAuth({
      type: 'root',
      username: 'admin',
      password: 'secret',
    });
    expect(result).toBeDefined();
    expect(result?.type).toBe('root');
    expect(result?.username).toBe('admin');
    expect(result?.password).toBe('secret');
  });

  it('parses namespace auth with namespace field', () => {
    const result = parseAuth({
      type: 'namespace',
      username: 'user',
      password: 'pass',
      namespace: 'my_ns',
    });
    expect(result?.type).toBe('namespace');
    expect(result?.namespace).toBe('my_ns');
  });

  it('parses database auth with database field', () => {
    const result = parseAuth({
      type: 'database',
      username: 'user',
      password: 'pass',
      namespace: 'ns',
      database: 'db',
    });
    expect(result?.type).toBe('database');
    expect(result?.database).toBe('db');
  });

  it('parses record auth with access and variables', () => {
    const result = parseAuth({
      type: 'record',
      namespace: 'ns',
      database: 'db',
      access: 'my_access',
      variables: { scope: 'openid' },
    });
    expect(result?.type).toBe('record');
    expect(result?.access).toBe('my_access');
    expect(result?.variables).toEqual({ scope: 'openid' });
  });
});

// ============================================================================
// Tests: parseDriverOptions
// ============================================================================

describe('parseDriverOptions', () => {
  it('returns undefined for nullish input', () => {
    expect(
      parseDriverOptions(null as unknown as Parameters<typeof parseDriverOptions>[0]),
    ).toBeUndefined();
  });

  it('accepts valid ws pingInterval', () => {
    const result = parseDriverOptions({ ws: { pingInterval: 5000 } });
    expect(result?.ws?.pingInterval).toBe(5000);
  });

  it('throws when ws pingInterval is below minimum', () => {
    expect(() => parseDriverOptions({ ws: { pingInterval: 500 } })).toThrow(
      'pingInterval must be at least 1000ms',
    );
  });

  it('accepts valid ws pingTimeout', () => {
    const result = parseDriverOptions({ ws: { pingTimeout: 15000 } });
    expect(result?.ws?.pingTimeout).toBe(15000);
  });

  it('accepts valid http timeout', () => {
    const result = parseDriverOptions({ http: { timeout: 20000 } });
    expect(result?.http?.timeout).toBe(20000);
  });

  it('throws when http timeout is below minimum', () => {
    expect(() => parseDriverOptions({ http: { timeout: 999 } })).toThrow(
      'timeout must be at least 1000ms',
    );
  });
});

// ============================================================================
// Tests: toAuthConfig
// ============================================================================

describe('toAuthConfig', () => {
  it('converts root validated auth to SDK format', () => {
    const result = toAuthConfig({
      type: 'root',
      username: 'root',
      password: 'secret',
    });
    expect(result.type).toBe('root');
    expect(result.username).toBe('root');
    expect(result.password).toBe('secret');
  });

  it('converts namespace validated auth to SDK format', () => {
    const result = toAuthConfig({
      type: 'namespace',
      username: 'user',
      password: 'pass',
      namespace: 'my_ns',
    });
    expect(result.namespace).toBe('my_ns');
  });

  it('converts database validated auth to SDK format', () => {
    const result = toAuthConfig({
      type: 'database',
      username: 'user',
      password: 'pass',
      namespace: 'ns',
      database: 'my_db',
    });
    expect(result.database).toBe('my_db');
  });

  it('converts record validated auth to SDK format', () => {
    const result = toAuthConfig({
      type: 'record',
      namespace: 'ns',
      database: 'db',
      access: 'github',
      variables: { client_id: '123' },
    });
    expect(result.access).toBe('github');
    expect(result.variables).toEqual({ client_id: '123' });
  });
});
