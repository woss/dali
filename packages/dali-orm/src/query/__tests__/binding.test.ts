/**
 * Tests for query/binding.ts
 *
 * Tests bindTable() which enhances a TableDefinition with builder
 * factory methods (select, insert, update, delete, relate).
 *
 * These are unit tests — no DB connection required. Mock drivers
 * satisfy the builder constructor guard clauses.
 */

import { describe, expect, it } from 'vite-plus/test';
import type { DaliORM } from '../../sdk/dali-orm.js';
import { string } from '../../sdk/schema/column/index.js';
import { defineRelationTable, defineTable } from '../../sdk/table.js';
import { bindTable } from '../binding.js';
import { DeleteBuilder } from '../delete.js';
import { InsertBuilder } from '../insert.js';
import { SelectBuilder } from '../select.js';
import { UpdateBuilder } from '../update.js';

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
// 1. bindTable adds builder factory methods
// ============================================================================

describe('bindTable adds methods', () => {
  it('adds select() method', () => {
    const bound = bindTable(users);

    expect(typeof bound.select).toBe('function');
  });

  it('adds insert() method', () => {
    const bound = bindTable(users);

    expect(typeof bound.insert).toBe('function');
  });

  it('adds update() method', () => {
    const bound = bindTable(users);

    expect(typeof bound.update).toBe('function');
  });

  it('adds delete() method', () => {
    const bound = bindTable(users);

    expect(typeof bound.delete).toBe('function');
  });

  it('adds relate() method', () => {
    const bound = bindTable(users);

    expect(typeof bound.relate).toBe('function');
  });

  it('adds all five methods at once', () => {
    const bound = bindTable(users);

    expect(typeof bound.select).toBe('function');
    expect(typeof bound.insert).toBe('function');
    expect(typeof bound.update).toBe('function');
    expect(typeof bound.delete).toBe('function');
    expect(typeof bound.relate).toBe('function');
  });
});

// ============================================================================
// 2. bindTable returns a new object (non-mutating)
// ============================================================================

describe('bindTable returns a new object', () => {
  it('returns a different object reference (non-mutating)', () => {
    const original = users;
    const bound = bindTable(users);

    expect(bound).not.toBe(original);
  });

  it('original table def does NOT gain methods after bind', () => {
    const table = defineTable('temp', { name: string('name') });

    expect(typeof (table as any).select).toBe('undefined');

    bindTable(table);

    expect(typeof (table as any).select).toBe('undefined');
  });

  it('returned copy gains builder methods', () => {
    const table = defineTable('temp', { name: string('name') });
    const bound = bindTable(table);

    expect(typeof bound.select).toBe('function');
    expect(typeof bound.insert).toBe('function');
    expect(typeof bound.update).toBe('function');
    expect(typeof bound.delete).toBe('function');
    expect(typeof bound.relate).toBe('function');
  });
});

// ============================================================================
// 3. Builder factory methods return correct builder instances
// ============================================================================

describe('builder factory returns correct instances', () => {
  it('select() returns SelectBuilder', () => {
    const bound = bindTable(users);

    expect(bound.select(orm)).toBeInstanceOf(SelectBuilder);
  });

  it('insert() returns InsertBuilder', () => {
    const bound = bindTable(users);

    expect(bound.insert(orm)).toBeInstanceOf(InsertBuilder);
  });

  it('update() returns UpdateBuilder', () => {
    const bound = bindTable(users);

    expect(bound.update(orm)).toBeInstanceOf(UpdateBuilder);
  });

  it('delete() returns DeleteBuilder', () => {
    const bound = bindTable(users);

    expect(bound.delete(orm)).toBeInstanceOf(DeleteBuilder);
  });

  it('each factory call returns a fresh builder instance', () => {
    const bound = bindTable(users);

    const s1 = bound.select(orm);
    const s2 = bound.select(orm);

    expect(s1).toBeInstanceOf(SelectBuilder);
    expect(s2).toBeInstanceOf(SelectBuilder);
    expect(s1).not.toBe(s2);
  });
});

// ============================================================================
// 4. bindTable works with relation tables
// ============================================================================

describe('bindTable with relation tables', () => {
  it('adds methods to relation table definition', () => {
    const bound = bindTable(wrote);

    expect(typeof bound.select).toBe('function');
    expect(typeof bound.relate).toBe('function');
  });

  it('relate() returns RelateBuilder for relation table', () => {
    const bound = bindTable(wrote);

    const builder = bound.relate(orm);
    expect(builder).toBeDefined();
    expect(typeof (builder as any).from).toBe('function');
    expect(typeof (builder as any).to).toBe('function');
    expect(typeof (builder as any).execute).toBe('function');
  });
});

// ============================================================================
// 5. bindTable preserves original table properties
// ============================================================================

describe('bindTable preserves original properties', () => {
  it('preserves table name after binding', () => {
    const bound = bindTable(users);

    expect(bound.name).toBe('user');
  });

  it('preserves columns after binding', () => {
    const bound = bindTable(users);

    expect(bound.columns).toBeDefined();
    expect(Array.isArray(bound.columns)).toBe(true);
  });

  it('preserves config after binding', () => {
    const bound = bindTable(users);

    expect(bound.config).toBeDefined();
    expect(bound.config).toEqual(users.config);
  });
});

// ============================================================================
// 6. Builder methods reference the correct table in SQL
// ============================================================================

describe('builder SQL references correct table', () => {
  it('select().toSQL() references table name', () => {
    const bound = bindTable(users);
    const sql = (bound.select(orm) as SelectBuilder<any, any>).toSQL();

    expect(sql.sql).toContain('FROM user');
  });

  it('delete() references table name', () => {
    const bound = bindTable(users);

    expect(bound.delete(orm)).toBeInstanceOf(DeleteBuilder);
  });
});
