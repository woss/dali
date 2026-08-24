import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventConfig, FunctionConfig } from '../../../sdk/schema.js';
import type { ColumnDefinition, TableDefinition } from '../../../sdk/table.js';
import type { SchemaSnapshot } from '../snapshot.js';
import { SnapshotManager } from '../snapshot.js';

// ---------------------------------------------------------------------------
// Mock setup — vi.hoisted required because vi.mock is hoisted to top
// ---------------------------------------------------------------------------
const { mockFiles, mockReadFile, mockWriteFile, mockMkdir, mockReaddir } = vi.hoisted(() => {
  const files = new Map<string, string>();

  const readFile = vi.fn(async (path: string) => {
    const content = files.get(path);
    if (content === undefined) {
      const err = new Error(`ENOENT: ${path}`) as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    }
    return content;
  });

  const writeFile = vi.fn(async (path: string, content: string) => {
    files.set(path, content);
  });

  const mkdir = vi.fn(async () => {});

  const readdir = vi.fn(async (dir: string) => {
    const prefix = dir.endsWith('/') ? dir : `${dir}/`;
    return Array.from(files.keys())
      .filter((p) => p.startsWith(prefix))
      .map((p) => p.slice(prefix.length));
  });

  return {
    mockFiles: files,
    mockReadFile: readFile,
    mockWriteFile: writeFile,
    mockMkdir: mkdir,
    mockReaddir: readdir,
  };
});

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  readdir: mockReaddir,
}));

vi.mock('obug', () => ({
  createDebug: vi.fn(() => {
    const fn = vi.fn() as any;
    fn.extend = vi.fn(() => vi.fn());
    return fn;
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const snapshotsDir = '/tmp/snapshots';

function createManager(): SnapshotManager {
  return new SnapshotManager(snapshotsDir);
}

function createSampleTable(name = 'user'): TableDefinition {
  const col: ColumnDefinition = {
    name: 'name',
    tableName: name,
    config: { type: 'string' as const },
  };
  return {
    name,
    columns: [col],
    config: { schema: 'full' as const, type: 'normal' as const },
  };
}

function createSampleSnapshot(version = '001', name = 'initial'): SchemaSnapshot {
  return {
    version,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    tables: [
      {
        name: 'user',
        columns: [
          {
            name: 'name',
            tableName: 'user',
            config: { type: 'string' as const },
          },
        ],
        config: {
          schema: 'full' as const,
          type: 'normal' as const,
        },
      },
    ],
    access: [],
    events: [],
    functions: [],
    analyzers: [],
  };
}

beforeEach(() => {
  mockFiles.clear();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getSnapshotPath
// ---------------------------------------------------------------------------
describe('getSnapshotPath', () => {
  it('returns path with version appended', () => {
    const manager = createManager();
    expect(manager.getSnapshotPath('001')).toBe('/tmp/snapshots/001.json');
  });

  it('returns correct path for version string', () => {
    const manager = createManager();
    expect(manager.getSnapshotPath('abc-def')).toBe('/tmp/snapshots/abc-def.json');
  });
});

// ---------------------------------------------------------------------------
// loadSnapshot
// ---------------------------------------------------------------------------
describe('loadSnapshot', () => {
  it('loads an existing snapshot by version', async () => {
    const manager = createManager();
    const snapshot = createSampleSnapshot('001', 'initial');
    mockFiles.set('/tmp/snapshots/001.json', JSON.stringify(snapshot));

    const result = await manager.loadSnapshot('001');

    expect(result).not.toBeNull();
    expect(result?.version).toBe('001');
    expect(result?.name).toBe('initial');
    expect(result?.tables).toHaveLength(1);
    expect(result?.tables[0].name).toBe('user');
  });

  it('returns null when snapshot file does not exist', async () => {
    const manager = createManager();

    const result = await manager.loadSnapshot('nonexistent');

    expect(result).toBeNull();
  });

  it('re-throws non-ENOENT errors', async () => {
    const manager = createManager();
    mockReadFile.mockRejectedValueOnce(new Error('Permission denied'));

    await expect(manager.loadSnapshot('001')).rejects.toThrow('Permission denied');
  });

  it('loads a snapshot by full path', async () => {
    const manager = createManager();
    const snapshot = createSampleSnapshot('002', 'second');
    mockFiles.set('/custom/path/snap.json', JSON.stringify(snapshot));

    const result = await manager.loadSnapshot('/custom/path/snap.json');

    expect(result).not.toBeNull();
    expect(result?.version).toBe('002');
  });
});

// ---------------------------------------------------------------------------
// saveSnapshot
// ---------------------------------------------------------------------------
describe('saveSnapshot', () => {
  it('creates directory and writes file', async () => {
    const manager = createManager();
    const snapshot = createSampleSnapshot('003', 'third');

    const path = await manager.saveSnapshot(snapshot);

    expect(path).toBe('/tmp/snapshots/003.json');
    expect(mockMkdir).toHaveBeenCalledWith('/tmp/snapshots', { recursive: true });
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/snapshots/003.json',
      expect.any(String),
      'utf-8',
    );
  });

  it('writes valid JSON content', async () => {
    const manager = createManager();
    const snapshot = createSampleSnapshot('004', 'fourth');

    await manager.saveSnapshot(snapshot);

    const writtenContent = mockWriteFile.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);
    expect(parsed.version).toBe('004');
    expect(parsed.name).toBe('fourth');
    expect(parsed.createdAt).toBeDefined();
  });

  it('returns the correct file path', async () => {
    const manager = createManager();
    const snapshot = createSampleSnapshot('005', 'fifth');

    const path = await manager.saveSnapshot(snapshot);

    expect(path).toBe('/tmp/snapshots/005.json');
  });
});

// ---------------------------------------------------------------------------
// getLatestSnapshotPath
// ---------------------------------------------------------------------------
describe('getLatestSnapshotPath', () => {
  it('finds latest snapshot by version sorting', async () => {
    const manager = createManager();
    mockFiles.set('/tmp/snapshots/001.json', '{}');
    mockFiles.set('/tmp/snapshots/002.json', '{}');
    mockFiles.set('/tmp/snapshots/003.json', '{}');

    const result = await manager.getLatestSnapshotPath();

    expect(result).toBe('/tmp/snapshots/003.json');
  });

  it('returns null when directory is empty', async () => {
    const manager = createManager();

    const result = await manager.getLatestSnapshotPath();

    expect(result).toBeNull();
  });

  it('returns null when readdir throws error', async () => {
    const manager = createManager();
    mockReaddir.mockRejectedValueOnce(new Error('EACCES'));

    const result = await manager.getLatestSnapshotPath();

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// loadLatestSnapshot
// ---------------------------------------------------------------------------
describe('loadLatestSnapshot', () => {
  it('loads the most recent snapshot', async () => {
    const manager = createManager();
    const snap1 = createSampleSnapshot('001', 'first');
    const snap2 = createSampleSnapshot('002', 'second');
    mockFiles.set('/tmp/snapshots/001.json', JSON.stringify(snap1));
    mockFiles.set('/tmp/snapshots/002.json', JSON.stringify(snap2));

    const result = await manager.loadLatestSnapshot();

    expect(result).not.toBeNull();
    expect(result?.version).toBe('002');
    expect(result?.name).toBe('second');
  });

  it('returns null when no snapshots exist', async () => {
    const manager = createManager();

    const result = await manager.loadLatestSnapshot();

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createSnapshot
// ---------------------------------------------------------------------------
describe('createSnapshot', () => {
  it('creates a valid snapshot with all fields', () => {
    const manager = createManager();
    const tables = [createSampleTable('user')];

    const snapshot = manager.createSnapshot(tables, '001', 'initial');

    expect(snapshot.version).toBe('001');
    expect(snapshot.name).toBe('initial');
    expect(snapshot.createdAt).toBeDefined();
    expect(snapshot.tables).toHaveLength(1);
    expect(snapshot.tables[0].name).toBe('user');
    expect(snapshot.access).toEqual([]);
    expect(snapshot.events).toEqual([]);
    expect(snapshot.functions).toEqual([]);
  });

  it('includes access, events, and functions when provided', () => {
    const manager = createManager();
    const tables = [createSampleTable('user')];
    const access = [
      {
        config: {
          name: 'my_access',
          type: 'RECORD',
          level: 'DATABASE',
          record: { signup: 'CREATE user SET email = $email', signin: 'SELECT * FROM user' },
          duration: { session: '12h' },
        },
      },
    ];
    const events: EventConfig[] = [
      {
        name: 'on_create',
        on: 'user',
        when: 'true',
        then: ['CREATE activity'],
      },
    ];
    const functions: FunctionConfig[] = [
      {
        name: 'fn::greet',
        args: ['$name'],
        body: 'RETURN "Hello " + $name',
      },
    ];

    const snapshot = manager.createSnapshot(
      tables,
      '002',
      'with_access',
      access,
      events,
      functions,
    );

    expect(snapshot.access).toHaveLength(1);
    expect(snapshot.access[0].name).toBe('my_access');
    expect(snapshot.access[0].type).toBe('RECORD');
    expect(snapshot.access[0].signup).toBe('CREATE user SET email = $email');
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0].name).toBe('on_create');
    expect(snapshot.events[0].what).toBe('user');
    expect(snapshot.functions).toHaveLength(1);
    expect(snapshot.functions[0].name).toBe('fn::greet');
  });

  it('creates an ISO timestamp for createdAt', () => {
    const manager = createManager();
    const tables = [createSampleTable('user')];

    const snapshot = manager.createSnapshot(tables, '003', 'timed');

    // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(snapshot.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('properly serializes version and name', () => {
    const manager = createManager();
    const tables = [createSampleTable('post')];

    const snapshot = manager.createSnapshot(tables, '010', 'add_posts');

    expect(snapshot.version).toBe('010');
    expect(snapshot.name).toBe('add_posts');
    expect(snapshot.tables[0].name).toBe('post');
  });
});

// ---------------------------------------------------------------------------
// restoreSnapshot
// ---------------------------------------------------------------------------
describe('restoreSnapshot', () => {
  it('restores tables from a snapshot', () => {
    const manager = createManager();
    const snapshot = createSampleSnapshot('001', 'initial');

    const tables = manager.restoreSnapshot(snapshot);

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('user');
    expect(tables[0].columns).toHaveLength(1);
    expect(tables[0].columns[0].name).toBe('name');
    expect(tables[0].config.schema).toBe('full');
    expect(tables[0].config.type).toBe('normal');
  });

  it('handles an empty snapshot (no tables)', () => {
    const manager = createManager();
    const snapshot: SchemaSnapshot = {
      version: '000',
      name: 'empty',
      createdAt: '2026-01-01T00:00:00.000Z',
      tables: [],
      access: [],
      events: [],
      functions: [],
      analyzers: [],
    };

    const tables = manager.restoreSnapshot(snapshot);

    expect(tables).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// restoreAccess
// ---------------------------------------------------------------------------
describe('restoreAccess', () => {
  it('returns access from snapshot', () => {
    const manager = createManager();
    const snapshot = createSampleSnapshot('001', 'initial');

    const access = manager.restoreAccess(snapshot);

    expect(access).toEqual([]);
  });

  it('returns empty array when access is not present', () => {
    const manager = createManager();
    const snapshot = {
      version: '001',
      name: 'test',
      createdAt: '2026-01-01T00:00:00.000Z',
      tables: [],
      events: [],
      functions: [],
    } as unknown as SchemaSnapshot;

    const access = manager.restoreAccess(snapshot);

    expect(access).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createSnapshot + restoreSnapshot roundtrip
// ---------------------------------------------------------------------------
describe('create + restore roundtrip', () => {
  it('preserves table data through serialization roundtrip', () => {
    const manager = createManager();
    const tables: TableDefinition[] = [
      {
        name: 'user',
        columns: [
          {
            name: 'email',
            tableName: 'user',
            config: { type: 'string', optional: true },
          },
          {
            name: 'score',
            tableName: 'user',
            config: { type: 'int', default: '0' },
          },
        ],
        config: {
          schema: 'full',
          type: 'normal',
          permissions: { select: 'true' },
        },
      },
    ];

    const snapshot = manager.createSnapshot(tables, '020', 'roundtrip');
    const restored = manager.restoreSnapshot(snapshot);

    expect(restored).toHaveLength(1);
    expect(restored[0].name).toBe('user');
    expect(restored[0].columns).toHaveLength(2);
    expect(restored[0].columns[0].name).toBe('email');
    expect(restored[0].columns[0].config.optional).toBe(true);
    expect(restored[0].columns[1].name).toBe('score');
    expect(restored[0].columns[1].config.default).toBe('0');
    expect(restored[0].config.permissions?.select).toBe('true');
  });

  it('persists access definitions roundtrip', () => {
    const manager = createManager();
    const tables = [createSampleTable('user')];
    const access = [
      {
        config: {
          name: 'account_access',
          type: 'RECORD',
          level: 'DATABASE',
          record: { signup: 'CREATE user', signin: 'SELECT * FROM user' },
          duration: { session: '24h' },
        },
      },
    ];

    const snapshotWithAccess = manager.createSnapshot(tables, '030', 'with_access', access);
    const restoredAccess = manager.restoreAccess(snapshotWithAccess);

    expect(restoredAccess).toHaveLength(1);
    expect(restoredAccess[0].name).toBe('account_access');
    expect(restoredAccess[0].type).toBe('RECORD');
    expect(restoredAccess[0].duration).toBe('24h');
  });

  it('serializes string-form duration correctly', () => {
    const manager = createManager();
    const tables = [createSampleTable('user')];
    const access = [
      {
        config: {
          name: 'str_duration',
          type: 'RECORD',
          level: 'DATABASE',
          duration: '12h',
        },
      },
    ];
    const snapshot = manager.createSnapshot(tables, '010', 'str_duration', access);
    expect(snapshot.access).toHaveLength(1);
    expect(snapshot.access[0].duration).toBe('12h');
  });
});
