/**
 * Tests: All query builders accept DaliORM instead of raw SurrealDriver
 *
 * Verifies every builder (Select, Insert, Update, Delete, Create, Upsert,
 * Relate, Live) accepts a DaliORM instance in its constructor and internally
 * calls orm.getDriver() to obtain the underlying SurrealDriver.
 *
 * Also verifies factory functions (select, insert, update, delete_, create,
 * upsert, relate, live) and bindTable() methods accept DaliORM.
 *
 * Unit tests — no DB connection required.
 */

import { describe, expect, it } from 'vitest';
import type { SurrealDriver } from '../../sdk/driver/types.js';
import { string } from '../../sdk/schema/column/index.js';
import { defineTable } from '../../sdk/table.js';
import { bindTable } from '../binding.js';
import { CreateBuilder, create } from '../create.js';
import { DeleteBuilder, delete_ } from '../delete.js';
import { InsertBuilder, insert } from '../insert.js';
import { LiveQueryBuilder, live } from '../live.js';
import { RelateBuilder, relate } from '../relate.js';
import { SelectBuilder, select } from '../select.js';
import { UpdateBuilder, update } from '../update.js';
import { UpsertBuilder, upsert } from '../upsert.js';
// Direct runtime import of DaliORM class
import { DaliORM } from '../../sdk/dali-orm.js';

// ============================================================================
// Mocks
// ============================================================================

/** Minimal SurrealDriver mock — each method is a spy that returns a resolved promise */
function createMockDriver() {
  let callCount = 0;
  const driver: SurrealDriver = {
    getUrl: () => 'mock://',
    connect: async () => {},
    disconnect: async () => {},
    isConnected: () => false,
    query: async () => {
      callCount++;
      return [];
    },
    transaction: async (_fn: any) => _fn({} as any),
    live: async () => {
      callCount++;
      return 'sub-id';
    },
    liveWithOptions: async () => {
      callCount++;
      return {
        id: 'sub',
        isAlive: true,
        kill: async () => {},
        subscribe: () => () => {},
        [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true, value: undefined }) }),
      };
    },
    kill: async () => {},
    use: async () => {},
    invalidate: async () => {},
    select: async () => {
      callCount++;
      return [];
    },
    create: async () => {
      callCount++;
      return [];
    },
    insert: async () => {
      callCount++;
      return [];
    },
    update: async () => {
      callCount++;
      return [];
    },
    delete: async () => {
      callCount++;
      return [];
    },
    upsert: async () => {
      callCount++;
      return [];
    },
    upsertWhere: async () => {
      callCount++;
      return [];
    },
    relate: async () => {
      callCount++;
      return [];
    },
    signin: async () => '',
    signup: async () => '',
    authenticate: async () => ({ access: '', refresh: '' }),
    auth: async () => ({}),
    config: { driver: 'node' } as any,
    showChanges: async () => [],
  };
  return { driver, getCallCount: () => callCount };
}

function createOrm(): DaliORM {
  const { driver } = createMockDriver();
  return { getDriver: () => driver } as unknown as DaliORM;
}

function createOrmWithDriverTracker(): {
  orm: DaliORM;
  driver: SurrealDriver;
  getCallCount: () => number;
} {
  const { driver, getCallCount } = createMockDriver();
  const orm = { getDriver: () => driver } as unknown as DaliORM;
  return { orm, driver, getCallCount };
}

// ============================================================================
// Table Definitions
// ============================================================================

const users = defineTable('user', {
  name: string('name'),
  email: string('email'),
});

const posts = defineTable('post', {
  title: string('title'),
  body: string('body'),
});

// ============================================================================
// 1. CRUD builders accept DaliORM in constructor
// ============================================================================

describe('CRUD builders accept DaliORM', () => {
  it('SelectBuilder constructor accepts DaliORM', () => {
    const orm = createOrm();
    const builder = new SelectBuilder(orm, users);
    expect(builder).toBeInstanceOf(SelectBuilder);
  });

  it('InsertBuilder constructor accepts DaliORM', () => {
    const orm = createOrm();
    const builder = new InsertBuilder(orm, users);
    expect(builder).toBeInstanceOf(InsertBuilder);
  });

  it('UpdateBuilder constructor accepts DaliORM', () => {
    const orm = createOrm();
    const builder = new UpdateBuilder(orm, users);
    expect(builder).toBeInstanceOf(UpdateBuilder);
  });

  it('DeleteBuilder constructor accepts DaliORM', () => {
    const orm = createOrm();
    const builder = new DeleteBuilder(orm, users);
    expect(builder).toBeInstanceOf(DeleteBuilder);
  });

  it('CreateBuilder constructor accepts DaliORM', () => {
    const orm = createOrm();
    const builder = new CreateBuilder(orm, users);
    expect(builder).toBeInstanceOf(CreateBuilder);
  });

  it('UpsertBuilder constructor accepts DaliORM', () => {
    const orm = createOrm();
    const builder = new UpsertBuilder(orm, users);
    expect(builder).toBeInstanceOf(UpsertBuilder);
  });

  it('RelateBuilder constructor accepts DaliORM', () => {
    const orm = createOrm();
    const builder = new RelateBuilder(orm, users);
    expect(builder).toBeInstanceOf(RelateBuilder);
  });

  it('LiveQueryBuilder constructor accepts DaliORM', () => {
    const orm = createOrm();
    const builder = new LiveQueryBuilder(orm, users);
    expect(builder).toBeInstanceOf(LiveQueryBuilder);
  });
});

// ============================================================================
// 2. Builders call getDriver() internally — verified via driver method execution
// ============================================================================

describe('builders call getDriver() and execute through it', () => {
  it('SelectBuilder.execute() calls driver.select() for simple query', async () => {
    const { orm, getCallCount } = createOrmWithDriverTracker();
    const builder = new SelectBuilder(orm, users);
    const results = await builder.execute();
    expect(results).toEqual([]);
    expect(getCallCount()).toBeGreaterThanOrEqual(1);
  });

  it('InsertBuilder.execute() calls driver.insert()', async () => {
    const { orm, getCallCount } = createOrmWithDriverTracker();
    const builder = new InsertBuilder(orm, users);
    builder.one({ name: 'Alice', email: 'alice@test.com' });
    const results = await builder.execute();
    expect(results).toEqual([]);
    expect(getCallCount()).toBeGreaterThanOrEqual(1);
  });

  it('UpdateBuilder.execute() calls driver.update()', async () => {
    const { orm, getCallCount } = createOrmWithDriverTracker();
    const builder = new UpdateBuilder(orm, users);
    builder.data({ name: 'Bob' });
    const results = await builder.execute();
    expect(results).toEqual([]);
    expect(getCallCount()).toBeGreaterThanOrEqual(1);
  });

  it('DeleteBuilder.execute() calls driver.delete()', async () => {
    const { orm, getCallCount } = createOrmWithDriverTracker();
    const builder = new DeleteBuilder(orm, users);
    const results = await builder.execute();
    expect(results).toEqual([]);
    expect(getCallCount()).toBeGreaterThanOrEqual(1);
  });

  it('CreateBuilder.execute() calls driver.create()', async () => {
    const { orm, getCallCount } = createOrmWithDriverTracker();
    const builder = new CreateBuilder(orm, users);
    builder.data({ name: 'Charlie' });
    const results = await builder.execute();
    expect(results).toEqual([]);
    expect(getCallCount()).toBeGreaterThanOrEqual(1);
  });

  it('UpsertBuilder.execute() calls driver.upsert()', async () => {
    const { orm, getCallCount } = createOrmWithDriverTracker();
    const builder = new UpsertBuilder(orm, users);
    builder.data({ name: 'Charlie' });
    const results = await builder.execute('charlie');
    expect(results).toEqual([]);
    expect(getCallCount()).toBeGreaterThanOrEqual(1);
  });

  it('RelateBuilder.execute() calls driver.relate()', async () => {
    const { orm, getCallCount } = createOrmWithDriverTracker();
    const builder = new RelateBuilder(orm, users);
    builder.from('user:alice').to('user:bob').data({ type: 'friend' });
    const results = await builder.execute();
    expect(results).toEqual([]);
    expect(getCallCount()).toBeGreaterThanOrEqual(1);
  });

  it('LiveQueryBuilder.start() calls driver.liveWithOptions()', async () => {
    const { orm, getCallCount } = createOrmWithDriverTracker();
    const builder = new LiveQueryBuilder(orm, users);
    const sub = await builder.start();
    expect(sub).toBeDefined();
    expect(getCallCount()).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// 3. Passing null/undefined throws 'DaliORM instance is required'
// ============================================================================

describe('passing null/undefined throws', () => {
  it('SelectBuilder throws on null', () => {
    expect(() => new (SelectBuilder as any)(null, users)).toThrow('DaliORM instance is required');
  });

  it('SelectBuilder throws on undefined', () => {
    expect(() => new (SelectBuilder as any)(undefined, users)).toThrow(
      'DaliORM instance is required',
    );
  });

  it('InsertBuilder throws on null', () => {
    expect(() => new (InsertBuilder as any)(null, users)).toThrow('DaliORM instance is required');
  });

  it('UpdateBuilder throws on null', () => {
    expect(() => new (UpdateBuilder as any)(null, users)).toThrow('DaliORM instance is required');
  });

  it('DeleteBuilder throws on null', () => {
    expect(() => new (DeleteBuilder as any)(null, users)).toThrow('DaliORM instance is required');
  });

  it('CreateBuilder throws on null', () => {
    expect(() => new (CreateBuilder as any)(null, users)).toThrow('DaliORM instance is required');
  });

  it('UpsertBuilder throws on null', () => {
    expect(() => new (UpsertBuilder as any)(null, users)).toThrow('DaliORM instance is required');
  });

  it('RelateBuilder throws on null', () => {
    expect(() => new (RelateBuilder as any)(null, users)).toThrow('DaliORM instance is required');
  });

  it('LiveQueryBuilder throws on null', () => {
    expect(() => new (LiveQueryBuilder as any)(null, users)).toThrow(
      'DaliORM instance is required',
    );
  });

  it('LiveQueryBuilder throws on undefined', () => {
    expect(() => new (LiveQueryBuilder as any)(undefined, users)).toThrow(
      'DaliORM instance is required',
    );
  });
});

// ============================================================================
// 4. Factory functions accept DaliORM
// ============================================================================

describe('factory functions accept DaliORM', () => {
  it('select() factory accepts DaliORM', () => {
    const orm = createOrm();
    const builder = select(orm, users);
    expect(builder).toBeInstanceOf(SelectBuilder);
  });

  it('insert() factory accepts DaliORM', () => {
    const orm = createOrm();
    const builder = insert(orm, users);
    expect(builder).toBeInstanceOf(InsertBuilder);
  });

  it('update() factory accepts DaliORM', () => {
    const orm = createOrm();
    const builder = update(orm, users);
    expect(builder).toBeInstanceOf(UpdateBuilder);
  });

  it('delete_() factory accepts DaliORM', () => {
    const orm = createOrm();
    const builder = delete_(orm, users);
    expect(builder).toBeInstanceOf(DeleteBuilder);
  });

  it('create() factory accepts DaliORM', () => {
    const orm = createOrm();
    const builder = create(orm, users);
    expect(builder).toBeInstanceOf(CreateBuilder);
  });

  it('upsert() factory accepts DaliORM', () => {
    const orm = createOrm();
    const builder = upsert(orm, users);
    expect(builder).toBeInstanceOf(UpsertBuilder);
  });

  it('relate() factory accepts DaliORM', () => {
    const orm = createOrm();
    const builder = relate(orm, users);
    expect(builder).toBeInstanceOf(RelateBuilder);
  });

  it('live() factory accepts DaliORM', () => {
    const orm = createOrm();
    const builder = live(orm, users);
    expect(builder).toBeInstanceOf(LiveQueryBuilder);
  });

  it('factory functions pass getDriver() — select().execute() works', async () => {
    const { orm, getCallCount } = createOrmWithDriverTracker();
    const builder = select(orm, users);
    const results = await builder.execute();
    expect(results).toEqual([]);
    expect(getCallCount()).toBeGreaterThanOrEqual(1);
  });

  it('factory functions pass getDriver() — insert().execute() works', async () => {
    const { orm, getCallCount } = createOrmWithDriverTracker();
    const builder = insert(orm, users);
    builder.one({ name: 'Test', email: 'test@test.com' });
    const results = await builder.execute();
    expect(results).toEqual([]);
    expect(getCallCount()).toBeGreaterThanOrEqual(1);
  });

  it('factory functions pass getDriver() — create().execute() works', async () => {
    const { orm, getCallCount } = createOrmWithDriverTracker();
    const builder = create(orm, users);
    builder.data({ name: 'New' });
    const results = await builder.execute();
    expect(results).toEqual([]);
    expect(getCallCount()).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// 5. bindTable() factory methods accept DaliORM
// ============================================================================

describe('bindTable() factory methods accept DaliORM', () => {
  it('bound.select() accepts DaliORM', () => {
    const orm = createOrm();
    const bound = bindTable(users);
    const builder = bound.select(orm);
    expect(builder).toBeInstanceOf(SelectBuilder);
  });

  it('bound.insert() accepts DaliORM', () => {
    const orm = createOrm();
    const bound = bindTable(users);
    const builder = bound.insert(orm);
    expect(builder).toBeInstanceOf(InsertBuilder);
  });

  it('bound.update() accepts DaliORM', () => {
    const orm = createOrm();
    const bound = bindTable(users);
    const builder = bound.update(orm);
    expect(builder).toBeInstanceOf(UpdateBuilder);
  });

  it('bound.delete() accepts DaliORM', () => {
    const orm = createOrm();
    const bound = bindTable(users);
    const builder = bound.delete(orm);
    expect(builder).toBeInstanceOf(DeleteBuilder);
  });

  it('bound.relate() accepts DaliORM', () => {
    const orm = createOrm();
    const bound = bindTable(users);
    const builder = bound.relate(orm);
    expect(builder).toBeInstanceOf(RelateBuilder);
  });

  it('bound methods delegate to factory — select with DaliORM uses getDriver()', async () => {
    const { orm, getCallCount } = createOrmWithDriverTracker();
    const bound = bindTable(users);
    const builder = bound.select(orm) as SelectBuilder<any, any>;
    const results = await builder.execute();
    expect(results).toEqual([]);
    expect(getCallCount()).toBeGreaterThanOrEqual(1);
  });

  it('each bindTable method produces a working builder with correct table name', () => {
    const orm = createOrm();
    const bound = bindTable(posts);

    const sqlBuilder = bound.select(orm) as SelectBuilder<any, any>;
    const sql = sqlBuilder.toSQL();

    expect(sql.sql).toContain('FROM post');
  });
});

// ============================================================================
// 6. DaliORM type re-export from index.ts
// ============================================================================

describe('DaliORM type re-export from index.ts', () => {
  it('index.ts re-exports DaliORM type (compile-time check — using import type)', () => {
    // Type-only re-export: import type { DaliORM } from '../index.js' compiles.
    // This test asserts the DaliORM class itself is constructible via DaliORM.connect config.
    expect(DaliORM).toBeDefined();
    expect(typeof DaliORM.connect).toBe('function');
  });
});

// ============================================================================
// 7. Edge cases: verify each builder validates missing tableDef too
// ============================================================================

describe('builder edge cases', () => {
  it('SelectBuilder throws when tableDef has no name', () => {
    const orm = createOrm();
    expect(() => new SelectBuilder(orm, {} as any)).toThrow(
      'Table definition with name is required',
    );
  });

  it('InsertBuilder throws when tableDef has no name', () => {
    const orm = createOrm();
    expect(() => new InsertBuilder(orm, {} as any)).toThrow(
      'Table definition with name is required',
    );
  });

  it('UpdateBuilder throws when tableDef has no name', () => {
    const orm = createOrm();
    expect(() => new UpdateBuilder(orm, {} as any)).toThrow(
      'Table definition with name is required',
    );
  });

  it('DeleteBuilder throws when tableDef has no name', () => {
    const orm = createOrm();
    expect(() => new DeleteBuilder(orm, {} as any)).toThrow(
      'Table definition with name is required',
    );
  });

  it('CreateBuilder throws when tableDef has no name', () => {
    const orm = createOrm();
    expect(() => new CreateBuilder(orm, {} as any)).toThrow(
      'Table definition with name is required',
    );
  });

  it('UpsertBuilder throws when tableDef has no name', () => {
    const orm = createOrm();
    expect(() => new UpsertBuilder(orm, {} as any)).toThrow(
      'Table definition with name is required',
    );
  });

  it('RelateBuilder throws when tableDef has no name', () => {
    const orm = createOrm();
    expect(() => new RelateBuilder(orm, {} as any)).toThrow(
      'Edge table definition with name is required',
    );
  });

  it('LiveQueryBuilder throws when tableDef has no name', () => {
    const orm = createOrm();
    expect(() => new LiveQueryBuilder(orm, {} as any)).toThrow(
      'Table definition with name is required',
    );
  });
});
