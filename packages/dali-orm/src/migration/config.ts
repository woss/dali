import fs from 'node:fs/promises';
import path from 'node:path';
import { createDebug as debug } from 'obug';
import { boolean, type InferOutput, literal, object, optional, parse, string } from 'valibot';

const log = debug('dali-orm:kit:config');

// Environment variable defaults (read inside loadConfig, not at module load time)

export const ConfigSchema = object({
  url: string(),
  namespace: string(),
  database: string(),

  auth: optional(
    object({
      type: literal('root'),
      username: string(),
      password: string(),
    }),
  ),

  migrations: optional(
    object({
      dir: string(),
      table: string(),
      journalDir: optional(string()),
      debug: optional(boolean()),
      autoResume: optional(boolean()),
    }),
  ),

  schema: optional(
    object({
      dir: string(),
      pattern: string(),
    }),
  ),

  snapshots: optional(
    object({
      dir: string(),
    }),
  ),

  shadow: optional(
    object({
      namespace: string(),
      database: string(),
    }),
  ),
});

export type Config = InferOutput<typeof ConfigSchema>;

/**
 * Parse, validate, and resolve relative paths for a config object.
 * Fail fast on invalid config.
 */
export function processConfigObject(
  rawConfig: unknown,
  configFilePath: string,
  configDir: string,
  resolvedPath: string,
): Config {
  // Guard: reject empty config objects
  if (rawConfig === null || rawConfig === undefined || typeof rawConfig !== 'object') {
    throw new Error(`Config at ${configFilePath} must be an object, got: ${typeof rawConfig}`);
  }

  const parsed = parse(ConfigSchema, rawConfig);

  // Fill defaults for absent migrations config
  if (!parsed.migrations) {
    parsed.migrations = {
      dir: path.join(configDir, 'migrations'),
      table: '__migrations',
      journalDir: path.join(configDir, 'meta'),
    };
  } else {
    if (parsed.migrations.dir) {
      parsed.migrations.dir = path.resolve(configDir, parsed.migrations.dir);
    }
    if (!parsed.migrations.journalDir) {
      parsed.migrations.journalDir = path.join(configDir, 'meta');
    }
  }

  // Fill defaults for absent schema config
  if (!parsed.schema) {
    parsed.schema = {
      dir: path.join(configDir, 'src'),
      pattern: 'schema.ts',
    };
  } else {
    if (parsed.schema.dir) {
      parsed.schema.dir = path.resolve(configDir, parsed.schema.dir);
    }
  }

  // Resolve relative paths for other optional dirs
  if (parsed.snapshots?.dir) {
    parsed.snapshots.dir = path.resolve(configDir, parsed.snapshots.dir);
  }

  log('Loaded successfully from:', resolvedPath);
  return parsed;
}

export async function loadConfig(configPath?: string): Promise<Config> {
  const defaultPaths = ['dali-orm.config.ts', 'dali-orm.config.js', '.dali-orm.js'];

  const pathsToTry = configPath ? [configPath] : defaultPaths;

  log('cwd:', process.cwd());
  log('pathsToTry:', pathsToTry);

  for (const configFilePath of pathsToTry) {
    try {
      const resolvedPath = path.resolve(process.cwd(), configFilePath);
      const configDir = path.dirname(resolvedPath);
      log('Trying:', resolvedPath);
      log('Config directory:', configDir);

      // For .ts files, register tsx/esm loader so Node.js can import TypeScript
      if (resolvedPath.endsWith('.ts')) {
        const { register } = await import('tsx/esm/api');
        const unregister = register();
        try {
          const configModule = await import(`file://${resolvedPath}?ts=${Date.now()}`);
          const rawConfig = configModule.default ?? configModule;
          return processConfigObject(rawConfig, configFilePath, configDir, resolvedPath);
        } finally {
          (unregister as () => void)();
        }
      }

      const configModule = await import(`file://${resolvedPath}`);
      const rawConfig = configModule.default ?? configModule;

      return processConfigObject(rawConfig, configFilePath, configDir, resolvedPath);
    } catch (error) {
      log('Error loading', `${configFilePath}:`, error);
    }
  }

  // Fail hard: no config file found
  throw new Error(
    `No config file found. Create one with:\n  dali-orm init\n\n` +
      `Tried: ${pathsToTry.join(', ')}`,
  );
}

export async function createConfigFile(filePath: string = 'dali-orm.config.js'): Promise<void> {
  const template = `import { defineConfig } from '@woss/dali-orm/migration/config';

export default defineConfig({
  // Use environment variables or defaults:
  // - SURREALDB_URL (default: ws://localhost:10101)
  // - SURREALDB_USER (optional)
  // - SURREALDB_PASS (optional)
  // - SURREALDB_NAMESPACE (default: test)
  // - SURREALDB_DATABASE (default: test)
  url: process.env.SURREALDB_URL || 'ws://localhost:10101',
  namespace: process.env.SURREALDB_NAMESPACE || 'test',
  database: process.env.SURREALDB_DATABASE || 'test',
  // auth: {
  //   type: 'root',
  //   username: process.env.SURREALDB_USER || 'admin',
  //   password: process.env.SURREALDB_PASS || 'admin',
  // },
  migrations: {
    dir: './migrations',
    table: '__migrations',
  },
  schema: {
    dir: './schema',
    pattern: '**/*.js',
  },
});
`;

  const resolvedPath = path.resolve(process.cwd(), filePath);
  await fs.writeFile(resolvedPath, template, 'utf-8');
}

export function defineConfig(config: Partial<Config>): Config {
  return parse(ConfigSchema, config);
}
