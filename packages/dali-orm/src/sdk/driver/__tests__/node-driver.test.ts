/**
 * Comprehensive test suite for NodeDriver
 *
 * Tests every method, guard clause, error path, and branch.
 * Uses mocked Surreal SDK and obug modules.
 */

import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

// ============================================================================
// Helper: thenable objects that mimic Surreal SDK query/promise types
// ============================================================================

/** Creates an object with .then() and .catch() that resolves to `value` */
function thenableResolve<T>(value: T) {
  const p = Promise.resolve(value);
  return {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
  };
}

/** Creates an object with .then() and .catch() that rejects with `error` */
function thenableReject(error: Error) {
  const p = Promise.reject(error);
  p.catch(() => {}); // Suppress unhandled rejection warning
  return {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
  };
}

// ============================================================================
// Mock surrealdb module — hoisted by vi.mock, replaces SDK classes
// ============================================================================

const mockConnect = vi.fn();
const mockSignin = vi.fn();
const mockSignup = vi.fn();
const mockAuthenticate = vi.fn();
const mockUse = vi.fn();
const mockQuery = vi.fn();
let mockReadyValue: Promise<void> = Promise.resolve();

vi.mock('surrealdb', () => {
  class Surreal {
    connect = mockConnect;
    signin = mockSignin;
    signup = mockSignup;
    authenticate = mockAuthenticate;
    use = mockUse;
    query = mockQuery;
    get ready() {
      return mockReadyValue;
    }
  }
  return {
    Surreal,
    createRemoteEngines: vi.fn(() => ({})),
    RootAuth: class {},
    NamespaceAuth: class {},
    DatabaseAuth: class {},
    AccessRecordAuth: class {},
    AnyAuth: class {},
  };
});

// ============================================================================
// Mock obug (debug logging)
// ============================================================================

vi.mock('obug', () => ({
  createDebug: vi.fn(() => {
    const fn = vi.fn() as any;
    fn.extend = vi.fn(() => vi.fn());
    return fn;
  }),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import type { SurrealClientFactory } from '../node-driver.js';
import { createSurrealClient, NodeDriver } from '../node-driver.js';

// ============================================================================
// Save original env
// ============================================================================

const ORIG_ENV = process.env;

// ============================================================================
// createSurrealClient
// ============================================================================

describe('createSurrealClient', () => {
  it('returns a Surreal instance', () => {
    const client = createSurrealClient();
    expect(client).toBeDefined();
    expect(typeof client.connect).toBe('function');
  });

  it('creates an independent instance each call', () => {
    const a = createSurrealClient();
    const b = createSurrealClient();
    expect(a).not.toBe(b);
  });
});

// ============================================================================
// constructor
// ============================================================================

describe('constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockReturnValue(thenableResolve(undefined));
    mockSignin.mockReturnValue(thenableResolve({ access: 'token123' }));
    mockSignup.mockReturnValue(thenableResolve({ access: 'token456' }));
    mockAuthenticate.mockReturnValue(thenableResolve({ access: 'auth_token' }));
    mockUse.mockReturnValue(thenableResolve(undefined));
    mockReadyValue = Promise.resolve();
    process.env = { ...ORIG_ENV };
    delete process.env.SURREALDB_URL;
    delete process.env.SURREALDB_NAMESPACE;
    delete process.env.SURREALDB_DATABASE;
    delete process.env.SURREALDB_USER;
    delete process.env.SURREALDB_PASS;
  });

  it('creates an instance with a valid URL', () => {
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    expect(driver).toBeInstanceOf(NodeDriver);
    expect(driver.getUrl()).toBe('ws://localhost:8000');
  });

  it('uses SURREALDB_URL from env or DEFAULT_URL when no URL in config', () => {
    process.env.SURREALDB_URL = 'ws://surrealdb-test:8000';
    const driver = new NodeDriver({ driver: 'node' });
    expect(driver.getUrl()).toBe('ws://surrealdb-test:8000');
    delete process.env.SURREALDB_URL;
  });

  it('throws when URL is not parseable', () => {
    expect(() => new NodeDriver({ driver: 'node', url: 'not-a-valid-url' })).toThrow(
      'Invalid SURREALDB_URL',
    );
  });

  it('sets auth from env when SURREALDB_USER and SURREALDB_PASS are set', () => {
    process.env.SURREALDB_USER = 'envuser';
    process.env.SURREALDB_PASS = 'envpass';
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    expect(driver.config.auth).toEqual({
      type: 'root',
      username: 'envuser',
      password: 'envpass',
    });
  });

  it('uses env SURREALDB_NAMESPACE and SURREALDB_DATABASE as defaults', () => {
    process.env.SURREALDB_NAMESPACE = 'envns';
    process.env.SURREALDB_DATABASE = 'envdb';
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    expect(driver.config.namespace).toBe('envns');
    expect(driver.config.database).toBe('envdb');
  });

  it('prefers config values over env vars', () => {
    process.env.SURREALDB_NAMESPACE = 'envns';
    process.env.SURREALDB_DATABASE = 'envdb';
    process.env.SURREALDB_USER = 'envuser';
    process.env.SURREALDB_PASS = 'envpass';
    const driver = new NodeDriver({
      driver: 'node',
      url: 'ws://localhost:8000',
      namespace: 'configns',
      database: 'configdb',
      auth: { type: 'root', username: 'configuser', password: 'configpass' },
    });
    expect(driver.config.namespace).toBe('configns');
    expect(driver.config.database).toBe('configdb');
    expect(driver.config.auth).toEqual({
      type: 'root',
      username: 'configuser',
      password: 'configpass',
    });
  });

  it('accepts a custom clientFactory', () => {
    const customDb = {
      connect: vi.fn(),
      signin: vi.fn(),
      signup: vi.fn(),
      authenticate: vi.fn(),
      use: vi.fn(),
      query: vi.fn(),
      get ready() {
        return Promise.resolve();
      },
    };
    const factory: SurrealClientFactory = () => customDb as never;
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' }, factory);
    // Accessing the private db field via type cast for test verification
    expect((driver as unknown as { db: unknown }).db).toBe(customDb);
  });

  it('sets debug flag when provided in config', () => {
    const driver = new NodeDriver({
      driver: 'node',
      url: 'ws://localhost:8000',
      debug: true,
    });
    expect(driver.config.debug).toBe(true);
  });

  it('sets auth to undefined when no auth in config or env', () => {
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    expect(driver.config.auth).toBeUndefined();
  });
});

// ============================================================================
// config getter
// ============================================================================

describe('config getter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockReturnValue(thenableResolve(undefined));
    mockSignin.mockReturnValue(thenableResolve({ access: 'token123' }));
    mockSignup.mockReturnValue(thenableResolve({ access: 'token456' }));
    mockAuthenticate.mockReturnValue(thenableResolve({ access: 'auth_token' }));
    mockUse.mockReturnValue(thenableResolve(undefined));
    mockReadyValue = Promise.resolve();
    process.env = { ...ORIG_ENV };
    delete process.env.SURREALDB_URL;
    delete process.env.SURREALDB_NAMESPACE;
    delete process.env.SURREALDB_DATABASE;
    delete process.env.SURREALDB_USER;
    delete process.env.SURREALDB_PASS;
  });

  it('returns the configuration object', () => {
    const driver = new NodeDriver({
      driver: 'node',
      url: 'ws://localhost:8000',
      namespace: 'myns',
      database: 'mydb',
      auth: { type: 'root', username: 'root', password: 'root' },
      debug: true,
    });
    const cfg = driver.config;
    expect(cfg.driver).toBe('node');
    expect(cfg.url).toBe('ws://localhost:8000');
    expect(cfg.namespace).toBe('myns');
    expect(cfg.database).toBe('mydb');
    expect(cfg.auth).toEqual({ type: 'root', username: 'root', password: 'root' });
    expect(cfg.debug).toBe(true);
  });
});

// ============================================================================
// getToken
// ============================================================================

describe('getToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockReturnValue(thenableResolve(undefined));
    mockSignin.mockReturnValue(thenableResolve({ access: 'token123' }));
    mockSignup.mockReturnValue(thenableResolve({ access: 'token456' }));
    mockAuthenticate.mockReturnValue(thenableResolve({ access: 'auth_token' }));
    mockUse.mockReturnValue(thenableResolve(undefined));
    mockReadyValue = Promise.resolve();
    process.env = { ...ORIG_ENV };
    delete process.env.SURREALDB_URL;
    delete process.env.SURREALDB_NAMESPACE;
    delete process.env.SURREALDB_DATABASE;
    delete process.env.SURREALDB_USER;
    delete process.env.SURREALDB_PASS;
  });

  it('returns null before any signin', () => {
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    expect(driver.getToken()).toBeNull();
  });

  it('returns the access token after signin via connect', async () => {
    const driver = new NodeDriver({
      driver: 'node',
      url: 'ws://localhost:8000',
      auth: { type: 'root', username: 'root', password: 'root' },
    });
    await driver.connect();
    expect(driver.getToken()).toBe('token123');
  });
});

// ============================================================================
// getUrl
// ============================================================================

describe('getUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockReturnValue(thenableResolve(undefined));
    mockSignin.mockReturnValue(thenableResolve({ access: 'token123' }));
    mockSignup.mockReturnValue(thenableResolve({ access: 'token456' }));
    mockAuthenticate.mockReturnValue(thenableResolve({ access: 'auth_token' }));
    mockUse.mockReturnValue(thenableResolve(undefined));
    mockReadyValue = Promise.resolve();
    process.env = { ...ORIG_ENV };
    delete process.env.SURREALDB_URL;
    delete process.env.SURREALDB_NAMESPACE;
    delete process.env.SURREALDB_DATABASE;
    delete process.env.SURREALDB_USER;
    delete process.env.SURREALDB_PASS;
  });

  it('returns the configured URL', () => {
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    expect(driver.getUrl()).toBe('ws://localhost:8000');
  });
});

// ============================================================================
// connect
// ============================================================================

describe('connect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockReturnValue(thenableResolve(undefined));
    mockSignin.mockReturnValue(thenableResolve({ access: 'token123' }));
    mockSignup.mockReturnValue(thenableResolve({ access: 'token456' }));
    mockAuthenticate.mockReturnValue(thenableResolve({ access: 'auth_token' }));
    mockUse.mockReturnValue(thenableResolve(undefined));
    mockReadyValue = Promise.resolve();
    process.env = { ...ORIG_ENV };
    delete process.env.SURREALDB_URL;
    delete process.env.SURREALDB_NAMESPACE;
    delete process.env.SURREALDB_DATABASE;
    delete process.env.SURREALDB_USER;
    delete process.env.SURREALDB_PASS;
  });

  it('returns early if already connected', async () => {
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    // Set connected to true manually
    Object.defineProperty(driver, 'connected', { value: true, writable: true });
    await driver.connect();
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('signs in first then uses namespace/database for root auth', async () => {
    const driver = new NodeDriver({
      driver: 'node',
      url: 'ws://localhost:8000',
      auth: { type: 'root', username: 'root', password: 'root' },
    });
    await driver.connect();

    expect(mockSignin).toHaveBeenCalledTimes(1);
    expect(mockUse).toHaveBeenCalledTimes(1);

    const signinCallOrder = mockSignin.mock.invocationCallOrder[0];
    const useCallOrder = mockUse.mock.invocationCallOrder[0];
    expect(signinCallOrder).toBeLessThan(useCallOrder);
  });

  it('signs in first then uses namespace/database for namespace auth', async () => {
    const driver = new NodeDriver({
      driver: 'node',
      url: 'ws://localhost:8000',
      auth: {
        type: 'namespace',
        username: 'user',
        password: 'pass',
        namespace: 'ns',
      },
    });
    await driver.connect();

    expect(mockSignin).toHaveBeenCalledTimes(1);
    expect(mockUse).toHaveBeenCalledTimes(1);

    const signinCallOrder = mockSignin.mock.invocationCallOrder[0];
    const useCallOrder = mockUse.mock.invocationCallOrder[0];
    expect(signinCallOrder).toBeLessThan(useCallOrder);
  });

  it('uses namespace/database first then signs in for database auth', async () => {
    const driver = new NodeDriver({
      driver: 'node',
      url: 'ws://localhost:8000',
      auth: {
        type: 'database',
        username: 'user',
        password: 'pass',
        namespace: 'ns',
        database: 'db',
      },
    });
    await driver.connect();

    expect(mockUse).toHaveBeenCalledTimes(1);
    expect(mockSignin).toHaveBeenCalledTimes(1);

    const useCallOrder = mockUse.mock.invocationCallOrder[0];
    const signinCallOrder = mockSignin.mock.invocationCallOrder[0];
    expect(useCallOrder).toBeLessThan(signinCallOrder);
  });

  it('uses namespace/database first then signs in for record auth', async () => {
    const driver = new NodeDriver({
      driver: 'node',
      url: 'ws://localhost:8000',
      auth: {
        type: 'record',
        namespace: 'ns',
        database: 'db',
        access: 'my_access',
      },
    });
    await driver.connect();

    expect(mockUse).toHaveBeenCalledTimes(1);
    expect(mockSignin).toHaveBeenCalledTimes(1);

    const useCallOrder = mockUse.mock.invocationCallOrder[0];
    const signinCallOrder = mockSignin.mock.invocationCallOrder[0];
    expect(useCallOrder).toBeLessThan(signinCallOrder);
  });

  it('adds /rpc suffix to ws:// URLs', async () => {
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    await driver.connect();
    expect(mockConnect).toHaveBeenCalledWith('ws://localhost:8000/rpc');
  });

  it('adds /rpc suffix to wss:// URLs', async () => {
    const driver = new NodeDriver({ driver: 'node', url: 'wss://localhost:8000' });
    await driver.connect();
    expect(mockConnect).toHaveBeenCalledWith('wss://localhost:8000/rpc');
  });

  it('does NOT add /rpc to http:// URLs', async () => {
    const driver = new NodeDriver({ driver: 'node', url: 'http://localhost:8000' });
    await driver.connect();
    expect(mockConnect).toHaveBeenCalledWith('http://localhost:8000');
  });

  it('does NOT add /rpc if already present', async () => {
    const driver = new NodeDriver({
      driver: 'node',
      url: 'ws://localhost:8000/rpc',
    });
    await driver.connect();
    expect(mockConnect).toHaveBeenCalledWith('ws://localhost:8000/rpc');
  });

  it('handles URL with trailing slash before adding /rpc', async () => {
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000/' });
    await driver.connect();
    expect(mockConnect).toHaveBeenCalledWith('ws://localhost:8000/rpc');
  });

  it('wraps connection errors in a descriptive message', async () => {
    mockConnect.mockReturnValue(thenableReject(new Error('connection refused')));
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    await expect(driver.connect()).rejects.toThrow(
      'Failed to connect to SurrealDB at ws://localhost:8000: connection refused',
    );
  });

  it('sets connected to false on connection error', async () => {
    mockConnect.mockReturnValue(thenableReject(new Error('connection refused')));
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    try {
      await driver.connect();
    } catch {
      // Expected
    }
    expect(driver.isConnected()).toBe(false);
  });

  it('skips signin when no auth is provided', async () => {
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    await driver.connect();
    expect(mockSignin).not.toHaveBeenCalled();
    expect(mockUse).toHaveBeenCalledWith({
      namespace: driver.config.namespace,
      database: driver.config.database,
    });
  });
});

// ============================================================================
// signin
// ============================================================================

describe('signin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockReturnValue(thenableResolve(undefined));
    mockSignin.mockReturnValue(thenableResolve({ access: 'token123' }));
    mockSignup.mockReturnValue(thenableResolve({ access: 'token456' }));
    mockAuthenticate.mockReturnValue(thenableResolve({ access: 'auth_token' }));
    mockUse.mockReturnValue(thenableResolve(undefined));
    mockReadyValue = Promise.resolve();
    process.env = { ...ORIG_ENV };
    delete process.env.SURREALDB_URL;
    delete process.env.SURREALDB_NAMESPACE;
    delete process.env.SURREALDB_DATABASE;
    delete process.env.SURREALDB_USER;
    delete process.env.SURREALDB_PASS;
  });

  it('throws if not connected', async () => {
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    await expect(
      driver.signin({ type: 'root', username: 'root', password: 'root' }),
    ).rejects.toThrow('Not connected to SurrealDB');
  });

  it('returns the access token on success', async () => {
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    // Connect first to set connected state
    await driver.connect();
    // Reset signin mock calls from connect phase
    mockSignin.mockClear();
    mockSignin.mockReturnValue(thenableResolve({ access: 'custom_token' }));

    const token = await driver.signin({
      type: 'root',
      username: 'root',
      password: 'root',
    });
    expect(token).toBe('custom_token');
  });

  it('stores the access token internally', async () => {
    const driver = new NodeDriver({
      driver: 'node',
      url: 'ws://localhost:8000',
      auth: { type: 'root', username: 'root', password: 'root' },
    });
    await driver.connect();
    expect(driver.getToken()).toBe('token123');
  });
});

// ============================================================================
// signup
// ============================================================================

describe('signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockReturnValue(thenableResolve(undefined));
    mockSignin.mockReturnValue(thenableResolve({ access: 'token123' }));
    mockSignup.mockReturnValue(thenableResolve({ access: 'token456' }));
    mockAuthenticate.mockReturnValue(thenableResolve({ access: 'auth_token' }));
    mockUse.mockReturnValue(thenableResolve(undefined));
    mockReadyValue = Promise.resolve();
    process.env = { ...ORIG_ENV };
    delete process.env.SURREALDB_URL;
    delete process.env.SURREALDB_NAMESPACE;
    delete process.env.SURREALDB_DATABASE;
    delete process.env.SURREALDB_USER;
    delete process.env.SURREALDB_PASS;
  });

  it('throws if not connected', async () => {
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    await expect(driver.signup({} as never)).rejects.toThrow('Not connected to SurrealDB');
  });

  it('returns the access token on success', async () => {
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    await driver.connect();

    // signup calls buildSigninObject internally, which expects a type field
    const token = await driver.signup({
      type: 'record',
      namespace: 'test',
      database: 'test',
      access: 'my_access',
      variables: { email: 'test@test.com', pass: 'password' },
    } as never);
    expect(token).toBe('token456');
  });
});

// ============================================================================
// authenticate
// ============================================================================

describe('authenticate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockReturnValue(thenableResolve(undefined));
    mockSignin.mockReturnValue(thenableResolve({ access: 'token123' }));
    mockSignup.mockReturnValue(thenableResolve({ access: 'token456' }));
    mockAuthenticate.mockReturnValue(thenableResolve({ access: 'auth_token' }));
    mockUse.mockReturnValue(thenableResolve(undefined));
    mockReadyValue = Promise.resolve();
    process.env = { ...ORIG_ENV };
    delete process.env.SURREALDB_URL;
    delete process.env.SURREALDB_NAMESPACE;
    delete process.env.SURREALDB_DATABASE;
    delete process.env.SURREALDB_USER;
    delete process.env.SURREALDB_PASS;
  });

  it('throws if not connected', async () => {
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    await expect(driver.authenticate('some_token')).rejects.toThrow('Not connected to SurrealDB');
  });

  it('returns the auth result on success', async () => {
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    await driver.connect();

    mockAuthenticate.mockClear();
    mockAuthenticate.mockReturnValue(
      thenableResolve({ access: 'my_access_token', refresh: 'my_refresh_token' }),
    );

    const result = await driver.authenticate('my_access_token');
    expect(result.access).toBe('my_access_token');
    expect(result.refresh).toBe('my_refresh_token');
  });

  it('wraps authentication errors', async () => {
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    await driver.connect();

    mockAuthenticate.mockClear();
    mockAuthenticate.mockReturnValue(thenableReject(new Error('invalid token')));

    await expect(driver.authenticate('bad_token')).rejects.toThrow(
      'Authentication failed: invalid token',
    );
  });
});

// ============================================================================
// buildSigninObject (private, tested via signin)
// ============================================================================

describe('buildSigninObject (via signin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockReturnValue(thenableResolve(undefined));
    mockSignin.mockReturnValue(thenableResolve({ access: 'token123' }));
    mockSignup.mockReturnValue(thenableResolve({ access: 'token456' }));
    mockAuthenticate.mockReturnValue(thenableResolve({ access: 'auth_token' }));
    mockUse.mockReturnValue(thenableResolve(undefined));
    mockReadyValue = Promise.resolve();
    process.env = { ...ORIG_ENV };
    delete process.env.SURREALDB_URL;
    delete process.env.SURREALDB_NAMESPACE;
    delete process.env.SURREALDB_DATABASE;
    delete process.env.SURREALDB_USER;
    delete process.env.SURREALDB_PASS;
  });

  it('builds root auth object', async () => {
    const driver = new NodeDriver({
      driver: 'node',
      url: 'ws://localhost:8000',
      auth: { type: 'root', username: 'root', password: 'root' },
    });
    await driver.connect();
    // mockSignin called during connect with the built object
    const signinArg = mockSignin.mock.calls[0][0];
    expect(signinArg).toEqual({
      username: 'root',
      password: 'root',
    });
  });

  it('builds namespace auth object', async () => {
    const driver = new NodeDriver({
      driver: 'node',
      url: 'ws://localhost:8000',
      auth: {
        type: 'namespace',
        username: 'ns_user',
        password: 'ns_pass',
        namespace: 'ns',
      },
    });
    await driver.connect();
    const signinArg = mockSignin.mock.calls[0][0];
    expect(signinArg).toEqual({
      namespace: 'ns',
      username: 'ns_user',
      password: 'ns_pass',
    });
  });

  it('builds database auth object', async () => {
    const driver = new NodeDriver({
      driver: 'node',
      url: 'ws://localhost:8000',
      auth: {
        type: 'database',
        username: 'db_user',
        password: 'db_pass',
        namespace: 'ns',
        database: 'db',
      },
    });
    await driver.connect();
    const signinArg = mockSignin.mock.calls[0][0];
    expect(signinArg).toEqual({
      namespace: 'ns',
      database: 'db',
      username: 'db_user',
      password: 'db_pass',
    });
  });

  it('builds record auth object', async () => {
    const driver = new NodeDriver({
      driver: 'node',
      url: 'ws://localhost:8000',
      auth: {
        type: 'record',
        namespace: 'ns',
        database: 'db',
        access: 'my_access',
        variables: { email: 'test@test.com' },
      },
    });
    await driver.connect();
    const signinArg = mockSignin.mock.calls[0][0];
    expect(signinArg).toEqual({
      namespace: 'ns',
      database: 'db',
      access: 'my_access',
      variables: { email: 'test@test.com' },
    });
  });

  it('throws for unknown auth type', async () => {
    const driver = new NodeDriver({ driver: 'node', url: 'ws://localhost:8000' });
    await driver.connect();

    // Direct call to signin with unknown auth type
    await expect(driver.signin({ type: 'unknown_type' } as never)).rejects.toThrow(
      'Unknown auth type: unknown_type',
    );
  });
});
