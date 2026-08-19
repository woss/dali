/**
 * Schema Validation Utilities
 *
 * Provides validation using Valibot with custom error formatting
 * for clear validation messages.
 */
import { type InferInput } from 'valibot';
import type { ValidatedAuth, ValidatedDriverOptions, ValidatedOrmConfig, ValidationResult } from './types.js';
declare const AuthConfigSchema: import("valibot").UnionSchema<[import("valibot").ObjectSchema<{
    readonly type: import("valibot").LiteralSchema<"root", undefined>;
    readonly username: import("valibot").StringSchema<undefined>;
    readonly password: import("valibot").StringSchema<undefined>;
}, undefined>, import("valibot").ObjectSchema<{
    readonly type: import("valibot").LiteralSchema<"namespace", undefined>;
    readonly username: import("valibot").StringSchema<undefined>;
    readonly password: import("valibot").StringSchema<undefined>;
    readonly namespace: import("valibot").StringSchema<undefined>;
}, undefined>, import("valibot").ObjectSchema<{
    readonly type: import("valibot").LiteralSchema<"database", undefined>;
    readonly username: import("valibot").StringSchema<undefined>;
    readonly password: import("valibot").StringSchema<undefined>;
    readonly namespace: import("valibot").StringSchema<undefined>;
    readonly database: import("valibot").StringSchema<undefined>;
}, undefined>, import("valibot").ObjectSchema<{
    readonly type: import("valibot").LiteralSchema<"record", undefined>;
    readonly namespace: import("valibot").StringSchema<undefined>;
    readonly database: import("valibot").StringSchema<undefined>;
    readonly access: import("valibot").StringSchema<undefined>;
    readonly variables: import("valibot").OptionalSchema<import("valibot").RecordSchema<import("valibot").StringSchema<undefined>, import("valibot").UnknownSchema, undefined>, undefined>;
}, undefined>], undefined>;
declare const DriverOptionsSchema: import("valibot").ObjectSchema<{
    readonly ws: import("valibot").OptionalSchema<import("valibot").ObjectSchema<{
        readonly pingInterval: import("valibot").OptionalSchema<import("valibot").NumberSchema<undefined>, undefined>;
        readonly pingTimeout: import("valibot").OptionalSchema<import("valibot").NumberSchema<undefined>, undefined>;
    }, undefined>, undefined>;
    readonly http: import("valibot").OptionalSchema<import("valibot").ObjectSchema<{
        readonly strict: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly timeout: import("valibot").OptionalSchema<import("valibot").NumberSchema<undefined>, undefined>;
    }, undefined>, undefined>;
}, undefined>;
declare const OrmConfigSchema: import("valibot").ObjectSchema<{
    readonly url: import("valibot").StringSchema<undefined>;
    readonly namespace: import("valibot").StringSchema<undefined>;
    readonly database: import("valibot").StringSchema<undefined>;
    readonly auth: import("valibot").OptionalSchema<import("valibot").UnionSchema<[import("valibot").ObjectSchema<{
        readonly type: import("valibot").LiteralSchema<"root", undefined>;
        readonly username: import("valibot").StringSchema<undefined>;
        readonly password: import("valibot").StringSchema<undefined>;
    }, undefined>, import("valibot").ObjectSchema<{
        readonly type: import("valibot").LiteralSchema<"namespace", undefined>;
        readonly username: import("valibot").StringSchema<undefined>;
        readonly password: import("valibot").StringSchema<undefined>;
        readonly namespace: import("valibot").StringSchema<undefined>;
    }, undefined>, import("valibot").ObjectSchema<{
        readonly type: import("valibot").LiteralSchema<"database", undefined>;
        readonly username: import("valibot").StringSchema<undefined>;
        readonly password: import("valibot").StringSchema<undefined>;
        readonly namespace: import("valibot").StringSchema<undefined>;
        readonly database: import("valibot").StringSchema<undefined>;
    }, undefined>, import("valibot").ObjectSchema<{
        readonly type: import("valibot").LiteralSchema<"record", undefined>;
        readonly namespace: import("valibot").StringSchema<undefined>;
        readonly database: import("valibot").StringSchema<undefined>;
        readonly access: import("valibot").StringSchema<undefined>;
        readonly variables: import("valibot").OptionalSchema<import("valibot").RecordSchema<import("valibot").StringSchema<undefined>, import("valibot").UnknownSchema, undefined>, undefined>;
    }, undefined>], undefined>, undefined>;
    readonly driver: import("valibot").OptionalSchema<import("valibot").ObjectSchema<{
        readonly ws: import("valibot").OptionalSchema<import("valibot").ObjectSchema<{
            readonly pingInterval: import("valibot").OptionalSchema<import("valibot").NumberSchema<undefined>, undefined>;
            readonly pingTimeout: import("valibot").OptionalSchema<import("valibot").NumberSchema<undefined>, undefined>;
        }, undefined>, undefined>;
        readonly http: import("valibot").OptionalSchema<import("valibot").ObjectSchema<{
            readonly strict: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
            readonly timeout: import("valibot").OptionalSchema<import("valibot").NumberSchema<undefined>, undefined>;
        }, undefined>, undefined>;
    }, undefined>, undefined>;
    readonly migrations: import("valibot").OptionalSchema<import("valibot").ObjectSchema<{
        readonly dir: import("valibot").StringSchema<undefined>;
        readonly table: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    }, undefined>, undefined>;
    readonly schema: import("valibot").OptionalSchema<import("valibot").ObjectSchema<{
        readonly dir: import("valibot").StringSchema<undefined>;
        readonly pattern: import("valibot").StringSchema<undefined>;
    }, undefined>, undefined>;
}, undefined>;
/**
 * Validate a raw config object against the Valibot schema
 *
 * @param data - Raw config object to validate
 * @returns Validation result with errors if validation failed
 *
 * @example
 * ```typescript
 * const result = validateConfig({
 *   url: 'ws://localhost:8000',
 *   namespace: 'test',
 *   database: 'test',
 * });
 *
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors);
 * }
 * ```
 */
export declare function validateConfig(data: unknown): ValidationResult;
/**
 * Validate and parse a config object into a ValidatedOrmConfig
 *
 * @param data - Raw config object
 * @returns Parsed and validated config
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * const config = parseConfig({
 *   url: 'ws://localhost:8000',
 *   namespace: 'test',
 *   database: 'test',
 * });
 * ```
 */
export declare function parseConfig(data: OrmConfig): ValidatedOrmConfig;
/**
 * Parse and validate URL
 * @throws Error if URL is invalid
 */
export declare function parseUrl(url: string): string;
/**
 * Parse and validate auth configuration
 */
export declare function parseAuth(auth: ConfigAuth): ValidatedAuth | undefined;
/**
 * Parse and validate driver options
 */
export declare function parseDriverOptions(driver: OrmConfig['driver']): ValidatedDriverOptions | undefined;
/**
 * Convert validated auth to SurrealDB SDK signin format
 * Maps to SDK field names: username/password
 */
export declare function toAuthConfig(validated: ValidatedAuth): {
    type?: 'root' | 'namespace' | 'database' | 'record';
    username?: string;
    password?: string;
    namespace?: string;
    database?: string;
    access?: string;
    variables?: Record<string, unknown>;
};
export type ConfigAuth = InferInput<typeof AuthConfigSchema>;
export type OrmConfig = InferInput<typeof OrmConfigSchema>;
export type DriverOptions = InferInput<typeof DriverOptionsSchema>;
export {};
//# sourceMappingURL=schema.d.ts.map