import type { SurrealSequence } from '../migration/ddl/ddl.js';
import type { TableDefinition } from './table.js';
/**
 * Access type for SurrealDB access definitions
 */
export type AccessType = 'RECORD' | 'JWT' | 'OIDC';
/**
 * AccessConfig schema using valibot
 * Defines the configuration structure for access definitions
 */
export declare const AccessConfigSchema: import("valibot").ObjectSchema<{
    readonly name: import("valibot").StringSchema<undefined>;
    readonly type: import("valibot").UnionSchema<[import("valibot").LiteralSchema<"RECORD", undefined>, import("valibot").LiteralSchema<"JWT", undefined>, import("valibot").LiteralSchema<"OIDC", undefined>], undefined>;
    readonly table: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    readonly signup: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    readonly signin: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    readonly identifier: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    readonly algorithm: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    readonly key: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    readonly issuer: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    readonly duration: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    readonly tokenDuration: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
}, undefined>;
export type AccessConfig = {
    name: string;
    type: 'RECORD' | 'JWT' | 'OIDC';
    /** Table name to auto-generate signup/signin from */
    table?: string;
    /** Custom signup SQL override */
    signup?: string;
    /** Custom signin SQL override */
    signin?: string;
    /** Custom identifier column for authentication (email, username, phone, etc.) */
    identifier?: string;
    /** JWT algorithm */
    algorithm?: 'HS256' | 'HS512';
    /** JWT key */
    key?: string;
    /** JWT issuer */
    issuer?: string;
    /** Session duration (e.g., '7d', '1h') */
    duration?: string;
    /** Token duration (e.g., '1h', '7d') - for DURATION FOR TOKEN */
    tokenDuration?: string;
};
/**
 * Generate SET clause from table columns for signup
 * Extracts required (non-optional) columns to include in INSERT statement
 */
export declare function generateSignupFromTable(table: TableDefinition): string;
/**
 * Generate SIGNUP SQL from table
 */
export declare function generateSignupFromSQL(tableName: string, table: TableDefinition): string;
/**
 * Generate SIGNIN SQL from table
 */
export declare function generateSigninFromSQL(tableName: string, table: TableDefinition, identifier?: string): string;
/**
 * Generate SQL from AccessConfig
 */
export declare function accessToSQL(config: AccessConfig, tables?: Record<string, TableDefinition>): string;
/**
 * Function configuration for SurrealDB function definitions
 */
export type FunctionConfig = {
    name: string;
    args?: string[];
    body: string;
    comment?: string;
    permissions?: string;
};
/**
 * FunctionConfig schema using valibot
 * Defines the configuration structure for SurrealDB function definitions
 */
export declare const FunctionConfigSchema: import("valibot").ObjectSchema<{
    readonly name: import("valibot").StringSchema<undefined>;
    readonly args: import("valibot").OptionalSchema<import("valibot").ArraySchema<import("valibot").StringSchema<undefined>, undefined>, undefined>;
    readonly body: import("valibot").StringSchema<undefined>;
    readonly comment: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    readonly permissions: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
}, undefined>;
/**
 * Generate SQL from FunctionConfig
 */
export declare function functionToSQL(config: FunctionConfig): string;
/**
 * Event configuration for SurrealDB event definitions
 */
export type EventConfig = {
    name: string;
    on: string;
    when: string;
    then: string[];
    comment?: string;
    async?: boolean;
    retry?: number;
    maxdepth?: number;
};
/**
 * EventConfig schema using valibot
 * Defines the configuration structure for SurrealDB event definitions
 */
export declare const EventConfigSchema: import("valibot").ObjectSchema<{
    readonly name: import("valibot").StringSchema<undefined>;
    readonly on: import("valibot").StringSchema<undefined>;
    readonly when: import("valibot").StringSchema<undefined>;
    readonly then: import("valibot").ArraySchema<import("valibot").StringSchema<undefined>, undefined>;
    readonly comment: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
    readonly async: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
    readonly retry: import("valibot").OptionalSchema<import("valibot").NumberSchema<undefined>, undefined>;
    readonly maxdepth: import("valibot").OptionalSchema<import("valibot").NumberSchema<undefined>, undefined>;
}, undefined>;
/**
 * Generate SQL from EventConfig
 */
export declare function eventToSQL(config: EventConfig): string;
export type AccessBuilder = ReturnType<typeof defineAccess>;
export declare function defineAccess(name: string): {
    readonly name: string;
    type(type: AccessType): /*elided*/ any;
    table(tableName: string): /*elided*/ any;
    signup(sql: string): /*elided*/ any;
    signin(sql: string): /*elided*/ any;
    identifier(column: string): /*elided*/ any;
    algorithm(algo: "HS256" | "HS512"): /*elided*/ any;
    key(key: string): /*elided*/ any;
    issuer(issuer: string): /*elided*/ any;
    duration(duration: string): /*elided*/ any;
    tokenDuration(duration: string): /*elided*/ any;
    build(): AccessConfig;
    toSQL(): string;
};
export type EventBuilder = ReturnType<typeof defineEvent>;
export declare function defineEvent(name: string): {
    readonly name: string;
    on(tableName: string): /*elided*/ any;
    when(condition: string): /*elided*/ any;
    then(sql: string): /*elided*/ any;
    comment(text: string): /*elided*/ any;
    async(): /*elided*/ any;
    retry(count: number): /*elided*/ any;
    maxdepth(depth: number): /*elided*/ any;
    build(): EventConfig;
    toSQL(): string;
};
export type SequenceBuilder = ReturnType<typeof defineSequence>;
/**
 * Sequence configuration for SurrealDB sequence definitions
 *
 * SurrealDB syntax: DEFINE SEQUENCE [IF NOT EXISTS] <name>
 *   [START <n>] [INCREMENT <n>] [MIN <n>] [MAX <n>] [CACHE <n>] [CYCLE]
 *   [COMMENT '<str>']
 */
export type SequenceConfig = {
    name: string;
    start?: number;
    increment?: number;
    min?: number;
    max?: number;
    cache?: number;
    cycle?: boolean;
    comment?: string;
};
/**
 * Create a DEFINE SEQUENCE fluent builder
 *
 * @example
 * defineSequence('my_seq')
 *   .start(1)
 *   .increment(2)
 *   .cycle()
 *   .toSQL()
 * // → DEFINE SEQUENCE IF NOT EXISTS `my_seq` START 1 INCREMENT 2 CYCLE
 */
export declare function defineSequence(name: string): {
    readonly name: string;
    start(n: number): /*elided*/ any;
    increment(n: number): /*elided*/ any;
    min(n: number): /*elided*/ any;
    max(n: number): /*elided*/ any;
    cache(n: number): /*elided*/ any;
    cycle(): /*elided*/ any;
    comment(text: string): /*elided*/ any;
    build(): SurrealSequence;
    toSQL(): string;
};
export type DatabaseBuilder = ReturnType<typeof defineDatabase>;
/**
 * Create a DEFINE DATABASE fluent builder
 *
 * SurrealDB syntax: DEFINE DATABASE [IF NOT EXISTS] <name> [COMMENT '<str>']
 *
 * @example
 * defineDatabase('testdb')
 *   .comment('Test database')
 *   .toSQL()
 * // → DEFINE DATABASE `testdb` COMMENT "Test database"
 */
export declare function defineDatabase(name: string): {
    readonly name: string;
    comment(text: string): /*elided*/ any;
    ifNotExists(): /*elided*/ any;
    build(): {
        comment?: string;
        ifNotExists?: boolean;
        name: string;
    };
    toSQL(): string;
};
export type NamespaceBuilder = ReturnType<typeof defineNamespace>;
/**
 * Create a DEFINE NAMESPACE fluent builder
 *
 * SurrealDB syntax: DEFINE NAMESPACE [IF NOT EXISTS] <name> [COMMENT '<str>']
 *
 * @example
 * defineNamespace('production')
 *   .comment('Production namespace')
 *   .toSQL()
 * // → DEFINE NAMESPACE `production` COMMENT "Production namespace"
 */
export declare function defineNamespace(name: string): {
    readonly name: string;
    comment(text: string): /*elided*/ any;
    ifNotExists(): /*elided*/ any;
    build(): {
        comment?: string;
        ifNotExists?: boolean;
        name: string;
    };
    toSQL(): string;
};
//# sourceMappingURL=schema.d.ts.map