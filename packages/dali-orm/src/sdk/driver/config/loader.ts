/**
 * Config File Loader
 *
 * Loads and parses configuration files from various formats
 * (JSON, JSONC, TypeScript) with caching support.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { extname, isAbsolute, join, resolve } from 'node:path';

import { parseConfig, validateConfig } from './schema.js';
import type {
  ConfigFileFormat,
  LoadConfigOptions,
  LoadConfigResult,
  OrmConfig,
  ValidatedOrmConfig,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Supported config file names
 */
const CONFIG_FILE_NAMES = ['.dali-orm', 'dali-orm.config', 'dali-orm'] as const;

/**
 * Supported file extensions
 */
const CONFIG_EXTENSIONS = ['.json', '.jsonc', '.ts'] as const;

/**
 * Search directories in priority order
 */
const SEARCH_DIRS = ['.', '.config', 'config'] as const;

/**
 * Cache for loaded configs
 */
let configCache: LoadConfigResult | null = null;

// ============================================================================
// File Format Detection
// ============================================================================

/**
 * Detect config file format from path
 */
function detectFormat(filePath: string): ConfigFileFormat {
  const ext = extname(filePath).toLowerCase();
  const normalizedExt = ext === '.jsonc' ? '.json' : ext;

  return {
    type:
      normalizedExt === '.ts'
        ? 'typescript'
        : ext === '.json'
          ? 'json'
          : 'jsonc',
    path: filePath,
    exists: existsSync(filePath),
  };
}

/**
 * Search for config file in a directory
 * Returns the first matching file found
 */
function searchConfigFile(dir: string): string | null {
  for (const baseName of CONFIG_FILE_NAMES) {
    for (const ext of CONFIG_EXTENSIONS) {
      const fullPath = join(dir, `${baseName}${ext}`);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
  }
  return null;
}

/**
 * Find config file by searching multiple locations
 * Priority: explicit path > CWD > home directory
 */
function findConfigFile(options: LoadConfigOptions): string | null {
  // Early exit: explicit path provided
  if (options.path) {
    return options.path;
  }

  const cwd = options.cwd ?? process.cwd();

  // Search in CWD and subdirectories
  for (const searchDir of SEARCH_DIRS) {
    const searchPath = resolve(cwd, searchDir);
    const found = searchConfigFile(searchPath);
    if (found) {
      return found;
    }
  }

  // Search in home directory
  const homeConfig = searchConfigFile(homedir());
  if (homeConfig) {
    return homeConfig;
  }

  return null;
}

// ============================================================================
// File Loading
// ============================================================================

/**
 * Load raw content from a config file
 */
function loadFileContent(filePath: string): string {
  if (!existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  return readFileSync(filePath, 'utf-8');
}

/**
 * Parse JSON/JSONC content
 * Handles JSONC comments and trailing commas
 */
function parseJsonContent(content: string): OrmConfig {
  // Strip comments and trailing commas for JSONC support
  const cleaned = stripJsonComments(content);

  try {
    return JSON.parse(cleaned) as OrmConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON config: ${message}`);
  }
}

/**
 * Strip JavaScript-style comments from JSON content
 * Handles single-line (//) and multi-line (/* *) comments
 */
function stripJsonComments(content: string): string {
  let result = '';
  let inString = false;
  let stringChar = '';
  let i = 0;

  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];

    // Handle string literals
    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
      result += char;
      i++;
      continue;
    }

    if (inString) {
      // Handle escape sequences
      if (char === '\\' && i + 1 < content.length) {
        result += char + content[i + 1];
        i += 2;
        continue;
      }

      // End of string
      if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
      result += char;
      i++;
      continue;
    }

    // Skip single-line comments
    if (char === '/' && nextChar === '/') {
      while (i < content.length && content[i] !== '\n') {
        i++;
      }
      continue;
    }

    // Skip multi-line comments
    if (char === '/' && nextChar === '*') {
      i += 2;
      while (i < content.length - 1) {
        if (content[i] === '*' && content[i + 1] === '/') {
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }

    result += char;
    i++;
  }

  // Remove trailing commas
  result = result.replace(/,(\s*[}\]])/g, '$1');

  return result;
}

/**
 * Load and parse a TypeScript config file
 */
async function loadTypeScriptConfig(filePath: string): Promise<OrmConfig> {
  // Use dynamic import for ESM compatibility
  const fileUrl = `file://${isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath)}`;

  try {
    // Dynamic import of the TypeScript file
    const module = await import(fileUrl);

    // Support default export or named export
    const config = module.default ?? module.config ?? module;

    if (!config || typeof config !== 'object') {
      throw new Error(
        'TypeScript config must export a default config object or named "config" export',
      );
    }

    return config as OrmConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load TypeScript config: ${message}`);
  }
}

// ============================================================================
// Main Loader Function
// ============================================================================

/**
 * Load configuration from a file
 *
 * @param options - Loader options
 * @returns Load result with validated config
 * @throws Error if file not found or validation fails
 *
 * @example
 * ```typescript
 * // Load from default locations
 * const result = await loadConfig();
 *
 * // Load from explicit path
 * const result = await loadConfig({ path: './my-config.json' });
 *
 * // Access the loaded config
 * console.log(result.config.url);
 * ```
 */
export async function loadConfig(
  options: LoadConfigOptions = {},
): Promise<LoadConfigResult> {
  const filePath = findConfigFile(options);

  // Fail fast: no config file found
  if (!filePath) {
    throw new Error(
      'Config file not found. Create a config file (.dali-orm.json, .dali-orm.jsonc, or .dali-orm.ts) ' +
        'in the current directory, .config/, or home directory.',
    );
  }

  // Return cached result if same path
  if (configCache && configCache.path === filePath) {
    return { ...configCache, cached: true };
  }

  const format = detectFormat(filePath);

  // Fail fast: file doesn't exist
  if (!format.exists) {
    throw new Error(`Config file does not exist: ${filePath}`);
  }

  let rawConfig: OrmConfig;

  if (format.type === 'typescript') {
    rawConfig = await loadTypeScriptConfig(filePath);
  } else {
    const content = loadFileContent(filePath);
    rawConfig = parseJsonContent(content);
  }
  // Validate the loaded config
  const validation = validateConfig(rawConfig);

  if (!validation.valid) {
    const errorMessages = validation.errors
      .map((e) => `${e.path}: ${e.message}`)
      .join('; ');
    throw new Error(
      `Config validation failed in ${filePath}: ${errorMessages}`,
    );
  }

  // Parse into validated config
  const validated = parseConfig(rawConfig);

  const result: LoadConfigResult = {
    config: validated,
    path: resolve(filePath),
    cached: false,
  };

  // Update cache
  configCache = result;

  return result;
}

/**
 * Load configuration synchronously
 * Useful for environments where async is not available
 *
 * @param options - Loader options
 * @returns Load result with validated config
 * @throws Error if file not found, validation fails, or file is TypeScript
 */
export function loadConfigSync(
  options: LoadConfigOptions = {},
): LoadConfigResult {
  const filePath = findConfigFile(options);

  // Fail fast: no config file found
  if (!filePath) {
    throw new Error(
      'Config file not found. Create a config file (.dali-orm.json, .dali-orm.jsonc, or .dali-orm.ts) ' +
        'in the current directory, .config/, or home directory.',
    );
  }

  // Return cached result if same path
  if (configCache && configCache.path === filePath) {
    return { ...configCache, cached: true };
  }

  const format = detectFormat(filePath);

  // Fail fast: file doesn't exist
  if (!format.exists) {
    throw new Error(`Config file does not exist: ${filePath}`);
  }

  // Fail fast: TypeScript requires async loading
  if (format.type === 'typescript') {
    throw new Error(
      'TypeScript config files cannot be loaded synchronously. Use loadConfig() instead.',
    );
  }

  const content = loadFileContent(filePath);
  const rawConfig = parseJsonContent(content);

  // Validate the loaded config
  const validation = validateConfig(rawConfig);

  if (!validation.valid) {
    const errorMessages = validation.errors
      .map((e) => `${e.path}: ${e.message}`)
      .join('; ');
    throw new Error(
      `Config validation failed in ${filePath}: ${errorMessages}`,
    );
  }

  // Parse into validated config
  const validated = parseConfig(rawConfig);

  const result: LoadConfigResult = {
    config: validated,
    path: resolve(filePath),
    cached: false,
  };

  // Update cache
  configCache = result;

  return result;
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear the config cache
 */
export function clearConfigCache(): void {
  configCache = null;
}

/**
 * Get the current cached config without loading
 */
export function getCachedConfig(): LoadConfigResult | null {
  return configCache ? { ...configCache, cached: true } : null;
}

/**
 * Check if a config file exists
 */
export function configFileExists(
  options: Partial<LoadConfigOptions> = {},
): boolean {
  const filePath = findConfigFile(options);
  return filePath !== null && existsSync(filePath);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Load config and return just the validated config object
 *
 * @param options - Loader options
 * @returns Validated config
 */
export async function loadConfigOptions(
  options: LoadConfigOptions = {},
): Promise<ValidatedOrmConfig> {
  const result = await loadConfig(options);
  return result.config;
}

/**
 * Load config synchronously and return just the validated config object
 *
 * @param options - Loader options
 * @returns Validated config
 */
export function loadConfigOptionsSync(
  options: LoadConfigOptions = {},
): ValidatedOrmConfig {
  const result = loadConfigSync(options);
  return result.config;
}
