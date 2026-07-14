import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import { RecordId } from 'surrealdb';
import { DaliORM } from '@woss/dali-orm';
import { pushSchemaFromTableDefs } from '@woss/dali-orm/migration/api';
import { schema } from '../../db/schema';
import { MemoryService } from '../memory';

const { mockState } = (vi as any).hoisted(() => ({
  mockState: { orm: null as any, embed: vi.fn(), embedBatch: vi.fn() },
}));

vi.mock('../../db/connection', () => ({
  getDB: () => {
    if (!mockState.orm) throw new Error('no db');
    return mockState.orm;
  },
}));

vi.mock('../../embedder/index', () => ({
  EmbedderService: vi.fn().mockImplementation(function () {
    return {
      initialize: vi.fn().mockResolvedValue(undefined),
      embed: mockState.embed,
      embedBatch: mockState.embedBatch,
    };
  }),
}));

vi.mock('$env/dynamic/private', () => ({
  env: {
    DALI_MEMORY_SECRET: 'x',
    DALI_MEMORY_EMBEDDING_MODEL: 'x',
    DALI_MEMORY_SURREAL_URL: 'x',
    DALI_MEMORY_SURREAL_NS: 'x',
    DALI_MEMORY_SURREAL_DB: 'x',
    DALI_MEMORY_SURREAL_USER: 'x',
    DALI_MEMORY_SURREAL_PASS: 'x',
  },
}));

let orm: DaliORM;
let wsId: string;
let wsRid: RecordId;
const EMBED = Array.from({ length: 384 }, (_, i) => (i % 10) / 10);

beforeAll(async () => {
  orm = await DaliORM.connect({ embeddedDriver: { driver: 'embedded', mode: 'memory' } });
  await orm.query('DEFINE ANALYZER fts_ascii TOKENIZERS class FILTERS ascii, lowercase');
  await pushSchemaFromTableDefs(orm.getDriver(), schema.getTables());
  await orm.query('DEFINE FIELD metadata.source ON memories TYPE option<string>');
  await orm.query('CREATE workspaces:default SET name = "default", is_personal = true');
  wsId = 'workspaces:default';
  wsRid = new RecordId('workspaces', 'default');
  mockState.orm = orm;
  mockState.embed.mockResolvedValue({ embedding: EMBED, model: 'test-model', dimensions: 384 });
  mockState.embedBatch.mockResolvedValue([
    { embedding: EMBED, model: 'test-model', dimensions: 384 },
  ]);
});

afterAll(async () => {
  if (orm) await orm.disconnect();
});

const sql = (where: string) =>
  `SELECT id, vector::similarity::cosine(vector, $queryEmbedding) AS score
FROM embeddings
WHERE ${where} OR $workspaceId IS NONE
ORDER BY score DESC LIMIT 10`;

describe('SQL variants', () => {
  test('CONTAINS string', async () => {
    await orm.query('DELETE has_embedding');
    await orm.query('DELETE embeddings');
    await orm.query('DELETE memories');
    await orm.query(
      "CREATE memories:m1 SET content='a', workspace_id=workspaces:default, name='m1'",
    );
    await orm.query(
      'CREATE embeddings:e1 SET vector=$emb, model=$mId, chunk_index=NONE, chunk_text=NONE, section=NONE',
      { emb: EMBED, mId: new RecordId('models', 'test') },
    );
    await orm.query('RELATE embeddings:e1 -> has_embedding -> memories:m1');

    // Get models ID
    const models = await (orm as any).query('SELECT id FROM models LIMIT 1');
    if (models.length > 0) {
      await orm.query('DELETE embeddings; DELETE has_embedding');
      await orm.query('CREATE embeddings:e1 SET vector=$emb, model=$mId', {
        emb: EMBED,
        mId: models[0].id,
      });
      await orm.query('RELATE embeddings:e1 -> has_embedding -> memories:m1');
    }

    const rows = await orm.query(sql(`->has_embedding.out.workspace_id CONTAINS $workspaceId`), {
      queryEmbedding: EMBED,
      workspaceId: wsId,
    });
    console.log('CONTAINS string:', rows.length, JSON.stringify(rows));

    const rows2 = await orm.query(sql(`->has_embedding.out.workspace_id CONTAINS $wsRid`), {
      queryEmbedding: EMBED,
      wsRid,
      workspaceId: null,
    });
    console.log('CONTAINS RecordId:', rows2.length, JSON.stringify(rows2));

    const rows3 = await orm.query(sql(`$workspaceId INSIDE ->has_embedding.out.workspace_id`), {
      queryEmbedding: EMBED,
      workspaceId: wsId,
    });
    console.log('INSIDE string:', rows3.length, JSON.stringify(rows3));

    const rows4 = await orm.query(sql(`$wsRid INSIDE ->has_embedding.out.workspace_id`), {
      queryEmbedding: EMBED,
      wsRid,
      workspaceId: null,
    });
    console.log('INSIDE RecordId:', rows4.length, JSON.stringify(rows4));

    // Test using RecordId
    const sql5 = `SELECT id, vector::similarity::cosine(vector, $queryEmbedding) AS score
FROM embeddings
WHERE (SELECT VALUE workspace_id FROM ->has_embedding.out LIMIT 1)[0] = $workspaceId OR $workspaceId IS NONE
ORDER BY score DESC LIMIT 10`;
    const rows5 = await orm.query(sql5, { queryEmbedding: EMBED, workspaceId: wsId });
    console.log('Subquery [0]:', rows5.length, JSON.stringify(rows5));

    // Test: separate queries
    const sql6 = `SELECT id, vector::similarity::cosine(vector, $queryEmbedding) AS score
FROM embeddings
WHERE id IN (SELECT in FROM has_embedding) AND $workspaceId IS NONE
ORDER BY score DESC LIMIT 10`;
    const rows6 = await orm.query(sql6, { queryEmbedding: EMBED, workspaceId: null });
    console.log('IN subquery (no WS filter):', rows6.length, JSON.stringify(rows6));

    // Test: retrieve emb IDs then filter
    const edges = await orm.query('SELECT in FROM has_embedding WHERE out.workspace_id = $ws', {
      ws: wsRid,
    });
    console.log(
      'Edge query WHERE out.workspace_id = RecordId:',
      edges.length,
      JSON.stringify(edges),
    );

    const edges2 = await orm.query('SELECT in FROM has_embedding WHERE out.workspace_id = $ws', {
      ws: wsId,
    });
    console.log(
      'Edge query WHERE out.workspace_id = string:',
      edges2.length,
      JSON.stringify(edges2),
    );
  });
});
