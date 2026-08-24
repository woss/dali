import {
  boolean,
  type InferOutput,
  literal,
  object,
  optional,
  string,
  union,
} from 'valibot';

// =============================================================================
// CLI OPTIONS SCHEMAS
// =============================================================================

/**
 * Global CLI options schema
 */
export const CLIOptionsSchema = object({
  config: optional(string()),
  dryRun: optional(boolean()),
  force: optional(boolean()),
  offline: optional(boolean()),
  to: optional(string()),
  steps: optional(string()), // parsed to number later
  output: optional(string()),
  name: optional(string()),
  schema: optional(string()),
  version: optional(string()),
  snapshots: optional(string()),
  full: optional(boolean()),
  verbose: optional(boolean()),
});

export type CLIOptions = InferOutput<typeof CLIOptionsSchema>;

/**
 * Migrate command options schema
 */
export const MigrateOptionsSchema = object({
  subcommand: optional(
    union([literal('up'), literal('status'), literal('resume')]),
  ),
  to: optional(string()),
  steps: optional(string()),
  force: optional(boolean()),
  dryRun: optional(boolean()),
});

export type MigrateOptions = InferOutput<typeof MigrateOptionsSchema>;

/**
 * Generate command options schema
 */
export const GenerateOptionsSchema = object({
  name: string(),
  output: optional(string()),
  version: optional(string()),
  schema: optional(string()),
  offline: optional(boolean()),
  full: optional(boolean()),
  snapshots: optional(string()),
});

export type GenerateOptions = InferOutput<typeof GenerateOptionsSchema>;

/**
 * Push command options schema
 */
export const PushOptionsSchema = object({
  dryRun: optional(boolean()),
  force: optional(boolean()),
  schema: optional(string()),
});

export type PushOptions = InferOutput<typeof PushOptionsSchema>;

/**
 * Pull command options schema
 */
export const PullOptionsSchema = object({
  table: optional(string()),
  output: optional(string()),
});

export type PullOptions = InferOutput<typeof PullOptionsSchema>;

/**
 * Diff command options schema
 */
export const DiffOptionsSchema = object({
  schema: optional(string()),
  verbose: optional(boolean()),
});

export type DiffOptions = InferOutput<typeof DiffOptionsSchema>;

/**
 * Query command options schema
 */
export const QueryOptionsSchema = object({
  query: string(),
});

export type QueryOptions = InferOutput<typeof QueryOptionsSchema>;
