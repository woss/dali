/**
 * Auth Validation
 *
 * Validation logic for auth configuration using valibot.
 * Follows Parse, Don't Validate principle - parses at boundary
 * into trusted typed output.
 */
export declare const AuthConfigSchema: import('valibot').UnionSchema<
  [
    import('valibot').ObjectSchema<
      {
        readonly type: import('valibot').LiteralSchema<'root', undefined>;
        readonly username: import('valibot').StringSchema<'Root auth requires username field'>;
        readonly password: import('valibot').StringSchema<'Root auth requires password field'>;
      },
      undefined
    >,
    import('valibot').ObjectSchema<
      {
        readonly type: import('valibot').LiteralSchema<'namespace', undefined>;
        readonly username: import('valibot').StringSchema<'Namespace auth requires username field'>;
        readonly password: import('valibot').StringSchema<'Namespace auth requires password field'>;
        readonly namespace: import('valibot').StringSchema<'Namespace auth requires namespace field'>;
      },
      undefined
    >,
    import('valibot').ObjectSchema<
      {
        readonly type: import('valibot').LiteralSchema<'database', undefined>;
        readonly username: import('valibot').StringSchema<'Database auth requires username field'>;
        readonly password: import('valibot').StringSchema<'Database auth requires password field'>;
        readonly namespace: import('valibot').StringSchema<'Database auth requires namespace field'>;
        readonly database: import('valibot').StringSchema<'Database auth requires database field'>;
      },
      undefined
    >,
    import('valibot').ObjectSchema<
      {
        readonly type: import('valibot').LiteralSchema<'record', undefined>;
        readonly namespace: import('valibot').StringSchema<'Record auth requires namespace field'>;
        readonly database: import('valibot').StringSchema<'Record auth requires database field'>;
        readonly access: import('valibot').StringSchema<'Record auth requires access field'>;
        readonly variables: import('valibot').OptionalSchema<
          import('valibot').RecordSchema<
            import('valibot').StringSchema<undefined>,
            import('valibot').UnknownSchema,
            undefined
          >,
          undefined
        >;
      },
      undefined
    >,
  ],
  undefined
>;
export type ValidatedAuthConfig =
  | {
      type: 'root';
      username: string;
      password: string;
    }
  | {
      type: 'namespace';
      username: string;
      password: string;
      namespace: string;
    }
  | {
      type: 'database';
      username: string;
      password: string;
      namespace: string;
      database: string;
    }
  | {
      type: 'record';
      namespace: string;
      database: string;
      access: string;
      variables?: Record<string, unknown>;
    };
/**
 * Validation error detail
 */
export interface AuthValidationErrorDetail {
  field: string;
  message: string;
  expected?: string;
}
/**
 * Result of auth config validation
 */
export interface AuthValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Parsed and validated auth config */
  data?: ValidatedAuthConfig;
  /** Validation errors if failed */
  errors?: AuthValidationErrorDetail[];
}
/**
 * Determine auth type from config based on fields present
 * Defaults to 'root' if type not specified
 */
export declare function determineAuthType(config: unknown): string;
/**
 * Add default type to config if not present
 */
export declare function normalizeConfig(
  config: unknown,
): Record<string, unknown>;
/**
 * Validate and parse auth configuration using valibot.
 * Follows Parse, Don't Validate - parses unknown input into
 * typed/validated ValidatedAuthConfig.
 *
 * @param config - Unknown input to validate
 * @returns Validation result with parsed data or errors
 *
 * @example
 * ```typescript
 * const result = validateAuthConfig({ type: 'root', username: 'root', password: 'secret' });
 * if (result.valid) {
 *   console.log('Valid auth config:', result.data);
 * } else {
 *   console.error('Validation failed:', result.errors);
 * }
 * ```
 */
export declare function validateAuthConfig(
  config: unknown,
): AuthValidationResult;
/**
 * Convert valibot error to our format
 */
export declare function convertValibotErrors(
  error: unknown,
): AuthValidationErrorDetail[];
//# sourceMappingURL=validate.d.ts.map
