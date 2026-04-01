import type { AccessConfig, AccessType } from '../schema.js';

// =============================================================================
// AccessBuilder
// =============================================================================

/**
 * Fluent builder for SurrealDB DEFINE ACCESS statements.
 *
 * Follows the same immutable config pattern as column builders.
 * Each method returns `this` for chaining.
 * Call `.build()` to get an `AccessConfig`, `.toSQL()` for the SQL string.
 *
 * @example
 * ```ts
 * const access = defineAccess('account')
 *   .type('RECORD')
 *   .table('user')
 *   .signup('CREATE user SET email = $email, pass = crypto::argon2::generate($pass)')
 *   .signin('SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(pass, $pass)')
 *   .duration('12h')
 *   .tokenDuration('15m')
 *   .build();
 * ```
 */
export type AccessBuilder = ReturnType<typeof defineAccess>;

export function defineAccess(name: string) {
  if (!name) throw new Error('Access name is required');

  let config: {
    type?: 'RECORD' | 'JWT' | 'OIDC';
    table?: string;
    signup?: string;
    signin?: string;
    identifier?: string;
    algorithm?: 'HS256' | 'HS512';
    key?: string;
    issuer?: string;
    duration?: string;
    tokenDuration?: string;
  } = { type: 'RECORD' };

  return {
    get name() {
      return name;
    },

    /** Set access type: RECORD, JWT, or OIDC */
    type(type: AccessType) {
      config = { ...config, type };
      return this;
    },

    /** Table for auto-generated signup/signin */
    table(tableName: string) {
      config = { ...config, table: tableName };
      return this;
    },

    /** Custom signup SQL */
    signup(sql: string) {
      config = { ...config, signup: sql };
      return this;
    },

    /** Custom signin SQL */
    signin(sql: string) {
      config = { ...config, signin: sql };
      return this;
    },

    /** Custom identifier column (email, username, phone, etc.) */
    identifier(column: string) {
      config = { ...config, identifier: column };
      return this;
    },

    /** JWT signing algorithm */
    algorithm(algo: 'HS256' | 'HS512') {
      config = { ...config, algorithm: algo };
      return this;
    },

    /** JWT signing key */
    key(key: string) {
      config = { ...config, key };
      return this;
    },

    /** JWT issuer */
    issuer(issuer: string) {
      config = { ...config, issuer };
      return this;
    },

    /** Session duration (e.g. '7d', '1h') — maps to DURATION FOR SESSION */
    duration(duration: string) {
      config = { ...config, duration };
      return this;
    },

    /** Token duration (e.g. '1h', '15m') — maps to DURATION FOR TOKEN */
    tokenDuration(duration: string) {
      config = { ...config, tokenDuration: duration };
      return this;
    },

    /**
     * Return the AccessConfig object.
     * Can be used directly or passed to `accessToSQL()` with tables for auto-generated signup/signin.
     */
    build(): AccessConfig {
      return { name, ...config, type: config.type ?? 'RECORD' };
    },

    /**
     * Generate the DEFINE ACCESS SQL string from stored configuration.
     * Does NOT require a tables record — uses signup/signin strings as-is.
     */
    toSQL(): string {
      const built = this.build();
      const parts = [`DEFINE ACCESS ${built.name} ON DATABASE TYPE ${built.type}`];

      if (built.signup) parts.push(`SIGNUP (${built.signup})`);
      if (built.signin) parts.push(`SIGNIN (${built.signin})`);
      if (built.algorithm) parts.push(`ALGORITHM ${built.algorithm}`);
      if (built.key) parts.push(`KEY "${built.key}"`);
      if (built.issuer) parts.push(`ISSUER ${built.issuer}`);
      if (built.duration || built.tokenDuration) {
        const durationParts: string[] = [];
        if (built.tokenDuration) durationParts.push(`FOR TOKEN ${built.tokenDuration}`);
        if (built.duration) durationParts.push(`FOR SESSION ${built.duration}`);
        parts.push(`DURATION ${durationParts.join(', ')}`);
      }

      return parts.join(' ');
    },
  };
}
