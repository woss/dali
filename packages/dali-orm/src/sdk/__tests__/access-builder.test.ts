import { describe, expect, it } from 'vite-plus/test';
import { defineAccess } from '../schema/access-builder.js';

describe('defineAccess builder', () => {
  it('creates access with name and default type', () => {
    const access = defineAccess('test_access').build();
    expect(access.name).toBe('test_access');
    expect(access.type).toBe('RECORD');
  });

  it('sets type to JWT', () => {
    const access = defineAccess('jwt_access').type('JWT').build();
    expect(access.type).toBe('JWT');
  });

  it('sets type to OIDC', () => {
    const access = defineAccess('oidc_access').type('OIDC').build();
    expect(access.type).toBe('OIDC');
  });

  it('chains all properties', () => {
    const access = defineAccess('full_access')
      .type('RECORD')
      .table('users')
      .signup('CREATE users SET email = $email, password = crypto::argon2::generate($password)')
      .signin(
        'SELECT * FROM users WHERE email = $email AND crypto::argon2::compare(password, $password)',
      )
      .identifier('email')
      .duration('7d')
      .tokenDuration('1h')
      .build();

    expect(access.name).toBe('full_access');
    expect(access.type).toBe('RECORD');
    expect(access.table).toBe('users');
    expect(access.signup).toContain('CREATE users');
    expect(access.signin).toContain('SELECT * FROM users');
    expect(access.identifier).toBe('email');
    expect(access.duration).toBe('7d');
    expect(access.tokenDuration).toBe('1h');
  });

  it('configures JWT with algorithm, key, issuer', () => {
    const access = defineAccess('jwt_custom')
      .type('JWT')
      .algorithm('HS256')
      .key('my-secret-key')
      .issuer('dali-orm')
      .duration('1h')
      .build();

    expect(access.name).toBe('jwt_custom');
    expect(access.type).toBe('JWT');
    expect(access.algorithm).toBe('HS256');
    expect(access.key).toBe('my-secret-key');
    expect(access.issuer).toBe('dali-orm');
    expect(access.duration).toBe('1h');
  });

  it('generates DEFINE ACCESS SQL via toSQL()', () => {
    const sql = defineAccess('web_access')
      .type('RECORD')
      .table('users')
      .signup('CREATE users SET email = $email, password = crypto::argon2::generate($password)')
      .signin(
        'SELECT * FROM users WHERE email = $email AND crypto::argon2::compare(password, $password)',
      )
      .duration('7d')
      .tokenDuration('1h')
      .toSQL();

    expect(sql).toContain('DEFINE ACCESS web_access ON DATABASE TYPE RECORD');
    expect(sql).toContain('SIGNUP');
    expect(sql).toContain('SIGNIN');
    expect(sql).toContain('DURATION');
    expect(sql).toContain('FOR TOKEN 1h');
    expect(sql).toContain('FOR SESSION 7d');
  });

  it('throws on empty name', () => {
    expect(() => defineAccess('').build()).toThrow();
  });

  it('can be chained in any order', () => {
    const access = defineAccess('chain_test')
      .duration('30m')
      .type('JWT')
      .algorithm('HS512')
      .key('key123')
      .build();

    expect(access.name).toBe('chain_test');
    expect(access.type).toBe('JWT');
    expect(access.algorithm).toBe('HS512');
    expect(access.key).toBe('key123');
    expect(access.duration).toBe('30m');
  });

  it('produces different instances from same factory', () => {
    const builder1 = defineAccess('access_a');
    const builder2 = defineAccess('access_b');

    expect(builder1.build().name).toBe('access_a');
    expect(builder2.build().name).toBe('access_b');
    expect(builder1).not.toBe(builder2);
  });
});
