import { type InferOutput } from 'valibot';
/**
 * Global CLI options schema
 */
export declare const CLIOptionsSchema: import('valibot').ObjectSchema<
  {
    readonly config: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly dryRun: import('valibot').OptionalSchema<
      import('valibot').BooleanSchema<undefined>,
      undefined
    >;
    readonly force: import('valibot').OptionalSchema<
      import('valibot').BooleanSchema<undefined>,
      undefined
    >;
    readonly offline: import('valibot').OptionalSchema<
      import('valibot').BooleanSchema<undefined>,
      undefined
    >;
    readonly to: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly steps: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly output: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly name: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly schema: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly version: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly snapshots: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly full: import('valibot').OptionalSchema<
      import('valibot').BooleanSchema<undefined>,
      undefined
    >;
    readonly verbose: import('valibot').OptionalSchema<
      import('valibot').BooleanSchema<undefined>,
      undefined
    >;
  },
  undefined
>;
export type CLIOptions = InferOutput<typeof CLIOptionsSchema>;
/**
 * Migrate command options schema
 */
export declare const MigrateOptionsSchema: import('valibot').ObjectSchema<
  {
    readonly subcommand: import('valibot').OptionalSchema<
      import('valibot').UnionSchema<
        [
          import('valibot').LiteralSchema<'up', undefined>,
          import('valibot').LiteralSchema<'status', undefined>,
          import('valibot').LiteralSchema<'resume', undefined>,
        ],
        undefined
      >,
      undefined
    >;
    readonly to: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly steps: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly force: import('valibot').OptionalSchema<
      import('valibot').BooleanSchema<undefined>,
      undefined
    >;
    readonly dryRun: import('valibot').OptionalSchema<
      import('valibot').BooleanSchema<undefined>,
      undefined
    >;
  },
  undefined
>;
export type MigrateOptions = InferOutput<typeof MigrateOptionsSchema>;
/**
 * Generate command options schema
 */
export declare const GenerateOptionsSchema: import('valibot').ObjectSchema<
  {
    readonly name: import('valibot').StringSchema<undefined>;
    readonly output: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly version: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly schema: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly offline: import('valibot').OptionalSchema<
      import('valibot').BooleanSchema<undefined>,
      undefined
    >;
    readonly full: import('valibot').OptionalSchema<
      import('valibot').BooleanSchema<undefined>,
      undefined
    >;
    readonly snapshots: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
  },
  undefined
>;
export type GenerateOptions = InferOutput<typeof GenerateOptionsSchema>;
/**
 * Push command options schema
 */
export declare const PushOptionsSchema: import('valibot').ObjectSchema<
  {
    readonly dryRun: import('valibot').OptionalSchema<
      import('valibot').BooleanSchema<undefined>,
      undefined
    >;
    readonly force: import('valibot').OptionalSchema<
      import('valibot').BooleanSchema<undefined>,
      undefined
    >;
    readonly schema: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
  },
  undefined
>;
export type PushOptions = InferOutput<typeof PushOptionsSchema>;
/**
 * Pull command options schema
 */
export declare const PullOptionsSchema: import('valibot').ObjectSchema<
  {
    readonly table: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly output: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
  },
  undefined
>;
export type PullOptions = InferOutput<typeof PullOptionsSchema>;
/**
 * Diff command options schema
 */
export declare const DiffOptionsSchema: import('valibot').ObjectSchema<
  {
    readonly schema: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly verbose: import('valibot').OptionalSchema<
      import('valibot').BooleanSchema<undefined>,
      undefined
    >;
  },
  undefined
>;
export type DiffOptions = InferOutput<typeof DiffOptionsSchema>;
/**
 * Query command options schema
 */
export declare const QueryOptionsSchema: import('valibot').ObjectSchema<
  {
    readonly query: import('valibot').StringSchema<undefined>;
  },
  undefined
>;
export type QueryOptions = InferOutput<typeof QueryOptionsSchema>;
//# sourceMappingURL=cli-schema.d.ts.map
