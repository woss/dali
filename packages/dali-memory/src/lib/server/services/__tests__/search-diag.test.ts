import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import { RecordId } from 'surrealdb';
import { DaliORM } from '@woss/dali-orm';
import { pushSchemaFromTableDefs } from '@woss/dali-orm/migration/api';
import { schema } from '../../db/schema';
import { MemoryService } from '../memory';

const { mockState } = (vi as any).hoisted(() => ({
  mockState: {
    orm: null as any,
    embed: vi.fn(),
    embedBatch: vi.fn(),
  },
}));

vi.mock('../../db/connection', () => ({
  getDB: () => {
    if (!mockState.orm) throw new Error('DB not initialized');
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
    DALI_MEMORY_SECRET: 'test-secret',
    DALI_MEMORY_EMBEDDING_MODEL: 'Xenova/all-MiniLM-L6-v2',
    DALI_MEMORY_SURREAL_URL: 'ws://localhost:10101',
    DALI_MEMORY_SURREAL_NS: 'memory',
    DALI_MEMORY_SURREAL_DB: 'memory',
    DALI_MEMORY_SURREAL_USER: 'root',
    DALI_MEMORY_SURREAL_PASS: 'root',
  },
}));

let orm: DaliORM;
let wsId: string;
const EMBED = Array.from({ length: 384 }, (_, i) => (i % 10) / 10);

beforeAll(async () => {
  orm = await DaliORM.connect({
    embeddedDriver: { driver: 'embedded', mode: 'memory' },
  });
  await orm.query('DEFINE ANALYZER fts_ascii TOKENIZERS class FILTERS ascii, lowercase');
  await pushSchemaFromTableDefs(orm.getDriver(), schema.getTables());
  await orm.query('DEFINE FIELD metadata.source ON memories TYPE option<string>');
  await orm.query('CREATE workspaces:default SET name = "default", is_personal = true');
  wsId = 'workspaces:default';
  mockState.orm = orm;
  mockState.embed.mockResolvedValue({ embedding: EMBED, model: 'test-model', dimensions: 384 });
  mockState.embedBatch.mockResolvedValue([{ embedding: EMBED, model: 'test-model', dimensions: 384 }]);
});

afterAll(async () => {
  if (orm) await orm.disconnect();
});

describe('searchSimilar diagnostics', () => {
  test('direct query returns results (no workspace filter, embedded engine)', async () => {
    await orm.query('DELETE has_embedding');
    await orm.query('DELETE embeddings');
    await orm.query('DELETE memories');

    await orm.query("CREATE models:test SET provider_id = 'test', model_id = 'test', dimensions = 384");
    await orm.query("CREATE memories:m1 SET content = 'test', workspace_id = workspaces:default, name = 'mem1', memory_type = 'fact', metadata = {}, created_at = time::now()");
    await orm.query("CREATE embeddings:e1 SET vector = $emb, model = models:test, dimensions = 384, chunk_index = NONE, chunk_text = NONE, section = NONE", { emb: EMBED });
    await orm.query('RELATE embeddings:e1 -> has_embedding -> memories:m1');

    // Direct query without workspace filter — works in embedded engine
    const sql = `SELECT id, vector::similarity::cosine(vector, $queryEmbedding) AS score 
FROM embeddings ORDER BY score DESC LIMIT 10`;
    const rows = await orm.query(sql, { queryEmbedding: EMBED });
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  test('createMemory -> searchSimilar works', async () => {
    await orm.query('DELETE has_embedding');
    await orm.query('DELETE embeddings');
    await orm.query('DELETE memories');

    const service = new MemoryService(new (await vi.importMock('../../embedder/index').then((m: any) => m.EmbedderService))());
    const mem: any = await service.createMemory({
      name: 'diag-test',
      content: 'diagnostic test content for search',
      workspace_id: wsId,
    });
    console.log('   Created memory slug:', mem.slug);

    const results: any[] = await service.searchSimilar(EMBED, { workspaceId: wsId, limit: 10 });
    console.log('   searchSimilar results:', results.length);
    if (results.length === 0) {
      // Raw query to debug
      const sql = `SELECT id, vector::similarity::cosine(vector, $queryEmbedding) AS score
FROM embeddings
WHERE ->has_embedding.out.workspace_id = $workspaceId OR $workspaceId IS NONE
ORDER BY score DESC LIMIT 10`;
      const rows = await orm.query(sql, { queryEmbedding: EMBED, workspaceId: 'workspaces:default' });
      console.log('   Raw query results:', rows.length);
      if (rows.length > 0) console.log('   Raw first:', JSON.stringify(rows[0]));

      // Try without where
      const sql2 = `SELECT id, vector::similarity::cosine(vector, $queryEmbedding) AS score
FROM embeddings
ORDER BY score DESC LIMIT 10`;
      const rows2 = await orm.query(sql2, { queryEmbedding: EMBED });
      console.log('   No WHERE results:', rows2.length, JSON.stringify(rows2));

      // Check edges
      const edges = await orm.query('SELECT * FROM has_embedding');
      console.log('   Edges:', JSON.stringify(edges));
      
      // Check traverse
      const tr = await orm.query("SELECT ->has_embedding.out.workspace_id AS ws FROM embeddings LIMIT 5");
      console.log('   Traverse:', JSON.stringify(tr));
    }
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});
