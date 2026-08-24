import * as v from 'valibot';

// Permission type (info.md lines 84-92)
export const PermissionSchema = v.union([v.boolean(), v.string()]);

// FieldPermissions (info.md lines 76-81)
export const FieldPermissionsSchema = v.object({
  select: PermissionSchema,
  create: PermissionSchema,
  update: PermissionSchema,
});

// Reference (info.md lines 95-106)
export const ReferenceSchema = v.object({
  on_delete: v.string(),
});

// FieldDefinition (info.md lines 59-81)
export const FieldDefinitionSchema = v.object({
  name: v.string(),
  table: v.optional(v.string(), ''),
  kind: v.optional(v.string()),
  flex: v.optional(v.literal(true)),
  value: v.optional(v.string()),
  assert: v.optional(v.string()),
  computed: v.optional(v.string()),
  default_always: v.optional(v.boolean()),
  default: v.optional(v.string()),
  reference: v.optional(ReferenceSchema),
  readonly: v.optional(v.boolean(), false),
  permissions: v.optional(FieldPermissionsSchema, {
    select: false,
    create: false,
    update: false,
  }),
  comment: v.optional(v.string()),
});

// EventSync (info.md lines 163-171)
export const EventSyncSchema = v.object({
  name: v.string(),
  what: v.string(),
  when: v.string(),
  then: v.array(v.string()),
  comment: v.optional(v.string()),
});

// EventAsync (info.md lines 173-183)
export const EventAsyncSchema = v.object({
  name: v.string(),
  what: v.string(),
  when: v.string(),
  then: v.array(v.string()),
  async: v.literal(true),
  retry: v.number(),
  maxdepth: v.number(),
  comment: v.optional(v.string()),
});

// EventDefinition — discriminate via 'async' in event
// Catch-all record schema handles events that don't match sync/async (rare edge case)
export const EventDefinitionSchema = v.union([
  EventAsyncSchema,
  EventSyncSchema,
  v.record(v.string(), v.any()),
]);
export type EventDefinition = v.InferOutput<typeof EventDefinitionSchema>;

// IndexDefinition (info.md lines 196-204)
export const IndexDefinitionSchema = v.object({
  name: v.string(),
  table: v.optional(v.string(), ''),
  cols: v.array(v.string()),
  index: v.string(),
  comment: v.optional(v.string()),
  prepare_remove: v.optional(v.literal(true)),
  // HNSW vector index fields
  dimension: v.optional(v.number()),
  vectorType: v.optional(v.string()),
  distance: v.optional(v.string()),
});

// SubscriptionDefinition (info.md lines 227-235)
export const SubscriptionDefinitionSchema = v.object({
  id: v.string(),
  node: v.string(),
  fields: v.union([v.literal('diff'), v.string()]),
  what: v.string(),
  cond: v.optional(v.string()),
  fetch: v.optional(v.string()),
});

// Top-level InfoForTable (info.md lines 36-43)
export const InfoForTableSchema = v.object({
  events: v.optional(v.array(EventDefinitionSchema), []),
  fields: v.optional(v.array(FieldDefinitionSchema), []),
  indexes: v.optional(v.array(IndexDefinitionSchema), []),
  lives: v.optional(v.array(SubscriptionDefinitionSchema), []),
  tables: v.optional(v.array(v.string()), []),
});
