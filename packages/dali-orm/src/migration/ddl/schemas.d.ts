import * as v from 'valibot';
export declare const PermissionSchema: v.UnionSchema<
  [v.BooleanSchema<undefined>, v.StringSchema<undefined>],
  undefined
>;
export declare const FieldPermissionsSchema: v.ObjectSchema<
  {
    readonly select: v.UnionSchema<
      [v.BooleanSchema<undefined>, v.StringSchema<undefined>],
      undefined
    >;
    readonly create: v.UnionSchema<
      [v.BooleanSchema<undefined>, v.StringSchema<undefined>],
      undefined
    >;
    readonly update: v.UnionSchema<
      [v.BooleanSchema<undefined>, v.StringSchema<undefined>],
      undefined
    >;
  },
  undefined
>;
export declare const ReferenceSchema: v.ObjectSchema<
  {
    readonly on_delete: v.StringSchema<undefined>;
  },
  undefined
>;
export declare const FieldDefinitionSchema: v.ObjectSchema<
  {
    readonly name: v.StringSchema<undefined>;
    readonly table: v.OptionalSchema<v.StringSchema<undefined>, ''>;
    readonly kind: v.OptionalSchema<v.StringSchema<undefined>, undefined>;
    readonly flex: v.OptionalSchema<
      v.LiteralSchema<true, undefined>,
      undefined
    >;
    readonly value: v.OptionalSchema<v.StringSchema<undefined>, undefined>;
    readonly assert: v.OptionalSchema<v.StringSchema<undefined>, undefined>;
    readonly computed: v.OptionalSchema<v.StringSchema<undefined>, undefined>;
    readonly default_always: v.OptionalSchema<
      v.BooleanSchema<undefined>,
      undefined
    >;
    readonly default: v.OptionalSchema<v.StringSchema<undefined>, undefined>;
    readonly reference: v.OptionalSchema<
      v.ObjectSchema<
        {
          readonly on_delete: v.StringSchema<undefined>;
        },
        undefined
      >,
      undefined
    >;
    readonly readonly: v.OptionalSchema<v.BooleanSchema<undefined>, false>;
    readonly permissions: v.OptionalSchema<
      v.ObjectSchema<
        {
          readonly select: v.UnionSchema<
            [v.BooleanSchema<undefined>, v.StringSchema<undefined>],
            undefined
          >;
          readonly create: v.UnionSchema<
            [v.BooleanSchema<undefined>, v.StringSchema<undefined>],
            undefined
          >;
          readonly update: v.UnionSchema<
            [v.BooleanSchema<undefined>, v.StringSchema<undefined>],
            undefined
          >;
        },
        undefined
      >,
      {
        readonly select: false;
        readonly create: false;
        readonly update: false;
      }
    >;
    readonly comment: v.OptionalSchema<v.StringSchema<undefined>, undefined>;
  },
  undefined
>;
export declare const EventSyncSchema: v.ObjectSchema<
  {
    readonly name: v.StringSchema<undefined>;
    readonly what: v.StringSchema<undefined>;
    readonly when: v.StringSchema<undefined>;
    readonly then: v.ArraySchema<v.StringSchema<undefined>, undefined>;
    readonly comment: v.OptionalSchema<v.StringSchema<undefined>, undefined>;
  },
  undefined
>;
export declare const EventAsyncSchema: v.ObjectSchema<
  {
    readonly name: v.StringSchema<undefined>;
    readonly what: v.StringSchema<undefined>;
    readonly when: v.StringSchema<undefined>;
    readonly then: v.ArraySchema<v.StringSchema<undefined>, undefined>;
    readonly async: v.LiteralSchema<true, undefined>;
    readonly retry: v.NumberSchema<undefined>;
    readonly maxdepth: v.NumberSchema<undefined>;
    readonly comment: v.OptionalSchema<v.StringSchema<undefined>, undefined>;
  },
  undefined
>;
export declare const EventDefinitionSchema: v.UnionSchema<
  [
    v.ObjectSchema<
      {
        readonly name: v.StringSchema<undefined>;
        readonly what: v.StringSchema<undefined>;
        readonly when: v.StringSchema<undefined>;
        readonly then: v.ArraySchema<v.StringSchema<undefined>, undefined>;
        readonly async: v.LiteralSchema<true, undefined>;
        readonly retry: v.NumberSchema<undefined>;
        readonly maxdepth: v.NumberSchema<undefined>;
        readonly comment: v.OptionalSchema<
          v.StringSchema<undefined>,
          undefined
        >;
      },
      undefined
    >,
    v.ObjectSchema<
      {
        readonly name: v.StringSchema<undefined>;
        readonly what: v.StringSchema<undefined>;
        readonly when: v.StringSchema<undefined>;
        readonly then: v.ArraySchema<v.StringSchema<undefined>, undefined>;
        readonly comment: v.OptionalSchema<
          v.StringSchema<undefined>,
          undefined
        >;
      },
      undefined
    >,
    v.RecordSchema<v.StringSchema<undefined>, v.AnySchema, undefined>,
  ],
  undefined
>;
export type EventDefinition = v.InferOutput<typeof EventDefinitionSchema>;
export declare const IndexDefinitionSchema: v.ObjectSchema<
  {
    readonly name: v.StringSchema<undefined>;
    readonly table: v.OptionalSchema<v.StringSchema<undefined>, ''>;
    readonly cols: v.ArraySchema<v.StringSchema<undefined>, undefined>;
    readonly index: v.StringSchema<undefined>;
    readonly comment: v.OptionalSchema<v.StringSchema<undefined>, undefined>;
    readonly prepare_remove: v.OptionalSchema<
      v.LiteralSchema<true, undefined>,
      undefined
    >;
    readonly dimension: v.OptionalSchema<v.NumberSchema<undefined>, undefined>;
    readonly vectorType: v.OptionalSchema<v.StringSchema<undefined>, undefined>;
    readonly distance: v.OptionalSchema<v.StringSchema<undefined>, undefined>;
  },
  undefined
>;
export declare const SubscriptionDefinitionSchema: v.ObjectSchema<
  {
    readonly id: v.StringSchema<undefined>;
    readonly node: v.StringSchema<undefined>;
    readonly fields: v.UnionSchema<
      [v.LiteralSchema<'diff', undefined>, v.StringSchema<undefined>],
      undefined
    >;
    readonly what: v.StringSchema<undefined>;
    readonly cond: v.OptionalSchema<v.StringSchema<undefined>, undefined>;
    readonly fetch: v.OptionalSchema<v.StringSchema<undefined>, undefined>;
  },
  undefined
>;
export declare const InfoForTableSchema: v.ObjectSchema<
  {
    readonly events: v.OptionalSchema<
      v.ArraySchema<
        v.UnionSchema<
          [
            v.ObjectSchema<
              {
                readonly name: v.StringSchema<undefined>;
                readonly what: v.StringSchema<undefined>;
                readonly when: v.StringSchema<undefined>;
                readonly then: v.ArraySchema<
                  v.StringSchema<undefined>,
                  undefined
                >;
                readonly async: v.LiteralSchema<true, undefined>;
                readonly retry: v.NumberSchema<undefined>;
                readonly maxdepth: v.NumberSchema<undefined>;
                readonly comment: v.OptionalSchema<
                  v.StringSchema<undefined>,
                  undefined
                >;
              },
              undefined
            >,
            v.ObjectSchema<
              {
                readonly name: v.StringSchema<undefined>;
                readonly what: v.StringSchema<undefined>;
                readonly when: v.StringSchema<undefined>;
                readonly then: v.ArraySchema<
                  v.StringSchema<undefined>,
                  undefined
                >;
                readonly comment: v.OptionalSchema<
                  v.StringSchema<undefined>,
                  undefined
                >;
              },
              undefined
            >,
            v.RecordSchema<v.StringSchema<undefined>, v.AnySchema, undefined>,
          ],
          undefined
        >,
        undefined
      >,
      readonly []
    >;
    readonly fields: v.OptionalSchema<
      v.ArraySchema<
        v.ObjectSchema<
          {
            readonly name: v.StringSchema<undefined>;
            readonly table: v.OptionalSchema<v.StringSchema<undefined>, ''>;
            readonly kind: v.OptionalSchema<
              v.StringSchema<undefined>,
              undefined
            >;
            readonly flex: v.OptionalSchema<
              v.LiteralSchema<true, undefined>,
              undefined
            >;
            readonly value: v.OptionalSchema<
              v.StringSchema<undefined>,
              undefined
            >;
            readonly assert: v.OptionalSchema<
              v.StringSchema<undefined>,
              undefined
            >;
            readonly computed: v.OptionalSchema<
              v.StringSchema<undefined>,
              undefined
            >;
            readonly default_always: v.OptionalSchema<
              v.BooleanSchema<undefined>,
              undefined
            >;
            readonly default: v.OptionalSchema<
              v.StringSchema<undefined>,
              undefined
            >;
            readonly reference: v.OptionalSchema<
              v.ObjectSchema<
                {
                  readonly on_delete: v.StringSchema<undefined>;
                },
                undefined
              >,
              undefined
            >;
            readonly readonly: v.OptionalSchema<
              v.BooleanSchema<undefined>,
              false
            >;
            readonly permissions: v.OptionalSchema<
              v.ObjectSchema<
                {
                  readonly select: v.UnionSchema<
                    [v.BooleanSchema<undefined>, v.StringSchema<undefined>],
                    undefined
                  >;
                  readonly create: v.UnionSchema<
                    [v.BooleanSchema<undefined>, v.StringSchema<undefined>],
                    undefined
                  >;
                  readonly update: v.UnionSchema<
                    [v.BooleanSchema<undefined>, v.StringSchema<undefined>],
                    undefined
                  >;
                },
                undefined
              >,
              {
                readonly select: false;
                readonly create: false;
                readonly update: false;
              }
            >;
            readonly comment: v.OptionalSchema<
              v.StringSchema<undefined>,
              undefined
            >;
          },
          undefined
        >,
        undefined
      >,
      readonly []
    >;
    readonly indexes: v.OptionalSchema<
      v.ArraySchema<
        v.ObjectSchema<
          {
            readonly name: v.StringSchema<undefined>;
            readonly table: v.OptionalSchema<v.StringSchema<undefined>, ''>;
            readonly cols: v.ArraySchema<v.StringSchema<undefined>, undefined>;
            readonly index: v.StringSchema<undefined>;
            readonly comment: v.OptionalSchema<
              v.StringSchema<undefined>,
              undefined
            >;
            readonly prepare_remove: v.OptionalSchema<
              v.LiteralSchema<true, undefined>,
              undefined
            >;
            readonly dimension: v.OptionalSchema<
              v.NumberSchema<undefined>,
              undefined
            >;
            readonly vectorType: v.OptionalSchema<
              v.StringSchema<undefined>,
              undefined
            >;
            readonly distance: v.OptionalSchema<
              v.StringSchema<undefined>,
              undefined
            >;
          },
          undefined
        >,
        undefined
      >,
      readonly []
    >;
    readonly lives: v.OptionalSchema<
      v.ArraySchema<
        v.ObjectSchema<
          {
            readonly id: v.StringSchema<undefined>;
            readonly node: v.StringSchema<undefined>;
            readonly fields: v.UnionSchema<
              [v.LiteralSchema<'diff', undefined>, v.StringSchema<undefined>],
              undefined
            >;
            readonly what: v.StringSchema<undefined>;
            readonly cond: v.OptionalSchema<
              v.StringSchema<undefined>,
              undefined
            >;
            readonly fetch: v.OptionalSchema<
              v.StringSchema<undefined>,
              undefined
            >;
          },
          undefined
        >,
        undefined
      >,
      readonly []
    >;
    readonly tables: v.OptionalSchema<
      v.ArraySchema<v.StringSchema<undefined>, undefined>,
      readonly []
    >;
  },
  undefined
>;
//# sourceMappingURL=schemas.d.ts.map
