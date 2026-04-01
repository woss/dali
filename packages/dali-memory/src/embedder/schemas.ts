import { z } from 'zod';

export const embedderConfigSchema = z.object({
  provider: z.enum(['remote', 'local']).default('remote'),
  model: z.string(),
  endpoint: z.string().optional(),
  apiKey: z.string().optional(),
  modelCacheDir: z.string().optional(),
});

export const embedResultSchema = z.object({
  vector: z.instanceof(Float32Array),
  dimensions: z.number().int().positive(),
});

export const embedderProviderSchema = z.enum(['remote', 'local']).default('remote');
