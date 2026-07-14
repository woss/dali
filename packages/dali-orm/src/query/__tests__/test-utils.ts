import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { EmbeddedDriver } from '../../sdk/driver/embedded-driver.js';
import type { SurrealDriver } from '../../sdk/driver/types.js';
import { bool, datetime, int, record, string } from '../../sdk/schema/column/index.js';
import { defineRelationTable, defineTable } from '../../sdk/table.js';
import {
  bindTable,
  columnRef,
  create,
  delete_,
  graphPath,
  insert,
  relate,
  select,
  update,
  upsert,
  WhereBuilder,
} from '../index.js';

// ============================================================================
// Test Setup
// ============================================================================

function createTestDriver(): EmbeddedDriver {
  return new EmbeddedDriver({
    driver: 'embedded',
    namespace: 'test_ns',
    database: 'test_db',
    mode: 'memory',
  });
}

/** Create isolated test driver with auto-cleanup */
async function setupTestDb(): Promise<{ driver: EmbeddedDriver; cleanup: () => Promise<void> }> {
  const d = createTestDriver();
  await d.connect();
  return {
    driver: d,
    cleanup: async () => {
      await d.disconnect();
    },
  };
}

// Table definitions for query builders
const users = defineTable('user', {
  name: string('name'),
  email: string('email'),
  age: int('age'),
  active: bool('active'),
  createdAt: datetime('createdAt'),
});

const posts = defineTable('post', {
  title: string('title'),
  content: string('content'),
  published: bool('published'),
  authorId: string('authorId'),
});

const wrote = defineRelationTable('wrote', {}, { in: 'user', out: 'post' });

// Edge table WITH typed columns for typed RelateBuilder testing
const review = defineRelationTable(
  'review',
  { rating: int('rating').optional(), comment: string('comment').optional() },
  { in: 'user', out: 'post' },
);

// Multi IN/OUT relation tables for testing (TASK-044)
const wroteMultiIn = defineRelationTable(
  'wrote_multi_in',
  {},
  { in: ['user', 'admin'], out: 'post' },
);
const wroteMultiOut = defineRelationTable(
  'wrote_multi_out',
  {},
  { in: 'user', out: ['post', 'article'] },
);
const wroteMultiBoth = defineRelationTable(
  'wrote_multi_both',
  {},
  { in: ['user', 'admin'], out: ['post', 'article'] },
);

// Helper to define tables in SurrealDB
async function defineTables(driver: SurrealDriver) {
  await driver.query('DEFINE TABLE user SCHEMAFULL');
  await driver.query('DEFINE FIELD name ON user TYPE string');
  await driver.query('DEFINE FIELD email ON user TYPE option<string>');
  await driver.query('DEFINE FIELD age ON user TYPE option<int>');
  await driver.query('DEFINE FIELD active ON user TYPE bool DEFAULT true');
  await driver.query('DEFINE FIELD createdAt ON user TYPE datetime DEFAULT time::now()');

  await driver.query('DEFINE TABLE post SCHEMAFULL');
  await driver.query('DEFINE FIELD title ON post TYPE string');
  await driver.query('DEFINE FIELD content ON post TYPE option<string>');
  await driver.query('DEFINE FIELD published ON post TYPE bool DEFAULT false');
  await driver.query('DEFINE FIELD authorId ON post TYPE option<string>');

  await driver.query('DEFINE TABLE wrote TYPE RELATION IN user OUT post SCHEMAFULL');
  await driver.query('DEFINE TABLE review TYPE RELATION IN user OUT post SCHEMAFULL');
  await driver.query('DEFINE FIELD rating ON review TYPE option<int>');
  await driver.query('DEFINE FIELD comment ON review TYPE option<string>');
  await driver.query(
    'DEFINE TABLE wrote_multi_in TYPE RELATION IN user IN admin OUT post SCHEMAFULL',
  );
  await driver.query(
    'DEFINE TABLE wrote_multi_out TYPE RELATION IN user OUT post OUT article SCHEMAFULL',
  );
  await driver.query(
    'DEFINE TABLE wrote_multi_both TYPE RELATION IN user IN admin OUT post OUT article SCHEMAFULL',
  );
}

export {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  EmbeddedDriver,
  createTestDriver,
  setupTestDb,
  users,
  posts,
  wrote,
  review,
  wroteMultiIn,
  wroteMultiOut,
  wroteMultiBoth,
  bool,
  datetime,
  int,
  record,
  string,
  defineRelationTable,
  defineTable,
  bindTable,
  columnRef,
  create,
  delete_,
  graphPath,
  insert,
  relate,
  select,
  update,
  upsert,
  WhereBuilder,
  defineTables,
};
