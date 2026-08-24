/**
 * Config File Loader
 *
 * Loads and parses configuration files from various formats
 * (JSON, JSONC, TypeScript) with caching support.
 */
import type {
  LoadConfigOptions,
  LoadConfigResult,
  ValidatedOrmConfig,
} from './types.js';
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
export declare function loadConfig(
  options?: LoadConfigOptions,
): Promise<LoadConfigResult>;
/**
 * Load configuration synchronously
 * Useful for environments where async is not available
 *
 * @param options - Loader options
 * @returns Load result with validated config
 * @throws Error if file not found, validation fails, or file is TypeScript
 */
export declare function loadConfigSync(
  options?: LoadConfigOptions,
): LoadConfigResult;
/**
 * Clear the config cache
 */
export declare function clearConfigCache(): void;
/**
 * Get the current cached config without loading
 */
export declare function getCachedConfig(): LoadConfigResult | null;
/**
 * Check if a config file exists
 */
export declare function configFileExists(
  options?: Partial<LoadConfigOptions>,
): boolean;
/**
 * Load config and return just the validated config object
 *
 * @param options - Loader options
 * @returns Validated config
 */
export declare function loadConfigOptions(
  options?: LoadConfigOptions,
): Promise<ValidatedOrmConfig>;
/**
 * Load config synchronously and return just the validated config object
 *
 * @param options - Loader options
 * @returns Validated config
 */
export declare function loadConfigOptionsSync(
  options?: LoadConfigOptions,
): ValidatedOrmConfig;
//# sourceMappingURL=loader.d.ts.map
