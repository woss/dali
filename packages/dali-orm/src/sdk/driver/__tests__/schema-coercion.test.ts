/**
 * Schema-Aware Record Coercion Tests (Task 1.2)
 *
 * Tests coerceRecordIds behavior through public CRUD methods:
 * 1. Schema-aware path: only record-typed columns coerced
 * 2. Fallback path (no schema): all string values with record-like format coerced
 * 3. Table not found in schema: falls back to coerce-all behavior
 * 4. Non-record string fields with colons preserved when schema is available
 * 5. Record-typed fields coerced when schema is available
 * 6. upsertWhere passes parsed tableName (not full "table:id") to coerceRecordIds
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseDriver } from '../base-driver.js';
import type { DriverConfig, EmbeddedConfig } from '../types.js';

// ============================================================================
// Mock surrealdb module — hoisted by vi.mock, replaces SDK classes
// ============================================================================

const mockRecordIdCtor = vi.fn();
const mockTableCtor = vi.fn();

vi.mock('surrealdb', () => {
  class RecordId {
    tb: string;
    id: string;
    constructor(tb: string, id: string) {
      this.tb = tb;
      this.id = id;
      mockRecordIdCtor(tb, id);
    }
    toString(): string {
      return `${this.tb}:${this.id}`;
    }
  }
  Object.defineProperty(RecordId, 'name', { value: 'RecordId' });

  class Table {
    table: string;
    constructor(table: string) {
      this.table = table;
      mockTableCtor(table);
    }
    toString(): string {
      return this.table;
    }
  }
  Object.defineProperty(Table, 'name', { value: 'Table' });

  class DateTime {
    value: string | number;
    constructor(value: string | number) {
      this.value = value;
    }
  }
  Object.defineProperty(DateTime, 'name', { value: 'DateTime' });

  return { RecordId, Table, DateTime };
});

// eslint-disable-next-line import/order
import { RecordId } from 'surrealdb';

// ============================================================================
// Helper: thenable objects that mimic Surreal SDK query/promise types
// ============================================================================

function thenableResolve<T>(value: T) {
  const p = Promise.resolve(value);
  return {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
  };
}

function builderThenable<T>(resolveTo: T) {
  const base = thenableResolve(resolveTo);
  return {
    ...base,
    content: vi.fn(function (this: unknown) {
      return this;
    }),
    merge: vi.fn(function (this: unknown) {
      return this;
    }),
    where: vi.fn(function (this: unknown) {
      return this;
    }),
  };
}

// ============================================================================
// TestDriver — concrete subclass of BaseDriver for testing
// ============================================================================

class TestDriver extends BaseDriver {
  // @ts-expect-error — mock db, not real Surreal instance
  public db: Record<string, unknown>;
  connected = false;
  subscriptions = new Map<string, { created: number; liveSubscription?: unknown }>();

  constructor(mockDb: Record<string, unknown>) {
    super();
    this.db = mockDb;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  getUrl(): string {
    return 'test://localhost';
  }

  async signin(): Promise<string> {
    return 'token';
  }

  async signup(): Promise<string> {
    return 'token';
  }

  async authenticate(): Promise<{ access: string }> {
    return { access: 'token' };
  }

  get config(): DriverConfig | EmbeddedConfig {
    return { driver: 'test' } as unknown as DriverConfig | EmbeddedConfig;
  }
}

// ============================================================================
// Test helpers
// ============================================================================

function createMockDb() {
  return {
    query: vi.fn().mockReturnValue({ collect: vi.fn().mockResolvedValue([[]]) }),
    select: vi.fn().mockReturnValue(thenableResolve([])),
    create: vi.fn().mockReturnValue(builderThenable([])),
    insert: vi.fn().mockReturnValue(thenableResolve([])),
    update: vi.fn().mockReturnValue(builderThenable([])),
    delete: vi.fn().mockReturnValue(thenableResolve([])),
    upsert: vi.fn().mockReturnValue(builderThenable({})),
    close: vi.fn().mockResolvedValue(true),
    use: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
    relate: vi.fn().mockReturnValue(thenableResolve({})),
    live: vi.fn(),
    beginTransaction: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

/**
 * Create a mock OrmSchema with table definitions for testing.
 * user table: name (string), email (string), profile (record<profile>), owner (record<user>)
 * notes table: title (string), content (string) — no record columns
 */
function createMockSchema(): any {
  return {
    name: 'test-schema',
    getTable: vi.fn((name: string) => {
      if (name === 'user') {
        return {
          name: 'user',
          $columns: {
            name: { name: 'name', config: { type: 'string' } },
            email: { name: 'email', config: { type: 'string' } },
            profile: { name: 'profile', config: { type: 'record', recordTable: 'profile' } },
            owner: { name: 'owner', config: { type: 'record', recordTable: 'user' } },
          },
        };
      }
      if (name === 'notes') {
        return {
          name: 'notes',
          $columns: {
            title: { name: 'title', config: { type: 'string' } },
            content: { name: 'content', config: { type: 'string' } },
          },
        };
      }
      return undefined;
    }),
    getTables: vi.fn().mockReturnValue([]),
    hasTable: vi.fn().mockReturnValue(false),
    tableCount: 0,
  };
}

/**
 * Extract the first argument passed to a mock's content() or merge() call.
 * Uses `any` cast because mock.calls type is inferred as empty tuple before invocation.
 */
function firstArg(fn: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return fn.mock.calls[0][0] as Record<string, unknown>;
}

// ============================================================================
// Tests
// ============================================================================

describe('BaseDriver — schema-aware record coercion', () => {
  let mockDb: MockDb;
  let driver: TestDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordIdCtor.mockClear();
    mockDb = createMockDb();
    driver = new TestDriver(mockDb as unknown as Record<string, unknown>);
    driver.connected = true;
  });

  // ============================================================================
  // 1. Schema-aware coercion: only record-typed columns coerced
  // ============================================================================

  describe('schema-aware coercion', () => {
    it('coerces only record-typed columns when schema is available', async () => {
      driver.schema = createMockSchema();
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('user', {
        name: 'Alice',
        email: 'alice@example.com',
        profile: 'profile:1',
        owner: 'user:42',
      });

      const data = firstArg(builder.content);
      // Non-record string fields preserved as-is
      expect(data.name).toBe('Alice');
      expect(data.email).toBe('alice@example.com');
      // Record-typed fields coerced to RecordId
      expect(data.profile).toBeInstanceOf(RecordId);
      expect(data.owner).toBeInstanceOf(RecordId);
      expect(String(data.profile)).toBe('profile:1');
      expect(String(data.owner)).toBe('user:42');
    });

    it('preserves non-record string fields that happen to contain a colon', async () => {
      driver.schema = createMockSchema();
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      // name field is string (not record) — even though value looks like a record ref
      await driver.create('user', {
        name: 'repo:woss',
        email: 'alice@example.com',
      });

      const data = firstArg(builder.content);
      // Schema-aware path: name is NOT a record column → pass through unchanged
      expect(data.name).toBe('repo:woss');
      expect(data.email).toBe('alice@example.com');
    });

    it('does not coerce when table has no record-typed columns', async () => {
      driver.schema = createMockSchema();
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      // notes table has only string columns, no record columns
      await driver.create('notes', {
        title: 'My Note',
        content: 'content with colon: still string',
      });

      const data = firstArg(builder.content);
      expect(data.title).toBe('My Note');
      expect(data.content).toBe('content with colon: still string');
      // No RecordId created
      expect(mockRecordIdCtor).not.toHaveBeenCalled();
    });

    it('handles null and undefined values in schema-aware path', async () => {
      driver.schema = createMockSchema();
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('user', {
        name: null,
        profile: undefined,
        email: 'alice@example.com',
      });

      const data = firstArg(builder.content);
      expect(data.name).toBeNull();
      expect(data.profile).toBeUndefined();
      expect(data.email).toBe('alice@example.com');
    });
  });

  // ============================================================================
  // 2. Fallback: no schema — coerce all values
  // ============================================================================

  describe('fallback behavior (no schema)', () => {
    it('coerces all string values with record-like format when schema is undefined', async () => {
      driver.schema = undefined;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('user', {
        name: 'Alice',
        profile: 'profile:1',
      });

      const data = firstArg(builder.content);
      // name has no colon → unchanged
      expect(data.name).toBe('Alice');
      // profile has record-like format → coerced
      expect(data.profile).toBeInstanceOf(RecordId);
      expect(mockRecordIdCtor).toHaveBeenCalledWith('profile', '1');
    });

    it('coerces all matching values when schema is null', async () => {
      driver.schema = null as unknown as undefined;
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('user', {
        tag: 'user:abc',
        note: 'plain text',
      });

      const data = firstArg(builder.content);
      expect(data.tag).toBeInstanceOf(RecordId);
      expect(data.note).toBe('plain text');
    });
  });

  // ============================================================================
  // 3. Table not found in schema: falls back to coerce-all
  // ============================================================================

  describe('table not found fallback', () => {
    it('falls back to coerce-all when table is not defined in schema', async () => {
      driver.schema = createMockSchema();
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      // unknown_table is not in the schema → fallback to coerce-all
      await driver.create('unknown_table', {
        name: 'repo:woss',
        profile: 'profile:1',
      });

      const data = firstArg(builder.content);
      // In fallback, both string values with record-like format get coerced
      expect(data.name).toBeInstanceOf(RecordId);
      expect(data.profile).toBeInstanceOf(RecordId);
      expect(String(data.name)).toBe('repo:woss');
      expect(String(data.profile)).toBe('profile:1');
    });
  });

  // ============================================================================
  // 4. Non-record string with colon preserved (schema available)
  // ============================================================================

  describe('non-record string preservation', () => {
    it('preserves string values with colons when field is not a record column', async () => {
      driver.schema = createMockSchema();
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      // email is a string column (not record) — even if value contains a colon
      await driver.create('user', {
        email: 'user:example.com',
        name: 'Alice',
      });

      const data = firstArg(builder.content);
      // email is NOT a record column → preserved as-is despite having a colon
      expect(data.email).toBe('user:example.com');
      expect(data.name).toBe('Alice');
    });

    it('preserves string values with colons when table has only non-record columns', async () => {
      driver.schema = createMockSchema();
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      // notes table has no record columns
      await driver.create('notes', {
        title: 'status:active',
        content: 'repo:my-repo',
      });

      const data = firstArg(builder.content);
      expect(data.title).toBe('status:active');
      expect(data.content).toBe('repo:my-repo');
      expect(mockRecordIdCtor).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 5. Record-typed fields ARE coerced when schema is available
  // ============================================================================

  describe('record-typed field coercion', () => {
    it('coerces multiple record-typed fields to RecordId', async () => {
      driver.schema = createMockSchema();
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('user', {
        profile: 'profile:99',
        owner: 'user:admin',
      });

      const data = firstArg(builder.content);
      expect(data.profile).toBeInstanceOf(RecordId);
      expect(data.owner).toBeInstanceOf(RecordId);
      expect(mockRecordIdCtor).toHaveBeenCalledWith('profile', '99');
      expect(mockRecordIdCtor).toHaveBeenCalledWith('user', 'admin');
    });

    it('coerces record field with complex record ID (string ID)', async () => {
      driver.schema = createMockSchema();
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('user', {
        profile: 'profile:john_doe',
      });

      const data = firstArg(builder.content);
      expect(data.profile).toBeInstanceOf(RecordId);
      expect(String(data.profile)).toBe('profile:john_doe');
    });

    it('passes already-coerced RecordId through unchanged', async () => {
      driver.schema = createMockSchema();
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      const existingId = new RecordId('profile', '5');
      await driver.create('user', {
        profile: existingId,
      });

      const data = firstArg(builder.content);
      expect(data.profile).toBe(existingId); // Same instance preserved
    });
  });

  // ============================================================================
  // 6. upsertWhere passes parsed tableName to coerceRecordIds
  // ============================================================================

  describe('upsertWhere table name parsing', () => {
    it('parses table name from "table:id" format before passing to coerceRecordIds', async () => {
      driver.schema = createMockSchema();
      const builder = builderThenable({ id: '1' });
      mockDb.upsert.mockReturnValue(builder);

      // upsertWhere with table containing a colon
      await driver.upsertWhere('user:5', 'email = "alice@b.com"', {
        name: 'Alice',
        email: 'alice@example.com',
        profile: 'profile:1',
      });

      const data = firstArg(builder.merge);
      // profile is record column → coerced (schema found the right table name)
      expect(data.profile).toBeInstanceOf(RecordId);
      // name and email are non-record columns → preserved
      expect(data.name).toBe('Alice');
      expect(data.email).toBe('alice@example.com');
    });

    it('uses parsed tableName correctly when upsertWhere table has no record columns', async () => {
      driver.schema = createMockSchema();
      const builder = builderThenable({ id: '1' });
      mockDb.upsert.mockReturnValue(builder);

      // notes table has no record columns — coerceRecordIds should skip all values
      await driver.upsertWhere('notes:abc', 'title = "hello"', {
        title: 'repo:woss',
        content: 'some content',
      });

      const data = firstArg(builder.merge);
      // notes table has no record columns → nothing coerced
      expect(data.title).toBe('repo:woss');
      expect(data.content).toBe('some content');
      expect(mockRecordIdCtor).not.toHaveBeenCalled();
    });

    it('works with upsertWhere when no schema is set (backward compat)', async () => {
      driver.schema = undefined;
      const builder = builderThenable({ id: '1' });
      mockDb.upsert.mockReturnValue(builder);

      await driver.upsertWhere('user:5', 'email = "a@b.com"', {
        name: 'Alice',
        profile: 'profile:1',
      });

      const data = firstArg(builder.merge);
      // Fallback: all strings with record-like format coerced
      expect(data.name).toBe('Alice'); // no colon
      expect(data.profile).toBeInstanceOf(RecordId);
    });

    it('works with upsertWhere when table is not in schema', async () => {
      driver.schema = createMockSchema();
      const builder = builderThenable({ id: '1' });
      mockDb.upsert.mockReturnValue(builder);

      // unknown_table is not in schema → falls back to coerce-all
      await driver.upsertWhere('unknown_table:1', 'name = "test"', {
        field1: 'something:value',
        field2: 'plain',
      });

      const data = firstArg(builder.merge);
      expect(data.field1).toBeInstanceOf(RecordId);
      expect(data.field2).toBe('plain');
    });
  });

  // ============================================================================
  // 7. Integration: coercion through all CRUD methods
  // ============================================================================

  describe('coercion through all CRUD methods', () => {
    it('coerces through create with schema', async () => {
      driver.schema = createMockSchema();
      const builder = builderThenable([{ id: '1' }]);
      mockDb.create.mockReturnValue(builder);

      await driver.create('user', { profile: 'profile:1', name: 'Alice' });

      const data = firstArg(builder.content);
      expect(data.profile).toBeInstanceOf(RecordId);
      expect(data.name).toBe('Alice');
    });

    it('coerces through insert with schema', async () => {
      driver.schema = createMockSchema();
      mockDb.insert.mockReturnValue(thenableResolve([{ id: '1' }]));

      await driver.insert('user', { profile: 'profile:1', name: 'Alice' });

      const data = (mockDb.insert as any).mock.calls[0][1][0];
      expect(data.profile).toBeInstanceOf(RecordId);
      expect(data.name).toBe('Alice');
    });

    it('coerces through update with schema', async () => {
      driver.schema = createMockSchema();
      const builder = builderThenable([{ id: '1' }]);
      mockDb.update.mockReturnValue(builder);

      await driver.update('user:1', { profile: 'profile:1', name: 'Alice' });

      const data = firstArg(builder.merge);
      expect(data.profile).toBeInstanceOf(RecordId);
      expect(data.name).toBe('Alice');
    });

    it('coerces through upsert with schema', async () => {
      driver.schema = createMockSchema();
      const builder = builderThenable({ id: '1' });
      mockDb.upsert.mockReturnValue(builder);

      await driver.upsert('user:1', { profile: 'profile:1', name: 'Alice' });

      const data = firstArg(builder.merge);
      expect(data.profile).toBeInstanceOf(RecordId);
      expect(data.name).toBe('Alice');
    });
  });
});
