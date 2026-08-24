import { type FunctionConfig } from '../schema.js';
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
export declare function defineFunction(name: string): {
  readonly name: string;
  /** Set function arguments */
  args(...args: string[]): /*elided*/ any;
  /** Set the function body (SurrealQL expression) */
  body(body: string): /*elided*/ any;
  /** Optional comment for the function */
  comment(text: string): /*elided*/ any;
  /** Set permissions for the function */
  permissions(perms: string): /*elided*/ any;
  /**
   * Return the FunctionConfig object.
   * Validates that required fields are set.
   */
  build(): FunctionConfig;
  /**
   * Generate the DEFINE FUNCTION SQL string from stored configuration.
   */
  toSQL(): string;
};
//# sourceMappingURL=function-builder.d.ts.map
