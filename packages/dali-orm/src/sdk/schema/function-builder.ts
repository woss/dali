// =============================================================================
// FunctionConfig
// =============================================================================

import { type FunctionConfig, functionToSQL } from '../schema.js';

/**
 * Fluent builder for SurrealDB DEFINE FUNCTION statements.
 *
 * Uses immutable config pattern — each method copies config with spread.
 * Call `.build()` to get a `FunctionConfig`, `.toSQL()` for the SQL string.
 *
 * @example
 * ```ts
 * const fn = defineFunction('calculate_tax')
 *   .args('price', 'rate')
 *   .body('RETURN $price * $rate')
 *   .comment('Calculate tax amount')
 *   .build();
 * ```
 */
export type FunctionBuilder = ReturnType<typeof defineFunction>;

export function defineFunction(name: string) {
  if (!name) throw new Error('Function name is required');

  let config: {
    args?: string[];
    body?: string;
    comment?: string;
    permissions?: string;
  } = {};

  return {
    get name() {
      return name;
    },

    /** Set function arguments */
    args(...args: string[]) {
      config = { ...config, args };
      return this;
    },

    /** Set the function body (SurrealQL expression) */
    body(body: string) {
      config = { ...config, body };
      return this;
    },

    /** Optional comment for the function */
    comment(text: string) {
      config = { ...config, comment: text };
      return this;
    },

    /** Set permissions for the function */
    permissions(perms: string) {
      config = { ...config, permissions: perms };
      return this;
    },

    /**
     * Return the FunctionConfig object.
     * Validates that required fields are set.
     */
    build(): FunctionConfig {
      if (!config.body) throw new Error('Function body is required (use .body())');
      return { name, ...config } as FunctionConfig;
    },

    /**
     * Generate the DEFINE FUNCTION SQL string from stored configuration.
     */
    toSQL(): string {
      return functionToSQL(this.build());
    },
  };
}
