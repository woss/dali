import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'jsonc-parser';
import { z } from 'zod';
import { pluginName } from './constants.ts';
import { logger } from './utils/logger.ts';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

export const DaliMemoryConfigSchema = z.object({
  storage: z
    .object({
      mode: z
        .enum(['embed', 'remote'])
        .describe("Storage mode: 'embed' for local embedded database, 'remote' for remote server"),
      embed: z
        .object({
          engine: z
            .enum(['surrealkv', 'memory'])
            .describe(
              "Embedded engine type: 'surrealkv' (persistent, default) or 'memory' (in-memory, resets on restart)",
            )
            .default('surrealkv'),
          dataPath: z
            .string()
            .describe(
              "Path to store embedded data (required when engine is 'surrealkv'). Supports ~ for home directory. Defaults to ~/.config/dali-memory/data/",
            ),
        })
        .describe("Embedded storage settings (required when mode is 'embed')")
        .optional(),
      remote: z
        .object({
          url: z.string().describe('URL of the remote memory server (WebSocket or HTTP)'),
          auth: z
            .object({
              username: z.string().describe('Username for basic authentication').optional(),
              password: z
                .string()
                .describe(
                  'Password for basic authentication. Supports env:// and file:// prefixes for secrets',
                )
                .optional(),
              accessToken: z
                .string()
                .describe('Bearer access token. Supports env:// and file:// prefixes for secrets')
                .optional(),
            })
            .describe('Authentication credentials for remote server')
            .optional(),
          namespace: z
            .string()
            .describe('SurrealDB namespace to use for memory storage')
            .optional(),
          database: z.string().describe('SurrealDB database to use for memory storage').optional(),
        })
        .describe("Remote storage settings (required when mode is 'remote')")
        .optional(),
    })
    .describe('Storage backend configuration'),
  embedding: z
    .object({
      endpoint: z
        .string()
        .describe(
          "API endpoint for the embedding model (required for 'remote' provider). Supports OpenAI-compatible endpoints",
        ),
      model: z
        .string()
        .describe(
          "Model identifier for text embeddings. Used as model name for 'remote' provider, or HuggingFace model ID for 'local' provider (default: Xenova/bge-large-en-v1.5)",
        ),
      apiKey: z
        .string()
        .describe(
          'API key for the embedding service. Supports env:// and file:// prefixes for secrets',
        )
        .optional(),
      provider: z
        .enum(['remote', 'local'])
        .describe(
          "Embedding provider: 'remote' (API endpoint) or 'local' (local HuggingFace pipeline). Defaults to 'remote' for backward compatibility",
        )
        .optional(),
      modelCacheDir: z
        .string()
        .describe(
          "Directory to cache downloaded models (used by 'local' provider). Defaults to ~/.config/dali-memory/model_cache/",
        )
        .optional(),
    })
    .describe('Embedding model configuration')
    .optional(),
  plugin: z
    .object({
      chatMessage: z
        .object({
          enabled: z.boolean().describe('Enable capturing chat messages for memory'),
        })
        .describe('Chat message memory capture settings')
        .optional(),
      autoCapture: z
        .object({
          enabled: z.boolean().describe('Enable automatic memory capture from session activity'),
        })
        .describe('Automatic memory capture settings')
        .optional(),
    })
    .describe('Plugin behavior configuration')
    .optional(),
});

export type DaliMemoryConfig = z.infer<typeof DaliMemoryConfigSchema>;

const DEFAULT_CONFIG: DaliMemoryConfig = {
  storage: {
    mode: 'embed',
    embed: { dataPath: join(homedir(), `.config/${pluginName}/data/`), engine: 'surrealkv' },
  },
  embedding: { endpoint: 'http://localhost:1234/v1', model: 'text-embedding-qwen3-embedding-4b' },
};

function loadConfigFile(path: string): Partial<DaliMemoryConfig> | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    return parse(raw, [], {
      allowTrailingComma: true,
      disallowComments: false,
    }) as Partial<DaliMemoryConfig>;
  } catch {
    logger.warn(`Failed to parse config file: ${path}`);
    return null;
  }
}

export function initConfig(
  directory: string,
): DaliMemoryConfig & Required<Pick<DaliMemoryConfig, 'embedding'>> {
  const userConfigPath = join(homedir(), `.config/${pluginName}/${pluginName}.jsonc`);
  const userConfig =
    loadConfigFile(userConfigPath) ||
    loadConfigFile(join(homedir(), `.config/${pluginName}/${pluginName}.json`)) ||
    {};

  const projectConfigPath = join(directory, `.opencode/${pluginName}.jsonc`);
  const projectConfig =
    loadConfigFile(projectConfigPath) ||
    loadConfigFile(join(directory, `.opencode/${pluginName}.json`)) ||
    {};

  const config: DaliMemoryConfig = {
    storage: {
      ...DEFAULT_CONFIG.storage,
      ...(userConfig as any)?.storage,
      ...(projectConfig as any)?.storage,
    },
    embedding: {
      ...DEFAULT_CONFIG.embedding,
      ...(userConfig as any)?.embedding,
      ...(projectConfig as any)?.embedding,
    },
    plugin: { ...(userConfig as any)?.plugin, ...(projectConfig as any)?.plugin },
  };

  // Resolve ~ or $HOME in paths
  if (config.storage.embed?.dataPath) {
    if (config.storage.embed.dataPath.includes('$HOME')) {
      config.storage.embed.dataPath = config.storage.embed.dataPath.replaceAll('$HOME', homedir());
    }
    if (config.storage.embed.dataPath.startsWith('~')) {
      config.storage.embed.dataPath = config.storage.embed.dataPath.replaceAll('~', homedir());
    }
  }
  return config as DaliMemoryConfig & Required<Pick<DaliMemoryConfig, 'embedding'>>;
}

export function resolveSecretValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('env://')) return process.env[value.slice(6)];
  if (value.startsWith('file://')) return readFileSync(value.slice(7), 'utf-8').trim();
  return value;
}

export function getTags(directory: string): { userTag: string; projectTag: string } {
  let email = '';
  try {
    email = execSync('git config user.email', { cwd: directory, encoding: 'utf-8' }).trim();
  } catch {}
  const userTag = `opencode_user_${crypto
    .createHash('sha256')
    .update(email || 'anonymous')
    .digest('hex')
    .slice(0, 16)}`;

  const projectTag = `opencode_project_${crypto.createHash('sha256').update(directory).digest('hex').slice(0, 16)}`;
  return { userTag, projectTag };
}
