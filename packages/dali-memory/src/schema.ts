import { createOrmSchema } from '@woss/dali-orm';
import { record } from '@woss/dali-orm/sdk/schema/column';
import {
  array,
  bool,
  datetime,
  float,
  int,
  object,
  string,
} from '@woss/dali-orm/sdk/schema/column/simple-builders';
import { defineRelationTable, defineTable } from '@woss/dali-orm/sdk/table';

export const embeddingsSchema = defineTable('embeddings', {
  created_at: datetime('created_at').defaultNow(),
  dimensions: int('dimensions'),
  model: string('model'),
});

export const modelSchema = defineTable(
  'models',
  {
    provider_id: string('provider_id'),
    model_id: string('model_id'),
    variant: string('variant').optional(),
    created_at: datetime('created_at').defaultNow(),
  },
  {
    indexes: [
      {
        name: 'idx_models_provider_id_model_id',
        fields: ['provider_id', 'model_id'],
        type: 'unique',
      },
    ],
  },
);

export const usesModelSchema = defineRelationTable(
  'uses_model',
  {
    type: string('type'),
  },
  {
    in: 'sessions',
    out: 'models',
    indexes: [
      {
        name: 'idx_uses_model_in_out',
        fields: ['in', 'out'],
        type: 'unique',
      },
    ],
  },
);

export const factsSchema = defineTable('facts', {
  content: string('content'),
  created_at: datetime('created_at').defaultNow(),
  verified: bool('verified'),
});

export const memoriesSchema = defineTable(
  'memories',
  {
    container_tag: string('container_tag'),
    content: string('content'),
    content_hash: string('content_hash').defaultRaw('crypto::blake3(content)'),
    created_at: datetime('created_at').defaultNow(),
    is_pinned: bool('is_pinned'),
    metadata: object('metadata').flexible(),
    tags: array('tags'),
    'tags.*': string('tags.*'),
    type: string('type'),
    updated_at: datetime('updated_at').defaultNow(),
    vector: array('vector'),
    'vector.*': float('vector.*'),
  },
  {
    indexes: [
      {
        name: 'idx_memories_content_hash',
        fields: ['content_hash'],
        type: 'unique',
      },
    ],
  },
);

export const messagesSchema = defineTable('messages', {
  content: string('content'),
  created_at: datetime('created_at').defaultNow(),
  role: string('role'),
  session: record('sessions'),
});

export const projectsSchema = defineTable(
  'projects',
  {
    created_at: datetime('created_at').defaultNow(),
    directory_path: string('directory_path'),
    name: string('name'),
  },
  {
    indexes: [
      {
        name: 'idx_projects_directory_path',
        fields: ['directory_path'],
        type: 'unique',
      },
    ],
  },
);

export const sessionsSchema = defineTable('sessions', {
  created_at: datetime('created_at').defaultNow(),
  updated_at: datetime('updated_at').defaultNow(),
  slug: string('slug'),
  title: string('title'),
});

export const relatesToSchema = defineRelationTable(
  'relates_to',
  {
    type: string('type'),
  },
  { in: 'facts', out: 'memories' },
);
export const hasEmbeddingSchema = defineRelationTable(
  'has_embedding',
  {},
  { in: 'embeddings', out: 'memories' },
);

export const partOfProjectSchema = defineRelationTable(
  'part_of_project',
  {
    type: string('type'),
  },
  { out: 'memories', in: 'projects' },
);

export const partOfSessionSchema = defineRelationTable(
  'part_of_session',
  {
    type: string('type'),
  },
  { out: 'memories', in: 'sessions' },
);

// OrmSchema - complete schema definition for DaliORM initialization
export const schema = createOrmSchema({
  tables: {
    embeddings: embeddingsSchema,
    facts: factsSchema,
    memories: memoriesSchema,
    messages: messagesSchema,
    projects: projectsSchema,
    relates_to: relatesToSchema,
    part_of_project: partOfProjectSchema,
    part_of_session: partOfSessionSchema,
    has_embedding: hasEmbeddingSchema,
    sessions: sessionsSchema,
    models: modelSchema,
    uses_model: usesModelSchema,
  },
});
