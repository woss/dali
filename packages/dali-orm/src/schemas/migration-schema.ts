import {
  array,
  boolean,
  type InferOutput,
  literal,
  number,
  object,
  optional,
  string,
  union,
} from 'valibot';

// =============================================================================
// MIGRATION PUBLIC API SCHEMAS
// =============================================================================

/**
 * Migration file schema
 */
export const MigrationFileSchema = object({
  version: string(),
  name: string(),
  path: string(),
  content: string(),
  checksum: optional(string()),
});

export type MigrationFile = InferOutput<typeof MigrationFileSchema>;

/**
 * Migration result schema
 */
export const MigrationResultSchema = object({
  success: boolean(),
  applied: array(string()),
  failed: optional(array(string())),
  error: optional(string()),
});

export type MigrationResult = InferOutput<typeof MigrationResultSchema>;

/**
 * Migration status schema
 */
export const MigrationStatusSchema = object({
  version: string(),
  name: string(),
  appliedAt: optional(string()),
  status: union([literal('pending'), literal('applied'), literal('failed')]),
});

export type MigrationStatus = InferOutput<typeof MigrationStatusSchema>;

/**
 * Runner config schema
 */
export const RunnerConfigSchema = object({
  config: object({
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
  }),
  dryRun: optional(boolean()),
  to: optional(string()),
  steps: optional(number()),
  force: optional(boolean()),
});

export type RunnerConfig = InferOutput<typeof RunnerConfigSchema>;

/**
 * Snapshot schema
 */
export const SerializedColumnSchema = object({
  name: string(),
  type: string(),
  optional: optional(boolean()),
  readonly: optional(boolean()),
  default: optional(string()),
});

export type SerializedColumn = InferOutput<typeof SerializedColumnSchema>;

export const SerializedTableSchema = object({
  name: string(),
  schema: optional(string()),
  type: optional(string()),
  columns: optional(array(SerializedColumnSchema)),
  indexes: optional(
    array(
      object({
        name: string(),
        fields: array(string()),
        type: optional(string()),
      }),
    ),
  ),
});

export type SerializedTable = InferOutput<typeof SerializedTableSchema>;

export const SchemaSnapshotSchema = object({
  version: string(),
  tables: array(SerializedTableSchema),
  timestamp: string(),
});

export type SchemaSnapshot = InferOutput<typeof SchemaSnapshotSchema>;

/**
 * DDL Statement schema
 */
export const DDLStatementSchema = object({
  type: union([
    literal('DEFINE_TABLE'),
    literal('DEFINE_FIELD'),
    literal('DEFINE_INDEX'),
    literal('DEFINE_ACCESS'),
    literal('REMOVE_TABLE'),
    literal('REMOVE_FIELD'),
    literal('REMOVE_INDEX'),
    literal('REMOVE_ACCESS'),
  ]),
  sql: string(),
  table: optional(string()),
  field: optional(string()),
});

export type DDLStatement = InferOutput<typeof DDLStatementSchema>;

/**
 * Schema diff schema
 */
export const SchemaDiffSchema = object({
  added: array(SerializedTableSchema),
  removed: array(SerializedTableSchema),
  modified: array(
    object({
      table: string(),
      changes: array(string()),
    }),
  ),
});

export type SchemaDiff = InferOutput<typeof SchemaDiffSchema>;

/**
 * SchemaFilesResult - result of loading schema files
 */
export const SchemaFilesSchema = object({
  tables: array(
    object({
      name: string(),
      columns: array(
        object({
          name: string(),
          tableName: optional(string()),
          config: optional(
            object({
              type: optional(string()),
              optional: optional(boolean()),
              default: optional(string()),
              assert: optional(string()),
              readonly: optional(boolean()),
              permissions: optional(string()),
              flexible: optional(boolean()),
            }),
          ),
        }),
      ),
      config: optional(
        object({
          schema: optional(string()),
          type: optional(string()),
          in: optional(string()),
          out: optional(string()),
          indexes: optional(
            array(
              object({
                name: string(),
                fields: array(string()),
                type: optional(string()),
              }),
            ),
          ),
          permissions: optional(string()),
        }),
      ),
    }),
  ),
  access: optional(
    array(
      object({
        name: string(),
        type: union([literal('RECORD'), literal('JWT'), literal('OIDC')]),
        table: optional(string()),
        signup: optional(string()),
        signin: optional(string()),
        identifier: optional(string()),
        algorithm: optional(union([literal('HS256'), literal('HS512')])),
        key: optional(string()),
        issuer: optional(string()),
        duration: optional(string()),
        tokenDuration: optional(string()),
      }),
    ),
  ),
});

export type SchemaFiles = InferOutput<typeof SchemaFilesSchema>;
