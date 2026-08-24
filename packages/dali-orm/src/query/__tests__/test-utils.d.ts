import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EmbeddedDriver } from '../../sdk/driver/embedded-driver.js';
import type { SurrealDriver } from '../../sdk/driver/types.js';
import {
  bool,
  datetime,
  int,
  record,
  string,
} from '../../sdk/schema/column/index.js';
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

declare function createTestDriver(): EmbeddedDriver;
/** Create isolated test driver with auto-cleanup */
declare function setupTestDb(): Promise<{
  driver: EmbeddedDriver;
  cleanup: () => Promise<void>;
}>;
declare const users: import('../../index.js').TableDefinition & {
  _columns: {
    readonly name: import('../../sdk/schema/column/simple-builders.js').Builder<'string'>;
    readonly email: import('../../sdk/schema/column/simple-builders.js').Builder<'string'>;
    readonly age: import('../../sdk/schema/column/simple-builders.js').Builder<'int'>;
    readonly active: import('../../sdk/schema/column/simple-builders.js').Builder<'bool'>;
    readonly createdAt: import('../../sdk/schema/column/simple-builders.js').Builder<'datetime'>;
  };
  $id(id: string | number): string;
};
declare const posts: import('../../index.js').TableDefinition & {
  _columns: {
    readonly title: import('../../sdk/schema/column/simple-builders.js').Builder<'string'>;
    readonly content: import('../../sdk/schema/column/simple-builders.js').Builder<'string'>;
    readonly published: import('../../sdk/schema/column/simple-builders.js').Builder<'bool'>;
    readonly authorId: import('../../sdk/schema/column/simple-builders.js').Builder<'string'>;
  };
  $id(id: string | number): string;
};
declare const wrote: import('../../index.js').TableDefinition & {
  _columns: {};
  $id(id: string | number): string;
};
declare const review: import('../../index.js').TableDefinition & {
  _columns: {
    readonly rating: import('../../sdk/schema/column/simple-builders.js').Builder<'int'>;
    readonly comment: import('../../sdk/schema/column/simple-builders.js').Builder<'string'>;
  };
  $id(id: string | number): string;
};
declare const wroteMultiIn: import('../../index.js').TableDefinition & {
  _columns: {};
  $id(id: string | number): string;
};
declare const wroteMultiOut: import('../../index.js').TableDefinition & {
  _columns: {};
  $id(id: string | number): string;
};
declare const wroteMultiBoth: import('../../index.js').TableDefinition & {
  _columns: {};
  $id(id: string | number): string;
};
declare function defineTables(driver: SurrealDriver): Promise<void>;

export {
  afterEach,
  beforeEach,
  bindTable,
  bool,
  columnRef,
  create,
  createTestDriver,
  datetime,
  defineRelationTable,
  defineTable,
  defineTables,
  delete_,
  describe,
  EmbeddedDriver,
  expect,
  graphPath,
  insert,
  int,
  it,
  posts,
  record,
  relate,
  review,
  select,
  setupTestDb,
  string,
  update,
  upsert,
  users,
  WhereBuilder,
  wrote,
  wroteMultiBoth,
  wroteMultiIn,
  wroteMultiOut,
};
//# sourceMappingURL=test-utils.d.ts.map
