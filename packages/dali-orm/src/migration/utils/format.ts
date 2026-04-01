/**
 * Shared formatting utilities for DDL generation
 *
 * Centralizes: isNowVariant, formatDefaultValue, normalizeDefault, validateChangefeed
 * Single source of truth - Parse Don't Validate
 */

/**
 * Check if a string value represents a now() variant that should become time::now()
 */
export function isNowVariant(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === 'now' || normalized === 'now()' || normalized === 'time::now()';
}

/**
 * Format a default value for SurrealQL output
 *
 * Handles: now() variants, booleans, strings, numbers, objects
 * Returns properly formatted SurrealQL literal
 */
export function formatDefaultValue(value: unknown): string | number | boolean {
  if (value === null) return 'NULL';
  if (value === undefined) return 'NONE';
  if (typeof value === 'string') {
    // SurrealDB function expressions (e.g., `crypto::blake3(content)`, `time::now()`) — emit unquoted
    if (value.includes('::') && value.endsWith(')')) {
      return value;
    }
    if (isNowVariant(value)) return 'time::now()';
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return 'true';
    if (normalized === 'false') return 'false';
    return `'${value.replace(/'/g, "\\'")}'`;
  }
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'object') return `${JSON.stringify(value)}`;
  // istanbul ignore next
  return String(value as never);
}

/**
 * Normalize default value for comparison operations
 *
 * Converts string defaults to their parsed equivalents for proper comparison.
 * Used when comparing schema defaults vs introspected database values.
 * Handles quote stripping and now() variants.
 */
export function normalizeDefault(defaultValue: unknown): unknown {
  if (typeof defaultValue !== 'string') {
    return defaultValue;
  }

  // Strip quotes from string defaults - schema may have quoted strings but introspect strips them
  // e.g., 'viewer' from schema vs viewer from introspect should match
  let trimmed = defaultValue;
  if (defaultValue.startsWith("'") && defaultValue.endsWith("'")) {
    trimmed = defaultValue.slice(1, -1).replace(/\\'/g, "'");
  }
  if (defaultValue.startsWith('"') && defaultValue.endsWith('"')) {
    trimmed = defaultValue.slice(1, -1).replace(/\\"/g, '"');
  }

  // Handle special string defaults (case-insensitive)
  switch (trimmed.toLowerCase()) {
    case 'now':
    case 'now()':
    case 'time::now()':
      return 'now'; // Keep as 'now' string for matching
    case 'true':
      return true;
    case 'false':
      return false;
    case 'null':
    case 'none':
      return null;
    default:
      return trimmed;
  }
}

/**
 * Validate changefeed duration format
 *
 * Accepts: 1s, 1m, 1h, 1d, 1w, or combinations like 7d, 24h
 * Fail Fast: Throws descriptive error for invalid formats
 */
export function validateChangefeed(value: string | undefined): void {
  if (!value) return;
  // Pattern: number + unit (s, m, h, d, w)
  const pattern = /^\d+[smhdw]+$/;
  if (!pattern.test(value)) {
    throw new Error(`Invalid changefeed duration: '${value}'. Expected format: '7d', '24h', '1w'`);
  }
}
