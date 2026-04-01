import { describe, expect, it } from 'vite-plus/test';
import { createEmptyDdl, isDdlEmpty } from '../ddl.js';

describe('DDL helpers', () => {
  it('createEmptyDdl returns empty structure', () => {
    const ddl = createEmptyDdl();
    expect(ddl.tables).toEqual([]);
    expect(ddl.indexes).toEqual([]);
    expect(ddl.relations).toEqual([]);
    expect(ddl.events).toEqual([]);
    expect(ddl.lives).toEqual([]);
    expect(ddl.views).toEqual([]);
    expect(ddl.access).toEqual([]);
    expect(ddl.accessStructured).toEqual([]);
    expect(ddl.functions).toEqual([]);
  });

  it('isDdlEmpty returns true for empty DDL', () => {
    expect(isDdlEmpty(createEmptyDdl())).toBe(true);
  });

  it('isDdlEmpty returns false when tables exist', () => {
    const ddl = createEmptyDdl();
    ddl.tables = [{ name: 'test', schema: 'full', type: 'normal', columns: [], indexes: [] }];
    expect(isDdlEmpty(ddl)).toBe(false);
  });

  // Cover remaining branch paths — each array should trigger false
  it('isDdlEmpty returns false for non-empty indexes', () => {
    const ddl = createEmptyDdl();
    ddl.indexes = [{ name: 'idx', table: 't', cols: ['id'], index: 'btree' }];
    expect(isDdlEmpty(ddl)).toBe(false);
  });

  it('isDdlEmpty returns false for non-empty relations', () => {
    const ddl = createEmptyDdl();
    ddl.relations = [{ name: 'rel', in: 'a', out: 'b', fields: [] }];
    expect(isDdlEmpty(ddl)).toBe(false);
  });

  it('isDdlEmpty returns false for non-empty events', () => {
    const ddl = createEmptyDdl();
    ddl.events = [{ name: 'evt', what: 't', when: 'after', then: ['sql'] }];
    expect(isDdlEmpty(ddl)).toBe(false);
  });

  it('isDdlEmpty returns false for non-empty lives', () => {
    const ddl = createEmptyDdl();
    ddl.lives = [{ id: 'l1', node: 'n', fields: '*', what: 't' }];
    expect(isDdlEmpty(ddl)).toBe(false);
  });

  it('isDdlEmpty returns false for non-empty views', () => {
    const ddl = createEmptyDdl();
    ddl.views = ['DEFINE VIEW test ...'];
    expect(isDdlEmpty(ddl)).toBe(false);
  });

  it('isDdlEmpty returns false for non-empty access', () => {
    const ddl = createEmptyDdl();
    ddl.access = ['DEFINE ACCESS ...'];
    expect(isDdlEmpty(ddl)).toBe(false);
  });

  it('isDdlEmpty returns false for non-empty accessStructured', () => {
    const ddl = createEmptyDdl();
    ddl.accessStructured = [{ name: 'a', type: 'jwt' }];
    expect(isDdlEmpty(ddl)).toBe(false);
  });

  it('isDdlEmpty returns false for non-empty functions', () => {
    const ddl = createEmptyDdl();
    ddl.functions = [{ name: 'fn', body: 'return 1' }];
    expect(isDdlEmpty(ddl)).toBe(false);
  });
});
