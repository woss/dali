/**
 * Comprehensive test suite for Auth Config Validation
 *
 * Tests validateAuthConfig, determineAuthType, normalizeConfig,
 * convertValibotErrors, and AuthConfigSchema.
 *
 * Strategy:
 * - No mocks needed — pure valibot validation, no I/O
 * - Test every exported function exhaustively
 */

import { parse } from 'valibot';
import { describe, expect, it } from 'vite-plus/test';
import {
  AuthConfigSchema,
  convertValibotErrors,
  determineAuthType,
  normalizeConfig,
  validateAuthConfig,
} from '../validate.js';

// ============================================================================
// Tests: validateAuthConfig
// ============================================================================

describe('validateAuthConfig', () => {
  it('returns invalid for null input', () => {
    const result = validateAuthConfig(null);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].field).toBe('config');
    expect(result.errors?.[0].message).toBe('Auth config is required');
  });

  it('returns invalid for undefined input', () => {
    const result = validateAuthConfig(undefined);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].field).toBe('config');
  });

  it('validates root auth with username and password', () => {
    const result = validateAuthConfig({ type: 'root', username: 'admin', password: 'secret' });

    expect(result.valid).toBe(true);
    expect(result.data).toEqual({ type: 'root', username: 'admin', password: 'secret' });
  });

  it('validates namespace auth with namespace field', () => {
    const result = validateAuthConfig({
      type: 'namespace',
      username: 'admin',
      password: 'secret',
      namespace: 'prod',
    });

    expect(result.valid).toBe(true);
    expect(result.data).toEqual({
      type: 'namespace',
      username: 'admin',
      password: 'secret',
      namespace: 'prod',
    });
  });

  it('validates database auth with namespace and database fields', () => {
    const result = validateAuthConfig({
      type: 'database',
      username: 'admin',
      password: 'secret',
      namespace: 'prod',
      database: 'app',
    });

    expect(result.valid).toBe(true);
    expect(result.data).toEqual({
      type: 'database',
      username: 'admin',
      password: 'secret',
      namespace: 'prod',
      database: 'app',
    });
  });

  it('validates record auth with access, namespace, database', () => {
    const result = validateAuthConfig({
      type: 'record',
      namespace: 'prod',
      database: 'app',
      access: 'my_access',
    });

    expect(result.valid).toBe(true);
    expect(result.data).toEqual({
      type: 'record',
      namespace: 'prod',
      database: 'app',
      access: 'my_access',
    });
  });

  it('validates record auth with optional variables', () => {
    const result = validateAuthConfig({
      type: 'record',
      namespace: 'prod',
      database: 'app',
      access: 'my_access',
      variables: { email: 'user@test.com' },
    });

    expect(result.valid).toBe(true);
    expect((result.data as any)?.variables).toEqual({ email: 'user@test.com' });
  });

  it('returns invalid for root auth missing username', () => {
    const result = validateAuthConfig({ type: 'root', password: 'secret' });

    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('returns invalid for root auth missing password', () => {
    const result = validateAuthConfig({ type: 'root', username: 'admin' });

    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('returns invalid for namespace auth missing namespace', () => {
    const result = validateAuthConfig({
      type: 'namespace',
      username: 'admin',
      password: 'secret',
    });

    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('returns invalid for database auth missing database', () => {
    const result = validateAuthConfig({
      type: 'database',
      username: 'admin',
      password: 'secret',
      namespace: 'prod',
    });

    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('returns invalid for record auth missing access', () => {
    const result = validateAuthConfig({
      type: 'record',
      namespace: 'prod',
      database: 'app',
    });

    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('normalizes config without type (infers from fields)', () => {
    const result = validateAuthConfig({
      username: 'admin',
      password: 'secret',
      access: 'my_access',
      namespace: 'prod',
      database: 'app',
    });

    expect(result.valid).toBe(true);
    expect(result.data?.type).toBe('record');
  });

  it('returns invalid for non-string username (number)', () => {
    const result = validateAuthConfig({ type: 'root', username: 123, password: 'secret' });

    expect(result.valid).toBe(false);
  });

  it('handles non-object primitive input gracefully', () => {
    const result = validateAuthConfig('not an object');

    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Tests: determineAuthType
// ============================================================================

describe('determineAuthType', () => {
  it('returns "root" for null', () => {
    expect(determineAuthType(null)).toBe('root');
  });

  it('returns "root" for undefined', () => {
    expect(determineAuthType(undefined)).toBe('root');
  });

  it('returns "root" for non-object input', () => {
    expect(determineAuthType('string')).toBe('root');
    expect(determineAuthType(42)).toBe('root');
    expect(determineAuthType(true)).toBe('root');
  });

  it('returns explicit type "root" when type field is set', () => {
    expect(determineAuthType({ type: 'root' })).toBe('root');
  });

  it('returns explicit type "namespace" when type field is set', () => {
    expect(determineAuthType({ type: 'namespace' })).toBe('namespace');
  });

  it('infers "record" when access field present with non-empty value', () => {
    expect(determineAuthType({ access: 'my_access' })).toBe('record');
  });

  it('infers "database" when database field present with non-empty value', () => {
    expect(determineAuthType({ database: 'app' })).toBe('database');
  });

  it('infers "namespace" when namespace field present with non-empty value', () => {
    expect(determineAuthType({ namespace: 'prod' })).toBe('namespace');
  });

  it('returns "root" when no recognizable fields present', () => {
    expect(determineAuthType({ foo: 'bar' })).toBe('root');
  });

  it('returns "root" when fields have empty/whitespace values', () => {
    expect(determineAuthType({ access: '', database: '  ' })).toBe('root');
  });

  it('prefers explicit type over field inference', () => {
    expect(determineAuthType({ type: 'root', access: 'my_access' })).toBe('root');
  });

  it('returns type as string even if passed as non-string', () => {
    expect(determineAuthType({ type: 123 })).toBe('123');
  });
});

// ============================================================================
// Tests: normalizeConfig
// ============================================================================

describe('normalizeConfig', () => {
  it('returns { type: "root" } for null', () => {
    expect(normalizeConfig(null)).toEqual({ type: 'root' });
  });

  it('returns { type: "root" } for undefined', () => {
    expect(normalizeConfig(undefined)).toEqual({ type: 'root' });
  });

  it('returns { type: "root" } for non-object', () => {
    expect(normalizeConfig('string')).toEqual({ type: 'root' });
  });

  it('preserves explicitly set type', () => {
    expect(normalizeConfig({ type: 'database', username: 'admin' })).toEqual({
      type: 'database',
      username: 'admin',
    });
  });

  it('adds inferred type when type is missing', () => {
    const result = normalizeConfig({ username: 'admin', password: 'secret', namespace: 'prod' });

    expect(result.type).toBe('namespace');
    expect(result.username).toBe('admin');
    expect(result.password).toBe('secret');
    expect(result.namespace).toBe('prod');
  });

  it('preserves original fields when adding inferred type', () => {
    const result = normalizeConfig({ username: 'admin', access: 'my_access' });

    expect(result.type).toBe('record');
    expect(result.username).toBe('admin');
    expect(result.access).toBe('my_access');
  });

  it('adds type root when no matching fields found', () => {
    expect(normalizeConfig({})).toEqual({ type: 'root' });
  });
});

// ============================================================================
// Tests: convertValibotErrors
// ============================================================================

describe('convertValibotErrors', () => {
  it('returns unknown field for non-Error input', () => {
    const result = convertValibotErrors('some string error');

    expect(result).toHaveLength(1);
    expect(result[0].field).toBe('unknown');
    expect(result[0].message).toBe('some string error');
  });

  it('returns unknown field for null/undefined error', () => {
    expect(convertValibotErrors(null)[0].field).toBe('unknown');
    expect(convertValibotErrors(undefined)[0].field).toBe('unknown');
  });

  it('extracts field and message from valibot error with path', () => {
    const error = new Error(
      'Validation failed:  At path "username" — Expected "string" but got "undefined".',
    );

    const result = convertValibotErrors(error);

    expect(result).toHaveLength(1);
    expect(result[0].field).toBe('username');
    expect(result[0].message).toContain('Expected');
  });

  it('returns generic error when no path found in message', () => {
    const error = new Error('Some generic validation error without path info');

    const result = convertValibotErrors(error);

    expect(result).toHaveLength(1);
    expect(result[0].field).toBe('config');
    expect(result[0].message).toBe('Some generic validation error without path info');
  });

  it('extracts field from valibot error with case-insensitive path', () => {
    const error = new Error('Validation failed:  At Path "PASSWORD" — Expected "string".');

    const result = convertValibotErrors(error);

    expect(result[0].field).toBe('PASSWORD');
  });
});

// ============================================================================
// Tests: AuthConfigSchema (valibot schema directly)
// ============================================================================

describe('AuthConfigSchema', () => {
  it('validates a complete root auth config', () => {
    const result = parse(AuthConfigSchema, {
      type: 'root',
      username: 'admin',
      password: 'secret',
    });

    expect(result.type).toBe('root');
    expect((result as any).username).toBe('admin');
  });

  it('rejects config missing required field', () => {
    expect(() => parse(AuthConfigSchema, { type: 'root', username: 'admin' })).toThrow();
  });

  it('validates record auth with variables', () => {
    const result = parse(AuthConfigSchema, {
      type: 'record',
      namespace: 'prod',
      database: 'app',
      access: 'my_access',
      variables: { email: 'user@test.com' },
    });

    expect(result.type).toBe('record');
    expect((result as any).variables).toEqual({ email: 'user@test.com' });
  });

  it('rejects invalid type string', () => {
    expect(() =>
      parse(AuthConfigSchema, {
        type: 'invalid_type',
        username: 'admin',
        password: 'secret',
      }),
    ).toThrow();
  });
});
