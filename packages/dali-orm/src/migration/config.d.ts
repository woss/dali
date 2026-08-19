import { type InferOutput } from 'valibot';
export declare const ConfigSchema: import("valibot").ObjectSchema<{
    readonly url: import("valibot").StringSchema<undefined>;
    readonly namespace: import("valibot").StringSchema<undefined>;
    readonly database: import("valibot").StringSchema<undefined>;
    readonly auth: import("valibot").OptionalSchema<import("valibot").ObjectSchema<{
        readonly type: import("valibot").LiteralSchema<"root", undefined>;
        readonly username: import("valibot").StringSchema<undefined>;
        readonly password: import("valibot").StringSchema<undefined>;
    }, undefined>, undefined>;
    readonly migrations: import("valibot").OptionalSchema<import("valibot").ObjectSchema<{
        readonly dir: import("valibot").StringSchema<undefined>;
        readonly table: import("valibot").StringSchema<undefined>;
        readonly journalDir: import("valibot").OptionalSchema<import("valibot").StringSchema<undefined>, undefined>;
        readonly debug: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
        readonly autoResume: import("valibot").OptionalSchema<import("valibot").BooleanSchema<undefined>, undefined>;
    }, undefined>, undefined>;
    readonly schema: import("valibot").OptionalSchema<import("valibot").ObjectSchema<{
        readonly dir: import("valibot").StringSchema<undefined>;
        readonly pattern: import("valibot").StringSchema<undefined>;
    }, undefined>, undefined>;
    readonly snapshots: import("valibot").OptionalSchema<import("valibot").ObjectSchema<{
        readonly dir: import("valibot").StringSchema<undefined>;
    }, undefined>, undefined>;
    readonly shadow: import("valibot").OptionalSchema<import("valibot").ObjectSchema<{
        readonly namespace: import("valibot").StringSchema<undefined>;
        readonly database: import("valibot").StringSchema<undefined>;
    }, undefined>, undefined>;
}, undefined>;
export type Config = InferOutput<typeof ConfigSchema>;
/**
 * Parse, validate, and resolve relative paths for a config object.
 * Fail fast on invalid config.
 */
export declare function processConfigObject(rawConfig: unknown, configFilePath: string, configDir: string, resolvedPath: string): Config;
export declare function loadConfig(configPath?: string): Promise<Config>;
export declare function createConfigFile(filePath?: string): Promise<void>;
export declare function defineConfig(config: Partial<Config>): Config;
//# sourceMappingURL=config.d.ts.map