import { defineTable, defineRelationTable } from '@woss/dali-orm/sdk/table';
import {
  string,
  datetime,
  bool,
  array,
  object,
  int,
} from '@woss/dali-orm/sdk/schema/column/simple-builders';
import { record } from '@woss/dali-orm/sdk/schema/column/record';
import { createOrmSchema } from '@woss/dali-orm/sdk/orm-schema';
import { defineAccess } from '@woss/dali-orm/sdk/schema';

// ---- Workspaces ----
export const workspacesTable = defineTable(
  'workspaces',
  {
    name: string('name'),
    description: string('description').optional(),
    is_personal: bool('is_personal').default(false),
    user_id: record('users').optional(),
    created_at: datetime('created_at').defaultNow(),
    deleted_at: datetime('deleted_at').optional(),
  },
  {
    indexes: [{ name: 'idx_workspaces_name', fields: ['name', 'user_id'], type: 'unique' as const }],
  },
);

// ---- Memories ----
export const memoriesTable = defineTable(
  'memories',
  {
    name: string('name'),
    content: string('content'),
    memory_type: string('memory_type').default('fact'),
    metadata: object('metadata').optional(),
    workspace_id: record('workspaces'),
    created_at: datetime('created_at').defaultNow(),
  },
  {
    indexes: [
      { name: 'idx_memories_name_ws', fields: ['name', 'workspace_id'], type: 'unique' as const },
      {
        name: 'idx_memories_content_ws',
        fields: ['content', 'workspace_id'],
        type: 'unique' as const,
      },
      {
        name: 'idx_memories_content_ft',
        fields: ['content'],
        type: 'fulltext' as const,
        analyzer: 'fts_ascii' as const,
      },
    ],
  },
);

// ---- Embeddings ----
export const embeddingsTable = defineTable(
  'embeddings',
  {
    vector: array('vector'),
    model: record('models'),
    chunk_index: int('chunk_index').optional(),
    chunk_text: string('chunk_text').optional(),
    section: string('section').optional(),
    created_at: datetime('created_at').defaultNow(),
  },
  // No HNSW index here — created dynamically per model dimension at model registration time (option 2)
);

// ---- Models ----
export const modelsTable = defineTable(
  'models',
  {
    provider_id: string('provider_id'),
    model_id: string('model_id'),
    variant: string('variant').optional(),
    dimensions: int('dimensions'),
    created_at: datetime('created_at').defaultNow(),
  },
  {
    indexes: [
      {
        name: 'idx_models_provider_model',
        fields: ['provider_id', 'model_id'],
        type: 'unique' as const,
      },
    ],
  },
);

// ---- Embedding-Memory Relation ----
export const hasEmbeddingTable = defineRelationTable(
  'has_embedding',
  {},
  {
    in: 'embeddings',
    out: 'memories',
  },
);

// ---- Tags ----
export const tagsTable = defineTable(
  'tags',
  {
    name: string('name'),
  },
  {
    indexes: [{ name: 'idx_tags_name', fields: ['name'], type: 'unique' as const }],
  },
);

// ---- Memory-Tag Relation ----
export const memoryTagsTable = defineRelationTable(
  'memory_tags',
  {
    in: record('memories'),
    out: record('tags'),
  },
  {
    in: 'memories',
    out: 'tags',
    indexes: [{ name: 'idx_memory_tags_pair', fields: ['in', 'out'], type: 'unique' as const }],
  },
);

// ---- User-Memory Relation ----
export const hasMemoryTable = defineRelationTable(
  'has_memory',
  {},
  {
    in: 'users',
    out: 'memories',
  },
);

// ---- API Keys ----
export const apiKeysTable = defineTable(
  'api_keys',
  {
    key_hash: string('key_hash'),
    name: string('name'),
    created_at: datetime('created_at').defaultNow(),
    last_used_at: datetime('last_used_at').optional(),
    user_id: record('users').optional(),
  },
  {
    indexes: [{ name: 'idx_api_keys_hash', fields: ['key_hash'], type: 'unique' as const }],
  },
);

// ---- Users ----
export const usersTable = defineTable(
  'users',
  {
    email: string('email'),
    pass: string('pass'),
    name: string('name').optional(),
    default_workspace_id: record('workspaces').optional(),
    created_at: datetime('created_at').defaultNow(),
  },
  {
    indexes: [{ name: 'idx_users_email', fields: ['email'], type: 'unique' as const }],
  },
);

export const userAccess = defineAccess('user_access')
  .type('RECORD')
  .signup('CREATE users SET email = $email, pass = crypto::argon2::generate($pass)')
  .signin('SELECT * FROM users WHERE email = $email AND crypto::argon2::compare(pass, $pass)')
  .duration('30d')
  .tokenDuration('1h')
  .build();

// ---- Complete schema ----
export const schema = createOrmSchema({
  tables: {
    workspaces: workspacesTable,
    memories: memoriesTable,
    embeddings: embeddingsTable,
    models: modelsTable,
    has_embedding: hasEmbeddingTable,
    tags: tagsTable,
    memory_tags: memoryTagsTable,
    has_memory: hasMemoryTable,
    api_keys: apiKeysTable,
    users: usersTable,
  },
  access: [userAccess],
  analyzers: [{ name: 'fts_ascii', tokenizers: ['class'], filters: ['ascii', 'lowercase'] }],
});
