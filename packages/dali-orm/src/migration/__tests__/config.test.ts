import { safeParse } from 'valibot';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import {
  ConfigSchema,
  createConfigFile,
  defineConfig,
  loadConfig,
  processConfigObject,
} from '../config.js';

const { mockWriteFile } = vi.hoisted(() => ({
  mockWriteFile: vi.fn(() => Promise.resolve()),
}));

vi.mock('obug', () => ({
  createDebug: vi.fn(() => {
    const fn = vi.fn() as any;
    fn.extend = vi.fn(() => vi.fn());
    return fn;
  }),
}));

vi.mock('tsx/esm/api', () => ({
  register: vi.fn(() => vi.fn()),
}));

vi.mock('node:fs/promises', () => ({
  default: { writeFile: mockWriteFile },
  writeFile: mockWriteFile,
}));

const ORIG_ENV = process.env;

beforeEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIG_ENV };
});

const validConfig = {
  url: 'ws://localhost:10101',
  namespace: 'test',
  database: 'test',
  auth: { type: 'root' as const, username: 'root', password: 'root' },
  migrations: { dir: './migrations', table: '__migrations' },
  schema: { dir: './schema', pattern: '**/*.ts' },
  snapshots: { dir: './snapshots' },
  shadow: { namespace: 'shadow_ns', database: 'shadow_db' },
};

// ---------------------------------------------------------------------------
// ConfigSchema validation
// ---------------------------------------------------------------------------
describe('ConfigSchema', () => {
  it('validates a full config', () => {
    const result = safeParse(ConfigSchema, validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.url).toBe('ws://localhost:10101');
      expect(result.output.namespace).toBe('test');
      expect(result.output.database).toBe('test');
      expect(result.output.auth?.type).toBe('root');
      expect(result.output.migrations?.dir).toBe('./migrations');
      expect(result.output.migrations?.table).toBe('__migrations');
      expect(result.output.schema!.dir).toBe('./schema');
      expect(result.output.schema!.pattern).toBe('**/*.ts');
      expect(result.output.snapshots?.dir).toBe('./snapshots');
      expect(result.output.shadow?.namespace).toBe('shadow_ns');
      expect(result.output.shadow?.database).toBe('shadow_db');
    }
  });

  it('validates a minimal config (url, ns, db, schema only)', () => {
    const minimal = {
      url: 'ws://localhost:10101',
      namespace: 'test',
      database: 'test',
      schema: { dir: './schema', pattern: '**/*.ts' },
    };
    const result = safeParse(ConfigSchema, minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.auth).toBeUndefined();
      expect(result.output.migrations).toBeUndefined();
      expect(result.output.snapshots).toBeUndefined();
      expect(result.output.shadow).toBeUndefined();
    }
  });

  it('rejects missing required fields', () => {
    const result = safeParse(ConfigSchema, {});
    expect(result.success).toBe(false);
  });

  it('rejects invalid auth type', () => {
    const invalid = {
      ...validConfig,
      auth: { type: 'admin', username: 'root', password: 'root' },
    };
    const result = safeParse(ConfigSchema, invalid);
    expect(result.success).toBe(false);
  });

  it('allows optional fields to be omitted', () => {
    const result = safeParse(ConfigSchema, {
      url: 'ws://localhost:10101',
      namespace: 'ns',
      database: 'db',
      schema: { dir: './s', pattern: '*.ts' },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// defineConfig
// ---------------------------------------------------------------------------
describe('defineConfig', () => {
  it('returns parsed config for valid input', () => {
    const config = defineConfig(validConfig);
    expect(config.url).toBe('ws://localhost:10101');
    expect(config.auth?.username).toBe('root');
  });

  it('throws for invalid config', () => {
    expect(() => defineConfig({ url: 123 } as unknown as Partial<never>)).toThrow();
  });

  it('throws when required fields missing', () => {
    expect(() => defineConfig({} as unknown as Partial<never>)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// processConfigObject
// ---------------------------------------------------------------------------
describe('processConfigObject', () => {
  const cfgDir = '/project/config';
  const cfgFile = 'dali-orm.config.ts';
  const resolved = '/project/config/dali-orm.config.ts';

  it('throws for null', () => {
    expect(() => processConfigObject(null, cfgFile, cfgDir, resolved)).toThrow('must be an object');
  });

  it('throws for undefined', () => {
    expect(() => processConfigObject(undefined, cfgFile, cfgDir, resolved)).toThrow(
      'must be an object',
    );
  });

  it('throws for non-object', () => {
    expect(() => processConfigObject('string', cfgFile, cfgDir, resolved)).toThrow(
      'must be an object',
    );
  });

  it('parses valid config', () => {
    const result = processConfigObject(validConfig, cfgFile, cfgDir, resolved);
    expect(result.url).toBe('ws://localhost:10101');
    expect(result.schema!.dir).toBe('/project/config/schema');
  });

  it('resolves migrations.dir relative to config dir', () => {
    const config = {
      url: 'ws://localhost:10101',
      namespace: 'ns',
      database: 'db',
      migrations: { dir: './migrations', table: '__migrations' },
      schema: { dir: './schema', pattern: '*.ts' },
    };
    const result = processConfigObject(config, cfgFile, cfgDir, resolved);
    expect(result.migrations?.dir).toBe('/project/config/migrations');
  });

  it('resolves schema.dir relative to config dir', () => {
    const config = {
      url: 'ws://localhost:10101',
      namespace: 'ns',
      database: 'db',
      schema: { dir: './schemas', pattern: '*.ts' },
    };
    const result = processConfigObject(config, cfgFile, cfgDir, resolved);
    expect(result.schema!.dir).toBe('/project/config/schemas');
  });

  it('resolves snapshots.dir relative to config dir', () => {
    const config = {
      url: 'ws://localhost:10101',
      namespace: 'ns',
      database: 'db',
      schema: { dir: './s', pattern: '*.ts' },
      snapshots: { dir: './snaps' },
    };
    const result = processConfigObject(config, cfgFile, cfgDir, resolved);
    expect(result.snapshots?.dir).toBe('/project/config/snaps');
  });
});

// ---------------------------------------------------------------------------
// loadConfig
// ---------------------------------------------------------------------------
describe('loadConfig', () => {
  it('throws when no config file found', async () => {
    await expect(loadConfig()).rejects.toThrow('No config file found');
  });
});

// ---------------------------------------------------------------------------
// createConfigFile
// ---------------------------------------------------------------------------
describe('createConfigFile', () => {
  it('writes template content', async () => {
    await createConfigFile('tmp-test-config.js');
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [calledPath, content] = mockWriteFile.mock.calls[0] as unknown as [string, string];
    expect(calledPath).toContain('tmp-test-config.js');
    expect(content).toContain('defineConfig');
  });

  it('uses default path when none provided', async () => {
    mockWriteFile.mockClear();
    await createConfigFile();
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [calledPath] = mockWriteFile.mock.calls[0] as unknown as [string];
    expect(calledPath).toContain('dali-orm.config.js');
  });
});
