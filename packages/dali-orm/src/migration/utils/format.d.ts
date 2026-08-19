/**
 * Shared formatting utilities for DDL generation
 *
 * Centralizes: isNowVariant, formatDefaultValue, normalizeDefault, validateChangefeed
 * Single source of truth - Parse Don't Validate
 */
/**
 * Check if a string value represents a now() variant that should become time::now()
 */
export declare function isNowVariant(value: string): boolean;
/**
 * Format a default value for SurrealQL output
 *
 * Handles: now() variants, booleans, strings, numbers, objects
 * Returns properly formatted SurrealQL literal
 */
export declare function formatDefaultValue(value: unknown): string;
/**
 * Normalize default value for comparison operations
 *
 * Converts string defaults to their parsed equivalents for proper comparison.
 * Used when comparing schema defaults vs introspected database values.
 * Handles quote stripping and now() variants.
 */
export declare function normalizeDefault(defaultValue: unknown): unknown;
/**
 * Validate changefeed duration format
 *
 * Accepts: 1s, 1m, 1h, 1d, 1w, or combinations like 7d, 24h
 * Fail Fast: Throws descriptive error for invalid formats
 */
export declare function validateChangefeed(value: string | undefined): void;
//# sourceMappingURL=format.d.ts.map