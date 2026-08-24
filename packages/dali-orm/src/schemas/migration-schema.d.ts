import { type InferOutput } from 'valibot';
/**
 * Migration file schema
 */
export declare const MigrationFileSchema: import('valibot').ObjectSchema<
  {
    readonly version: import('valibot').StringSchema<undefined>;
    readonly name: import('valibot').StringSchema<undefined>;
    readonly path: import('valibot').StringSchema<undefined>;
    readonly content: import('valibot').StringSchema<undefined>;
    readonly checksum: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
  },
  undefined
>;
export type MigrationFile = InferOutput<typeof MigrationFileSchema>;
/**
 * Migration result schema
 */
export declare const MigrationResultSchema: import('valibot').ObjectSchema<
  {
    readonly success: import('valibot').BooleanSchema<undefined>;
    readonly applied: import('valibot').ArraySchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly failed: import('valibot').OptionalSchema<
      import('valibot').ArraySchema<
        import('valibot').StringSchema<undefined>,
        undefined
      >,
      undefined
    >;
    readonly error: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
  },
  undefined
>;
export type MigrationResult = InferOutput<typeof MigrationResultSchema>;
/**
 * Migration status schema
 */
export declare const MigrationStatusSchema: import('valibot').ObjectSchema<
  {
    readonly version: import('valibot').StringSchema<undefined>;
    readonly name: import('valibot').StringSchema<undefined>;
    readonly appliedAt: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly status: import('valibot').UnionSchema<
      [
        import('valibot').LiteralSchema<'pending', undefined>,
        import('valibot').LiteralSchema<'applied', undefined>,
        import('valibot').LiteralSchema<'failed', undefined>,
      ],
      undefined
    >;
  },
  undefined
>;
export type MigrationStatus = InferOutput<typeof MigrationStatusSchema>;
/**
 * Runner config schema
 */
export declare const RunnerConfigSchema: import('valibot').ObjectSchema<
  {
    readonly config: import('valibot').ObjectSchema<
      {
        readonly url: import('valibot').StringSchema<undefined>;
        readonly namespace: import('valibot').StringSchema<undefined>;
        readonly database: import('valibot').StringSchema<undefined>;
        readonly auth: import('valibot').OptionalSchema<
          import('valibot').ObjectSchema<
            {
              readonly type: import('valibot').LiteralSchema<'root', undefined>;
              readonly username: import('valibot').StringSchema<undefined>;
              readonly password: import('valibot').StringSchema<undefined>;
            },
            undefined
          >,
          undefined
        >;
        readonly migrations: import('valibot').OptionalSchema<
          import('valibot').ObjectSchema<
            {
              readonly dir: import('valibot').StringSchema<undefined>;
              readonly table: import('valibot').StringSchema<undefined>;
              readonly journalDir: import('valibot').OptionalSchema<
                import('valibot').StringSchema<undefined>,
                undefined
              >;
              readonly debug: import('valibot').OptionalSchema<
                import('valibot').BooleanSchema<undefined>,
                undefined
              >;
              readonly autoResume: import('valibot').OptionalSchema<
                import('valibot').BooleanSchema<undefined>,
                undefined
              >;
            },
            undefined
          >,
          undefined
        >;
      },
      undefined
    >;
    readonly dryRun: import('valibot').OptionalSchema<
      import('valibot').BooleanSchema<undefined>,
      undefined
    >;
    readonly to: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly steps: import('valibot').OptionalSchema<
      import('valibot').NumberSchema<undefined>,
      undefined
    >;
    readonly force: import('valibot').OptionalSchema<
      import('valibot').BooleanSchema<undefined>,
      undefined
    >;
  },
  undefined
>;
export type RunnerConfig = InferOutput<typeof RunnerConfigSchema>;
/**
 * Snapshot schema
 */
export declare const SerializedColumnSchema: import('valibot').ObjectSchema<
  {
    readonly name: import('valibot').StringSchema<undefined>;
    readonly type: import('valibot').StringSchema<undefined>;
    readonly optional: import('valibot').OptionalSchema<
      import('valibot').BooleanSchema<undefined>,
      undefined
    >;
    readonly readonly: import('valibot').OptionalSchema<
      import('valibot').BooleanSchema<undefined>,
      undefined
    >;
    readonly default: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
  },
  undefined
>;
export type SerializedColumn = InferOutput<typeof SerializedColumnSchema>;
export declare const SerializedTableSchema: import('valibot').ObjectSchema<
  {
    readonly name: import('valibot').StringSchema<undefined>;
    readonly schema: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly type: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly columns: import('valibot').OptionalSchema<
      import('valibot').ArraySchema<
        import('valibot').ObjectSchema<
          {
            readonly name: import('valibot').StringSchema<undefined>;
            readonly type: import('valibot').StringSchema<undefined>;
            readonly optional: import('valibot').OptionalSchema<
              import('valibot').BooleanSchema<undefined>,
              undefined
            >;
            readonly readonly: import('valibot').OptionalSchema<
              import('valibot').BooleanSchema<undefined>,
              undefined
            >;
            readonly default: import('valibot').OptionalSchema<
              import('valibot').StringSchema<undefined>,
              undefined
            >;
          },
          undefined
        >,
        undefined
      >,
      undefined
    >;
    readonly indexes: import('valibot').OptionalSchema<
      import('valibot').ArraySchema<
        import('valibot').ObjectSchema<
          {
            readonly name: import('valibot').StringSchema<undefined>;
            readonly fields: import('valibot').ArraySchema<
              import('valibot').StringSchema<undefined>,
              undefined
            >;
            readonly type: import('valibot').OptionalSchema<
              import('valibot').StringSchema<undefined>,
              undefined
            >;
          },
          undefined
        >,
        undefined
      >,
      undefined
    >;
  },
  undefined
>;
export type SerializedTable = InferOutput<typeof SerializedTableSchema>;
export declare const SchemaSnapshotSchema: import('valibot').ObjectSchema<
  {
    readonly version: import('valibot').StringSchema<undefined>;
    readonly tables: import('valibot').ArraySchema<
      import('valibot').ObjectSchema<
        {
          readonly name: import('valibot').StringSchema<undefined>;
          readonly schema: import('valibot').OptionalSchema<
            import('valibot').StringSchema<undefined>,
            undefined
          >;
          readonly type: import('valibot').OptionalSchema<
            import('valibot').StringSchema<undefined>,
            undefined
          >;
          readonly columns: import('valibot').OptionalSchema<
            import('valibot').ArraySchema<
              import('valibot').ObjectSchema<
                {
                  readonly name: import('valibot').StringSchema<undefined>;
                  readonly type: import('valibot').StringSchema<undefined>;
                  readonly optional: import('valibot').OptionalSchema<
                    import('valibot').BooleanSchema<undefined>,
                    undefined
                  >;
                  readonly readonly: import('valibot').OptionalSchema<
                    import('valibot').BooleanSchema<undefined>,
                    undefined
                  >;
                  readonly default: import('valibot').OptionalSchema<
                    import('valibot').StringSchema<undefined>,
                    undefined
                  >;
                },
                undefined
              >,
              undefined
            >,
            undefined
          >;
          readonly indexes: import('valibot').OptionalSchema<
            import('valibot').ArraySchema<
              import('valibot').ObjectSchema<
                {
                  readonly name: import('valibot').StringSchema<undefined>;
                  readonly fields: import('valibot').ArraySchema<
                    import('valibot').StringSchema<undefined>,
                    undefined
                  >;
                  readonly type: import('valibot').OptionalSchema<
                    import('valibot').StringSchema<undefined>,
                    undefined
                  >;
                },
                undefined
              >,
              undefined
            >,
            undefined
          >;
        },
        undefined
      >,
      undefined
    >;
    readonly timestamp: import('valibot').StringSchema<undefined>;
  },
  undefined
>;
export type SchemaSnapshot = InferOutput<typeof SchemaSnapshotSchema>;
/**
 * DDL Statement schema
 */
export declare const DDLStatementSchema: import('valibot').ObjectSchema<
  {
    readonly type: import('valibot').UnionSchema<
      [
        import('valibot').LiteralSchema<'DEFINE_TABLE', undefined>,
        import('valibot').LiteralSchema<'DEFINE_FIELD', undefined>,
        import('valibot').LiteralSchema<'DEFINE_INDEX', undefined>,
        import('valibot').LiteralSchema<'DEFINE_ACCESS', undefined>,
        import('valibot').LiteralSchema<'REMOVE_TABLE', undefined>,
        import('valibot').LiteralSchema<'REMOVE_FIELD', undefined>,
        import('valibot').LiteralSchema<'REMOVE_INDEX', undefined>,
        import('valibot').LiteralSchema<'REMOVE_ACCESS', undefined>,
      ],
      undefined
    >;
    readonly sql: import('valibot').StringSchema<undefined>;
    readonly table: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
    readonly field: import('valibot').OptionalSchema<
      import('valibot').StringSchema<undefined>,
      undefined
    >;
  },
  undefined
>;
export type DDLStatement = InferOutput<typeof DDLStatementSchema>;
/**
 * Schema diff schema
 */
export declare const SchemaDiffSchema: import('valibot').ObjectSchema<
  {
    readonly added: import('valibot').ArraySchema<
      import('valibot').ObjectSchema<
        {
          readonly name: import('valibot').StringSchema<undefined>;
          readonly schema: import('valibot').OptionalSchema<
            import('valibot').StringSchema<undefined>,
            undefined
          >;
          readonly type: import('valibot').OptionalSchema<
            import('valibot').StringSchema<undefined>,
            undefined
          >;
          readonly columns: import('valibot').OptionalSchema<
            import('valibot').ArraySchema<
              import('valibot').ObjectSchema<
                {
                  readonly name: import('valibot').StringSchema<undefined>;
                  readonly type: import('valibot').StringSchema<undefined>;
                  readonly optional: import('valibot').OptionalSchema<
                    import('valibot').BooleanSchema<undefined>,
                    undefined
                  >;
                  readonly readonly: import('valibot').OptionalSchema<
                    import('valibot').BooleanSchema<undefined>,
                    undefined
                  >;
                  readonly default: import('valibot').OptionalSchema<
                    import('valibot').StringSchema<undefined>,
                    undefined
                  >;
                },
                undefined
              >,
              undefined
            >,
            undefined
          >;
          readonly indexes: import('valibot').OptionalSchema<
            import('valibot').ArraySchema<
              import('valibot').ObjectSchema<
                {
                  readonly name: import('valibot').StringSchema<undefined>;
                  readonly fields: import('valibot').ArraySchema<
                    import('valibot').StringSchema<undefined>,
                    undefined
                  >;
                  readonly type: import('valibot').OptionalSchema<
                    import('valibot').StringSchema<undefined>,
                    undefined
                  >;
                },
                undefined
              >,
              undefined
            >,
            undefined
          >;
        },
        undefined
      >,
      undefined
    >;
    readonly removed: import('valibot').ArraySchema<
      import('valibot').ObjectSchema<
        {
          readonly name: import('valibot').StringSchema<undefined>;
          readonly schema: import('valibot').OptionalSchema<
            import('valibot').StringSchema<undefined>,
            undefined
          >;
          readonly type: import('valibot').OptionalSchema<
            import('valibot').StringSchema<undefined>,
            undefined
          >;
          readonly columns: import('valibot').OptionalSchema<
            import('valibot').ArraySchema<
              import('valibot').ObjectSchema<
                {
                  readonly name: import('valibot').StringSchema<undefined>;
                  readonly type: import('valibot').StringSchema<undefined>;
                  readonly optional: import('valibot').OptionalSchema<
                    import('valibot').BooleanSchema<undefined>,
                    undefined
                  >;
                  readonly readonly: import('valibot').OptionalSchema<
                    import('valibot').BooleanSchema<undefined>,
                    undefined
                  >;
                  readonly default: import('valibot').OptionalSchema<
                    import('valibot').StringSchema<undefined>,
                    undefined
                  >;
                },
                undefined
              >,
              undefined
            >,
            undefined
          >;
          readonly indexes: import('valibot').OptionalSchema<
            import('valibot').ArraySchema<
              import('valibot').ObjectSchema<
                {
                  readonly name: import('valibot').StringSchema<undefined>;
                  readonly fields: import('valibot').ArraySchema<
                    import('valibot').StringSchema<undefined>,
                    undefined
                  >;
                  readonly type: import('valibot').OptionalSchema<
                    import('valibot').StringSchema<undefined>,
                    undefined
                  >;
                },
                undefined
              >,
              undefined
            >,
            undefined
          >;
        },
        undefined
      >,
      undefined
    >;
    readonly modified: import('valibot').ArraySchema<
      import('valibot').ObjectSchema<
        {
          readonly table: import('valibot').StringSchema<undefined>;
          readonly changes: import('valibot').ArraySchema<
            import('valibot').StringSchema<undefined>,
            undefined
          >;
        },
        undefined
      >,
      undefined
    >;
  },
  undefined
>;
export type SchemaDiff = InferOutput<typeof SchemaDiffSchema>;
/**
 * SchemaFilesResult - result of loading schema files
 */
export declare const SchemaFilesSchema: import('valibot').ObjectSchema<
  {
    readonly tables: import('valibot').ArraySchema<
      import('valibot').ObjectSchema<
        {
          readonly name: import('valibot').StringSchema<undefined>;
          readonly columns: import('valibot').ArraySchema<
            import('valibot').ObjectSchema<
              {
                readonly name: import('valibot').StringSchema<undefined>;
                readonly tableName: import('valibot').OptionalSchema<
                  import('valibot').StringSchema<undefined>,
                  undefined
                >;
                readonly config: import('valibot').OptionalSchema<
                  import('valibot').ObjectSchema<
                    {
                      readonly type: import('valibot').OptionalSchema<
                        import('valibot').StringSchema<undefined>,
                        undefined
                      >;
                      readonly optional: import('valibot').OptionalSchema<
                        import('valibot').BooleanSchema<undefined>,
                        undefined
                      >;
                      readonly default: import('valibot').OptionalSchema<
                        import('valibot').StringSchema<undefined>,
                        undefined
                      >;
                      readonly assert: import('valibot').OptionalSchema<
                        import('valibot').StringSchema<undefined>,
                        undefined
                      >;
                      readonly readonly: import('valibot').OptionalSchema<
                        import('valibot').BooleanSchema<undefined>,
                        undefined
                      >;
                      readonly permissions: import('valibot').OptionalSchema<
                        import('valibot').StringSchema<undefined>,
                        undefined
                      >;
                      readonly flexible: import('valibot').OptionalSchema<
                        import('valibot').BooleanSchema<undefined>,
                        undefined
                      >;
                    },
                    undefined
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
          readonly config: import('valibot').OptionalSchema<
            import('valibot').ObjectSchema<
              {
                readonly schema: import('valibot').OptionalSchema<
                  import('valibot').StringSchema<undefined>,
                  undefined
                >;
                readonly type: import('valibot').OptionalSchema<
                  import('valibot').StringSchema<undefined>,
                  undefined
                >;
                readonly in: import('valibot').OptionalSchema<
                  import('valibot').StringSchema<undefined>,
                  undefined
                >;
                readonly out: import('valibot').OptionalSchema<
                  import('valibot').StringSchema<undefined>,
                  undefined
                >;
                readonly indexes: import('valibot').OptionalSchema<
                  import('valibot').ArraySchema<
                    import('valibot').ObjectSchema<
                      {
                        readonly name: import('valibot').StringSchema<undefined>;
                        readonly fields: import('valibot').ArraySchema<
                          import('valibot').StringSchema<undefined>,
                          undefined
                        >;
                        readonly type: import('valibot').OptionalSchema<
                          import('valibot').StringSchema<undefined>,
                          undefined
                        >;
                      },
                      undefined
                    >,
                    undefined
                  >,
                  undefined
                >;
                readonly permissions: import('valibot').OptionalSchema<
                  import('valibot').StringSchema<undefined>,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
        },
        undefined
      >,
      undefined
    >;
    readonly access: import('valibot').OptionalSchema<
      import('valibot').ArraySchema<
        import('valibot').ObjectSchema<
          {
            readonly name: import('valibot').StringSchema<undefined>;
            readonly type: import('valibot').UnionSchema<
              [
                import('valibot').LiteralSchema<'RECORD', undefined>,
                import('valibot').LiteralSchema<'JWT', undefined>,
                import('valibot').LiteralSchema<'OIDC', undefined>,
              ],
              undefined
            >;
            readonly table: import('valibot').OptionalSchema<
              import('valibot').StringSchema<undefined>,
              undefined
            >;
            readonly signup: import('valibot').OptionalSchema<
              import('valibot').StringSchema<undefined>,
              undefined
            >;
            readonly signin: import('valibot').OptionalSchema<
              import('valibot').StringSchema<undefined>,
              undefined
            >;
            readonly identifier: import('valibot').OptionalSchema<
              import('valibot').StringSchema<undefined>,
              undefined
            >;
            readonly algorithm: import('valibot').OptionalSchema<
              import('valibot').UnionSchema<
                [
                  import('valibot').LiteralSchema<'HS256', undefined>,
                  import('valibot').LiteralSchema<'HS512', undefined>,
                ],
                undefined
              >,
              undefined
            >;
            readonly key: import('valibot').OptionalSchema<
              import('valibot').StringSchema<undefined>,
              undefined
            >;
            readonly issuer: import('valibot').OptionalSchema<
              import('valibot').StringSchema<undefined>,
              undefined
            >;
            readonly duration: import('valibot').OptionalSchema<
              import('valibot').StringSchema<undefined>,
              undefined
            >;
            readonly tokenDuration: import('valibot').OptionalSchema<
              import('valibot').StringSchema<undefined>,
              undefined
            >;
          },
          undefined
        >,
        undefined
      >,
      undefined
    >;
  },
  undefined
>;
export type SchemaFiles = InferOutput<typeof SchemaFilesSchema>;
//# sourceMappingURL=migration-schema.d.ts.map
