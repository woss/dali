import { Surreal } from 'surrealdb';

const db = new Surreal();
await db.connect('ws://localhost:10101/rpc', {
  namespace: 'memory',
  database: 'memory',
  authentication: { username: 'admin', password: 'admin' },
});

await db.query(`DEFINE FIELD IF NOT EXISTS chunk_index ON TABLE embeddings TYPE option<int>`);
await db.query(`DEFINE FIELD IF NOT EXISTS chunk_text ON TABLE embeddings TYPE option<string>`);
await db.query(`DEFINE FIELD IF NOT EXISTS section ON TABLE embeddings TYPE option<string>`);
console.log('Missing fields added to embeddings table');
await db.close();
