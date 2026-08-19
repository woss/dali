import { z } from 'zod';
declare const envSchema: z.ZodObject<{
    DALI_MEMORY_EMBEDDING_PROVIDER: z.ZodDefault<z.ZodEnum<{
        local: "local";
        remote: "remote";
    }>>;
    DALI_MEMORY_EMBEDDING_MODEL: z.ZodDefault<z.ZodString>;
    DALI_MEMORY_EMBEDDING_DIMENSION: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    DALI_MEMORY_EMBEDDING_ENDPOINT: z.ZodDefault<z.ZodString>;
    DALI_MEMORY_EMBEDDING_API_KEY: z.ZodOptional<z.ZodString>;
    DALI_MEMORY_EMBEDDING_CACHE_DIR: z.ZodDefault<z.ZodString>;
    DALI_MEMORY_MCP_SSE_PATH: z.ZodDefault<z.ZodString>;
    DALI_MEMORY_PORT: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    DALI_MEMORY_HOST: z.ZodDefault<z.ZodString>;
    DALI_MEMORY_SECRET: z.ZodString;
    DALI_MEMORY_AUTH_ENABLED: z.ZodDefault<z.ZodCoercedBoolean<unknown>>;
    DALI_MEMORY_SURREAL_URL: z.ZodDefault<z.ZodString>;
    DALI_MEMORY_SURREAL_NS: z.ZodDefault<z.ZodString>;
    DALI_MEMORY_SURREAL_DB: z.ZodDefault<z.ZodString>;
    DALI_MEMORY_SURREAL_USER: z.ZodDefault<z.ZodString>;
    DALI_MEMORY_SURREAL_PASS: z.ZodDefault<z.ZodString>;
    DALI_MEMORY_LOG_LEVEL: z.ZodDefault<z.ZodEnum<{
        warn: "warn";
        error: "error";
        debug: "debug";
        info: "info";
    }>>;
}, z.core.$strip>;
export type MemlordConfig = z.infer<typeof envSchema>;
export declare function getConfig(): MemlordConfig;
export {};
//# sourceMappingURL=config.d.ts.map