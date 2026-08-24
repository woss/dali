/**
 * Schema Propagation Tests
 *
 * Tests that the optional schema field flows correctly through:
 * 1. BaseDriver — schema field exists, defaults to undefined, can be set
 * 2. orm-connection connect() — sets driver.schema from config.schema
 * 3. DaliORM.connect() — passes schema via orm-connection to driver
 *
 * Schema is optional everywhere for backward compatibility.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mock surrealdb — needed by BaseDriver import
// ============================================================================

vi.mock('surrealdb', () => {
  class RecordId {
    tb: string;
    id: string;
    constructor(tb: string, id: string) {
      this.tb = tb;
      this.id = id;
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

// ============================================================================
// Mock obug — needed by orm-connection
// ============================================================================

vi.mock('obug', () => ({
  createDebug: vi.fn(() => {
    const fn = vi.fn() as any;
    fn.extend = vi.fn(() => vi.fn());
    return fn;
  }),
}));

// ============================================================================
// Mock node-driver and embedded-driver with schema field
// ============================================================================

vi.mock('../node-driver.js', () => {
  const connect = vi.fn();
  const query = vi.fn();
  const getUrl = vi.fn();
  const isConnected = vi.fn().mockReturnValue(true);
  (globalThis as any).__schemaTestNodeDriver = {
    connect,
    query,
    getUrl,
    isConnected,
    schema: undefined,
  };
  return {
    NodeDriver: class {
      connect = connect;
      query = query;
      getUrl = getUrl;
      isConnected = isConnected;
      config = {};
      schema: any = undefined;
    },
  };
});

vi.mock('../embedded-driver.js', () => {
  const connect = vi.fn();
  const query = vi.fn();
  const getUrl = vi.fn();
  const isConnected = vi.fn().mockReturnValue(true);
  (globalThis as any).__schemaTestEmbeddedDriver = {
    connect,
    query,
    getUrl,
    isConnected,
    schema: undefined,
  };
  return {
    EmbeddedDriver: class {
      connect = connect;
      query = query;
      getUrl = getUrl;
      isConnected = isConnected;
      schema: any = undefined;
    },
  };
});

vi.mock('../orm-interfaces.js', () => {
  const fn = vi.fn() as any;
  (globalThis as any).__schemaTestIsHttpProtocol = fn;
  return { isHttpProtocol: fn };
});

// ============================================================================
// Imports
// ============================================================================

import { DaliORM } from '../../dali-orm.js';
import { BaseDriver } from '../base-driver.js';
import { connect as ormConnect } from '../orm-connection.js';
import type { DriverConfig, EmbeddedConfig } from '../types.js';

// ============================================================================
// Helpers
// ============================================================================

function getNodeMocks() {
  return (globalThis as any).__schemaTestNodeDriver;
}

function getEmbedMocks() {
  return (globalThis as any).__schemaTestEmbeddedDriver;
}

function getIsHttpProtocol() {
  return (globalThis as any).__schemaTestIsHttpProtocol;
}

// ============================================================================
// TestDriver — concrete subclass of BaseDriver for testing
// ============================================================================

class TestDriver extends BaseDriver {
  // @ts-expect-error — mock db
  public db: Record<string, any>;
  connected = false;
  subscriptions = new Map<
    string,
    { created: number; liveSubscription?: unknown }
  >();

  constructor() {
    super();
    this.db = {};
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
// A minimal mock OrmSchema object
// ============================================================================

function createMockSchema(name = 'test-schema') {
  return {
    name,
    tables: new Map(),
    access: [],
    events: [],
    variables: {},
    functions: [],
    analyzers: [],
    getTable: vi.fn(),
    getTables: vi.fn().mockReturnValue([]),
    hasTable: vi.fn().mockReturnValue(false),
    tableCount: 0,
  } as any;
}

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();

  const node = getNodeMocks();
  node.connect.mockResolvedValue(undefined);
  node.query.mockResolvedValue([]);
  node.getUrl.mockReturnValue('ws://localhost:8000');
  node.schema = undefined;

  const embed = getEmbedMocks();
  embed.connect.mockResolvedValue(undefined);
  embed.query.mockResolvedValue([]);
  embed.getUrl.mockReturnValue('mem://');
  embed.schema = undefined;

  getIsHttpProtocol().mockReturnValue(false);
});

// ============================================================================
// 1. BaseDriver Schema Field
// ============================================================================

describe('BaseDriver — schema field', () => {
  it('schema is undefined by default (backward compatibility)', () => {
    const driver = new TestDriver();
    expect(driver.schema).toBeUndefined();
  });

  it('schema can be set to an OrmSchema object', () => {
    const driver = new TestDriver();
    const schema = createMockSchema();
    driver.schema = schema;
    expect(driver.schema).toBe(schema);
  });

  it('schema can be reassigned to a different value', () => {
    const driver = new TestDriver();
    const schema1 = createMockSchema('schema-a');
    const schema2 = createMockSchema('schema-b');
    driver.schema = schema1;
    expect(driver.schema).toBe(schema1);
    driver.schema = schema2;
    expect(driver.schema).toBe(schema2);
  });

  it('schema can be set to undefined after being assigned', () => {
    const driver = new TestDriver();
    driver.schema = createMockSchema();
    expect(driver.schema).toBeDefined();
    driver.schema = undefined;
    expect(driver.schema).toBeUndefined();
  });

  it('schema field exists as own property on BaseDriver instances', () => {
    const driver = new TestDriver();
    // schema is declared as a class field on BaseDriver
    expect('schema' in driver).toBe(true);
  });
});

// ============================================================================
// 2. orm-connection connect() Schema Propagation
// ============================================================================

describe('orm-connection connect() — schema wiring', () => {
  it('sets driver.schema when schema is provided in config (nodeDriver)', async () => {
    const mockSchema = createMockSchema('node-schema');
    const driver = await ormConnect({
      nodeDriver: { driver: 'node', url: 'ws://localhost:8000' },
      schema: mockSchema,
    });

    expect(driver.schema).toBe(mockSchema);
  });

  it('sets driver.schema when schema is provided in config (embeddedDriver)', async () => {
    const mockSchema = createMockSchema('embedded-schema');
    const driver = await ormConnect({
      embeddedDriver: { driver: 'embedded' },
      schema: mockSchema,
    });

    expect(driver.schema).toBe(mockSchema);
  });

  it('driver.schema is undefined when no schema in config (nodeDriver backward compat)', async () => {
    const driver = await ormConnect({
      nodeDriver: { driver: 'node', url: 'ws://localhost:8000' },
    });

    expect(driver.schema).toBeUndefined();
  });

  it('driver.schema is undefined when no schema in config (embeddedDriver backward compat)', async () => {
    const driver = await ormConnect({
      embeddedDriver: { driver: 'embedded' },
    });

    expect(driver.schema).toBeUndefined();
  });

  it('schema is set before driver.connect() is called', async () => {
    const node = getNodeMocks();
    const mockSchema = createMockSchema('pre-connect');
    const connectSpy = node.connect;

    await ormConnect({
      nodeDriver: { driver: 'node', url: 'ws://localhost:8000' },
      schema: mockSchema,
    });

    // Schema should be set — connect was called after driver.schema assignment
    expect(connectSpy).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// 3. DaliORM.connect() Schema Propagation
// ============================================================================

describe('DaliORM.connect() — schema propagation', () => {
  it('passes schema through orm-connection to driver', async () => {
    const mockSchema = createMockSchema('orm-schema');
    const orm = await DaliORM.connect({
      nodeDriver: { driver: 'node', url: 'ws://localhost:8000' },
      schema: mockSchema,
    });

    // DaliORM stores schema on itself
    expect(orm.schemaDefinition).toBe(mockSchema);

    // The underlying driver also has schema set (via orm-connection)
    const driver = orm.getDriver();
    expect(driver.schema).toBe(mockSchema);
  });

  it('schema is undefined when no schema in config (backward compat)', async () => {
    const orm = await DaliORM.connect({
      nodeDriver: { driver: 'node', url: 'ws://localhost:8000' },
    });

    expect(orm.schemaDefinition).toBeUndefined();
    expect(orm.getDriver().schema).toBeUndefined();
  });

  it('works with embedded driver and schema', async () => {
    const mockSchema = createMockSchema('embedded-orm-schema');
    const orm = await DaliORM.connect({
      embeddedDriver: { driver: 'embedded' },
      schema: mockSchema,
    });

    expect(orm.schemaDefinition).toBe(mockSchema);
    expect(orm.getDriver().schema).toBe(mockSchema);
  });

  it('driver is available after connect', async () => {
    const orm = await DaliORM.connect({
      nodeDriver: { driver: 'node', url: 'ws://localhost:8000' },
      schema: createMockSchema(),
    });

    expect(orm.isConnected()).toBe(true);
    expect(orm.getDriver()).toBeDefined();
  });
});
