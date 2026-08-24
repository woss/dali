/**
 * Tests for query/model.ts
 *
 * Tests the Model<TDef> class and createModel() factory.
 * Covers all 8 builder delegation methods, fresh instance per call,
 * relation table support, .orm getter, and SQL table name correctness.
 *
 * These are unit tests — no DB connection required. Mock drivers
 * satisfy the builder constructor guard clauses.
 */

import { describe, expect, it } from 'vitest';
import type { DaliORM } from '../../sdk/dali-orm.js';
import { string } from '../../sdk/schema/column/index.js';
import { defineRelationTable, defineTable } from '../../sdk/table.js';
import { Model, createModel } from '../model.js';
import { SelectBuilder } from '../select.js';
import { InsertBuilder } from '../insert.js';
import { UpdateBuilder } from '../update.js';
import { DeleteBuilder } from '../delete.js';
import type { RelateBuilder } from '../relate.js';
import type { CreateBuilder } from '../create.js';
import type { UpsertBuilder } from '../upsert.js';
import type { LiveQueryBuilder } from '../live.js';

// ============================================================================
// Mock ORM (satisfies builder constructor guard: truthy)
// ============================================================================

const orm = { getDriver: () => ({}) } as unknown as DaliORM;

// ============================================================================
// Table Definitions (use ColumnBuilder objects, not raw strings)
// ============================================================================

const users = defineTable('user', {
  name: string('name'),
  email: string('email'),
});

const wrote = defineRelationTable('wrote', {}, { in: 'user', out: 'post' });

// ============================================================================
// 1. createModel creates Model instance
// ============================================================================

describe('createModel factory', () => {
  it('returns a Model instance', () => {
    const model = createModel(orm, users);

    expect(model).toBeInstanceOf(Model);
  });

  it('new Model() is equivalent to createModel()', () => {
    const viaFactory = createModel(orm, users);
    const viaNew = new Model(orm, users);

    expect(viaNew).toBeInstanceOf(Model);
    expect(viaFactory).toBeInstanceOf(Model);
  });
});

// ============================================================================
// 2. All 8 methods return correct builder types
// ============================================================================

describe('Model builder methods return correct types', () => {
  const model = createModel(orm, users);

  it('select() returns SelectBuilder', () => {
    expect(model.select()).toBeInstanceOf(SelectBuilder);
  });

  it('insert() returns InsertBuilder', () => {
    expect(model.insert()).toBeInstanceOf(InsertBuilder);
  });

  it('update() returns UpdateBuilder', () => {
    expect(model.update()).toBeInstanceOf(UpdateBuilder);
  });

  it('delete() returns DeleteBuilder', () => {
    expect(model.delete()).toBeInstanceOf(DeleteBuilder);
  });

  it('relate() returns RelateBuilder', () => {
    const builder = model.relate();

    // RelateBuilder is not exported as a class-name import in Model,
    // so duck-check its API surface
    expect(typeof (builder as RelateBuilder<any>).from).toBe('function');
    expect(typeof (builder as RelateBuilder<any>).to).toBe('function');
  });

  it('create() returns CreateBuilder', () => {
    const builder = model.create();

    expect(typeof (builder as CreateBuilder<any>).id).toBe('function');
    expect(typeof (builder as CreateBuilder<any>).set).toBe('function');
  });

  it('upsert() returns UpsertBuilder', () => {
    const builder = model.upsert();

    expect(typeof (builder as UpsertBuilder<any>).set).toBe('function');
    expect(typeof (builder as UpsertBuilder<any>).data).toBe('function');
  });

  it('live() returns LiveQueryBuilder', () => {
    const builder = model.live();

    expect(typeof (builder as LiveQueryBuilder<any>).fields).toBe('function');
    expect(typeof (builder as LiveQueryBuilder<any>).start).toBe('function');
  });
});

// ============================================================================
// 3. Fresh instance per call
// ============================================================================

describe('fresh instance per call', () => {
  const model = createModel(orm, users);

  it('two select() calls return different objects', () => {
    const a = model.select();
    const b = model.select();

    expect(a).toBeInstanceOf(SelectBuilder);
    expect(b).toBeInstanceOf(SelectBuilder);
    expect(a).not.toBe(b);
  });

  it('two insert() calls return different objects', () => {
    const a = model.insert();
    const b = model.insert();

    expect(a).toBeInstanceOf(InsertBuilder);
    expect(b).toBeInstanceOf(InsertBuilder);
    expect(a).not.toBe(b);
  });

  it('two update() calls return different objects', () => {
    const a = model.update();
    const b = model.update();

    expect(a).toBeInstanceOf(UpdateBuilder);
    expect(b).toBeInstanceOf(UpdateBuilder);
    expect(a).not.toBe(b);
  });

  it('two delete() calls return different objects', () => {
    const a = model.delete();
    const b = model.delete();

    expect(a).toBeInstanceOf(DeleteBuilder);
    expect(b).toBeInstanceOf(DeleteBuilder);
    expect(a).not.toBe(b);
  });
});

// ============================================================================
// 4. Works with relation tables
// ============================================================================

describe('Model with relation tables', () => {
  const model = createModel(orm, wrote);

  it('select() returns SelectBuilder', () => {
    expect(model.select()).toBeInstanceOf(SelectBuilder);
  });

  it('relate() returns RelateBuilder with chainable API', () => {
    const builder = model.relate() as RelateBuilder<any>;

    expect(typeof builder.from).toBe('function');
    expect(typeof builder.to).toBe('function');
    expect(typeof builder.set).toBe('function');
  });
});

// ============================================================================
// 5. .orm getter returns the same ORM reference
// ============================================================================

describe('.orm getter', () => {
  it('returns the same ORM reference passed to the constructor', () => {
    const model = createModel(orm, users);

    expect(model.orm).toBe(orm);
  });

  it('multiple instances each retain their own ORM reference', () => {
    const ormA = { getDriver: () => ({}) } as unknown as DaliORM;
    const ormB = { getDriver: () => ({}) } as unknown as DaliORM;
    const modelA = createModel(ormA, users);
    const modelB = createModel(ormB, users);

    expect(modelA.orm).toBe(ormA);
    expect(modelB.orm).toBe(ormB);
    expect(modelA.orm).not.toBe(modelB.orm);
  });
});

// ============================================================================
// 6. Builder SQL references correct table
// ============================================================================

describe('builder SQL references correct table', () => {
  it('select().toSQL() contains table name', () => {
    const model = createModel(orm, users);
    const { sql } = model.select().toSQL();

    expect(sql).toContain('FROM user');
  });

  it('select().toSQL() contains relation table name', () => {
    const model = createModel(orm, wrote);
    const { sql } = model.select().toSQL();

    expect(sql).toContain('FROM wrote');
  });
});
