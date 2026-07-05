import { z } from 'zod';
import { env } from '$env/dynamic/private';

const envSchema = z.object({
  // Embedding
  DALI_MEMORY_EMBEDDING_PROVIDER: z.enum(['local', 'remote']).default('local'),
  DALI_MEMORY_EMBEDDING_MODEL: z.string().default('Xenova/all-MiniLM-L6-v2'),
  DALI_MEMORY_EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(384),
  DALI_MEMORY_EMBEDDING_ENDPOINT: z.string().default('http://localhost:1234/v1'),
  DALI_MEMORY_EMBEDDING_API_KEY: z.string().optional(),
  DALI_MEMORY_EMBEDDING_CACHE_DIR: z.string().default('./models'),

  // MCP
  DALI_MEMORY_MCP_SSE_PATH: z.string().default('/mcp'),

  // Server
  DALI_MEMORY_PORT: z.coerce.number().int().positive().default(5173),
  DALI_MEMORY_HOST: z.string().default('0.0.0.0'),
  DALI_MEMORY_SECRET: z.string().min(1, 'DALI_MEMORY_SECRET is required'),

  // Auth
  DALI_MEMORY_AUTH_ENABLED: z.coerce.boolean().default(true),

  // SurrealDB
  DALI_MEMORY_SURREAL_URL: z.string().default('ws://localhost:10101'),
  DALI_MEMORY_SURREAL_NS: z.string().default('memory'),
  DALI_MEMORY_SURREAL_DB: z.string().default('memory'),
  DALI_MEMORY_SURREAL_USER: z.string().min(1, 'DALI_MEMORY_SURREAL_USER is required and must be set'),
  DALI_MEMORY_SURREAL_PASS: z.string().min(1, 'DALI_MEMORY_SURREAL_PASS is required and must be set'),

  // Logging
  DALI_MEMORY_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type DaliMemoryConfig = z.infer<typeof envSchema>;

let cached: DaliMemoryConfig | null = null;

export function getConfig(): DaliMemoryConfig {
  if (cached) return cached;
  const result = envSchema.safeParse(env);
  if (!result.success) {
    console.error('Invalid DALI_MEMORY_* configuration:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  cached = result.data;
  return cached;
}
